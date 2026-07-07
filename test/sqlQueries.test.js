const test = require('node:test');
const assert = require('node:assert/strict');

const h3Queries = require('../src/repositories/sql/h3Queries');
const { INSERT_FEEDBACK } = require('../src/repositories/sql/feedbackQueries');
const { INSERT_PREDICTION_REQUEST } = require('../src/repositories/sql/predictionRequestQueries');
const statsQueries = require('../src/repositories/sql/statsQueries');

test('H3 repository queries call Supabase PostgreSQL functions for complex lookups', () => {
    assert.match(h3Queries.SELECT_HEATMAP_SCORES, /zentra_get_heatmap_scores/);
    assert.match(h3Queries.SELECT_NEAREST_PREDICTION_SCORE, /zentra_get_nearest_prediction_score/);
    assert.match(h3Queries.SELECT_NEAREST_H3_CELL, /zentra_get_nearest_h3_cell/);
    assert.match(h3Queries.SELECT_FORECAST_SCORES, /zentra_get_forecast_scores/);
    assert.match(h3Queries.SELECT_QUIETER_NEARBY_SCORES, /zentra_get_quieter_nearby_scores/);
});

test('Node H3 query module does not embed the long ranked_scores SQL', () => {
    const combined = Object.values(h3Queries).join('\n');

    assert.doesNotMatch(combined, /WITH ranked_scores/i);
    assert.doesNotMatch(combined, /ROW_NUMBER\s*\(/i);
});

test('write queries remain parameterized', () => {
    assert.match(INSERT_FEEDBACK, /\$1/);
    assert.match(INSERT_FEEDBACK, /\$5/);
    assert.match(INSERT_PREDICTION_REQUEST, /\$1/);
    assert.match(INSERT_PREDICTION_REQUEST, /\$6/);
});

test('admin stats queries stay read-only', () => {
    const combined = Object.values(statsQueries).join('\n').toUpperCase();

    assert.match(combined, /SELECT/);
    assert.doesNotMatch(combined, /INSERT\s+INTO/);
    assert.doesNotMatch(combined, /UPDATE\s+/);
    assert.doesNotMatch(combined, /DELETE\s+FROM/);
});
