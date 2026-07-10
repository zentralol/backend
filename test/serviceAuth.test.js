const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.AGENT_INTERNAL_TOKEN = 'svc-token';

const { serviceOrUserAuth, tokensMatch } = require('../src/middleware/serviceAuth');

function mockReq({ token, auth } = {}) {
    return {
        _headers: token ? { 'x-internal-service-token': token } : {},
        get(name) {
            return this._headers[name.toLowerCase()];
        },
        auth
    };
}

function mockRes() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

function run(req) {
    const res = mockRes();
    let nextCalled = false;
    serviceOrUserAuth(req, res, () => {
        nextCalled = true;
    });
    return { res, nextCalled };
}

test('allows a valid internal service token and marks the request', () => {
    const req = mockReq({ token: 'svc-token' });
    const { res, nextCalled } = run(req);

    assert.equal(nextCalled, true);
    assert.equal(req.internalService, true);
    assert.equal(res.statusCode, null);
});

test('rejects an invalid internal service token with 401', () => {
    const req = mockReq({ token: 'wrong' });
    const { res, nextCalled } = run(req);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
});

test('falls back to Clerk and allows an authenticated user', () => {
    const req = mockReq({ auth: { isAuthenticated: true, userId: 'user_1' } });
    const { nextCalled } = run(req);

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 'user_1');
    assert.equal(req.internalService, undefined);
});

test('rejects when neither a token nor an authenticated user is present', () => {
    const req = mockReq({});
    const { res, nextCalled } = run(req);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
});

test('tokensMatch is length-safe and exact', () => {
    assert.equal(tokensMatch('abc', 'abcd'), false);
    assert.equal(tokensMatch('abc', 'abc'), true);
    assert.equal(tokensMatch('', 'x'), false);
    assert.equal(tokensMatch('x', ''), false);
});
