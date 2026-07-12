const scheduleConfig = require('../config/schedule');
const { runCrowdPredictionJob } = require('./crowdPredictionJob');

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

    if (!config.jobEnabled()) {
        logger.log('Crowd prediction scheduler disabled (set CROWD_PREDICTION_JOB_ENABLED=true to enable)');
        return null;
    }

    const tick = async () => {
        try {
            await runJob();
        } catch (err) {
            logger.error('Crowd Prediction Run Failed:', err.message);
        }
    };

    const interval = config.intervalMs();
    const timer = setIntervalFn(tick, interval);
    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    logger.log(`Crowd prediction scheduler started (every ${interval}ms)`);
    tick();

    return {
        stop: () => clearIntervalFn(timer)
    };
}

module.exports = {
    startCrowdPredictionScheduler
};
