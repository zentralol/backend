const mlClient = require('../services/mlClient');
const h3Repository = require('../repositories/h3Repository');
const heatmapRepository = require('../repositories/heatmapRepository');
const scheduleConfig = require('../config/schedule');
const { mapWithConcurrency } = require('../utils/concurrency');
const { normalizeScore, busynessLevel } = require('../utils/busyness');
const {
    buildHeatmapTargetTimes,
    buildHeatmapRetentionCutoff
} = require('../utils/heatmapTargetTimes');

const MAX_LOGGED_FAILURES = 5;
const PREDICTION_SOURCE = 'ml_fastapi';

function buildPredictionRow(cell, targetTime, mlResult) {
    const score = normalizeScore(mlResult.crowd_score);
    if (score === null) {
        throw new Error('ML prediction has no usable crowd_score');
    }

    const pedestrians = Number(mlResult.pedestrians);

    return {
        targetTime,
        h3Cell: mlResult.h3_cell || cell.h3_cell,
        lat: cell.lat,
        lon: cell.lon,
        crowdScore: score,
        crowdLevel: busynessLevel(score),
        crowdCategory: mlResult.crowd_category ?? null,
        pedestriansPred: Number.isFinite(pedestrians) ? pedestrians : null,
        period: mlResult.period ?? null,
        source: PREDICTION_SOURCE
    };
}

function createHeatmapPredictionJob(deps = {}) {
    const {
        isMlConfigured = mlClient.isMlConfigured,
        callMlPrediction = mlClient.callMlPrediction,
        getH3GridCells = h3Repository.getH3GridCells,
        upsertHeatmapPrediction = heatmapRepository.upsertHeatmapPrediction,
        deleteStaleHeatmapPredictions = heatmapRepository.deleteStaleHeatmapPredictions,
        gridLimit = scheduleConfig.heatmapGridLimit,
        horizonHours = scheduleConfig.heatmapHorizonHours,
        retentionHours = scheduleConfig.heatmapRetentionHours,
        concurrency = scheduleConfig.heatmapConcurrency,
        now = () => new Date(),
        logger = console
    } = deps;

    let running = false;

    async function predictOne(cell, targetTime) {
        const mlResult = await callMlPrediction(cell.lat, cell.lon, targetTime);
        if (!mlResult) {
            throw new Error('ML service returned no prediction');
        }

        await upsertHeatmapPrediction(buildPredictionRow(cell, targetTime, mlResult));
    }

    async function run() {
        if (running) {
            logger.warn('Heatmap Prediction Job tick skipped: previous run still in progress');
            return { alreadyRunning: true };
        }

        if (!isMlConfigured()) {
            logger.warn('Heatmap Prediction Job skipped: ML service is not configured');
            return { skipped: true, reason: 'ml_not_configured' };
        }

        running = true;
        const startedAt = Date.now();
        const currentTime = now();
        const targetTimes = buildHeatmapTargetTimes(currentTime, horizonHours());
        const cutoffTargetTime = buildHeatmapRetentionCutoff(currentTime, retentionHours());

        try {
            logger.log(
                `Heatmap Prediction Job started (targetTimes=${targetTimes.length}, gridLimit=${gridLimit()})`
            );

            const { rows } = await getH3GridCells(gridLimit());
            let totalFailures = 0;
            let totalSucceeded = 0;

            for (const targetTime of targetTimes) {
                const results = await mapWithConcurrency(rows, concurrency(), (cell) =>
                    predictOne(cell, targetTime)
                );

                const failures = results.filter((result) => result.status === 'rejected');
                totalFailures += failures.length;
                totalSucceeded += rows.length - failures.length;

                for (const { reason } of failures.slice(0, MAX_LOGGED_FAILURES)) {
                    logger.error(
                        `Heatmap Prediction Failed for targetTime ${targetTime}:`,
                        reason.message
                    );
                }
            }

            const deleteResult = await deleteStaleHeatmapPredictions(cutoffTargetTime);
            const deletedRows = deleteResult.rowCount ?? 0;

            const summary = {
                targetTimes,
                gridCells: rows.length,
                totalCells: rows.length * targetTimes.length,
                succeeded: totalSucceeded,
                failed: totalFailures,
                deletedRows,
                cutoffTargetTime,
                durationMs: Date.now() - startedAt
            };

            logger.log('Heatmap Prediction Job finished:', JSON.stringify(summary));
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

const defaultJob = createHeatmapPredictionJob();

module.exports = {
    createHeatmapPredictionJob,
    runHeatmapPredictionJob: defaultJob.run
};
