const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isValidDateTime,
    isInManhattanCoverage,
    parseLimit
} = require('../src/utils/validation');

test('isValidDateTime accepts valid ISO-like values only', () => {
    assert.equal(isValidDateTime('2026-07-01T16:30:00-04:00'), true);
    assert.equal(isValidDateTime('2026-07-01T20:30:00Z'), true);
    assert.equal(isValidDateTime(''), false);
    assert.equal(isValidDateTime(null), false);
    assert.equal(isValidDateTime('not-a-date'), false);
});

test('isInManhattanCoverage validates current prediction bounds', () => {
    assert.equal(isInManhattanCoverage(40.758, -73.9855), true);
    assert.equal(isInManhattanCoverage(40.679, -74.020), true);
    assert.equal(isInManhattanCoverage(40.882, -73.907), true);
    assert.equal(isInManhattanCoverage(40.60, -73.9855), false);
    assert.equal(isInManhattanCoverage(40.758, -74.20), false);
});

test('parseLimit applies defaults and max values', () => {
    assert.equal(parseLimit(undefined, 100, 524), 100);
    assert.equal(parseLimit('3', 100, 524), 3);
    assert.equal(parseLimit('999', 100, 524), 524);
    assert.equal(parseLimit('abc', 5, 20), 5);
});
