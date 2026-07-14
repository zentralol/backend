const pool = require('../config/database');
const {
    SELECT_ATTRACTIONS_FOR_PREDICTION,
    UPSERT_ATTRACTION_PREDICTION,
    DELETE_STALE_ATTRACTION_PREDICTIONS
} = require('./sql/attractionQueries');

async function getAttractionsForPrediction() {
    return pool.query(SELECT_ATTRACTIONS_FOR_PREDICTION);
}

// Errors propagate on purpose: the prediction job counts per-attraction
// failures, so writes must not be silently swallowed here.
async function upsertAttractionPrediction(prediction) {
    return pool.query(UPSERT_ATTRACTION_PREDICTION, [
        prediction.attractionId,
        prediction.predictedFor,
        prediction.crowdScore,
        prediction.crowdLevel,
        prediction.crowdCategory,
        prediction.pedestriansPred,
        prediction.h3Cell,
        prediction.source
    ]);
}

async function deleteStaleAttractionPredictions(cutoffIso) {
    const result = await pool.query(DELETE_STALE_ATTRACTION_PREDICTIONS, [cutoffIso]);
    return result.rowCount ?? 0;
}

module.exports = {
    getAttractionsForPrediction,
    upsertAttractionPrediction,
    deleteStaleAttractionPredictions
};
