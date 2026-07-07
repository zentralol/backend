module.exports = {
    baseUrl: (process.env.ML_API_BASE_URL || '').replace(/\/$/, ''),
    timeoutMs: Number(process.env.ML_API_TIMEOUT_MS) || 5000
};
