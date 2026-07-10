const crypto = require('crypto');
const agentConfig = require('../config/agent');
const { getRequestAuth } = require('./auth');
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
// X-Internal-Service-Token) OR an end user (verified Clerk session). Resolves a
// single `req.gatewayPrincipal = { userId, source }` for downstream handlers.
//
//   - Internal service: userId is taken from the request body (the trusted
//     caller acts on behalf of a user). Missing body userId -> 400.
//   - Clerk user: userId comes from the verified session; any body userId is
//     ignored to prevent spoofing.
//   - Neither present / bad token -> 401.
function gatewayAuth(req, res, next) {
    const providedToken = req.get(SERVICE_TOKEN_HEADER);

    if (providedToken) {
        if (!tokensMatch(providedToken, agentConfig.internalToken())) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Invalid internal service token');
        }

        const bodyUserId = req.body?.userId || req.body?.user_id;
        if (typeof bodyUserId !== 'string' || bodyUserId.trim().length === 0) {
            return sendError(res, 400, 'INVALID_QUERY', 'userId is required for internal service calls');
        }

        req.gatewayPrincipal = { userId: bodyUserId.trim(), source: 'internal_service' };
        return next();
    }

    const auth = getRequestAuth(req);
    if (auth?.isAuthenticated && auth.userId) {
        req.gatewayPrincipal = { userId: auth.userId, source: 'clerk_user' };
        return next();
    }

    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
}

module.exports = gatewayAuth;
module.exports.tokensMatch = tokensMatch;
