const express = require('express');
const agentConfig = require('../config/agent');
const { sendError } = require('../utils/response');

const router = express.Router();

const VALID_CLIENT_TYPES = new Set(['web', 'ios']);

// Optional device coordinate: absent -> null; present must be a finite number
// within [min, max], otherwise invalid.
function parseOptionalCoordinate(raw, min, max) {
    if (raw === undefined || raw === null) {
        return { value: null };
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) {
        return { invalid: true };
    }
    return { value: raw };
}

function validateChatInput(body) {
    const message = body?.message;
    if (typeof message !== 'string' || message.trim().length === 0) {
        return { error: { status: 400, code: 'INVALID_QUERY', message: 'message is required' } };
    }

    const clientType = body?.clientType || 'web';
    if (!VALID_CLIENT_TYPES.has(clientType)) {
        return { error: { status: 400, code: 'INVALID_QUERY', message: 'clientType must be one of: web, ios' } };
    }

    const lat = parseOptionalCoordinate(body?.lat, -90, 90);
    if (lat.invalid) {
        return { error: { status: 400, code: 'INVALID_QUERY', message: 'lat must be a number between -90 and 90' } };
    }

    const lng = parseOptionalCoordinate(body?.lng, -180, 180);
    if (lng.invalid) {
        return { error: { status: 400, code: 'INVALID_QUERY', message: 'lng must be a number between -180 and 180' } };
    }

    return {
        value: {
            message: message.trim(),
            clientType,
            conversationId: typeof body?.conversationId === 'string' ? body.conversationId : null,
            requestId: typeof body?.requestId === 'string' ? body.requestId : null,
            lat: lat.value,
            lng: lng.value
        }
    };
}

// Streams an agent SSE response straight through to the client. Runs only after
// the response body has started, so failures here are surfaced as an SSE error
// frame rather than an HTTP status.
async function pipeAgentStream(agentResponse, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });

    try {
        for await (const chunk of agentResponse.body) {
            res.write(chunk);
        }
        res.end();
    } catch (err) {
        console.error('Chat stream interrupted:', err.message);
        res.write(`data: ${JSON.stringify({ type: 'error', code: 'AGENT_STREAM_INTERRUPTED', message: 'The response stream ended unexpectedly.' })}\n\n`);
        res.end();
    }
}

router.post('/stream', async (req, res) => {
    const { error, value } = validateChatInput(req.body);
    if (error) {
        return sendError(res, error.status, error.code, error.message);
    }

    const baseUrl = agentConfig.baseUrl();
    if (!baseUrl) {
        return sendError(res, 503, 'AGENT_UNAVAILABLE', 'The AI agent service is not configured');
    }

    // user_id is resolved from verified auth context (Clerk or trusted internal
    // caller) by gatewayAuth — never taken from the model or an untrusted field.
    const forwardBody = JSON.stringify({
        user_id: req.gatewayPrincipal.userId,
        message: value.message,
        client_type: value.clientType,
        conversation_id: value.conversationId,
        request_id: value.requestId,
        lat: value.lat,
        lng: value.lng
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), agentConfig.timeoutMs());

    let agentResponse;
    try {
        agentResponse = await fetch(`${baseUrl}/api/v1/agent/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-Token': agentConfig.internalToken()
            },
            body: forwardBody,
            signal: controller.signal
        });
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            return sendError(res, 504, 'AGENT_TIMEOUT', 'The AI agent did not respond in time');
        }
        console.error('Chat forward failed:', err.message);
        return sendError(res, 502, 'AGENT_ERROR', 'Failed to reach the AI agent service');
    }

    if (!agentResponse.ok) {
        clearTimeout(timeout);
        return sendError(res, 502, 'AGENT_ERROR', `The AI agent returned status ${agentResponse.status}`);
    }

    // Stop aborting once the stream is flowing; the client drives its own lifetime.
    clearTimeout(timeout);
    return pipeAgentStream(agentResponse, res);
});

module.exports = router;
