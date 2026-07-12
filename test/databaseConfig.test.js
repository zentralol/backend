const test = require('node:test');
const assert = require('node:assert/strict');

const DATABASE_CONFIG_PATH = require.resolve('../src/config/database');

function loadPoolWithEnv(overrides) {
    const keys = Object.keys(overrides);
    const saved = keys.map((key) => [key, process.env[key]]);

    for (const key of keys) {
        if (overrides[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = overrides[key];
        }
    }

    delete require.cache[DATABASE_CONFIG_PATH];

    try {
        return require(DATABASE_CONFIG_PATH);
    } finally {
        delete require.cache[DATABASE_CONFIG_PATH];
        for (const [key, value] of saved) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('pool bounds queries and connects with default timeouts and keepalive', () => {
    // Arrange & Act
    const pool = loadPoolWithEnv({
        DB_QUERY_TIMEOUT_MS: undefined,
        DB_CONNECT_TIMEOUT_MS: undefined
    });

    // Assert: without these a hung query/connect pends forever (pg defaults to 0)
    assert.equal(pool.options.query_timeout, 30000);
    assert.equal(pool.options.connectionTimeoutMillis, 10000);
    assert.equal(pool.options.keepAlive, true);
});

test('pool timeout overrides are honored', () => {
    const pool = loadPoolWithEnv({
        DB_QUERY_TIMEOUT_MS: '5000',
        DB_CONNECT_TIMEOUT_MS: '2000'
    });

    assert.equal(pool.options.query_timeout, 5000);
    assert.equal(pool.options.connectionTimeoutMillis, 2000);
});

test('invalid or non-positive timeout overrides fall back to defaults', () => {
    const pool = loadPoolWithEnv({
        DB_QUERY_TIMEOUT_MS: '-1',
        DB_CONNECT_TIMEOUT_MS: 'abc'
    });

    assert.equal(pool.options.query_timeout, 30000);
    assert.equal(pool.options.connectionTimeoutMillis, 10000);
});
