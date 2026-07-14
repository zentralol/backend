const test = require('node:test');
const assert = require('node:assert/strict');

const {
    UPSERT_HEATMAP_PREDICTION,
    DELETE_STALE_HEATMAP_PREDICTIONS
} = require('../src/repositories/sql/heatmapQueries');

test('UPSERT_HEATMAP_PREDICTION writes into heatmap_predictions with conflict handling', () => {
    assert.match(UPSERT_HEATMAP_PREDICTION, /INSERT INTO heatmap_predictions/i);
    assert.match(UPSERT_HEATMAP_PREDICTION, /ON CONFLICT \(target_time, h3_cell\)/i);
    assert.match(UPSERT_HEATMAP_PREDICTION, /generated_at = now\(\)/i);
});

test('DELETE_STALE_HEATMAP_PREDICTIONS removes rows older than cutoff', () => {
    assert.match(DELETE_STALE_HEATMAP_PREDICTIONS, /DELETE FROM heatmap_predictions/i);
    assert.match(DELETE_STALE_HEATMAP_PREDICTIONS, /target_time < \$1::timestamp/i);
});
