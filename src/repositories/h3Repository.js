const pool = require('../config/database');
const {
    SELECT_H3_GRID_CELLS,
    SELECT_HEATMAP_SCORES,
    SELECT_NEAREST_PREDICTION_SCORE,
    SELECT_NEAREST_H3_CELL,
    SELECT_FORECAST_SCORES,
    SELECT_QUIETER_NEARBY_SCORES,
    UPSERT_H3_GRID_SCORE
} = require('./sql/h3Queries');

function getH3GridCells(limit) {
    return pool.query(SELECT_H3_GRID_CELLS, [limit]);
}

function getHeatmapScores(targetTime, limit) {
    return pool.query(SELECT_HEATMAP_SCORES, [targetTime, limit]);
}

function getNearestPredictionScore(lat, lng, targetTime) {
    return pool.query(SELECT_NEAREST_PREDICTION_SCORE, [lat, lng, targetTime]);
}

function getNearestH3Cell(lat, lng) {
    return pool.query(SELECT_NEAREST_H3_CELL, [lat, lng]);
}

function getForecastScores(h3Cell, startTime, endTime, limit) {
    return pool.query(SELECT_FORECAST_SCORES, [h3Cell, startTime, endTime, limit]);
}

function getQuieterNearbyScores(lat, lng, targetTime, limit) {
    return pool.query(SELECT_QUIETER_NEARBY_SCORES, [lat, lng, targetTime, limit]);
}

function upsertH3GridScore(score) {
    return pool.query(UPSERT_H3_GRID_SCORE, [
        score.h3Cell,
        score.lat,
        score.lon,
        score.period,
        score.queryTimestamp,
        score.crowdScore,
        score.pedestriansPred
    ]);
}

module.exports = {
    getH3GridCells,
    getHeatmapScores,
    getNearestPredictionScore,
    getNearestH3Cell,
    getForecastScores,
    getQuieterNearbyScores,
    upsertH3GridScore
};
