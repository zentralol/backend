function generatedAt() {
    return new Date().toISOString();
}

function sendSuccess(res, status, data, meta = {}) {
    return res.status(status).json({
        success: true,
        data,
        meta: {
            ...meta,
            generatedAt: generatedAt()
        }
    });
}

function sendError(res, status, code, message, meta = {}) {
    return res.status(status).json({
        success: false,
        error: {
            code,
            message
        },
        meta: {
            ...meta,
            generatedAt: generatedAt()
        }
    });
}

module.exports = {
    sendSuccess,
    sendError
};
