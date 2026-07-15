const mlClient = require('../services/mlClient');
const h3Repository = require('../repositories/h3Repository');
const h3GridRefreshConfig = require('../config/h3GridRefresh');
const { mapWithConcurrency } = require('../utils/concurrency');

const MAX_LOGGED_FAILURES = 5;

// Rounds down to a fixed UTC step boundary so repeated runs land on the same
// bucket timestamps and upsert in place instead of growing the table forever.
function truncateToStepUtc(date, stepMinutesValue) {
    const stepMs = stepMinutesValue * 60000;
    return new Date(Math.floor(date.getTime() / stepMs) * stepMs);
}

// Builds the rolling window of future timestamps to keep scored for every
// cell: bucket 0 is "now" (rounded down), and each subsequent bucket is one
// step further out, covering horizonHours in total.
function buildTargetTimestamps(now, horizonHoursValue, stepMinutesValue) {
    const stepMs = stepMinutesValue * 60000;
    const bucketCount = Math.max(1, Math.round((horizonHoursValue * 60) / stepMinutesValue));
    const base = truncateToStepUtc(now, stepMinutesValue);

    return Array.from({ length: bucketCount }, (_, i) => new Date(base.getTime() + i * stepMs).toISOString());
}

function createH3GridScoreRefreshJob(deps = {}) {
    const {
        isMlConfigured = mlClient.isMlConfigured,
        callMlPrediction = mlClient.callMlPrediction,
        getH3GridCells = h3Repository.getH3GridCells,
        upsertH3GridScore = h3Repository.upsertH3GridScore,
        concurrency = h3GridRefreshConfig.concurrency,
        cellLimit = h3GridRefreshConfig.cellLimit,
        horizonHours = h3GridRefreshConfig.horizonHours,
        stepMinutes = h3GridRefreshConfig.stepMinutes,
        now = () => new Date(),
        logger = console
    } = deps;

    let running = false;

    async function refreshOne(cell, targetTime) {
        const mlResult = await callMlPrediction(cell.lat, cell.lon, targetTime);
        if (!mlResult) {
            throw new Error('ML service returned no prediction');
        }

        const crowdScore = Number(mlResult.crowd_score);
        if (!Number.isFinite(crowdScore)) {
            throw new Error('ML prediction has no usable crowd_score');
        }

        const pedestrians = Number(mlResult.pedestrians);

        await upsertH3GridScore({
            h3Cell: mlResult.h3_cell || cell.h3_cell,
            lat: cell.lat,
            lon: cell.lon,
            period: mlResult.period ?? null,
            queryTimestamp: targetTime,
            crowdScore,
            pedestriansPred: Number.isFinite(pedestrians) ? pedestrians : null
        });
    }

    async function run() {
        if (running) {
            logger.warn('H3 Grid Score Refresh Job tick skipped: previous run still in progress');
            return { alreadyRunning: true };
        }

        if (!isMlConfigured()) {
            logger.warn('H3 Grid Score Refresh Job skipped: ML service is not configured');
            return { skipped: true, reason: 'ml_not_configured' };
        }

        running = true;
        const startedAt = Date.now();

        try {
            const targetTimestamps = buildTargetTimestamps(now(), horizonHours(), stepMinutes());
            logger.log(`H3 Grid Score Refresh Job started (buckets=${targetTimestamps.length})`);

            const { rows: cells } = await getH3GridCells(cellLimit());

            const tasks = [];
            for (const cell of cells) {
                for (const targetTime of targetTimestamps) {
                    tasks.push({ cell, targetTime });
                }
            }

            const results = await mapWithConcurrency(tasks, concurrency(), (task) =>
                refreshOne(task.cell, task.targetTime)
            );

            const failures = results.filter((result) => result.status === 'rejected');

            for (const result of failures.slice(0, MAX_LOGGED_FAILURES)) {
                logger.error('H3 Grid Score Refresh Failed:', result.reason.message);
            }
            if (failures.length > MAX_LOGGED_FAILURES) {
                logger.error(`H3 Grid Score Refresh: ${failures.length - MAX_LOGGED_FAILURES} more failures not shown`);
            }

            const summary = {
                cells: cells.length,
                buckets: targetTimestamps.length,
                total: tasks.length,
                succeeded: tasks.length - failures.length,
                failed: failures.length,
                durationMs: Date.now() - startedAt
            };
            logger.log('H3 Grid Score Refresh Job finished:', JSON.stringify(summary));

            return summary;
        } finally {
            running = false;
        }
    }

    return {
        run,
        isRunning: () => running
    };
}

const defaultJob = createH3GridScoreRefreshJob();

module.exports = {
    createH3GridScoreRefreshJob,
    buildTargetTimestamps,
    runH3GridScoreRefreshJob: defaultJob.run
};
