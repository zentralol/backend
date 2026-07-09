const express = require('express');
const { insertFeedback } = require('../repositories/feedbackRepository');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

router.post('/', async (req, res) => {
    const { userId = null, h3Cell = null, rating, wasUseful = null, comment = null } = req.body || {};
    const parsedRating = Number(rating);

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return sendError(res, 422, 'INVALID_RATING', 'rating must be an integer between 1 and 5');
    }

    try {
        const result = await insertFeedback(userId, h3Cell, parsedRating, wasUseful, comment);
        const row = result.rows[0];

        return sendSuccess(res, 201, {
            feedback: {
                id: row.id,
                userId: row.user_id,
                h3Cell: row.h3_cell,
                rating: row.rating,
                wasUseful: row.was_useful,
                comment: row.comment,
                createdAt: row.created_at
            }
        });
    } catch (err) {
        console.error('Feedback Submission Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Feedback submission failed');
    }
});

module.exports = router;
