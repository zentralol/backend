const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SELECT_ATTRACTIONS_LIST,
    SELECT_ATTRACTIONS_NEARBY,
    SELECT_RECENT_ATTRACTION_PREDICTIONS
} = require('../src/repositories/sql/attractionsQueries');

test('attractions list query quotes capitalized columns and applies limit', () => {
    assert.match(SELECT_ATTRACTIONS_LIST, /"Name"/);
    assert.match(SELECT_ATTRACTIONS_LIST, /"Category"/);
    assert.match(SELECT_ATTRACTIONS_LIST, /FROM attractions/i);
    assert.match(SELECT_ATTRACTIONS_LIST, /LIMIT \$1/);
    assert.match(SELECT_ATTRACTIONS_LIST, /lat IS NOT NULL/i);
});

test('attractions nearby query orders by haversine distance', () => {
    assert.match(SELECT_ATTRACTIONS_NEARBY, /distance_meters/i);
    assert.match(SELECT_ATTRACTIONS_NEARBY, /ORDER BY distance_meters ASC/i);
    assert.match(SELECT_ATTRACTIONS_NEARBY, /LIMIT \$3/);
});

test('recent attraction predictions query uses a two-hour window', () => {
    assert.match(SELECT_RECENT_ATTRACTION_PREDICTIONS, /FROM attraction_predictions/i);
    assert.match(SELECT_RECENT_ATTRACTION_PREDICTIONS, /INTERVAL '2 hours'/);
    assert.match(SELECT_RECENT_ATTRACTION_PREDICTIONS, /ORDER BY predicted_for DESC/i);
});
