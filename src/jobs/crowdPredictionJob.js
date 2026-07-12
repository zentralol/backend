const mlClient = require('../services/mlClient');
const attractionRepository = require('../repositories/attractionRepository');
const scheduleConfig = require('../config/schedule');
const { mapWithConcurrency } = require('../utils/concurrency');
const { normalizeScore, busynessLevel } = require('../utils/busyness');

const MAX_LOGGED_FAILURES = 5;
const PREDICTION_SOURCE = 'ml';
const HOUR_MS = 3600000;

// The DB key is date_trunc('hour', predicted_for), so the JS side reports
// the same hourly bucket instead of a raw timestamp that never matches a row.
function truncateToHourIso(date) {
    return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS).toISOString();
}

function buildPredictionRow(attraction, predictedFor, mlResult) {
    const score = normalizeScore(mlResult.crowd_score);
    if (score === null) {
        throw new Error('ML prediction has no usable crowd_score');
    }

    const pedestrians = Number(mlResult.pedestrians);

    return {
        attractionId: attraction.id,
        predictedFor,
        crowdScore: score,
        crowdLevel: busynessLevel(score),
        crowdCategory: mlResult.crowd_category ?? null,
        pedestriansPred: Number.isFinite(pedestrians) ? pedestrians : null,
        h3Cell: mlResult.h3_cell ?? null,
        source: PREDICTION_SOURCE
    };
}

function createCrowdPredictionJob(deps = {}) {
    const {
        isMlConfigured = mlClient.isMlConfigured,
        callMlPrediction = mlClient.callMlPrediction,
        getAttractionsForPrediction = attractionRepository.getAttractionsForPrediction,
        upsertAttractionPrediction = attractionRepository.upsertAttractionPrediction,
        concurrency = scheduleConfig.concurrency,
        now = () => new Date(),
        logger = console
    } = deps;

    let running = false;

    async function predictOne(attraction, predictedFor) {
        const mlResult = await callMlPrediction(attraction.lat, attraction.lon, predictedFor);
        if (!mlResult) {
            throw new Error('ML service returned no prediction');
        }

        await upsertAttractionPrediction(buildPredictionRow(attraction, predictedFor, mlResult));
    }

    async function run() {
        if (running) return { alreadyRunning: true };

        if (!isMlConfigured()) {
            logger.warn('Crowd Prediction Job skipped: ML service is not configured');
            return { skipped: true, reason: 'ml_not_configured' };
        }

        running = true;
        const startedAt = Date.now();

        try {
            // One hour-truncated timestamp for the whole run: every
            // attraction lands in the same hourly bucket (matching the DB
            // key) and the past-or-present value makes mlClient route to
            // /predict/crowd.
            const predictedFor = truncateToHourIso(now());
            const { rows } = await getAttractionsForPrediction();

            const results = await mapWithConcurrency(rows, concurrency(), (attraction) =>
                predictOne(attraction, predictedFor)
            );

            const failures = results
                .map((result, index) => ({ result, attraction: rows[index] }))
                .filter(({ result }) => result.status === 'rejected');

            for (const { result, attraction } of failures.slice(0, MAX_LOGGED_FAILURES)) {
                logger.error(
                    `Crowd Prediction Failed for attraction ${attraction.id} (${attraction.name}):`,
                    result.reason.message
                );
            }
            if (failures.length > MAX_LOGGED_FAILURES) {
                logger.error(`Crowd Prediction: ${failures.length - MAX_LOGGED_FAILURES} more failures not shown`);
            }

            const summary = {
                total: rows.length,
                succeeded: rows.length - failures.length,
                failed: failures.length,
                predictedFor,
                durationMs: Date.now() - startedAt
            };
            logger.log('Crowd Prediction Job finished:', JSON.stringify(summary));

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

const defaultJob = createCrowdPredictionJob();

module.exports = {
    createCrowdPredictionJob,
    runCrowdPredictionJob: defaultJob.run
};
