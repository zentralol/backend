const test = require('node:test');
const assert = require('node:assert/strict');

const { createCrowdPredictionJob } = require('../src/jobs/crowdPredictionJob');

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

function buildDeps(overrides = {}) {
    const upserts = [];
    const deleteCalls = [];
    const deps = {
        isMlConfigured: () => true,
        callMlPrediction: async () => ({
            crowd_score: 0.62,
            crowd_category: 'moderate',
            pedestrians: 120,
            h3_cell: '8a2a1072b59ffff'
        }),
        getAttractionsForPrediction: async () => ({
            rows: [
                { id: 1, name: 'Central Park', lat: 40.7851, lon: -73.9683 },
                { id: 2, name: 'Times Square', lat: 40.758, lon: -73.9855 }
            ]
        }),
        upsertAttractionPrediction: async (prediction) => {
            upserts.push(prediction);
        },
        deleteStaleAttractionPredictions: async (cutoffIso) => {
            deleteCalls.push(cutoffIso);
            return 3;
        },
        retentionMs: () => 3600000,
        concurrency: () => 2,
        now: () => new Date('2026-07-12T10:23:45.000Z'),
        logger: silentLogger,
        ...overrides
    };

    return { deps, upserts, deleteCalls };
}

test('predicts and upserts one row per attraction on the happy path', async () => {
    // Arrange
    const { deps, upserts, deleteCalls } = buildDeps();
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.total, 2);
    assert.equal(summary.succeeded, 2);
    assert.equal(summary.failed, 0);
    assert.equal(summary.deletedCount, 3);
    assert.equal(typeof summary.durationMs, 'number');
    assert.equal(upserts.length, 2);
    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0], '2026-07-12T09:23:45.000Z');
    assert.deepEqual(
        upserts.map((u) => u.attractionId).sort(),
        [1, 2]
    );
});

test('normalizes the ML score and derives the crowd level', async () => {
    // Arrange
    const { deps, upserts } = buildDeps();
    const job = createCrowdPredictionJob(deps);

    // Act
    await job.run();

    // Assert: 0.62 → 62 → 'busy' band (61-80)
    assert.equal(upserts[0].crowdScore, 62);
    assert.equal(upserts[0].crowdLevel, 'busy');
    assert.equal(upserts[0].crowdCategory, 'moderate');
    assert.equal(upserts[0].pedestriansPred, 120);
    assert.equal(upserts[0].h3Cell, '8a2a1072b59ffff');
    assert.equal(upserts[0].source, 'ml');
});

test('uses one shared New York five-minute predictedFor timestamp for the whole run', async () => {
    // Arrange
    const mlCalls = [];
    const { deps, upserts } = buildDeps({
        callMlPrediction: async (lat, lng, targetTime) => {
            mlCalls.push(targetTime);
            return { crowd_score: 50 };
        }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert: 10:23:45Z is 06:23:45 in New York during daylight time, so it
    // truncates to the 06:20 local bucket with the correct offset.
    assert.equal(summary.predictedFor, '2026-07-12T06:20:00-04:00');
    assert.deepEqual(mlCalls, [summary.predictedFor, summary.predictedFor]);
    assert.deepEqual(
        upserts.map((u) => u.predictedFor),
        [summary.predictedFor, summary.predictedFor]
    );
});

test('counts a failed ML call without aborting the rest', async () => {
    // Arrange
    const { deps, upserts } = buildDeps({
        callMlPrediction: async (lat) => {
            if (lat === 40.7851) throw new Error('ML down');
            return { crowd_score: 30 };
        }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.failed, 1);
    assert.equal(summary.succeeded, 1);
    assert.equal(upserts.length, 1);
});

test('counts an ML response without a usable crowd_score as a failure', async () => {
    // Arrange: HTTP 200 with an empty/partial body must not persist a null row
    const { deps, upserts } = buildDeps({
        callMlPrediction: async () => ({})
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.failed, 2);
    assert.equal(summary.succeeded, 0);
    assert.equal(upserts.length, 0);
});

test('counts a null ML response as a failure', async () => {
    // Arrange
    const { deps, upserts } = buildDeps({
        callMlPrediction: async () => null
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.failed, 2);
    assert.equal(summary.succeeded, 0);
    assert.equal(upserts.length, 0);
});

test('counts a failed upsert without aborting the rest', async () => {
    // Arrange
    let calls = 0;
    const { deps } = buildDeps({
        upsertAttractionPrediction: async () => {
            calls += 1;
            if (calls === 1) throw new Error('db write failed');
        }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.failed, 1);
    assert.equal(summary.succeeded, 1);
});

test('skips the run when the ML service is not configured', async () => {
    // Arrange
    let attractionsFetched = false;
    const { deps, deleteCalls } = buildDeps({
        isMlConfigured: () => false,
        getAttractionsForPrediction: async () => {
            attractionsFetched = true;
            return { rows: [] };
        }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.skipped, true);
    assert.equal(summary.deletedCount, 3);
    assert.equal(deleteCalls.length, 1);
    assert.equal(attractionsFetched, false);
});

test('still deletes stale predictions when the ML service is not configured', async () => {
    const { deps, deleteCalls } = buildDeps({
        isMlConfigured: () => false
    });
    const job = createCrowdPredictionJob(deps);

    await job.run();

    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0], '2026-07-12T09:23:45.000Z');
});

test('releases the run lock after delete throws', async () => {
    const { deps } = buildDeps({
        deleteStaleAttractionPredictions: async () => {
            throw new Error('delete failed');
        }
    });
    const job = createCrowdPredictionJob(deps);

    await assert.rejects(() => job.run(), /delete failed/);
    assert.equal(job.isRunning(), false);
});

test('logs the start and finish of every run', async () => {
    // Arrange
    const logs = [];
    const { deps } = buildDeps({
        logger: { ...silentLogger, log: (...args) => logs.push(args.join(' ')) }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    await job.run();

    // Assert
    assert.ok(
        logs.some((line) => line.includes('Crowd Prediction Job started')),
        `expected a start log, got: ${JSON.stringify(logs)}`
    );
    assert.ok(
        logs.some((line) => line.includes('Crowd Prediction Job finished')),
        `expected a finish log, got: ${JSON.stringify(logs)}`
    );
});

test('logs a warning when a tick is skipped because a run is in progress', async () => {
    // Arrange
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const warnings = [];
    const { deps } = buildDeps({
        callMlPrediction: async () => {
            await gate;
            return { crowd_score: 10 };
        },
        logger: { ...silentLogger, warn: (...args) => warnings.push(args.join(' ')) }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const firstRun = job.run();
    await job.run();
    release();
    await firstRun;

    // Assert
    assert.ok(
        warnings.some((line) => line.includes('previous run still in progress')),
        `expected a skip warning, got: ${JSON.stringify(warnings)}`
    );
});

test('rejects re-entrant runs while a run is in progress', async () => {
    // Arrange
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const { deps } = buildDeps({
        callMlPrediction: async () => {
            await gate;
            return { crowd_score: 10 };
        }
    });
    const job = createCrowdPredictionJob(deps);

    // Act
    const firstRun = job.run();
    const secondRunSummary = await job.run();
    release();
    const firstRunSummary = await firstRun;

    // Assert
    assert.equal(secondRunSummary.alreadyRunning, true);
    assert.equal(firstRunSummary.total, 2);
    assert.equal(job.isRunning(), false);
});

test('releases the run lock after a run that throws', async () => {
    // Arrange
    let shouldThrow = true;
    const { deps } = buildDeps({
        getAttractionsForPrediction: async () => {
            if (shouldThrow) throw new Error('db down');
            return { rows: [] };
        }
    });
    const job = createCrowdPredictionJob(deps);

    // Act & Assert
    await assert.rejects(() => job.run(), /db down/);
    assert.equal(job.isRunning(), false);

    shouldThrow = false;
    const summary = await job.run();
    assert.equal(summary.total, 0);
});
