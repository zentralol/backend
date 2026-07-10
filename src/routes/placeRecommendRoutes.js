const express = require('express');
const { proxyPost, sendProxyResult } = require('../services/recommendClient');

const router = express.Router();

router.post('/', async (req, res) => {
    const result = await proxyPost('/recommend/', req.body);
    return sendProxyResult(res, result);
});

module.exports = router;
