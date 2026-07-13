const express = require('express');
const {
    listAttractions,
    listAttractionsNearby,
    listRecentAttractionPredictions
} = require('../repositories/attractionsRepository');
const { attachCrowdToAttractions, mapAttractionRow } = require('../utils/attractionMapper');
const { isInManhattanCoverage, parseLimit } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

function validateCoordinate(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { code: 'INVALID_COORDINATES', message: 'lat and lng must be valid numbers' };
    }

    if (!isInManhattanCoverage(lat, lng)) {
        return { code: 'LOCATION_OUT_OF_COVERAGE', message: 'Attractions are currently available for Manhattan only' };
    }

    return null;
}

async function loadAttractionsWithCrowd(loadAttractionsFn) {
    const [attractionsResult, predictionsResult] = await Promise.all([
        loadAttractionsFn(),
        listRecentAttractionPredictions().catch(() => ({ rows: [] }))
    ]);

    const attractions = attractionsResult.rows.map((row) => mapAttractionRow(row));
    return attachCrowdToAttractions(attractions, predictionsResult.rows);
}

router.get('/', async (req, res) => {
    const limit = parseLimit(req.query.limit, 524, 524);

    try {
        const attractions = await loadAttractionsWithCrowd(() => listAttractions(limit));

        return sendSuccess(res, 200, { attractions }, { count: attractions.length });
    } catch (err) {
        console.error('Attractions list failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Attraction query failed');
    }
});

router.get('/nearby', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const limit = parseLimit(req.query.limit, 20, 50);

    const coordinateError = validateCoordinate(lat, lng);
    if (coordinateError) {
        return sendError(res, 422, coordinateError.code, coordinateError.message);
    }

    try {
        const attractions = await loadAttractionsWithCrowd(() => listAttractionsNearby(lat, lng, limit));

        return sendSuccess(res, 200, { attractions }, { count: attractions.length });
    } catch (err) {
        console.error('Nearby attractions failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Nearby attraction query failed');
    }
});

module.exports = router;
