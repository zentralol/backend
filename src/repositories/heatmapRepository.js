const pool = require('../config/database');
const {
    UPSERT_HEATMAP_PREDICTION,
    DELETE_STALE_HEATMAP_PREDICTIONS
} = require('./sql/heatmapQueries');

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
    upsertHeatmapPrediction,
    deleteStaleHeatmapPredictions
};
