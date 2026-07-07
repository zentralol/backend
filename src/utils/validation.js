function isValidDateTime(value) {
    return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function isFutureTime(value) {
    return new Date(value).getTime() > Date.now();
}

function isInManhattanCoverage(lat, lng) {
    return lat >= 40.679 && lat <= 40.882 && lng >= -74.020 && lng <= -73.907;
}

function parseLimit(value, defaultValue, maxValue) {
    const limit = Number(value) || defaultValue;
    return Math.min(limit, maxValue);
}

module.exports = {
    isValidDateTime,
    isFutureTime,
    isInManhattanCoverage,
    parseLimit
};
