const express = require('express');
const { getQuieterNearbyScores } = require('../repositories/h3Repository');
const { busynessLevel, normalizeScore } = require('../utils/busyness');
const { isValidDateTime, parseLimit } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

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
                type: 'quieter_place',
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

module.exports = router;
