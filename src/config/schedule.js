// Configuration for periodic background jobs.
//
// Values are read from the environment on each access (not captured at require
// time) so deployment and tests can toggle jobs without reloading modules.

const { positiveNumberOrDefault } = require('../utils/numbers');
const { DEFAULT_HORIZON_HOURS } = require('../utils/heatmapTargetTimes');

const DEFAULT_CROWD_INTERVAL_MS = 300000; // 5 minutes
const DEFAULT_HEATMAP_INTERVAL_MS = 1800000; // 30 minutes
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_RETENTION_MS = 3600000; // 1 hour
const DEFAULT_HEATMAP_GRID_LIMIT = 524;
const DEFAULT_HEATMAP_RETENTION_HOURS = 48;

function jobEnabled() {
    return process.env.CROWD_PREDICTION_JOB_ENABLED === 'true';
}

function intervalMs() {
    return positiveNumberOrDefault(
        process.env.CROWD_PREDICTION_INTERVAL_MS,
        DEFAULT_CROWD_INTERVAL_MS
    );
}

function concurrency() {
    return positiveNumberOrDefault(
        process.env.CROWD_PREDICTION_CONCURRENCY,
        DEFAULT_CONCURRENCY
    );
}

function heatmapJobEnabled() {
    return process.env.HEATMAP_PREDICTION_JOB_ENABLED === 'true';
}

function heatmapIntervalMs() {
    return positiveNumberOrDefault(
        process.env.HEATMAP_PREDICTION_INTERVAL_MS,
        DEFAULT_HEATMAP_INTERVAL_MS
    );
}

function heatmapConcurrency() {
    return positiveNumberOrDefault(
        process.env.HEATMAP_PREDICTION_CONCURRENCY,
        DEFAULT_CONCURRENCY
    );
}

function heatmapGridLimit() {
    return positiveNumberOrDefault(
        process.env.HEATMAP_GRID_LIMIT,
        DEFAULT_HEATMAP_GRID_LIMIT
    );
}

function heatmapHorizonHours() {
    return positiveNumberOrDefault(
        process.env.HEATMAP_HORIZON_HOURS,
        DEFAULT_HORIZON_HOURS
    );
}

function heatmapRetentionHours() {
    return positiveNumberOrDefault(
        process.env.HEATMAP_RETENTION_HOURS,
        DEFAULT_HEATMAP_RETENTION_HOURS
    );
}

function retentionMs() {
    return positiveNumberOrDefault(process.env.CROWD_PREDICTION_RETENTION_MS, DEFAULT_RETENTION_MS);
}

module.exports = {
    jobEnabled,
    intervalMs,
    concurrency,
    retentionMs,
    heatmapJobEnabled,
    heatmapIntervalMs,
    heatmapConcurrency,
    heatmapGridLimit,
    heatmapHorizonHours,
    heatmapRetentionHours
};
