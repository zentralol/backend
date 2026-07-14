const mlClient = require('../services/mlClient');
const attractionRepository = require('../repositories/attractionRepository');
const scheduleConfig = require('../config/schedule');
const { mapWithConcurrency } = require('../utils/concurrency');
const { normalizeScore, busynessLevel } = require('../utils/busyness');

const MAX_LOGGED_FAILURES = 5;
const PREDICTION_SOURCE = 'ml';
const NEW_YORK_TIME_ZONE = 'America/New_York';
const FIVE_MINUTES = 5;

const NEW_YORK_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset'
});

// Build a five-minute wall-clock bucket in New York and keep its offset in the
// value sent to ML/Postgres. This makes the model use New York's local hour
// while preserving the correct instant for the timestamptz database column.
function truncateToFiveMinutesNewYorkIso(date) {
    const parts = Object.fromEntries(
        NEW_YORK_PARTS_FORMATTER.formatToParts(date)
            .filter(({ type }) => type !== 'literal')
            .map(({ type, value }) => [type, value])
    );
    const minute = Math.floor(Number(parts.minute) / FIVE_MINUTES) * FIVE_MINUTES;
    const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.replace('GMT', '');

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${String(minute).padStart(2, '0')}:00${offset}`;
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
        deleteStaleAttractionPredictions = attractionRepository.deleteStaleAttractionPredictions,
        concurrency = scheduleConfig.concurrency,
        retentionMs = scheduleConfig.retentionMs,
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
        if (running) {
            logger.warn('Crowd Prediction Job tick skipped: previous run still in progress');
            return { alreadyRunning: true };
        }

        running = true;
        const startedAt = Date.now();

        try {
            const cutoff = new Date(now().getTime() - retentionMs()).toISOString();
            const deletedCount = await deleteStaleAttractionPredictions(cutoff);

            if (!isMlConfigured()) {
                logger.warn('Crowd Prediction Job skipped: ML service is not configured');
                return { skipped: true, reason: 'ml_not_configured', deletedCount };
            }

            // One New York five-minute timestamp for the whole run: every
            // attraction lands in the same five-minute bucket (matching the
            // DB key) and the past-or-present value makes mlClient route to
            // /predict/crowd.
            const predictedFor = truncateToFiveMinutesNewYorkIso(now());
            logger.log(`Crowd Prediction Job started (predictedFor=${predictedFor})`);
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
                deletedCount,
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
