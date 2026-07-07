const pool = require('../config/database');
const {
    SELECT_PREDICTION_STATS,
    SELECT_TOP_PREDICTION_CELLS
} = require('./sql/statsQueries');

function getPredictionStats(startDate, endDate) {
    return pool.query(SELECT_PREDICTION_STATS, [startDate, endDate]);
}

function getTopPredictionCells(startDate, endDate) {
    return pool.query(SELECT_TOP_PREDICTION_CELLS, [startDate, endDate]);
}

module.exports = {
    getPredictionStats,
    getTopPredictionCells
};
