const express = require('express');
const {
    getForecastScores,
    getNearestH3Cell,
    getNearestPredictionScore,
    getQuieterNearbyScores
} = require('../repositories/h3Repository');
const { busynessLevel, normalizeScore } = require('../utils/busyness');
const { isInManhattanCoverage, isValidDateTime, parseLimit } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

function distanceMeters(a, b) {
    const earthRadiusMeters = 6371000;
    const toRad = (value) => value * Math.PI / 180;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const deltaLat = toRad(b.lat - a.lat);
    const deltaLng = toRad(b.lng - a.lng);

    const h = Math.sin(deltaLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

    return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function mapPredictionRow(row, targetTime) {
    const score = normalizeScore(row.crowd_score);

    return {
        h3Cell: row.h3_cell,
        targetTime: row.query_timestamp || targetTime,
        busynessScore: score,
        busynessLevel: busynessLevel(score),
        pedestriansPredicted: row.pedestrians_pred,
        period: row.period,
        confidence: 0.6,
        source: 'h3_grid_scores'
    };
}

function validateCoordinate(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { code: 'INVALID_COORDINATES', message: 'lat and lng must be valid numbers' };
    }

    if (!isInManhattanCoverage(lat, lng)) {
        return { code: 'LOCATION_OUT_OF_COVERAGE', message: 'Prediction is currently available for Manhattan only' };
    }

    return null;
}

router.post('/', async (req, res) => {
    const { lat, lng, targetTime, limit = 5 } = req.body || {};
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedLimit = parseLimit(limit, 5, 20);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !targetTime) {
        return sendError(res, 400, 'INVALID_QUERY', 'lat, lng, and targetTime are required');
    }

    if (!isValidDateTime(targetTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime must be a valid date-time string');
    }

    try {
        const result = await getQuieterNearbyScores(parsedLat, parsedLng, targetTime, parsedLimit);

        const recommendations = result.rows.map((row) => {
            const score = normalizeScore(row.crowd_score);

            return {
                type: 'quieter_area',
                h3Cell: row.h3_cell,
                coordinates: {
                    lat: row.lat,
                    lng: row.lon
                },
                busynessScore: score,
                busynessLevel: busynessLevel(score),
                pedestriansPredicted: row.pedestrians_pred,
                period: row.period,
                reason: 'This nearby grid cell has a lower predicted crowd score.'
            };
        });

        return sendSuccess(res, 200, {
            targetTime,
            recommendations
        }, { count: result.rowCount });
    } catch (err) {
        console.error('Recommendations Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Recommendation query failed');
    }
});

router.post('/quiet-times', async (req, res) => {
    const { lat, lng, targetTime, startTime, endTime, limit = 3 } = req.body || {};
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedLimit = parseLimit(limit, 3, 24);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !targetTime || !startTime || !endTime) {
        return sendError(res, 400, 'INVALID_QUERY', 'lat, lng, targetTime, startTime, and endTime are required');
    }

    if (![targetTime, startTime, endTime].every(isValidDateTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime, startTime, and endTime must be valid date-time strings');
    }

    const coordinateError = validateCoordinate(parsedLat, parsedLng);
    if (coordinateError) {
        return sendError(res, 422, coordinateError.code, coordinateError.message);
    }

    try {
        const nearestCell = await getNearestH3Cell(parsedLat, parsedLng);

        if (nearestCell.rowCount === 0) {
            return sendError(res, 503, 'PREDICTION_UNAVAILABLE', 'Forecast data is not available for this coordinate');
        }

        const originalResult = await getNearestPredictionScore(parsedLat, parsedLng, targetTime);
        if (originalResult.rowCount === 0) {
            return sendError(res, 503, 'PREDICTION_UNAVAILABLE', 'Prediction is not available for this coordinate and time');
        }

        const h3Cell = nearestCell.rows[0].h3_cell;
        const forecastResult = await getForecastScores(h3Cell, startTime, endTime, 100);
        const original = mapPredictionRow(originalResult.rows[0], targetTime);
        const originalTime = new Date(targetTime).getTime();

        const quietTimes = forecastResult.rows
            .map((row) => mapPredictionRow(row, row.query_timestamp))
            .filter((item) => new Date(item.targetTime).getTime() !== originalTime)
            .sort((a, b) => a.busynessScore - b.busynessScore)
            .slice(0, parsedLimit)
            .map((item) => ({
                targetTime: item.targetTime,
                busynessScore: item.busynessScore,
                busynessLevel: item.busynessLevel,
                confidence: item.confidence,
                reason: item.busynessScore < original.busynessScore
                    ? 'Predicted crowd score is lower than the selected time.'
                    : 'This is one of the quietest available times in the selected window.'
            }));

        return sendSuccess(res, 200, {
            original: {
                targetTime,
                busynessScore: original.busynessScore,
                busynessLevel: original.busynessLevel
            },
            quietTimes
        }, { count: quietTimes.length });
    } catch (err) {
        console.error('Quiet Times Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Quiet time recommendation query failed');
    }
});

router.post('/places', async (req, res) => {
    const { currentLocation, targetTime, candidatePlaces, limit = 5 } = req.body || {};
    const parsedLimit = parseLimit(limit, 5, 20);
    const origin = {
        lat: Number(currentLocation?.lat),
        lng: Number(currentLocation?.lng)
    };

    if (!targetTime || !Array.isArray(candidatePlaces) || candidatePlaces.length === 0 || candidatePlaces.length > 100) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime and 1 to 100 candidatePlaces are required');
    }

    if (!isValidDateTime(targetTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime must be a valid date-time string');
    }

    const originError = validateCoordinate(origin.lat, origin.lng);
    if (originError) {
        return sendError(res, 422, originError.code, `currentLocation ${originError.message}`);
    }

    const recommendations = [];
    const warnings = [];

    for (const place of candidatePlaces) {
        const coordinates = {
            lat: Number(place.coordinates?.lat),
            lng: Number(place.coordinates?.lng)
        };
        const placeId = place?.placeId || place?.poiId || place?.name || null;
        const coordinateError = validateCoordinate(coordinates.lat, coordinates.lng);

        if (coordinateError) {
            warnings.push({ placeId, code: coordinateError.code, message: coordinateError.message });
            continue;
        }

        try {
            const result = await getNearestPredictionScore(coordinates.lat, coordinates.lng, targetTime);

            if (result.rowCount === 0) {
                warnings.push({ placeId, code: 'PREDICTION_UNAVAILABLE', message: 'Prediction is not available for this candidate place' });
                continue;
            }

            const prediction = mapPredictionRow(result.rows[0], targetTime);
            recommendations.push({
                type: 'candidate_place',
                place: {
                    placeId: place.placeId || place.poiId || null,
                    name: place.name || null,
                    category: place.category || null,
                    coordinates,
                    source: place?.source || 'frontend_place_provider'
                },
                prediction,
                distanceMeters: distanceMeters(origin, coordinates),
                reason: 'This candidate place is ranked using its predicted crowd score and distance from the current location.'
            });
        } catch (err) {
            console.error('Candidate Place Recommendation Failed:', err.message);
            warnings.push({ placeId, code: 'INTERNAL_ERROR', message: 'Prediction failed for this candidate place' });
        }
    }

    recommendations
        .sort((a, b) => a.prediction.busynessScore - b.prediction.busynessScore || a.distanceMeters - b.distanceMeters)
        .splice(parsedLimit);

    recommendations.forEach((item, index) => {
        item.rank = index + 1;
    });

    return sendSuccess(res, 200, {
        targetTime,
        recommendations,
        warnings
    }, {
        count: recommendations.length,
        warningCount: warnings.length
    });
});

module.exports = router;

