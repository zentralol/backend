const express = require('express');
const {
    listAttractions,
    getAttractionById,
    searchAttractions,
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

function parseOptionalText(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
}

function parseAttractionId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
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

router.get('/search', async (req, res) => {
    const query = parseOptionalText(req.query.q);
    const category = parseOptionalText(req.query.category);
    const hasLat = req.query.lat !== undefined;
    const hasLng = req.query.lng !== undefined;
    const lat = hasLat ? Number(req.query.lat) : null;
    const lng = hasLng ? Number(req.query.lng) : null;
    const limit = parseLimit(req.query.limit, 20, 50);

    if (hasLat || hasLng) {
        const coordinateError = validateCoordinate(lat, lng);
        if (coordinateError) {
            return sendError(res, 422, coordinateError.code, coordinateError.message);
        }
    }

    try {
        const attractions = await loadAttractionsWithCrowd(() =>
            searchAttractions({ query, category, lat, lng, limit })
        );

        return sendSuccess(res, 200, { attractions }, { count: attractions.length });
    } catch (err) {
        console.error('Attraction search failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Attraction search failed');
    }
});

router.get('/:attractionId', async (req, res) => {
    const attractionId = parseAttractionId(req.params.attractionId);
    if (!attractionId) {
        return sendError(res, 400, 'INVALID_QUERY', 'attractionId must be a positive integer');
    }

    try {
        const attractions = await loadAttractionsWithCrowd(() => getAttractionById(attractionId));
        const attraction = attractions[0];

        if (!attraction) {
            return sendError(res, 404, 'ATTRACTION_NOT_FOUND', 'Attraction not found');
        }

        return sendSuccess(res, 200, { attraction });
    } catch (err) {
        console.error('Attraction detail failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Attraction detail query failed');
    }
});

module.exports = router;