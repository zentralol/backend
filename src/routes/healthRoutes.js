const express = require('express');
const { checkDatabaseConnection } = require('../repositories/healthRepository');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

router.get('/health', async (req, res) => {
    try {
        await checkDatabaseConnection();

        return sendSuccess(res, 200, {
            status: 'ok',
            apiVersion: 'v1',
            database: 'connected',
            uptimeSeconds: process.uptime()
        });
    } catch (error) {
        console.error('Health Check DB Error:', error.message);
        return sendError(res, 503, 'DATABASE_UNAVAILABLE', 'Database connection failed');
    }
});

module.exports = router;
