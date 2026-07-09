const { getAuth } = require('@clerk/express');
const { sendError } = require('../utils/response');

function getRequestAuth(req) {
    if (req.auth && typeof req.auth !== 'function') {
        return req.auth;
    }

    try {
        return getAuth(req);
    } catch {
        return null;
    }
}

function requireAuthenticatedUser(req, res, next) {
    const auth = getRequestAuth(req);

    if (!auth?.isAuthenticated || !auth.userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    req.user = {
        id: auth.userId,
        sessionId: auth.sessionId || null
    };

    return next();
}

module.exports = {
    getRequestAuth,
    requireAuthenticatedUser
};
