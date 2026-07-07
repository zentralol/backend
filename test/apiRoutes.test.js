const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/database');

function createMockDb() {
    const calls = [];

    async function query(sql, params = []) {
        const text = String(sql);
        calls.push({ sql: text, params });

        if (text === 'SELECT 1') {
            return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }

        if (text.includes('zentra_get_heatmap_scores')) {
            return {
                rowCount: 1,
                rows: [{
                    h3_cell: '892a1008807ffff',
                    lat: 40.7952,
                    lon: -73.9725,
                    period: 'PM',
                    query_timestamp: '2026-07-01T16:30:00-04:00',
                    crowd_score: 0.53,
                    pedestrians_pred: 3399.1,
                    poi_total: 42
                }]
            };
        }

        if (text.includes('zentra_get_nearest_prediction_score')) {
            return {
                rowCount: 1,
                rows: [{
                    id: 123,
                    h3_cell: '892a100d67bffff',
                    lat: 40.7581,
                    lon: -73.9854,
                    period: 'PM',
                    query_timestamp: '2026-07-01T16:30:00-04:00',
                    crowd_score: 0.82,
                    pedestrians_pred: 3067.3,
                    ensemble_log_pred: 8.1,
                    poi_total: 25,
                    poi_density_score: 0.7,
                    tlc_trip_count: 100,
                    mta_ridership_total: 200,
                    citibike_trip_count: 50,
                    created_at: '2026-07-01T12:00:00Z'
                }]
            };
        }

        if (text.includes('zentra_get_nearest_h3_cell')) {
            return {
                rowCount: 1,
                rows: [{ h3_cell: '892a100d67bffff' }]
            };
        }

        if (text.includes('zentra_get_forecast_scores')) {
            return {
                rowCount: 1,
                rows: [{
                    h3_cell: '892a100d67bffff',
                    lat: 40.7581,
                    lon: -73.9854,
                    period: 'PM',
                    query_timestamp: '2026-07-01T16:30:00-04:00',
                    crowd_score: 0.82,
                    pedestrians_pred: 3067.3
                }]
            };
        }

        if (text.includes('zentra_get_quieter_nearby_scores')) {
            return {
                rowCount: 1,
                rows: [{
                    h3_cell: '892a100d6d3ffff',
                    lat: 40.7714,
                    lon: -73.9737,
                    period: 'PM',
                    query_timestamp: '2026-07-01T16:30:00-04:00',
                    crowd_score: 0.38,
                    pedestrians_pred: 920.4,
                    distance_score: 0.01
                }]
            };
        }

        if (text.includes('INSERT INTO prediction_requests')) {
            return { rowCount: 1, rows: [] };
        }

        if (text.includes('INSERT INTO feedback')) {
            return {
                rowCount: 1,
                rows: [{
                    id: 1,
                    user_id: 'user_123',
                    h3_cell: '892a100d67bffff',
                    rating: 5,
                    was_useful: true,
                    comment: 'Useful',
                    created_at: '2026-07-01T12:00:00Z'
                }]
            };
        }

        if (text.includes('COUNT(*)::int AS total_requests')) {
            return {
                rowCount: 1,
                rows: [{
                    total_requests: 4,
                    average_crowd_score: 70.5,
                    ml_requests: 1,
                    cached_requests: 3,
                    unique_h3_cells: 2
                }]
            };
        }

        if (text.includes('GROUP BY matched_h3_cell')) {
            return {
                rowCount: 1,
                rows: [{
                    matched_h3_cell: '892a100d67bffff',
                    request_count: 3,
                    average_crowd_score: 75.2
                }]
            };
        }

        throw new Error(`Unhandled SQL in test: ${text}`);
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
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    return {
        status: response.status,
        body: await response.json()
    };
}

test('GET /health returns database status', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/health');

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.equal(response.body.data.database, 'connected');
    });
});

test('GET /map/heatmap returns database-backed H3 points', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/map/heatmap?source=database&limit=1&targetTime=2026-07-01T16:30:00-04:00');

        assert.equal(response.status, 200);
        assert.equal(response.body.data.source, 'h3_grid_scores');
        assert.equal(response.body.data.points[0].crowdScore, 53);
        assert.equal(response.body.data.points[0].crowdLevel, 'moderate');
    });
});

test('GET /map/heatmap rejects invalid targetTime', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/map/heatmap?targetTime=not-a-date');

        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'INVALID_QUERY');
    });
});

test('POST /predictions returns fallback prediction and logs request', async () => {
    await withTestServer(async (baseUrl, calls) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions', {
            method: 'POST',
            body: JSON.stringify({
                lat: 40.758,
                lng: -73.9855,
                targetTime: '2026-07-01T16:30:00-04:00',
                durationMinutes: 60
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.prediction.busynessScore, 82);
        assert.equal(response.body.data.prediction.source, 'h3_grid_scores');
        assert.ok(calls.some((call) => call.sql.includes('INSERT INTO prediction_requests')));
    });
});

test('POST /predictions rejects out-of-coverage coordinates', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions', {
            method: 'POST',
            body: JSON.stringify({
                lat: 41.2,
                lng: -73.9855,
                targetTime: '2026-07-01T16:30:00-04:00',
                durationMinutes: 60
            })
        });

        assert.equal(response.status, 422);
        assert.equal(response.body.error.code, 'LOCATION_OUT_OF_COVERAGE');
    });
});

test('POST /predictions/batch accepts coordinates and returns warnings for invalid items', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions/batch', {
            method: 'POST',
            body: JSON.stringify({
                targetTime: '2026-07-01T16:30:00-04:00',
                durationMinutes: 60,
                coordinates: [
                    { clientId: 'valid', lat: 40.758, lng: -73.9855 },
                    { clientId: 'bad', lat: 'x', lng: -73.9855 }
                ]
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.predictions.length, 1);
        assert.equal(response.body.data.warnings.length, 1);
        assert.equal(response.body.data.warnings[0].code, 'INVALID_COORDINATES');
    });
});

test('GET /predictions/forecast returns forecast rows', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2026-07-01T00:00:00-04:00&endTime=2026-07-02T00:00:00-04:00&limit=5');

        assert.equal(response.status, 200);
        assert.equal(response.body.data.h3Cell, '892a100d67bffff');
        assert.equal(response.body.data.forecast[0].busynessLevel, 'very_busy');
    });
});

test('POST /recommendations returns quieter nearby areas', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/recommendations', {
            method: 'POST',
            body: JSON.stringify({
                lat: 40.758,
                lng: -73.9855,
                targetTime: '2026-07-01T16:30:00-04:00',
                limit: 3
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.recommendations[0].busynessScore, 38);
        assert.equal(response.body.data.recommendations[0].busynessLevel, 'quiet');
    });
});

test('POST /feedback stores feedback', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/feedback', {
            method: 'POST',
            body: JSON.stringify({
                userId: 'user_123',
                h3Cell: '892a100d67bffff',
                rating: 5,
                wasUseful: true,
                comment: 'Useful'
            })
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.data.feedback.rating, 5);
        assert.equal(response.body.data.feedback.wasUseful, true);
    });
});

test('POST /feedback rejects invalid rating', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/feedback', {
            method: 'POST',
            body: JSON.stringify({ rating: 8 })
        });

        assert.equal(response.status, 422);
        assert.equal(response.body.error.code, 'INVALID_RATING');
    });
});

test('GET /admin/stats/predictions returns aggregate stats', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/admin/stats/predictions');

        assert.equal(response.status, 200);
        assert.equal(response.body.data.totalPredictionRequests, 4);
        assert.equal(response.body.data.cacheHitRate, 0.75);
        assert.equal(response.body.data.mostRequestedH3Cells[0].count, 3);
    });
});

test('GET /admin/stats/predictions rejects invalid dates', async () => {
    await withTestServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/admin/stats/predictions?startDate=bad-date');

        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'INVALID_QUERY');
    });
});
