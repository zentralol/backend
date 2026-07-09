const { clerkMiddleware } = require('@clerk/express');

function testAuthMiddleware(req, _res, next) {
    const userId = req.get('x-test-user-id');

    if (userId) {
        req.auth = {
            isAuthenticated: true,
            userId,
            sessionId: req.get('x-test-session-id') || 'sess_test'
        };
    }

    next();
}

function createClerkAuthMiddleware() {
    if (process.env.NODE_ENV === 'test') {
        return testAuthMiddleware;
    }

    return clerkMiddleware();
}

module.exports = {
    createClerkAuthMiddleware
};
