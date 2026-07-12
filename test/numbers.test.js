const test = require('node:test');
const assert = require('node:assert/strict');

const { positiveNumberOrDefault } = require('../src/utils/numbers');

test('returns the parsed value for positive numeric input', () => {
    assert.equal(positiveNumberOrDefault('15000', 300000), 15000);
    assert.equal(positiveNumberOrDefault(4, 8), 4);
});

test('falls back for zero, negative, non-numeric, and missing input', () => {
    assert.equal(positiveNumberOrDefault('0', 300000), 300000);
    assert.equal(positiveNumberOrDefault('-1', 300000), 300000);
    assert.equal(positiveNumberOrDefault('abc', 8), 8);
    assert.equal(positiveNumberOrDefault(undefined, 8), 8);
    assert.equal(positiveNumberOrDefault('', 8), 8);
});
