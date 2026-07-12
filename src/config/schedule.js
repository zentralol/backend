// Configuration for the periodic attraction crowd-prediction job.
//
// Values are read from the environment on each access (not captured at require
// time) so deployment and tests can toggle the job without reloading modules.

const DEFAULT_INTERVAL_MS = 300000; // 5 minutes
const DEFAULT_CONCURRENCY = 8;

// Negative or zero values must not reach setInterval (Node clamps them to
// ~1ms, turning the schedule into a tight loop), so anything that is not a
// positive number falls back to the default.
function positiveNumberOrDefault(value, defaultValue) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function jobEnabled() {
    return process.env.CROWD_PREDICTION_JOB_ENABLED === 'true';
}

function intervalMs() {
    return positiveNumberOrDefault(process.env.CROWD_PREDICTION_INTERVAL_MS, DEFAULT_INTERVAL_MS);
}

function concurrency() {
    return positiveNumberOrDefault(process.env.CROWD_PREDICTION_CONCURRENCY, DEFAULT_CONCURRENCY);
}

module.exports = {
    jobEnabled,
    intervalMs,
    concurrency
};
