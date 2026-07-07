const express = require('express');
const {
    getFeedbackByH3Cell,
    getFeedbackStats,
    getPredictionStats,
    getRecentFeedbackComments,
    getTopPredictionCells
} = require('../repositories/statsRepository');
const { isValidDateTime } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

function validateDateRange(startDate, endDate, res) {
    if (startDate && !isValidDateTime(startDate)) {
        sendError(res, 400, 'INVALID_QUERY', 'startDate must be a valid date string');
        return false;
    }

    if (endDate && !isValidDateTime(endDate)) {
        sendError(res, 400, 'INVALID_QUERY', 'endDate must be a valid date string');
        return false;
    }

    return true;
}

router.get('/stats/predictions', async (req, res) => {
    const startDate = (req.query.startDate || '').trim();
    const endDate = (req.query.endDate || '').trim();

    if (!validateDateRange(startDate, endDate, res)) {
        return null;
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

router.get('/stats/feedback', async (req, res) => {
    const startDate = (req.query.startDate || '').trim();
    const endDate = (req.query.endDate || '').trim();

    if (!validateDateRange(startDate, endDate, res)) {
        return null;
    }

    try {
        const statsResult = await getFeedbackStats(startDate, endDate);
        const byH3CellResult = await getFeedbackByH3Cell(startDate, endDate);
        const commentsResult = await getRecentFeedbackComments(startDate, endDate);
        const stats = statsResult.rows[0];

        return sendSuccess(res, 200, {
            totalFeedback: Number(stats.total_feedback) || 0,
            averageRating: stats.average_rating === null ? null : Number(stats.average_rating),
            usefulRate: stats.useful_rate === null ? null : Number(stats.useful_rate),
            feedbackByH3Cell: byH3CellResult.rows.map((row) => ({
                h3Cell: row.h3_cell,
                count: row.feedback_count,
                averageRating: row.average_rating === null ? null : Number(row.average_rating),
                usefulRate: row.useful_rate === null ? null : Number(row.useful_rate)
            })),
            recentComments: commentsResult.rows.map((row) => ({
                id: String(row.id),
                h3Cell: row.h3_cell,
                rating: row.rating,
                wasUseful: row.was_useful,
                comment: row.comment,
                createdAt: row.created_at
            }))
        }, {
            startDate: startDate || null,
            endDate: endDate || null
        });
    } catch (err) {
        console.error('Feedback Stats Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Feedback statistics query failed');
    }
});

module.exports = router;
