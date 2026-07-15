const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const pool = require('../src/config/database');

function createMockDb(mode = {}) {
    async function query(sql, params = []) {
        const text = String(sql);

        if (mode.throwOn && text.includes(mode.throwOn)) {
            throw new Error(mode.errorMessage || 'forced db error');
        }

        if (text === 'SELECT 1') {
            if (mode.healthFails) throw new Error('database down');
            return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }

        if (text.includes('zentra_get_heatmap_scores')) {
            if (mode.emptyHeatmap) return { rowCount: 0, rows: [] };
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
            if (mode.emptyPrediction) return { rowCount: 0, rows: [] };
            if (mode.throwPrediction) throw new Error('prediction db failed');
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
            if (mode.emptyNearestCell) return { rowCount: 0, rows: [] };
            return { rowCount: 1, rows: [{ h3_cell: '892a100d67bffff' }] };
        }

        if (text.includes('zentra_get_forecast_scores')) {
            if (mode.throwForecast) throw new Error('forecast db failed');
            if (mode.emptyForecast) return { rowCount: 0, rows: [] };
            return {
                rowCount: 2,
                rows: [
                    {
                        h3_cell: '892a100d67bffff',
                        lat: 40.7581,
                        lon: -73.9854,
                        period: 'PM',
                        query_timestamp: '2026-07-01T16:30:00-04:00',
                        crowd_score: 0.82,
                        pedestrians_pred: 3067.3
                    },
                    {
                        h3_cell: '892a100d67bffff',
                        lat: 40.7581,
                        lon: -73.9854,
                        period: 'AM',
                        query_timestamp: '2026-07-01T10:00:00-04:00',
                        crowd_score: 0.35,
                        pedestrians_pred: 900.1
                    }
                ]
            };
        }

        if (text.includes('zentra_get_quieter_nearby_scores')) {
            if (mode.throwRecommendations) throw new Error('recommendation db failed');
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
            if (mode.throwPredictionLog) throw new Error('log write failed');
            return { rowCount: 1, rows: [] };
        }

        if (text.includes('INSERT INTO feedback')) {
            if (mode.throwFeedback) throw new Error('feedback db failed');
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

        if (text.includes('zentra_get_feedback_stats')) {
            if (mode.throwFeedbackStats) throw new Error('feedback stats db failed');
            return {
                rowCount: 1,
                rows: [{
                    total_feedback: 0,
                    average_rating: null,
                    useful_rate: null
                }]
            };
        }

        if (text.includes('zentra_get_feedback_by_h3_cell')) {
            return { rowCount: 0, rows: [] };
        }

        if (text.includes('zentra_get_recent_feedback_comments')) {
            return { rowCount: 0, rows: [] };
        }

        if (text.includes('COUNT(*)::int AS total_requests')) {
            if (mode.throwStats) throw new Error('stats db failed');
            return {
                rowCount: 1,
                rows: [{
                    total_requests: mode.zeroStats ? 0 : 4,
                    average_crowd_score: mode.zeroStats ? null : 70.5,
                    ml_requests: 0,
                    cached_requests: mode.zeroStats ? 0 : 3,
                    unique_h3_cells: 0
                }]
            };
        }

        if (text.includes('GROUP BY matched_h3_cell')) {
            return {
                rowCount: mode.zeroStats ? 0 : 1,
                rows: mode.zeroStats ? [] : [{
                    matched_h3_cell: '892a100d67bffff',
                    request_count: 3,
                    average_crowd_score: null
                }]
            };
        }

        throw new Error(`Unhandled SQL in test: ${text}`);
    }

    return { query };
}

async function withTestServer(mode, fn) {
    const originalQuery = pool.query;
    pool.query = createMockDb(mode).query;

    const app = require('../src/app');
    const server = app.listen(0);

    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address();
        await fn(`http://127.0.0.1:${port}`);
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

test('GET /health returns 503 when database check fails', async () => {
    await withTestServer({ healthFails: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/health');

        assert.equal(response.status, 503);
        assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE');
    });
});

test('GET /map/heatmap returns 500 when database fallback fails', async () => {
    await withTestServer({ throwOn: 'zentra_get_heatmap_scores' }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/map/heatmap?source=database&targetTime=2026-07-01T16:30:00-04:00');

        assert.equal(response.status, 500);
        assert.equal(response.body.error.code, 'INTERNAL_ERROR');
    });
});

test('POST /predictions validates missing fields, invalid date, and duration', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/predictions', { method: 'POST', body: JSON.stringify({}) });
        const badDate = await requestJson(baseUrl, '/api/v1/predictions', { method: 'POST', body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: 'bad', durationMinutes: 60 }) });
        const badDuration = await requestJson(baseUrl, '/api/v1/predictions', { method: 'POST', body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', durationMinutes: 2 }) });

        assert.equal(missing.status, 400);
        assert.equal(badDate.status, 400);
        assert.equal(badDuration.status, 422);
    });
});

test('POST /predictions returns 503 when no fallback row exists', async () => {
    await withTestServer({ emptyPrediction: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', durationMinutes: 60 })
        });

        assert.equal(response.status, 503);
        assert.equal(response.body.error.code, 'PREDICTION_UNAVAILABLE');
    });
});

test('POST /predictions returns 500 when fallback query throws', async () => {
    await withTestServer({ throwPrediction: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', durationMinutes: 60 })
        });

        assert.equal(response.status, 500);
        assert.equal(response.body.error.code, 'INTERNAL_ERROR');
    });
});

test('POST /predictions still succeeds when request logging fails', async () => {
    await withTestServer({ throwPredictionLog: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', durationMinutes: 60 })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.prediction.source, 'h3_grid_scores');
    });
});

test('POST /predictions/batch validates top-level payload', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/predictions/batch', { method: 'POST', body: JSON.stringify({ targetTime: '2026-07-01T16:30:00-04:00' }) });
        const badDate = await requestJson(baseUrl, '/api/v1/predictions/batch', { method: 'POST', body: JSON.stringify({ targetTime: 'bad', coordinates: [{ lat: 40.758, lng: -73.9855 }] }) });
        const badDuration = await requestJson(baseUrl, '/api/v1/predictions/batch', { method: 'POST', body: JSON.stringify({ targetTime: '2026-07-01T16:30:00-04:00', durationMinutes: 999, coordinates: [{ lat: 40.758, lng: -73.9855 }] }) });

        assert.equal(missing.status, 400);
        assert.equal(badDate.status, 400);
        assert.equal(badDuration.status, 422);
    });
});

test('POST /predictions/batch supports legacy locations key and warning branches', async () => {
    await withTestServer({ emptyPrediction: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions/batch', {
            method: 'POST',
            body: JSON.stringify({
                targetTime: '2026-07-01T16:30:00-04:00',
                locations: [
                    { locationId: 'outside', lat: 41.2, lng: -73.9855 },
                    { locationId: 'empty', lat: 40.758, lng: -73.9855 }
                ]
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.predictions.length, 0);
        assert.deepEqual(response.body.data.warnings.map((warning) => warning.code), ['LOCATION_OUT_OF_COVERAGE', 'PREDICTION_UNAVAILABLE']);
    });
});

test('POST /predictions/batch records internal warning when one item throws', async () => {
    await withTestServer({ throwPrediction: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/predictions/batch', {
            method: 'POST',
            body: JSON.stringify({
                targetTime: '2026-07-01T16:30:00-04:00',
                coordinates: [{ clientId: 'throws', lat: 40.758, lng: -73.9855 }]
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.warnings[0].code, 'INTERNAL_ERROR');
    });
});

test('GET /predictions/forecast validates missing and invalid query params', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758');
        const invalid = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=bad&endTime=2099-01-01T03:00:00Z');
        const reversed = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2099-01-01T03:00:00Z&endTime=2099-01-01T00:00:00Z');
        const outside = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=41.2&lng=-73.9855&startTime=2099-01-01T00:00:00Z&endTime=2099-01-01T03:00:00Z');
        const pastEnd = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2020-01-01T00:00:00Z&endTime=2020-01-01T03:00:00Z');

        assert.equal(missing.status, 400);
        assert.equal(invalid.status, 400);
        assert.equal(reversed.status, 422);
        assert.equal(outside.status, 422);
        assert.equal(outside.body.error.code, 'LOCATION_OUT_OF_COVERAGE');
        assert.equal(pastEnd.status, 422);
    });
});

test('GET /predictions/forecast handles unavailable and failing refreshed DB data', async () => {
    await withTestServer({ emptyNearestCell: true }, async (baseUrl) => {
        const unavailable = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2099-01-01T00:00:00Z&endTime=2099-01-01T03:00:00Z');
        assert.equal(unavailable.status, 503);
        assert.equal(unavailable.body.error.code, 'PREDICTION_UNAVAILABLE');
    });

    await withTestServer({ emptyForecast: true }, async (baseUrl) => {
        const empty = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2099-01-01T00:00:00Z&endTime=2099-01-01T03:00:00Z');
        assert.equal(empty.status, 503);
        assert.equal(empty.body.error.code, 'PREDICTION_UNAVAILABLE');
    });

    await withTestServer({ throwForecast: true }, async (baseUrl) => {
        const failing = await requestJson(baseUrl, '/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2099-01-01T00:00:00Z&endTime=2099-01-01T03:00:00Z');
        assert.equal(failing.status, 500);
    });
});
test('POST /recommendations validates input and handles failures', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/recommendations', { method: 'POST', body: JSON.stringify({}) });
        const badDate = await requestJson(baseUrl, '/api/v1/recommendations', { method: 'POST', body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: 'bad' }) });

        assert.equal(missing.status, 400);
        assert.equal(badDate.status, 400);
    });

    await withTestServer({ throwRecommendations: true }, async (baseUrl) => {
        const failing = await requestJson(baseUrl, '/api/v1/recommendations', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00' })
        });

        assert.equal(failing.status, 500);
    });
});

test('POST /feedback returns 500 when insert fails', async () => {
    await withTestServer({ throwFeedback: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/feedback', {
            method: 'POST',
            body: JSON.stringify({ rating: 5 })
        });

        assert.equal(response.status, 500);
    });
});

test('GET /admin/stats/predictions handles zero stats, invalid endDate, and failures', async () => {
    await withTestServer({ zeroStats: true }, async (baseUrl) => {
        const zero = await requestJson(baseUrl, '/api/v1/admin/stats/predictions');
        assert.equal(zero.status, 200);
        assert.equal(zero.body.data.cacheHitRate, 0);
        assert.equal(zero.body.data.averageCrowdScore, null);
    });

    await withTestServer({}, async (baseUrl) => {
        const invalid = await requestJson(baseUrl, '/api/v1/admin/stats/predictions?endDate=bad-date');
        assert.equal(invalid.status, 400);
    });

    await withTestServer({ throwStats: true }, async (baseUrl) => {
        const failing = await requestJson(baseUrl, '/api/v1/admin/stats/predictions');
        assert.equal(failing.status, 500);
    });
});

test('POST /predictions/explanation validates request fields', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/predictions/explanation', { method: 'POST', body: JSON.stringify({}) });
        const badScore = await requestJson(baseUrl, '/api/v1/predictions/explanation', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', busynessScore: 200 })
        });
        const outside = await requestJson(baseUrl, '/api/v1/predictions/explanation', {
            method: 'POST',
            body: JSON.stringify({ lat: 41.2, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', busynessScore: 40 })
        });

        assert.equal(missing.status, 400);
        assert.equal(badScore.status, 422);
        assert.equal(outside.status, 422);
    });
});

test('POST /recommendations/quiet-times validates input and unavailable data', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/recommendations/quiet-times', { method: 'POST', body: JSON.stringify({}) });
        const badDate = await requestJson(baseUrl, '/api/v1/recommendations/quiet-times', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: 'bad', startTime: '2026-07-01T09:00:00-04:00', endTime: '2026-07-01T21:00:00-04:00' })
        });
        const outside = await requestJson(baseUrl, '/api/v1/recommendations/quiet-times', {
            method: 'POST',
            body: JSON.stringify({ lat: 41.2, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', startTime: '2026-07-01T09:00:00-04:00', endTime: '2026-07-01T21:00:00-04:00' })
        });

        assert.equal(missing.status, 400);
        assert.equal(badDate.status, 400);
        assert.equal(outside.status, 422);
    });

    await withTestServer({ emptyNearestCell: true }, async (baseUrl) => {
        const unavailable = await requestJson(baseUrl, '/api/v1/recommendations/quiet-times', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', startTime: '2026-07-01T09:00:00-04:00', endTime: '2026-07-01T21:00:00-04:00' })
        });

        assert.equal(unavailable.status, 503);
    });

    await withTestServer({ emptyPrediction: true }, async (baseUrl) => {
        const unavailable = await requestJson(baseUrl, '/api/v1/recommendations/quiet-times', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', startTime: '2026-07-01T09:00:00-04:00', endTime: '2026-07-01T21:00:00-04:00' })
        });

        assert.equal(unavailable.status, 503);
    });
});

test('POST /recommendations/quiet-times handles database failures', async () => {
    await withTestServer({ throwForecast: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/recommendations/quiet-times', {
            method: 'POST',
            body: JSON.stringify({ lat: 40.758, lng: -73.9855, targetTime: '2026-07-01T16:30:00-04:00', startTime: '2026-07-01T09:00:00-04:00', endTime: '2026-07-01T21:00:00-04:00' })
        });

        assert.equal(response.status, 500);
    });
});

test('POST /recommendations/places validates top-level request', async () => {
    await withTestServer({}, async (baseUrl) => {
        const missing = await requestJson(baseUrl, '/api/v1/recommendations/places', { method: 'POST', body: JSON.stringify({}) });
        const badDate = await requestJson(baseUrl, '/api/v1/recommendations/places', {
            method: 'POST',
            body: JSON.stringify({ currentLocation: { lat: 40.758, lng: -73.9855 }, targetTime: 'bad', candidatePlaces: [{ coordinates: { lat: 40.758, lng: -73.9855 } }] })
        });
        const badOrigin = await requestJson(baseUrl, '/api/v1/recommendations/places', {
            method: 'POST',
            body: JSON.stringify({ currentLocation: { lat: 'x', lng: -73.9855 }, targetTime: '2026-07-01T16:30:00-04:00', candidatePlaces: [{ coordinates: { lat: 40.758, lng: -73.9855 } }] })
        });

        assert.equal(missing.status, 400);
        assert.equal(badDate.status, 400);
        assert.equal(badOrigin.status, 422);
    });
});

test('POST /recommendations/places returns warnings for bad or unavailable candidates', async () => {
    await withTestServer({ emptyPrediction: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/recommendations/places', {
            method: 'POST',
            body: JSON.stringify({
                currentLocation: { lat: 40.758, lng: -73.9855 },
                targetTime: '2026-07-01T16:30:00-04:00',
                candidatePlaces: [
                    { placeId: 'bad', coordinates: { lat: 'x', lng: -73.9855 } },
                    { placeId: 'empty', coordinates: { lat: 40.758, lng: -73.9855 } }
                ]
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.recommendations.length, 0);
        assert.deepEqual(response.body.data.warnings.map((warning) => warning.code), ['INVALID_COORDINATES', 'PREDICTION_UNAVAILABLE']);
    });
});

test('POST /recommendations/places records internal warnings when candidate query fails', async () => {
    await withTestServer({ throwPrediction: true }, async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/recommendations/places', {
            method: 'POST',
            body: JSON.stringify({
                currentLocation: { lat: 40.758, lng: -73.9855 },
                targetTime: '2026-07-01T16:30:00-04:00',
                candidatePlaces: [{ placeId: 'throws', coordinates: { lat: 40.758, lng: -73.9855 } }]
            })
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.data.warnings[0].code, 'INTERNAL_ERROR');
    });
});

test('GET /admin/stats/feedback validates dates and handles database failures', async () => {
    await withTestServer({}, async (baseUrl) => {
        const invalid = await requestJson(baseUrl, '/api/v1/admin/stats/feedback?startDate=bad-date');
        assert.equal(invalid.status, 400);
    });

    await withTestServer({ throwFeedbackStats: true }, async (baseUrl) => {
        const failing = await requestJson(baseUrl, '/api/v1/admin/stats/feedback');
        assert.equal(failing.status, 500);
    });
});
