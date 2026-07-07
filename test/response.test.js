const test = require('node:test');
const assert = require('node:assert/strict');

const { sendSuccess, sendError } = require('../src/utils/response');

function createMockResponse() {
    return {
        statusCode: null,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return this;
        }
    };
}

test('sendSuccess returns standard success shape', () => {
    const res = createMockResponse();

    sendSuccess(res, 200, { value: 1 }, { count: 1 });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.deepEqual(res.payload.data, { value: 1 });
    assert.equal(res.payload.meta.count, 1);
    assert.match(res.payload.meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('sendError returns standard error shape', () => {
    const res = createMockResponse();

    sendError(res, 422, 'INVALID_QUERY', 'Bad request');

    assert.equal(res.statusCode, 422);
    assert.equal(res.payload.success, false);
    assert.deepEqual(res.payload.error, {
        code: 'INVALID_QUERY',
        message: 'Bad request'
    });
    assert.match(res.payload.meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
