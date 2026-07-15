const test = require('node:test');
const assert = require('node:assert/strict');

const { createH3GridScoreRefreshJob, buildTargetTimestamps } = require('../src/jobs/h3GridScoreRefreshJob');

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

function buildDeps(overrides = {}) {
    const upserts = [];
    const deps = {
        isMlConfigured: () => true,
        callMlPrediction: async () => ({
            crowd_score: 0.62,
            crowd_category: 'moderate',
            pedestrians: 120,
            period: 'PM',
            h3_cell: '8a2a1072b59ffff'
        }),
        getH3GridCells: async () => ({
            rows: [
                { h3_cell: '8a2a1072b59ffff', lat: 40.7851, lon: -73.9683 },
                { h3_cell: '8a2a1072b5affff', lat: 40.758, lon: -73.9855 }
            ]
        }),
        upsertH3GridScore: async (score) => {
            upserts.push(score);
        },
        concurrency: () => 2,
        cellLimit: () => 524,
        horizonHours: () => 2,
        stepMinutes: () => 60,
        now: () => new Date('2026-07-13T10:23:45.000Z'),
        logger: silentLogger,
        ...overrides
    };

    return { deps, upserts };
}

test('buildTargetTimestamps rounds down to the step boundary and covers the horizon', () => {
    const timestamps = buildTargetTimestamps(new Date('2026-07-13T10:23:45.000Z'), 2, 60);

    assert.deepEqual(timestamps, [
        '2026-07-13T10:00:00.000Z',
        '2026-07-13T11:00:00.000Z'
    ]);
});

test('buildTargetTimestamps is stable across runs within the same bucket', () => {
    const first = buildTargetTimestamps(new Date('2026-07-13T10:05:00.000Z'), 1, 60);
    const second = buildTargetTimestamps(new Date('2026-07-13T10:55:00.000Z'), 1, 60);

    assert.deepEqual(first, second);
});

test('refreshes every cell for every bucket in the horizon on the happy path', async () => {
    // Arrange: 2 cells x 2 buckets (horizonHours=2, stepMinutes=60)
    const { deps, upserts } = buildDeps();
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.cells, 2);
    assert.equal(summary.buckets, 2);
    assert.equal(summary.total, 4);
    assert.equal(summary.succeeded, 4);
    assert.equal(summary.failed, 0);
    assert.equal(upserts.length, 4);
});

test('stores the raw ML crowd_score, not a normalized 0-100 value', async () => {
    // Arrange
    const { deps, upserts } = buildDeps();
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    await job.run();

    // Assert: h3_grid_scores stores raw model output; routes normalize on read
    assert.equal(upserts[0].crowdScore, 0.62);
    assert.equal(upserts[0].period, 'PM');
    assert.equal(upserts[0].pedestriansPred, 120);
    assert.equal(upserts[0].h3Cell, '8a2a1072b59ffff');
});

test('falls back to the cell h3_cell when the ML response omits it', async () => {
    // Arrange
    const { deps, upserts } = buildDeps({
        callMlPrediction: async () => ({ crowd_score: 0.4 })
    });
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    await job.run();

    // Assert
    assert.deepEqual(
        upserts.map((u) => u.h3Cell).sort(),
        ['8a2a1072b59ffff', '8a2a1072b59ffff', '8a2a1072b5affff', '8a2a1072b5affff']
    );
});

test('counts a failed ML call without aborting the rest', async () => {
    // Arrange
    const { deps, upserts } = buildDeps({
        callMlPrediction: async (lat) => {
            if (lat === 40.7851) throw new Error('ML down');
            return { crowd_score: 0.3 };
        }
    });
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    const summary = await job.run();

    // Assert: 2 buckets fail for the first cell, 2 succeed for the second
    assert.equal(summary.failed, 2);
    assert.equal(summary.succeeded, 2);
    assert.equal(upserts.length, 2);
});

test('counts an ML response without a usable crowd_score as a failure', async () => {
    // Arrange
    const { deps, upserts } = buildDeps({
        callMlPrediction: async () => ({})
    });
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.failed, 4);
    assert.equal(summary.succeeded, 0);
    assert.equal(upserts.length, 0);
});

test('skips the run when the ML service is not configured', async () => {
    // Arrange
    let cellsFetched = false;
    const { deps } = buildDeps({
        isMlConfigured: () => false,
        getH3GridCells: async () => {
            cellsFetched = true;
            return { rows: [] };
        }
    });
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    const summary = await job.run();

    // Assert
    assert.equal(summary.skipped, true);
    assert.equal(cellsFetched, false);
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
            return { crowd_score: 0.1 };
        }
    });
    const job = createH3GridScoreRefreshJob(deps);

    // Act
    const firstRun = job.run();
    const secondRunSummary = await job.run();
    release();
    const firstRunSummary = await firstRun;

    // Assert
    assert.equal(secondRunSummary.alreadyRunning, true);
    assert.equal(firstRunSummary.total, 4);
    assert.equal(job.isRunning(), false);
});

test('releases the run lock after a run that throws', async () => {
    // Arrange
    let shouldThrow = true;
    const { deps } = buildDeps({
        getH3GridCells: async () => {
            if (shouldThrow) throw new Error('db down');
            return { rows: [] };
        }
    });
    const job = createH3GridScoreRefreshJob(deps);

    // Act & Assert
    await assert.rejects(() => job.run(), /db down/);
    assert.equal(job.isRunning(), false);

    shouldThrow = false;
    const summary = await job.run();
    assert.equal(summary.total, 0);
});
