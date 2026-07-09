const { clerkMiddleware } = require('@clerk/express');

function csv(value) {
    return (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

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

function buildClerkOptions() {
    const options = {};
    const authorizedParties = csv(process.env.CLERK_AUTHORIZED_PARTIES);

    if (authorizedParties.length > 0) {
        options.authorizedParties = authorizedParties;
    }

    if (process.env.CLERK_JWT_KEY) {
        options.jwtKey = process.env.CLERK_JWT_KEY;
    }

    return options;
}

function createClerkAuthMiddleware() {
    if (process.env.NODE_ENV === 'test') {
        return testAuthMiddleware;
    }

    return clerkMiddleware(buildClerkOptions());
}

module.exports = {
    createClerkAuthMiddleware
};
