// Configuration for the internal Zentra AI agent service.
//
// The Express gateway forwards chat requests to the agent and authenticates
// itself with a shared secret (AGENT_INTERNAL_TOKEN) sent as the
// X-Internal-Service-Token header. The agent must be configured with the same
// value. See backend .env.example and zentra-agent .env.example.
//
// Values are read from the environment on each access (not captured at require
// time) so deployment and tests can point the gateway at different agent hosts.

function baseUrl() {
    return (process.env.AGENT_API_BASE_URL || '').replace(/\/$/, '');
}

function timeoutMs() {
    // Chat responses stream over SSE, so allow a generous timeout.
    return Number(process.env.AGENT_API_TIMEOUT_MS) || 30000;
}

function internalToken() {
    return process.env.AGENT_INTERNAL_TOKEN || '';
}

module.exports = {
    baseUrl,
    timeoutMs,
    internalToken
};
