const scheduleConfig = require('../config/schedule');
const { runCrowdPredictionJob } = require('./crowdPredictionJob');
const { runHeatmapPredictionJob } = require('./heatmapPredictionJob');

function startScheduler({
    enabled,
    intervalMs,
    runJob,
    disabledMessage,
    startedMessage,
    failureMessage,
    logger,
    setIntervalFn,
    clearIntervalFn
}) {
    if (!enabled()) {
        logger.log(disabledMessage);
        return null;
    }

    const tick = async () => {
        try {
            await runJob();
        } catch (err) {
            logger.error(failureMessage, err.message);
        }
    };

    const interval = intervalMs();
    const timer = setIntervalFn(tick, interval);
    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    logger.log(`${startedMessage} (every ${interval}ms)`);
    tick();

    return {
        stop: () => clearIntervalFn(timer)
    };
}

// Starts the in-process crowd-prediction scheduler. Returns { stop } when
// started, or null when CROWD_PREDICTION_JOB_ENABLED is not "true".
// runCrowdPredictionJob carries its own overlap lock, so a tick that fires
// while the previous run is still going becomes a no-op.
function startCrowdPredictionScheduler(overrides = {}) {
    const {
        runJob = runCrowdPredictionJob,
        config = scheduleConfig,
        logger = console,
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval
    } = overrides;

    return startScheduler({
        enabled: config.jobEnabled,
        intervalMs: config.intervalMs,
        runJob,
        disabledMessage:
            'Crowd prediction scheduler disabled (set CROWD_PREDICTION_JOB_ENABLED=true to enable)',
        startedMessage: 'Crowd prediction scheduler started',
        failureMessage: 'Crowd Prediction Run Failed:',
        logger,
        setIntervalFn,
        clearIntervalFn
    });
}

function startHeatmapPredictionScheduler(overrides = {}) {
    const {
        runJob = runHeatmapPredictionJob,
        config = scheduleConfig,
        logger = console,
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval
    } = overrides;

    return startScheduler({
        enabled: config.heatmapJobEnabled,
        intervalMs: config.heatmapIntervalMs,
        runJob,
        disabledMessage:
            'Heatmap prediction scheduler disabled (set HEATMAP_PREDICTION_JOB_ENABLED=true to enable)',
        startedMessage: 'Heatmap prediction scheduler started',
        failureMessage: 'Heatmap Prediction Run Failed:',
        logger,
        setIntervalFn,
        clearIntervalFn
    });
}

module.exports = {
    startCrowdPredictionScheduler,
    startHeatmapPredictionScheduler
};
