const test = require('node:test');
const assert = require('node:assert/strict');

function loadMlClientWithEnv(baseUrl = '', timeoutMs = '5000') {
    const mlPath = require.resolve('../src/services/mlClient');
    const configPath = require.resolve('../src/config/ml');
    delete require.cache[mlPath];
    delete require.cache[configPath];

    process.env.ML_API_BASE_URL = baseUrl;
    process.env.ML_API_TIMEOUT_MS = timeoutMs;

    return require('../src/services/mlClient');
}

test('mlClient reports unconfigured service and returns null', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
        throw new Error('fetch should not be called');
    };

    try {
        const mlClient = loadMlClientWithEnv('');

        assert.equal(mlClient.isMlConfigured(), false);
        assert.equal(await mlClient.callMlPrediction(40.758, -73.9855, '2026-07-01T16:30:00-04:00'), null);
    } finally {
        global.fetch = originalFetch;
    }
});

test('mlClient calls current crowd endpoint and returns JSON', async () => {
    const originalFetch = global.fetch;
    let calledUrl = null;
    let calledBody = null;

    global.fetch = async (url, options) => {
        calledUrl = url;
        calledBody = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({ h3_cell: 'cell', crowd_score: 0.7 })
        };
    };

    try {
        const mlClient = loadMlClientWithEnv('http://ml.local/');
        const result = await mlClient.callMlPrediction(40.758, -73.9855, '2020-01-01T00:00:00Z');

        assert.equal(mlClient.isMlConfigured(), true);
        assert.equal(calledUrl, 'http://ml.local/predict/crowd');
        assert.deepEqual(calledBody, { lat: 40.758, lon: -73.9855, when: '2020-01-01T00:00:00Z' });
        assert.deepEqual(result, { h3_cell: 'cell', crowd_score: 0.7 });
    } finally {
        global.fetch = originalFetch;
    }
});

test('mlClient calls future endpoint for future targetTime', async () => {
    const originalFetch = global.fetch;
    let calledUrl = null;

    global.fetch = async (url) => {
        calledUrl = url;
        return {
            ok: true,
            json: async () => ({ h3_cell: 'future-cell', crowd_score: 0.5 })
        };
    };

    try {
        const mlClient = loadMlClientWithEnv('http://ml.local');
        await mlClient.callMlPrediction(40.758, -73.9855, '2099-01-01T00:00:00Z');

        assert.equal(calledUrl, 'http://ml.local/predict/future');
    } finally {
        global.fetch = originalFetch;
    }
});

test('mlClient throws when ML API responds with non-2xx status', async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({ ok: false, status: 503 });

    try {
        const mlClient = loadMlClientWithEnv('http://ml.local');
        await assert.rejects(
            () => mlClient.callMlPrediction(40.758, -73.9855, '2020-01-01T00:00:00Z'),
            /ML API returned 503/
        );
    } finally {
        global.fetch = originalFetch;
    }
});
