const test = require('node:test');
const assert = require('node:assert/strict');

const h3GridRefreshConfig = require('../src/config/h3GridRefresh');

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
    withEnv({ H3_GRID_REFRESH_JOB_ENABLED: undefined }, () => {
        assert.equal(h3GridRefreshConfig.jobEnabled(), false);
    });
});

test('jobEnabled is true only for the literal string "true"', () => {
    withEnv({ H3_GRID_REFRESH_JOB_ENABLED: 'true' }, () => {
        assert.equal(h3GridRefreshConfig.jobEnabled(), true);
    });
    withEnv({ H3_GRID_REFRESH_JOB_ENABLED: 'TRUE' }, () => {
        assert.equal(h3GridRefreshConfig.jobEnabled(), false);
    });
    withEnv({ H3_GRID_REFRESH_JOB_ENABLED: '1' }, () => {
        assert.equal(h3GridRefreshConfig.jobEnabled(), false);
    });
});

test('intervalMs defaults to one hour when unset or invalid', () => {
    withEnv({ H3_GRID_REFRESH_INTERVAL_MS: undefined }, () => {
        assert.equal(h3GridRefreshConfig.intervalMs(), 3600000);
    });
    withEnv({ H3_GRID_REFRESH_INTERVAL_MS: 'abc' }, () => {
        assert.equal(h3GridRefreshConfig.intervalMs(), 3600000);
    });
    withEnv({ H3_GRID_REFRESH_INTERVAL_MS: '0' }, () => {
        assert.equal(h3GridRefreshConfig.intervalMs(), 3600000);
    });
});

test('intervalMs honors a valid override', () => {
    withEnv({ H3_GRID_REFRESH_INTERVAL_MS: '15000' }, () => {
        assert.equal(h3GridRefreshConfig.intervalMs(), 15000);
    });
});

test('concurrency defaults to 8 when unset or invalid', () => {
    withEnv({ H3_GRID_REFRESH_CONCURRENCY: undefined }, () => {
        assert.equal(h3GridRefreshConfig.concurrency(), 8);
    });
    withEnv({ H3_GRID_REFRESH_CONCURRENCY: '-4' }, () => {
        assert.equal(h3GridRefreshConfig.concurrency(), 8);
    });
});

test('concurrency honors a valid override', () => {
    withEnv({ H3_GRID_REFRESH_CONCURRENCY: '4' }, () => {
        assert.equal(h3GridRefreshConfig.concurrency(), 4);
    });
});

test('cellLimit defaults to 524 when unset or invalid', () => {
    withEnv({ H3_GRID_REFRESH_CELL_LIMIT: undefined }, () => {
        assert.equal(h3GridRefreshConfig.cellLimit(), 524);
    });
    withEnv({ H3_GRID_REFRESH_CELL_LIMIT: 'nope' }, () => {
        assert.equal(h3GridRefreshConfig.cellLimit(), 524);
    });
});

test('cellLimit honors a valid override', () => {
    withEnv({ H3_GRID_REFRESH_CELL_LIMIT: '100' }, () => {
        assert.equal(h3GridRefreshConfig.cellLimit(), 100);
    });
});

test('horizonHours defaults to 6 when unset or invalid', () => {
    withEnv({ H3_GRID_REFRESH_HORIZON_HOURS: undefined }, () => {
        assert.equal(h3GridRefreshConfig.horizonHours(), 6);
    });
    withEnv({ H3_GRID_REFRESH_HORIZON_HOURS: '-1' }, () => {
        assert.equal(h3GridRefreshConfig.horizonHours(), 6);
    });
});

test('horizonHours honors a valid override', () => {
    withEnv({ H3_GRID_REFRESH_HORIZON_HOURS: '24' }, () => {
        assert.equal(h3GridRefreshConfig.horizonHours(), 24);
    });
});

test('stepMinutes defaults to 60 when unset or invalid', () => {
    withEnv({ H3_GRID_REFRESH_STEP_MINUTES: undefined }, () => {
        assert.equal(h3GridRefreshConfig.stepMinutes(), 60);
    });
    withEnv({ H3_GRID_REFRESH_STEP_MINUTES: 'x' }, () => {
        assert.equal(h3GridRefreshConfig.stepMinutes(), 60);
    });
});

test('stepMinutes honors a valid override', () => {
    withEnv({ H3_GRID_REFRESH_STEP_MINUTES: '30' }, () => {
        assert.equal(h3GridRefreshConfig.stepMinutes(), 30);
    });
});
