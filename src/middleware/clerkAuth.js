const { clerkMiddleware } = require('@clerk/express');

const REQUIRED_CLERK_ENV_VARS = ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'];

function assertClerkEnv() {
    const missing = REQUIRED_CLERK_ENV_VARS.filter((name) => !process.env[name]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required Clerk environment variable(s): ${missing.join(', ')}. ` +
            'Set them from your Clerk application before starting the server.'
        );
    }
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

function createClerkAuthMiddleware() {
    if (process.env.NODE_ENV === 'test') {
        return testAuthMiddleware;
    }

    assertClerkEnv();

    return clerkMiddleware();
}

module.exports = {
    createClerkAuthMiddleware
};
