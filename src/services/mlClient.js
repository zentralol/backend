const mlConfig = require('../config/ml');
const { isFutureTime } = require('../utils/validation');

function getMlConfig() {
    return {
        baseUrl: (process.env.ML_API_BASE_URL || mlConfig.baseUrl || '').replace(/\/$/, ''),
        timeoutMs: Number(process.env.ML_API_TIMEOUT_MS) || mlConfig.timeoutMs || 5000
    };
}

function isMlConfigured() {
    return Boolean(getMlConfig().baseUrl);
}

async function callMlPrediction(lat, lng, targetTime) {
    const config = getMlConfig();
    if (!config.baseUrl) return null;

    const endpoint = isFutureTime(targetTime) ? '/predict/future' : '/predict/crowd';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
        const response = await fetch(`${config.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat,
                lon: lng,
                when: targetTime
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`ML API returned ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    isMlConfigured,
    callMlPrediction
};
