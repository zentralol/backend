const express = require('express');
const { getPredictionStats, getTopPredictionCells } = require('../repositories/statsRepository');
const { isValidDateTime } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

router.get('/stats/predictions', async (req, res) => {
    const startDate = (req.query.startDate || '').trim();
    const endDate = (req.query.endDate || '').trim();

    if (startDate && !isValidDateTime(startDate)) {
        return sendError(res, 400, 'INVALID_QUERY', 'startDate must be a valid date string');
    }

    if (endDate && !isValidDateTime(endDate)) {
        return sendError(res, 400, 'INVALID_QUERY', 'endDate must be a valid date string');
    }

    try {
        const result = await getPredictionStats(startDate, endDate);
        const topCells = await getTopPredictionCells(startDate, endDate);
        const stats = result.rows[0];
        const totalRequests = Number(stats.total_requests) || 0;
        const cachedRequests = Number(stats.cached_requests) || 0;

        return sendSuccess(res, 200, {
            totalPredictionRequests: totalRequests,
            averageCrowdScore: stats.average_crowd_score === null ? null : Number(stats.average_crowd_score),
            mlRequests: Number(stats.ml_requests) || 0,
            cachedRequests,
            cacheHitRate: totalRequests === 0 ? 0 : cachedRequests / totalRequests,
            uniqueH3Cells: Number(stats.unique_h3_cells) || 0,
            mostRequestedH3Cells: topCells.rows.map((row) => ({
                h3Cell: row.matched_h3_cell,
                count: row.request_count,
                averageCrowdScore: row.average_crowd_score === null ? null : Number(row.average_crowd_score)
            }))
        }, {
            startDate: startDate || null,
            endDate: endDate || null
        });
    } catch (err) {
        console.error('Prediction Stats Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Prediction statistics query failed');
    }
});

module.exports = router;
