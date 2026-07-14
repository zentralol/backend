const test = require('node:test');
const assert = require('node:assert/strict');

const { createHeatmapPredictionJob } = require('../src/jobs/heatmapPredictionJob');

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

const sampleCells = [
    { h3_cell: '892a1008803ffff', lat: 40.7978, lon: -73.9748 },
    { h3_cell: '892a1008807ffff', lat: 40.7952, lon: -73.9725 }
];

function buildDeps(overrides = {}) {
    const upserts = [];
    const deps = {
        isMlConfigured: () => true,
        callMlPrediction: async () => ({
            crowd_score: 0.62,
            crowd_category: 'moderate',
            pedestrians: 120,
            h3_cell: '892a1008803ffff',
            period: 'PM'
        }),
        getH3GridCells: async () => ({ rows: sampleCells }),
        upsertHeatmapPrediction: async (prediction) => {
            upserts.push(prediction);
        },
        deleteStaleHeatmapPredictions: async () => ({ rowCount: 3 }),
        gridLimit: () => 524,
        horizonHours: () => 1,
        retentionHours: () => 48,
        concurrency: () => 2,
        now: () => new Date('2026-07-10T14:00:00.000Z'),
        logger: silentLogger,
        ...overrides
    };

    return { deps, upserts };
}

test('predicts and upserts rows for each target time and grid cell', async () => {
    const { deps, upserts } = buildDeps();
    const job = createHeatmapPredictionJob(deps);

    const summary = await job.run();

    assert.equal(summary.targetTimes.length, 2);
    assert.equal(summary.gridCells, 2);
    assert.equal(summary.totalCells, 4);
    assert.equal(summary.succeeded, 4);
    assert.equal(summary.failed, 0);
    assert.equal(summary.deletedRows, 3);
    assert.equal(upserts.length, 4);
});

test('normalizes the ML score and derives the crowd level', async () => {
    const { deps, upserts } = buildDeps({ horizonHours: () => 0 });
    const job = createHeatmapPredictionJob(deps);

    await job.run();

    assert.equal(upserts[0].crowdScore, 62);
    assert.equal(upserts[0].crowdLevel, 'busy');
    assert.equal(upserts[0].crowdCategory, 'moderate');
    assert.equal(upserts[0].pedestriansPred, 120);
    assert.equal(upserts[0].source, 'ml_fastapi');
});

test('uses one shared target-time list for the whole run', async () => {
    const mlCalls = [];
    const { deps } = buildDeps({
        horizonHours: () => 1,
        callMlPrediction: async (lat, lon, targetTime) => {
            mlCalls.push(targetTime);
            return { crowd_score: 50, h3_cell: '892a1008803ffff' };
        }
    });
    const job = createHeatmapPredictionJob(deps);

    const summary = await job.run();

    assert.deepEqual(summary.targetTimes, ['2026-07-10T10:00:00', '2026-07-10T11:00:00']);
    assert.deepEqual(mlCalls, [
        '2026-07-10T10:00:00',
        '2026-07-10T10:00:00',
        '2026-07-10T11:00:00',
        '2026-07-10T11:00:00'
    ]);
});

test('counts a failed ML call without aborting the rest', async () => {
    const { deps, upserts } = buildDeps({
        horizonHours: () => 0,
        callMlPrediction: async (lat) => {
            if (lat === 40.7978) throw new Error('ML down');
            return { crowd_score: 30, h3_cell: '892a1008807ffff' };
        }
    });
    const job = createHeatmapPredictionJob(deps);

    const summary = await job.run();

    assert.equal(summary.failed, 1);
    assert.equal(summary.succeeded, 1);
    assert.equal(upserts.length, 1);
});

test('skips the run when the ML service is not configured', async () => {
    let cellsFetched = false;
    const { deps } = buildDeps({
        isMlConfigured: () => false,
        getH3GridCells: async () => {
            cellsFetched = true;
            return { rows: [] };
        }
    });
    const job = createHeatmapPredictionJob(deps);

    const summary = await job.run();

    assert.equal(summary.skipped, true);
    assert.equal(cellsFetched, false);
});

test('deletes stale rows using a Manhattan retention cutoff', async () => {
    let cutoff;
    const { deps } = buildDeps({
        horizonHours: () => 0,
        deleteStaleHeatmapPredictions: async (value) => {
            cutoff = value;
            return { rowCount: 0 };
        }
    });
    const job = createHeatmapPredictionJob(deps);

    await job.run();

    assert.equal(cutoff, '2026-07-08T10:00:00');
});

test('rejects re-entrant runs while a run is in progress', async () => {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const { deps } = buildDeps({
        horizonHours: () => 0,
        callMlPrediction: async () => {
            await gate;
            return { crowd_score: 10, h3_cell: '892a1008803ffff' };
        }
    });
    const job = createHeatmapPredictionJob(deps);

    const firstRun = job.run();
    const secondRunSummary = await job.run();
    release();
    const firstRunSummary = await firstRun;

    assert.equal(secondRunSummary.alreadyRunning, true);
    assert.equal(firstRunSummary.totalCells, 2);
    assert.equal(job.isRunning(), false);
});
