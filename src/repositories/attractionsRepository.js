const pool = require('../config/database');
const {
    SELECT_ATTRACTIONS_LIST,
    SELECT_ATTRACTION_BY_ID,
    SELECT_ATTRACTIONS_SEARCH,
    SELECT_ATTRACTIONS_NEARBY,
    SELECT_ATTRACTIONS_SEARCH_NEARBY,
    SELECT_RECENT_ATTRACTION_PREDICTIONS
} = require('./sql/attractionsQueries');

async function listAttractions(limit) {
    return pool.query(SELECT_ATTRACTIONS_LIST, [limit]);
}

async function getAttractionById(attractionId) {
    return pool.query(SELECT_ATTRACTION_BY_ID, [attractionId]);
}

async function searchAttractions({ query, category, lat, lng, limit }) {
    const searchText = query || null;
    const categoryText = category || null;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return pool.query(SELECT_ATTRACTIONS_SEARCH_NEARBY, [searchText, categoryText, lat, lng, limit]);
    }

    return pool.query(SELECT_ATTRACTIONS_SEARCH, [searchText, categoryText, limit]);
}

async function listAttractionsNearby(lat, lng, limit) {
    return pool.query(SELECT_ATTRACTIONS_NEARBY, [lat, lng, limit]);
}

async function listRecentAttractionPredictions() {
    return pool.query(SELECT_RECENT_ATTRACTION_PREDICTIONS);
}

module.exports = {
    listAttractions,
    getAttractionById,
    searchAttractions,
    listAttractionsNearby,
    listRecentAttractionPredictions
};