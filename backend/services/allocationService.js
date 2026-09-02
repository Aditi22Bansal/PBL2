const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const USE_REST_ALLOCATION = process.env.USE_REST_ALLOCATION === 'true';

const runRelaxedPythonAllocation = async (profiles, config = null) => {
    return runPythonAllocation(profiles, config);
};

// Dispatcher: routes to the REST microservice or the legacy subprocess,
// depending on USE_REST_ALLOCATION. Both paths accept/return the identical
// schema, so callers (adminController.js) never need to know which is active.
const runPythonAllocation = async (profiles, config = null) => {
    if (USE_REST_ALLOCATION) {
        return runPythonAllocationViaHTTP(profiles, config);
    }
    return runPythonAllocationViaSubprocess(profiles, config);
};

// --- REST path: calls the FastAPI microservice (POST /allocate/v2) over HTTP ---
const runPythonAllocationViaHTTP = async (profiles, config = null) => {
    const payload = { profiles };
    if (config) {
        payload.config = config;
    }

    try {
        const response = await axios.post(`${PYTHON_SERVICE_URL}/allocate/v2`, payload);
        const result = response.data;
        if (result.error) {
            throw new Error(result.error);
        }
        return result;
    } catch (err) {
        if (err.response) {
            // FastAPI HTTPException surfaces as { detail: "..." }
            const detail = err.response.data && err.response.data.detail;
            throw new Error(`Allocation service returned ${err.response.status}: ${detail || err.message}`);
        }
        throw err;
    }
};

// --- Legacy path: spawns executor.py as a child process (stdin/stdout JSON) ---
// Kept as a fallback behind USE_REST_ALLOCATION until the REST path is proven solid.
const runPythonAllocationViaSubprocess = async (profiles, config = null) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '..', 'ml_engine', 'executor.py');
        
        // Spawn python process
        // Depending on environment (Windows vs Linux), it might be 'python' or 'python3' or 'py'
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
        
        const pythonProcess = spawn(pythonCommand, [scriptPath]);
        
        let stdoutData = '';
        let stderrData = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python process exited with code ${code}`);
                console.error(`Stderr: ${stderrData}`);
                return reject(new Error(`Failed to run allocation algorithm: ${stderrData}`));
            }
            
            try {
                // The ML model prints evaluation metrics (text) followed by the JSON string on the last line.
                // We split the output and strictly parse only the final line to avoid syntax errors.
                const lines = stdoutData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                
                const result = JSON.parse(lastLine);
                if (result.error) {
                    return reject(new Error(result.error));
                }
                resolve(result);
            } catch (err) {
                console.error('Failed to parse python stdout:', stdoutData);
                reject(new Error('Invalid output format from ML engine'));
            }
        });
        
        // Send JSON data to python stdin
        let inputPayload = profiles;
        if (config) {
            inputPayload = {
                profiles: profiles,
                config: config
            };
        }
        pythonProcess.stdin.write(JSON.stringify(inputPayload));
        pythonProcess.stdin.end();
    });
};

module.exports = {
    runPythonAllocation,
    runRelaxedPythonAllocation
};
