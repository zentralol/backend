// Configuration for the periodic attraction crowd-prediction job.
//
// Values are read from the environment on each access (not captured at require
// time) so deployment and tests can toggle the job without reloading modules.

const { positiveNumberOrDefault } = require('../utils/numbers');

const DEFAULT_INTERVAL_MS = 300000; // 5 minutes
const DEFAULT_CONCURRENCY = 8;

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
