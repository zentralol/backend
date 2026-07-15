const pool = require('../config/database');
const {
    SELECT_HEATMAP_PREDICTIONS,
    UPSERT_HEATMAP_PREDICTION,
    DELETE_STALE_HEATMAP_PREDICTIONS
} = require('./sql/heatmapQueries');

async function getCachedHeatmapPredictions(targetTime, limit) {
    return pool.query(SELECT_HEATMAP_PREDICTIONS, [targetTime, limit]);
}

async function upsertHeatmapPrediction(prediction) {
    return pool.query(UPSERT_HEATMAP_PREDICTION, [
        prediction.targetTime,
        prediction.h3Cell,
        prediction.lat,
        prediction.lon,
        prediction.crowdScore,
        prediction.crowdLevel,
        prediction.pedestriansPred,
        prediction.period,
        prediction.crowdCategory,
        prediction.source
    ]);
}

async function deleteStaleHeatmapPredictions(cutoffTargetTime) {
    return pool.query(DELETE_STALE_HEATMAP_PREDICTIONS, [cutoffTargetTime]);
}

module.exports = {
    getCachedHeatmapPredictions,
    upsertHeatmapPrediction,
    deleteStaleHeatmapPredictions
};
