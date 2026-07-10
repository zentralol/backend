const crypto = require('crypto');
const agentConfig = require('../config/agent');
const { requireAuthenticatedUser } = require('./auth');
const { sendError } = require('../utils/response');

const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

// Constant-time comparison that never throws on length mismatch.
function tokensMatch(provided, expected) {
    if (!provided || !expected) {
        return false;
    }

    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);

    if (providedBuf.length !== expectedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// Authenticates a caller as EITHER a trusted internal service (shared secret in
// X-Internal-Service-Token) OR a Clerk-authenticated user. Capability endpoints
// the agent calls server-to-server use this so both the browser (Clerk) and the
// agent (internal token) are accepted.
//
//   - Valid internal token -> allow; mark req.internalService = true.
//   - Bad token            -> 401 (do not fall through to Clerk).
//   - No token             -> require a Clerk-authenticated user.
function serviceOrUserAuth(req, res, next) {
    const token = req.get(SERVICE_TOKEN_HEADER);

    if (token) {
        if (!tokensMatch(token, agentConfig.internalToken())) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Invalid internal service token');
        }
        req.internalService = true;
        return next();
    }

    return requireAuthenticatedUser(req, res, next);
}

module.exports = {
    serviceOrUserAuth,
    tokensMatch,
    SERVICE_TOKEN_HEADER
};
