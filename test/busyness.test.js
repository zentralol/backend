const test = require('node:test');
const assert = require('node:assert/strict');

const { busynessLevel, normalizeScore } = require('../src/utils/busyness');

test('normalizeScore converts model probabilities to percentage scores', () => {
    assert.equal(normalizeScore(0), 0);
    assert.equal(normalizeScore(0.42), 42);
    assert.equal(normalizeScore(0.825), 83);
    assert.equal(normalizeScore(87.4), 87);
});

test('normalizeScore clamps invalid range values', () => {
    assert.equal(normalizeScore(-10), 0);
    assert.equal(normalizeScore(130), 100);
    assert.equal(normalizeScore('not-a-number'), null);
    assert.equal(normalizeScore(undefined), null);
});

test('busynessLevel maps scores to contract levels', () => {
    assert.equal(busynessLevel(20), 'very_quiet');
    assert.equal(busynessLevel(21), 'quiet');
    assert.equal(busynessLevel(40), 'quiet');
    assert.equal(busynessLevel(41), 'moderate');
    assert.equal(busynessLevel(60), 'moderate');
    assert.equal(busynessLevel(61), 'busy');
    assert.equal(busynessLevel(80), 'busy');
    assert.equal(busynessLevel(81), 'very_busy');
});
