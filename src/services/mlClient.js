const mlConfig = require('../config/ml');
const { isFutureTime } = require('../utils/validation');

function isMlConfigured() {
    return Boolean(mlConfig.baseUrl);
}

async function callMlPrediction(lat, lng, targetTime) {
    if (!isMlConfigured()) return null;

    const endpoint = isFutureTime(targetTime) ? '/predict/future' : '/predict/crowd';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), mlConfig.timeoutMs);

    try {
        const response = await fetch(`${mlConfig.baseUrl}${endpoint}`, {
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
