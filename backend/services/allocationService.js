const axios = require('axios');

const PYTHON_TIMEOUT_MS = 120000; // 2 minutes per request
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 8000; // 8 seconds between retries (let Render wake up)

/**
 * Wakes up the Python service by hitting /health.
 * Render free tier spins down after inactivity — this gives it time to boot.
 */
const wakeUpPythonService = async (pythonBackendUrl) => {
    console.log('[AllocationService] Pinging Python service to wake it up...');
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            await axios.get(`${pythonBackendUrl}/health`, { timeout: 30000 });
            console.log('[AllocationService] Python service is awake ✓');
            return true;
        } catch (err) {
            const status = err.response?.status;
            console.warn(`[AllocationService] Wake-up ping attempt ${i + 1}/${MAX_RETRIES} failed (${status || err.message}). Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            if (i < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            }
        }
    }
    throw new Error('Python allocation service is unavailable after multiple wake-up attempts. Please try again in 30–60 seconds (Render free tier cold start).');
};

/**
 * Runs the ML allocation algorithm on the Python FastAPI service.
 * Automatically handles Render cold-start delays with retry logic.
 */
const runPythonAllocation = async (profiles) => {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

    // Step 1: Wake the service up first
    await wakeUpPythonService(pythonBackendUrl);

    // Step 2: Run allocation with retry on transient errors
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[AllocationService] Sending ${profiles.length} profiles to Python (attempt ${attempt})...`);
            const response = await axios.post(
                `${pythonBackendUrl}/api/allocate`,
                profiles,
                { timeout: PYTHON_TIMEOUT_MS }
            );
            console.log(`[AllocationService] Allocation complete. Rooms: ${response.data?.allocations?.length ?? 0}, Unassigned: ${response.data?.unassigned_ids?.length ?? 0}`);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            lastError = error;

            // Only retry on 502/503/504 (gateway errors) or ECONNRESET
            const isRetryable = !status || status === 502 || status === 503 || status === 504;
            
            if (isRetryable && attempt < MAX_RETRIES) {
                console.warn(`[AllocationService] Attempt ${attempt} got ${status || error.code}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            } else {
                break;
            }
        }
    }

    console.error('[AllocationService] All attempts failed:', lastError.response?.data || lastError.message);
    throw new Error(`Failed to run allocation algorithm: ${lastError.response?.data?.detail || lastError.message}`);
};

module.exports = {
    runPythonAllocation,
    wakeUpPythonService,
};
