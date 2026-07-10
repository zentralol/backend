const recommendConfig = require('../config/recommend');
const { sendError } = require('../utils/response');

function isRecommendConfigured() {
    return Boolean(recommendConfig.baseUrl());
}

async function proxyPost(upstreamPath, body, { timeoutMs } = {}) {
    const baseUrl = recommendConfig.baseUrl();
    if (!baseUrl) {
        return {
            ok: false,
            gatewayError: {
                status: 503,
                code: 'RECOMMEND_UNAVAILABLE',
                message: 'The recommendation service is not configured'
            }
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs ?? recommendConfig.timeoutMs()
    );

    try {
        const response = await fetch(`${baseUrl}${upstreamPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
            signal: controller.signal
        });

        const contentType = response.headers.get('content-type') || '';
        let payload = null;

        if (contentType.includes('application/json')) {
            payload = await response.json();
        } else {
            const text = await response.text();
            payload = text.length > 0 ? text : null;
        }

        return { ok: true, status: response.status, payload };
    } catch (err) {
        if (err.name === 'AbortError') {
            return {
                ok: false,
                gatewayError: {
                    status: 504,
                    code: 'RECOMMEND_TIMEOUT',
                    message: 'The recommendation service did not respond in time'
                }
            };
        }

        console.error('Recommend proxy request failed:', err.message);
        return {
            ok: false,
            gatewayError: {
                status: 502,
                code: 'RECOMMEND_ERROR',
                message: 'Failed to reach the recommendation service'
            }
        };
    } finally {
        clearTimeout(timeout);
    }
}

function sendProxyResult(res, result) {
    if (!result.ok) {
        const { status, code, message } = result.gatewayError;
        return sendError(res, status, code, message);
    }

    if (result.payload === null) {
        return res.status(result.status).end();
    }

    return res.status(result.status).json(result.payload);
}

module.exports = {
    isRecommendConfigured,
    proxyPost,
    sendProxyResult
};
