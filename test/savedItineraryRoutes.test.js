const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const pool = require('../src/config/database');

const SAMPLE_ITEM = {
    candidateId: 'poi_1',
    rank: 1,
    name: 'Central Park',
    lat: 40.7829,
    lng: -73.9654,
    reason: 'Quiet now',
    subtitle: 'Park',
    detail: 'Great for a walk'
};

const ITINERARY_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function createMockDb() {
    const calls = [];

    async function query(sql, params = []) {
        const text = String(sql);
        calls.push({ sql: text, params });

        if (text.includes('FROM public.saved_itineraries') && text.includes('ORDER BY created_at DESC')) {
            return {
                rowCount: 1,
                rows: [{
                    id: ITINERARY_ID,
                    user_id: params[0],
                    conversation_id: 'conv_1',
                    title: 'Park walk',
                    source: 'nearby',
                    items: [SAMPLE_ITEM],
                    description: 'A stroll',
                    note: null,
                    target_time: '2026-07-20T16:00:00',
                    created_at: new Date('2026-07-20T12:00:00.000Z'),
                    deleted_at: null
                }]
            };
        }

        if (text.includes('INSERT INTO public.saved_itineraries')) {
            return {
                rowCount: 1,
                rows: [{
                    id: ITINERARY_ID,
                    user_id: params[0],
                    conversation_id: params[1],
                    title: params[2],
                    source: params[3],
                    items: JSON.parse(params[4]),
                    description: params[5],
                    note: null,
                    target_time: params[6],
                    created_at: new Date('2026-07-20T12:00:00.000Z'),
                    deleted_at: null
                }]
            };
        }

        if (text.includes('SET deleted_at = NOW()')) {
            return {
                rowCount: params[0] === ITINERARY_ID ? 1 : 0,
                rows: params[0] === ITINERARY_ID ? [{ id: ITINERARY_ID }] : []
            };
        }

        if (text.includes('SET title = $3')) {
            return { rowCount: 1, rows: [{ id: ITINERARY_ID }] };
        }

        if (text.includes('SET note = $3')) {
            return { rowCount: 1, rows: [{ id: ITINERARY_ID }] };
        }

        if (text.includes('SET target_time = $3')) {
            return { rowCount: 1, rows: [{ id: ITINERARY_ID }] };
        }

        throw new Error(`Unexpected query: ${text}`);
    }

    return { query, calls };
}

async function withServer(fn) {
    const originalQuery = pool.query;
    const mock = createMockDb();
    pool.query = mock.query;

    const app = require('../src/app');
    const server = app.listen(0);

    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address();
        await fn(`http://127.0.0.1:${port}`, mock.calls);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        pool.query = originalQuery;
    }
}

async function requestJson(baseUrl, path, { method = 'GET', headers = {}, body } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = text;
    }
    return { status: response.status, body: parsed };
}

test('GET /saved-itineraries requires auth', async () => {
    await withServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/saved-itineraries');
        assert.equal(response.status, 401);
    });
});

test('GET /saved-itineraries returns the signed-in user trips', async () => {
    await withServer(async (baseUrl, calls) => {
        const response = await requestJson(baseUrl, '/api/v1/saved-itineraries', {
            headers: { 'x-test-user-id': 'user_123' }
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.equal(response.body.data.itineraries.length, 1);
        assert.equal(response.body.data.itineraries[0].title, 'Park walk');
        assert.equal(response.body.data.itineraries[0].targetTime, '2026-07-20T16:00:00');
        assert.equal(calls[0].params[0], 'user_123');
    });
});

test('POST /saved-itineraries creates a trip for the signed-in user', async () => {
    await withServer(async (baseUrl, calls) => {
        const response = await requestJson(baseUrl, '/api/v1/saved-itineraries', {
            method: 'POST',
            headers: { 'x-test-user-id': 'user_123' },
            body: {
                source: 'nearby',
                items: [SAMPLE_ITEM],
                title: 'My park trip',
                conversationId: 'conv_9',
                targetTime: '2026-07-20T16:00'
            }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.data.itinerary.title, 'My park trip');
        assert.equal(calls.at(-1).params[0], 'user_123');
        assert.equal(calls.at(-1).params[2], 'My park trip');
    });
});

test('POST /saved-itineraries rejects invalid payloads', async () => {
    await withServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, '/api/v1/saved-itineraries', {
            method: 'POST',
            headers: { 'x-test-user-id': 'user_123' },
            body: { source: 'nearby', items: [] }
        });
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'INVALID_ITINERARY');
    });
});

test('DELETE /saved-itineraries/:id soft-deletes an owned trip', async () => {
    await withServer(async (baseUrl) => {
        const response = await requestJson(baseUrl, `/api/v1/saved-itineraries/${ITINERARY_ID}`, {
            method: 'DELETE',
            headers: { 'x-test-user-id': 'user_123' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.body.data.deleted, true);
    });
});

test('PATCH title/note/target-time update owned fields', async () => {
    await withServer(async (baseUrl) => {
        const title = await requestJson(baseUrl, `/api/v1/saved-itineraries/${ITINERARY_ID}/title`, {
            method: 'PATCH',
            headers: { 'x-test-user-id': 'user_123' },
            body: { title: 'Renamed' }
        });
        assert.equal(title.status, 200);
        assert.equal(title.body.data.title, 'Renamed');

        const note = await requestJson(baseUrl, `/api/v1/saved-itineraries/${ITINERARY_ID}/note`, {
            method: 'PATCH',
            headers: { 'x-test-user-id': 'user_123' },
            body: { note: 'Bring sunscreen' }
        });
        assert.equal(note.status, 200);
        assert.equal(note.body.data.note, 'Bring sunscreen');

        const target = await requestJson(baseUrl, `/api/v1/saved-itineraries/${ITINERARY_ID}/target-time`, {
            method: 'PATCH',
            headers: { 'x-test-user-id': 'user_123' },
            body: { targetTime: '2026-07-21T10:30' }
        });
        assert.equal(target.status, 200);
        assert.equal(target.body.data.targetTime, '2026-07-21T10:30:00');
    });
});

test('DELETE returns 404 for unknown trip ids', async () => {
    await withServer(async (baseUrl) => {
        const response = await requestJson(
            baseUrl,
            '/api/v1/saved-itineraries/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            {
                method: 'DELETE',
                headers: { 'x-test-user-id': 'user_123' }
            }
        );
        assert.equal(response.status, 404);
        assert.equal(response.body.error.code, 'NOT_FOUND');
    });
});
