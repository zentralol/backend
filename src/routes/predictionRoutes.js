const express = require('express');
const {
    getNearestPredictionScore,
    getNearestH3Cell,
    getForecastScores
} = require('../repositories/h3Repository');
const { savePredictionRequest } = require('../repositories/predictionRequestRepository');
const { callMlPrediction } = require('../services/mlClient');
const { busynessLevel, normalizeScore } = require('../utils/busyness');
const { isFutureTime, isInManhattanCoverage, isValidDateTime, parseLimit } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

function validatePredictionInput(lat, lng, targetTime, durationMinutes) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !targetTime) {
        return { status: 400, code: 'INVALID_QUERY', message: 'lat, lng, and targetTime are required' };
    }

    if (!isValidDateTime(targetTime)) {
        return { status: 400, code: 'INVALID_QUERY', message: 'targetTime must be a valid date-time string' };
    }

    if (!isInManhattanCoverage(lat, lng)) {
        return { status: 422, code: 'LOCATION_OUT_OF_COVERAGE', message: 'Prediction is currently available for Manhattan only' };
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
        return { status: 422, code: 'INVALID_QUERY', message: 'durationMinutes must be between 15 and 240' };
    }

    return null;
}

function buildExplanation(score, period) {
    const level = busynessLevel(score);
    const periodText = period ? ` during the ${period} period` : '';
    const details = {
        very_quiet: {
            summary: `This area is expected to be very quiet${periodText}.`,
            reasons: [
                'The predicted crowd score is very low for the selected time.',
                'This time window is likely to have lighter foot traffic than busier periods.'
            ],
            suggestedAction: 'This is a good time to visit if you prefer a quieter area.'
        },
        quiet: {
            summary: `This area is expected to be quiet${periodText}.`,
            reasons: [
                'The predicted crowd score is below a typical moderate level.',
                'Nearby movement patterns suggest relatively light activity.'
            ],
            suggestedAction: 'This time is suitable if you want to avoid busy crowds.'
        },
        moderate: {
            summary: `This area is expected to be moderately busy${periodText}.`,
            reasons: [
                'The predicted crowd score is in the middle range.',
                'Some foot traffic is expected, but it is not at the busiest level.'
            ],
            suggestedAction: 'This should be manageable, but consider checking quieter alternatives if needed.'
        },
        busy: {
            summary: `This area is expected to be busy${periodText}.`,
            reasons: [
                'The predicted crowd score is above the moderate range.',
                'Travel, visitor activity, or nearby points of interest may increase foot traffic.'
            ],
            suggestedAction: 'Consider a quieter nearby area or a different time.'
        },
        very_busy: {
            summary: `This area is expected to be very busy${periodText}.`,
            reasons: [
                'The predicted crowd score is in the highest range.',
                'Nearby transit, visitor activity, or POI density may increase foot traffic.'
            ],
            suggestedAction: 'Consider changing the time or choosing a quieter nearby area.'
        }
    };

    return {
        ...details[level],
        disclaimer: 'This is a model prediction, not a live crowd count.'
    };
}

async function buildPrediction(lat, lng, targetTime, durationMinutes, clientId = null) {
    try {
        const mlResult = await callMlPrediction(lat, lng, targetTime);

        if (mlResult) {
            const score = normalizeScore(mlResult.crowd_score);
            await savePredictionRequest(lat, lng, targetTime, mlResult.h3_cell, score, 'ml_fastapi');

            return {
                predictionId: `ml_${mlResult.h3_cell}_${Date.now()}`,
                clientId,
                h3Cell: mlResult.h3_cell,
                coordinates: { lat, lng },
                matchedCoordinates: {
                    lat: mlResult.lat,
                    lng: mlResult.lon
                },
                targetTime: mlResult.timestamp || targetTime,
                durationMinutes,
                busynessScore: score,
                busynessLevel: busynessLevel(score),
                crowdCategory: mlResult.crowd_category,
                pedestriansPredicted: mlResult.pedestrians,
                period: mlResult.period,
                confidence: isFutureTime(targetTime) ? 0.65 : 0.8,
                modelVersion: 'ml-fastapi-v1.0',
                cached: false,
                source: 'ml_fastapi'
            };
        }
    } catch (mlError) {
        console.warn('ML API unavailable, falling back to Supabase:', mlError.message);
    }

    const result = await getNearestPredictionScore(lat, lng, targetTime);

    if (result.rowCount === 0) {
        return null;
    }

    const row = result.rows[0];
    const score = normalizeScore(row.crowd_score);
    await savePredictionRequest(lat, lng, targetTime, row.h3_cell, score, 'h3_grid_scores');

    return {
        predictionId: `grid_${row.id}`,
        clientId,
        h3Cell: row.h3_cell,
        coordinates: { lat, lng },
        matchedCoordinates: {
            lat: row.lat,
            lng: row.lon
        },
        targetTime,
        durationMinutes,
        busynessScore: score,
        busynessLevel: busynessLevel(score),
        pedestriansPredicted: row.pedestrians_pred,
        period: row.period,
        confidence: 0.6,
        modelVersion: 'h3-grid-v0.1',
        cached: true,
        source: 'h3_grid_scores',
        features: {
            ensembleLogPrediction: row.ensemble_log_pred,
            poiTotal: row.poi_total,
            poiDensityScore: row.poi_density_score,
            taxiTripCount: row.tlc_trip_count,
            mtaRidershipTotal: row.mta_ridership_total,
            citibikeTripCount: row.citibike_trip_count
        }
    };
}

router.post('/', async (req, res) => {
    const { lat, lng, targetTime, durationMinutes = 60 } = req.body || {};
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedDuration = Number(durationMinutes);

    const validationError = validatePredictionInput(parsedLat, parsedLng, targetTime, parsedDuration);
    if (validationError) {
        return sendError(res, validationError.status, validationError.code, validationError.message);
    }

    try {
        const prediction = await buildPrediction(parsedLat, parsedLng, targetTime, parsedDuration);

        if (!prediction) {
            return sendError(res, 503, 'PREDICTION_UNAVAILABLE', 'Prediction is not available for this coordinate and time');
        }

        return sendSuccess(res, 200, { prediction }, { modelVersion: prediction.modelVersion });
    } catch (err) {
        console.error('Prediction Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Prediction query failed');
    }
});

router.post('/batch', async (req, res) => {
    const { targetTime, durationMinutes = 60 } = req.body || {};
    const coordinates = req.body?.coordinates || req.body?.locations;
    const parsedDuration = Number(durationMinutes);

    if (!Array.isArray(coordinates) || coordinates.length === 0 || coordinates.length > 100 || !targetTime) {
        return sendError(res, 400, 'INVALID_QUERY', 'coordinates must contain 1 to 100 items, and targetTime is required');
    }

    if (!isValidDateTime(targetTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime must be a valid date-time string');
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration < 15 || parsedDuration > 240) {
        return sendError(res, 422, 'INVALID_QUERY', 'durationMinutes must be between 15 and 240');
    }

    const predictions = [];
    const warnings = [];

    for (const item of coordinates) {
        const parsedLat = Number(item.lat);
        const parsedLng = Number(item.lng);
        const clientId = item.clientId || item.locationId || null;

        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            warnings.push({ clientId, code: 'INVALID_COORDINATES', message: 'lat and lng must be valid numbers' });
            continue;
        }

        if (!isInManhattanCoverage(parsedLat, parsedLng)) {
            warnings.push({ clientId, code: 'LOCATION_OUT_OF_COVERAGE', message: 'Prediction is currently available for Manhattan only' });
            continue;
        }

        try {
            const prediction = await buildPrediction(parsedLat, parsedLng, targetTime, parsedDuration, clientId);

            if (!prediction) {
                warnings.push({ clientId, code: 'PREDICTION_UNAVAILABLE', message: 'Prediction is not available for this coordinate and time' });
                continue;
            }

            predictions.push(prediction);
        } catch (err) {
            console.error('Batch Prediction Failed:', err.message);
            warnings.push({ clientId, code: 'INTERNAL_ERROR', message: 'Prediction failed for this coordinate' });
        }
    }

    return sendSuccess(res, 200, {
        targetTime,
        durationMinutes: parsedDuration,
        predictions,
        warnings
    }, {
        count: predictions.length,
        warningCount: warnings.length
    });
});

router.get('/forecast', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const startTime = (req.query.startTime || '').trim();
    const endTime = (req.query.endTime || '').trim();
    const limit = parseLimit(req.query.limit, 24, 100);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !startTime || !endTime) {
        return sendError(res, 400, 'INVALID_QUERY', 'lat, lng, startTime, and endTime are required');
    }

    if (!isValidDateTime(startTime) || !isValidDateTime(endTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'startTime and endTime must be valid date-time strings');
    }

    try {
        const nearestCell = await getNearestH3Cell(lat, lng);

        if (nearestCell.rowCount === 0) {
            return sendError(res, 503, 'PREDICTION_UNAVAILABLE', 'Forecast data is not available for this coordinate');
        }

        const h3Cell = nearestCell.rows[0].h3_cell;
        const result = await getForecastScores(h3Cell, startTime, endTime, limit);

        if (result.rowCount === 0) {
            return sendError(res, 503, 'PREDICTION_UNAVAILABLE', 'Forecast data is not available for this time range');
        }

        const forecast = result.rows.map((row) => {
            const score = normalizeScore(row.crowd_score);

            return {
                timestamp: row.query_timestamp,
                period: row.period,
                busynessScore: score,
                busynessLevel: busynessLevel(score),
                pedestriansPredicted: row.pedestrians_pred
            };
        });

        return sendSuccess(res, 200, {
            h3Cell,
            coordinates: { lat, lng },
            startTime,
            endTime,
            forecast
        }, { count: result.rowCount });
    } catch (err) {
        console.error('Forecast Query Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Forecast query failed');
    }
});

router.post('/explanation', async (req, res) => {
    const { lat, lng, targetTime, busynessScore, period = null } = req.body || {};
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const score = Number(busynessScore);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !targetTime || !Number.isFinite(score)) {
        return sendError(res, 400, 'INVALID_QUERY', 'lat, lng, targetTime, and busynessScore are required');
    }

    if (!isValidDateTime(targetTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime must be a valid date-time string');
    }

    if (score < 0 || score > 100) {
        return sendError(res, 422, 'INVALID_QUERY', 'busynessScore must be between 0 and 100');
    }

    if (!isInManhattanCoverage(parsedLat, parsedLng)) {
        return sendError(res, 422, 'LOCATION_OUT_OF_COVERAGE', 'Prediction is currently available for Manhattan only');
    }

    return sendSuccess(res, 200, {
        explanation: buildExplanation(score, period)
    });
});

module.exports = router;
