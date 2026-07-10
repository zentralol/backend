function requestLogger(req, res, next) {
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    const start = Date.now();
    const { method, originalUrl } = req;

    console.log(`--> ${method} ${originalUrl}`);

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        console.log(`<-- ${method} ${originalUrl} ${res.statusCode} ${durationMs}ms`);
    });

    next();
}

module.exports = {
    requestLogger
};
