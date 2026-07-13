const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const pool = require('../src/config/database');

const sampleAttractionRows = [
    {
        id: 1,
        name: 'Central Park',
        category: 'Parks & Outdoors',
        neighborhood: 'Midtown',
        description: 'Large park',
        lat: 40.7812,
        lon: -73.9665,
        distance_meters: 1200
    },
    {
        id: 2,
        name: 'Times Square',
        category: 'Landmarks',
        neighborhood: 'Midtown',
        description: 'Bright lights',
        lat: 40.7580,
        lon: -73.9855,
        distance_meters: 250
    }
];

const samplePredictionRows = [
    {
        attraction_id: 1,
        crowd_score: 42,
        crowd_level: 'quiet',
        predicted_for: '2026-07-01T16:30:00-04:00'
    },
    {
        attraction_id: 2,
        crowd_score: 82,
        crowd_level: 'very_busy',
        predicted_for: '2026-07-01T16:30:00-04:00'
    }
];

function withoutDistance(row) {
    const { distance_meters, ...rest } = row;
    return rest;
}

function filterAttractions(query, category) {
    const q = typeof query === 'string' ? query.toLowerCase() : null;
    const categoryFilter = typeof category === 'string' ? category.toLowerCase() : null;

    return sampleAttractionRows.filter((row) => {
        const matchesQuery = !q
            || row.name.toLowerCase().includes(q)
            || row.description.toLowerCase().includes(q)
            || row.neighborhood.toLowerCase().includes(q);
        const matchesCategory = !categoryFilter || row.category.toLowerCase() === categoryFilter;

        return matchesQuery && matchesCategory;
    });
}

function createMockDb() {
    const calls = [];

    async function query(sql, params = []) {
        const text = String(sql);
        calls.push({ sql: text, params });

        if (text.includes('FROM attractions') && text.includes('WHERE id = $1')) {
            const row = sampleAttractionRows.find((attraction) => attraction.id === params[0]);
            return {
                rowCount: row ? 1 : 0,
                rows: row ? [withoutDistance(row)] : []
            };
        }

        if (text.includes('FROM attractions') && text.includes('ILIKE') && text.includes('distance_meters')) {
            const rows = filterAttractions(params[0], params[1])
                .sort((a, b) => a.distance_meters - b.distance_meters);
            return {
                rowCount: rows.length,
                rows
            };
        }

        if (text.includes('FROM attractions') && text.includes('distance_meters')) {
            return {
                rowCount: sampleAttractionRows.length,
                rows: [...sampleAttractionRows].sort((a, b) => a.distance_meters - b.distance_meters)
            };
        }

        if (text.includes('FROM attractions') && text.includes('ILIKE')) {
            const rows = filterAttractions(params[0], params[1]).map(withoutDistance);
            return {
                rowCount: rows.length,
                rows
            };
        }

        if (text.includes('FROM attractions') && text.includes('ORDER BY name')) {
            return {
                rowCount: sampleAttractionRows.length,
                rows: sampleAttractionRows.map(withoutDistance)
            };
        }

        if (text.includes('FROM attraction_predictions')) {
            return {
                rowCount: samplePredictionRows.length,
                rows: samplePredictionRows
            };
        }

        throw new Error(`Unhandled SQL in attraction route test: ${text}`);
    }

    return { query, calls };
}

async function withTestServer(fn) {
    const originalQuery = pool.query;
    const mockDb = createMockDb();
    pool.query = mockDb.query;

    const app = require('../src/app');
    const server = app.listen(0);

    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address();
        await fn(`http://127.0.0.1:${port}`, mockDb.calls);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        pool.query = originalQuery;
    }
}

async function requestJson(baseUrl, path, options = {}) {
    const {
        auth = true,
        headers = {},
        ...fetchOptions
    } = options;
    const authHeaders = auth === false ? {} : {
        'x-test-user-id': 'user_123'
    };

    const response = await fetch(`${baseUrl}${path}`, {
        ...fetchOptions,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
            ...headers
        }
    });

    return {
        status: response.status,
        body: await response.json()
    };
}

test('GET /attractions returns attractions with crowd data', async () => {
    await withTestServer(async (baseUrl, calls) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions?limit=10');

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.equal(response.body.data.attractions.length, 2);
        assert.equal(response.body.data.attractions[0].name, 'Central Park');
        assert.equal(response.body.data.attractions[0].lng, -73.9665);
        assert.equal(response.body.data.attractions[0].crowd.level, 'quiet');
        assert.equal(response.body.meta.count, 2);
        assert.ok(calls.some((call) => call.sql.includes('FROM attractions')));
        assert.ok(calls.some((call) => call.sql.includes('FROM attraction_predictions')));
    });
});

test('GET /attractions rejects unauthenticated requests', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions', { auth: false });

        assert.equal(response.status, 401);
        assert.equal(response.body.error.code, 'UNAUTHORIZED');
    });
});

test('GET /attractions/nearby returns distance-sorted attractions', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(
            baseUrl,
            '/api/v1/attractions/nearby?lat=40.758&lng=-73.9855&limit=5'
        );

        assert.equal(response.status, 200);
        assert.equal(response.body.data.attractions[0].name, 'Times Square');
        assert.equal(response.body.data.attractions[0].distanceMeters, 250);
        assert.equal(response.body.data.attractions[1].name, 'Central Park');
        assert.equal(response.body.data.attractions[1].distanceMeters, 1200);
    });
});

test('GET /attractions/nearby rejects invalid coordinates', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions/nearby?lat=bad&lng=-73.9855');

        assert.equal(response.status, 422);
        assert.equal(response.body.error.code, 'INVALID_COORDINATES');
    });
});

test('GET /attractions/nearby rejects out-of-coverage coordinates', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions/nearby?lat=41.2&lng=-73.9855');

        assert.equal(response.status, 422);
        assert.equal(response.body.error.code, 'LOCATION_OUT_OF_COVERAGE');
    });
});

test('GET /attractions/search filters by query and category', async () => {
    await withTestServer(async (baseUrl, calls) => {
        const response = await requestJson(
            baseUrl,
            '/api/v1/attractions/search?q=Central&category=Parks%20%26%20Outdoors&limit=5'
        );

        assert.equal(response.status, 200);
        assert.equal(response.body.data.attractions.length, 1);
        assert.equal(response.body.data.attractions[0].name, 'Central Park');
        assert.equal(response.body.data.attractions[0].crowd.level, 'quiet');
        assert.ok(calls.some((call) => call.sql.includes('ILIKE') && call.params[0] === 'Central'));
    });
});

test('GET /attractions/search can distance-sort filtered results', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(
            baseUrl,
            '/api/v1/attractions/search?q=Midtown&lat=40.758&lng=-73.9855&limit=5'
        );

        assert.equal(response.status, 200);
        assert.equal(response.body.data.attractions.length, 2);
        assert.equal(response.body.data.attractions[0].name, 'Times Square');
        assert.equal(response.body.data.attractions[0].distanceMeters, 250);
    });
});

test('GET /attractions/search rejects invalid optional coordinates', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions/search?q=park&lat=bad&lng=-73.9855');

        assert.equal(response.status, 422);
        assert.equal(response.body.error.code, 'INVALID_COORDINATES');
    });
});

test('GET /attractions/:id returns one attraction with crowd data', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions/1');

        assert.equal(response.status, 200);
        assert.equal(response.body.data.attraction.name, 'Central Park');
        assert.equal(response.body.data.attraction.crowd.level, 'quiet');
    });
});

test('GET /attractions/:id rejects invalid ids', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions/not-a-number');

        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'INVALID_QUERY');
    });
});

test('GET /attractions/:id returns 404 when missing', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/attractions/999');

        assert.equal(response.status, 404);
        assert.equal(response.body.error.code, 'ATTRACTION_NOT_FOUND');
    });
});