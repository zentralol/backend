const test = require('node:test');
const assert = require('node:assert/strict');

const { startCrowdPredictionScheduler } = require('../src/jobs/scheduler');

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

function buildFakeTimer() {
    const registered = [];
    const setIntervalFn = (fn, ms) => {
        const timer = { fn, ms, cleared: false, unref: () => { timer.unrefCalled = true; } };
        registered.push(timer);
        return timer;
    };
    const clearIntervalFn = (timer) => {
        timer.cleared = true;
    };

    return { registered, setIntervalFn, clearIntervalFn };
}

test('does not start when the job is disabled', () => {
    // Arrange
    const { registered, setIntervalFn } = buildFakeTimer();
    let runs = 0;

    // Act
    const scheduler = startCrowdPredictionScheduler({
        runJob: async () => { runs += 1; },
        config: { jobEnabled: () => false, intervalMs: () => 1000 },
        logger: silentLogger,
        setIntervalFn
    });

    // Assert
    assert.equal(scheduler, null);
    assert.equal(registered.length, 0);
    assert.equal(runs, 0);
});

test('runs immediately and registers the configured interval when enabled', async () => {
    // Arrange
    const { registered, setIntervalFn, clearIntervalFn } = buildFakeTimer();
    let runs = 0;

    // Act
    const scheduler = startCrowdPredictionScheduler({
        runJob: async () => { runs += 1; },
        config: { jobEnabled: () => true, intervalMs: () => 15000 },
        logger: silentLogger,
        setIntervalFn,
        clearIntervalFn
    });
    await new Promise((resolve) => setImmediate(resolve));

    // Assert
    assert.equal(runs, 1);
    assert.equal(registered.length, 1);
    assert.equal(registered[0].ms, 15000);
    assert.equal(registered[0].unrefCalled, true);
    scheduler.stop();
});

test('ticks invoke the job and rejections are contained', async () => {
    // Arrange
    const { registered, setIntervalFn, clearIntervalFn } = buildFakeTimer();
    let runs = 0;
    const errors = [];

    const scheduler = startCrowdPredictionScheduler({
        runJob: async () => {
            runs += 1;
            throw new Error('run failed');
        },
        config: { jobEnabled: () => true, intervalMs: () => 1000 },
        logger: { ...silentLogger, error: (...args) => errors.push(args) },
        setIntervalFn,
        clearIntervalFn
    });
    await new Promise((resolve) => setImmediate(resolve));

    // Act: fire a tick manually; it must not reject
    await registered[0].fn();

    // Assert
    assert.equal(runs, 2);
    assert.ok(errors.length >= 2);
    scheduler.stop();
});

test('stop clears the interval', async () => {
    // Arrange
    const { registered, setIntervalFn, clearIntervalFn } = buildFakeTimer();

    const scheduler = startCrowdPredictionScheduler({
        runJob: async () => {},
        config: { jobEnabled: () => true, intervalMs: () => 1000 },
        logger: silentLogger,
        setIntervalFn,
        clearIntervalFn
    });
    await new Promise((resolve) => setImmediate(resolve));

    // Act
    scheduler.stop();

    // Assert
    assert.equal(registered[0].cleared, true);
});
