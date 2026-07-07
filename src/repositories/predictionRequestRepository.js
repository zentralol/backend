const pool = require('../config/database');
const { INSERT_PREDICTION_REQUEST } = require('./sql/predictionRequestQueries');

async function savePredictionRequest(lat, lng, targetTime, h3Cell, score, source) {
    try {
        await pool.query(INSERT_PREDICTION_REQUEST, [lat, lng, targetTime, h3Cell, score, source]);
    } catch (err) {
        console.error('Prediction Request Logging Failed:', err.message);
    }
}

module.exports = {
    savePredictionRequest
};
