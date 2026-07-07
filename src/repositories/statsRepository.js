const pool = require('../config/database');
const {
    SELECT_PREDICTION_STATS,
    SELECT_TOP_PREDICTION_CELLS,
    SELECT_FEEDBACK_STATS,
    SELECT_FEEDBACK_BY_H3_CELL,
    SELECT_RECENT_FEEDBACK_COMMENTS
} = require('./sql/statsQueries');

function getPredictionStats(startDate, endDate) {
    return pool.query(SELECT_PREDICTION_STATS, [startDate, endDate]);
}

function getTopPredictionCells(startDate, endDate) {
    return pool.query(SELECT_TOP_PREDICTION_CELLS, [startDate, endDate]);
}

function getFeedbackStats(startDate, endDate) {
    return pool.query(SELECT_FEEDBACK_STATS, [startDate, endDate]);
}

function getFeedbackByH3Cell(startDate, endDate) {
    return pool.query(SELECT_FEEDBACK_BY_H3_CELL, [startDate, endDate]);
}

function getRecentFeedbackComments(startDate, endDate) {
    return pool.query(SELECT_RECENT_FEEDBACK_COMMENTS, [startDate, endDate]);
}

module.exports = {
    getPredictionStats,
    getTopPredictionCells,
    getFeedbackStats,
    getFeedbackByH3Cell,
    getRecentFeedbackComments
};
