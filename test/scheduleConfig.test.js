const test = require('node:test');
const assert = require('node:assert/strict');

const scheduleConfig = require('../src/config/schedule');

function withEnv(overrides, fn) {
    const keys = Object.keys(overrides);
    const saved = keys.map((key) => [key, process.env[key]]);

    for (const key of keys) {
        if (overrides[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = overrides[key];
        }
    }

    try {
        return fn();
    } finally {
        for (const [key, value] of saved) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('jobEnabled is false when the flag is unset', () => {
    withEnv({ CROWD_PREDICTION_JOB_ENABLED: undefined }, () => {
        assert.equal(scheduleConfig.jobEnabled(), false);
    });
});

test('jobEnabled is true only for the literal string "true"', () => {
    withEnv({ CROWD_PREDICTION_JOB_ENABLED: 'true' }, () => {
        assert.equal(scheduleConfig.jobEnabled(), true);
    });
    withEnv({ CROWD_PREDICTION_JOB_ENABLED: 'TRUE' }, () => {
        assert.equal(scheduleConfig.jobEnabled(), false);
    });
    withEnv({ CROWD_PREDICTION_JOB_ENABLED: '1' }, () => {
        assert.equal(scheduleConfig.jobEnabled(), false);
    });
});

test('intervalMs defaults to five minutes when unset or invalid', () => {
    withEnv({ CROWD_PREDICTION_INTERVAL_MS: undefined }, () => {
        assert.equal(scheduleConfig.intervalMs(), 300000);
    });
    withEnv({ CROWD_PREDICTION_INTERVAL_MS: 'abc' }, () => {
        assert.equal(scheduleConfig.intervalMs(), 300000);
    });
    withEnv({ CROWD_PREDICTION_INTERVAL_MS: '0' }, () => {
        assert.equal(scheduleConfig.intervalMs(), 300000);
    });
    withEnv({ CROWD_PREDICTION_INTERVAL_MS: '-1' }, () => {
        assert.equal(scheduleConfig.intervalMs(), 300000);
    });
});

test('intervalMs honors a valid override', () => {
    withEnv({ CROWD_PREDICTION_INTERVAL_MS: '15000' }, () => {
        assert.equal(scheduleConfig.intervalMs(), 15000);
    });
});

test('concurrency defaults to 8 when unset or invalid', () => {
    withEnv({ CROWD_PREDICTION_CONCURRENCY: undefined }, () => {
        assert.equal(scheduleConfig.concurrency(), 8);
    });
    withEnv({ CROWD_PREDICTION_CONCURRENCY: 'nope' }, () => {
        assert.equal(scheduleConfig.concurrency(), 8);
    });
    withEnv({ CROWD_PREDICTION_CONCURRENCY: '-4' }, () => {
        assert.equal(scheduleConfig.concurrency(), 8);
    });
});

test('concurrency honors a valid override', () => {
    withEnv({ CROWD_PREDICTION_CONCURRENCY: '4' }, () => {
        assert.equal(scheduleConfig.concurrency(), 4);
    });
});
