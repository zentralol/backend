const pool = require('../config/database');
const { INSERT_FEEDBACK } = require('./sql/feedbackQueries');

function insertFeedback(userId, h3Cell, rating, wasUseful, comment) {
    return pool.query(INSERT_FEEDBACK, [userId, h3Cell, rating, wasUseful, comment]);
}

module.exports = {
    insertFeedback
};
