const { spawn } = require('child_process');
const path = require('path');

const runPythonAllocation = async (profiles) => {
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
        pythonProcess.stdin.write(JSON.stringify(profiles));
        pythonProcess.stdin.end();
    });
};

module.exports = {
    runPythonAllocation
};
