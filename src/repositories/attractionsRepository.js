const pool = require('../config/database');
const {
    SELECT_ATTRACTIONS_LIST,
    SELECT_ATTRACTIONS_NEARBY,
    SELECT_RECENT_ATTRACTION_PREDICTIONS
} = require('./sql/attractionsQueries');

async function listAttractions(limit) {
    return pool.query(SELECT_ATTRACTIONS_LIST, [limit]);
}

async function listAttractionsNearby(lat, lng, limit) {
    return pool.query(SELECT_ATTRACTIONS_NEARBY, [lat, lng, limit]);
}

async function listRecentAttractionPredictions() {
    return pool.query(SELECT_RECENT_ATTRACTION_PREDICTIONS);
}

module.exports = {
    listAttractions,
    listAttractionsNearby,
    listRecentAttractionPredictions
};
