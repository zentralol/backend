const h3GridRefreshConfig = require('../config/h3GridRefresh');
const { runH3GridScoreRefreshJob } = require('./h3GridScoreRefreshJob');

// Starts the in-process h3_grid_scores refresh scheduler. Returns { stop }
// when started, or null when H3_GRID_REFRESH_JOB_ENABLED is not "true".
// runH3GridScoreRefreshJob carries its own overlap lock, so a tick that
// fires while the previous run is still going becomes a no-op.
function startH3GridScoreRefreshScheduler(overrides = {}) {
    const {
        runJob = runH3GridScoreRefreshJob,
        config = h3GridRefreshConfig,
        logger = console,
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval
    } = overrides;

    if (!config.jobEnabled()) {
        logger.log('H3 grid score refresh scheduler disabled (set H3_GRID_REFRESH_JOB_ENABLED=true to enable)');
        return null;
    }

    const tick = async () => {
        try {
            await runJob();
        } catch (err) {
            logger.error('H3 Grid Score Refresh Run Failed:', err.message);
        }
    };

    const interval = config.intervalMs();
    const timer = setIntervalFn(tick, interval);
    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    logger.log(`H3 grid score refresh scheduler started (every ${interval}ms)`);
    tick();

    return {
        stop: () => clearIntervalFn(timer)
    };
}

module.exports = {
    startH3GridScoreRefreshScheduler
};
