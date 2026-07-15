// Configuration for the periodic h3_grid_scores refresh job.
//
// Values are read from the environment on each access (not captured at require
// time) so deployment and tests can toggle the job without reloading modules.

const { positiveNumberOrDefault } = require('../utils/numbers');

const DEFAULT_INTERVAL_MS = 3600000; // 1 hour
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_CELL_LIMIT = 524; // all Manhattan H3 cells
const DEFAULT_HORIZON_HOURS = 6;
const DEFAULT_STEP_MINUTES = 60;

function jobEnabled() {
    return process.env.H3_GRID_REFRESH_JOB_ENABLED === 'true';
}

function intervalMs() {
    return positiveNumberOrDefault(process.env.H3_GRID_REFRESH_INTERVAL_MS, DEFAULT_INTERVAL_MS);
}

function concurrency() {
    return positiveNumberOrDefault(process.env.H3_GRID_REFRESH_CONCURRENCY, DEFAULT_CONCURRENCY);
}

function cellLimit() {
    return positiveNumberOrDefault(process.env.H3_GRID_REFRESH_CELL_LIMIT, DEFAULT_CELL_LIMIT);
}

function horizonHours() {
    return positiveNumberOrDefault(process.env.H3_GRID_REFRESH_HORIZON_HOURS, DEFAULT_HORIZON_HOURS);
}

function stepMinutes() {
    return positiveNumberOrDefault(process.env.H3_GRID_REFRESH_STEP_MINUTES, DEFAULT_STEP_MINUTES);
}

module.exports = {
    jobEnabled,
    intervalMs,
    concurrency,
    cellLimit,
    horizonHours,
    stepMinutes
};
