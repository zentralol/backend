const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SELECT_ATTRACTIONS_LIST,
    SELECT_ATTRACTION_BY_ID,
    SELECT_ATTRACTIONS_SEARCH,
    SELECT_ATTRACTIONS_NEARBY,
    SELECT_ATTRACTIONS_SEARCH_NEARBY,
    SELECT_RECENT_ATTRACTION_PREDICTIONS
} = require('../src/repositories/sql/attractionsQueries');

test('attractions list query quotes capitalized columns and applies limit', () => {
    assert.match(SELECT_ATTRACTIONS_LIST, /"Name"/);
    assert.match(SELECT_ATTRACTIONS_LIST, /"Category"/);
    assert.match(SELECT_ATTRACTIONS_LIST, /FROM attractions/i);
    assert.match(SELECT_ATTRACTIONS_LIST, /LIMIT \$1/);
    assert.match(SELECT_ATTRACTIONS_LIST, /lat IS NOT NULL/i);
});

test('attraction detail query selects by id', () => {
    assert.match(SELECT_ATTRACTION_BY_ID, /WHERE id = \$1/i);
    assert.match(SELECT_ATTRACTION_BY_ID, /LIMIT 1/i);
});

test('attractions search query filters text and category', () => {
    assert.match(SELECT_ATTRACTIONS_SEARCH, /"Name" ILIKE/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH, /"Description" ILIKE/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH, /"Neighborhood" ILIKE/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH, /"Category" ILIKE \$2/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH, /LIMIT \$3/);
});

test('attractions nearby query orders by haversine distance', () => {
    assert.match(SELECT_ATTRACTIONS_NEARBY, /distance_meters/i);
    assert.match(SELECT_ATTRACTIONS_NEARBY, /ORDER BY distance_meters ASC/i);
    assert.match(SELECT_ATTRACTIONS_NEARBY, /LIMIT \$3/);
});

test('attractions nearby search query filters before distance sorting', () => {
    assert.match(SELECT_ATTRACTIONS_SEARCH_NEARBY, /"Name" ILIKE/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH_NEARBY, /distance_meters/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH_NEARBY, /ORDER BY distance_meters ASC, name/i);
    assert.match(SELECT_ATTRACTIONS_SEARCH_NEARBY, /LIMIT \$5/);
});

test('recent attraction predictions query uses a two-hour window', () => {
    assert.match(SELECT_RECENT_ATTRACTION_PREDICTIONS, /FROM attraction_predictions/i);
    assert.match(SELECT_RECENT_ATTRACTION_PREDICTIONS, /INTERVAL '2 hours'/);
    assert.match(SELECT_RECENT_ATTRACTION_PREDICTIONS, /ORDER BY predicted_for DESC/i);
});