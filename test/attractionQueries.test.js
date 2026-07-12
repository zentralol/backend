const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SELECT_ATTRACTIONS_FOR_PREDICTION,
    UPSERT_ATTRACTION_PREDICTION
} = require('../src/repositories/sql/attractionQueries');

test('attraction select quotes the capitalized Name column', () => {
    assert.match(SELECT_ATTRACTIONS_FOR_PREDICTION, /"Name"/);
    assert.match(SELECT_ATTRACTIONS_FOR_PREDICTION, /FROM attractions/i);
});

test('attraction select skips rows without coordinates', () => {
    assert.match(SELECT_ATTRACTIONS_FOR_PREDICTION, /lat IS NOT NULL/i);
    assert.match(SELECT_ATTRACTIONS_FOR_PREDICTION, /lon IS NOT NULL/i);
});

test('attraction prediction upsert is parameterized', () => {
    assert.match(UPSERT_ATTRACTION_PREDICTION, /\$1/);
    assert.match(UPSERT_ATTRACTION_PREDICTION, /\$8/);
    assert.doesNotMatch(UPSERT_ATTRACTION_PREDICTION, /\$9/);
});

test('attraction prediction upsert targets the five-minute unique key', () => {
    assert.match(UPSERT_ATTRACTION_PREDICTION, /ON CONFLICT \(attraction_id, predicted_for\)/);
    assert.match(UPSERT_ATTRACTION_PREDICTION, /extract\(epoch from \$2::timestamptz\)/i);
    assert.match(UPSERT_ATTRACTION_PREDICTION, /\/ 300\)/);
});

test('attraction prediction upsert refreshes updated_at on conflict', () => {
    assert.match(UPSERT_ATTRACTION_PREDICTION, /updated_at = now\(\)/);
});
