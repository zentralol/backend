const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';

const SERVICE_TOKEN = 'test-internal-token';

function createStubRecommend() {
    const received = [];

    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            received.push({
                method: req.method,
                path: req.url,
                body: JSON.parse(raw || '{}')
            });

            if (req.url === '/itinerary/plan') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ stops: [{ place_name: 'Central Park' }] }));
                return;
            }

            if (req.url === '/recommend/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ recommendations: [{ name: 'MoMA' }], based_on: 'test' }));
                return;
            }

            if (req.url === '/itinerary/missing') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ detail: 'Place not found' }));
                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'not found' }));
        });
    });

    return { server, received };
}

async function listen(server) {
    await new Promise((resolve) => server.listen(0, resolve));
    return server.address().port;
}

async function close(server) {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

async function withRecommendServers(fn, { configureRecommend = true } = {}) {
    const original = {
        base: process.env.RECOMMEND_API_BASE_URL,
        token: process.env.AGENT_INTERNAL_TOKEN
    };

    const stub = createStubRecommend();
    const recommendPort = await listen(stub.server);

    process.env.AGENT_INTERNAL_TOKEN = SERVICE_TOKEN;
    process.env.RECOMMEND_API_BASE_URL = configureRecommend ? `http://127.0.0.1:${recommendPort}` : '';

    const app = require('../src/app');
    const server = app.listen(0);

    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address();
        await fn(`http://127.0.0.1:${port}`, stub.received);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        await close(stub.server);
        process.env.RECOMMEND_API_BASE_URL = original.base;
        process.env.AGENT_INTERNAL_TOKEN = original.token;
    }
}

function post(baseUrl, path, { headers = {}, body } = {}) {
    return fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body ?? {})
    });
}

test('itinerary plan proxies body and path to zentra-recommend', async () => {
    await withRecommendServers(async (baseUrl, received) => {
        const payload = {
            inline_profile: { interests: ['art'] },
            anchor_place: 'Central Park',
            anchor_time: '2026-07-10T10:00:00',
            duration_hours: 8
        };

        const res = await post(baseUrl, '/api/v1/itinerary/plan', {
            headers: { 'X-Internal-Service-Token': SERVICE_TOKEN },
            body: payload
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.stops[0].place_name, 'Central Park');
        assert.equal(received.length, 1);
        assert.equal(received[0].path, '/itinerary/plan');
        assert.deepEqual(received[0].body, payload);
    });
});

test('recommend proxies body and path to zentra-recommend', async () => {
    await withRecommendServers(async (baseUrl, received) => {
        const payload = {
            inline_profile: { interests: ['art'] },
            query: 'quiet museums',
            count: 4
        };

        const res = await post(baseUrl, '/api/v1/recommend', {
            headers: { 'X-Internal-Service-Token': SERVICE_TOKEN },
            body: payload
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.recommendations[0].name, 'MoMA');
        assert.equal(received.length, 1);
        assert.equal(received[0].path, '/recommend/');
        assert.deepEqual(received[0].body, payload);
    });
});

test('recommend proxy returns 503 when upstream is not configured', async () => {
    await withRecommendServers(async (baseUrl) => {
        const res = await post(baseUrl, '/api/v1/recommend', {
            headers: { 'X-Internal-Service-Token': SERVICE_TOKEN },
            body: { query: 'museums' }
        });

        assert.equal(res.status, 503);
        const body = await res.json();
        assert.equal(body.error.code, 'RECOMMEND_UNAVAILABLE');
    }, { configureRecommend: false });
});

test('recommend proxy rejects unauthenticated requests', async () => {
    await withRecommendServers(async (baseUrl) => {
        const res = await post(baseUrl, '/api/v1/recommend', {
            body: { query: 'museums' }
        });

        assert.equal(res.status, 401);
    });
});


test('itinerary proxy passes through upstream 404 detail', async () => {
    const original = {
        base: process.env.RECOMMEND_API_BASE_URL,
        token: process.env.AGENT_INTERNAL_TOKEN
    };

    const stub = createStubRecommend();
    const recommendPort = await listen(stub.server);
    process.env.AGENT_INTERNAL_TOKEN = SERVICE_TOKEN;
    process.env.RECOMMEND_API_BASE_URL = `http://127.0.0.1:${recommendPort}`;

    const upstreamOnly = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'Place not found' }));
        });
    });

    await new Promise((resolve) => upstreamOnly.listen(0, resolve));
    const upstreamPort = upstreamOnly.address().port;
    process.env.RECOMMEND_API_BASE_URL = `http://127.0.0.1:${upstreamPort}`;

    const app = require('../src/app');
    const server = app.listen(0);

    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address();
        const res = await post(`http://127.0.0.1:${port}`, '/api/v1/itinerary/plan', {
            headers: { 'X-Internal-Service-Token': SERVICE_TOKEN },
            body: { anchor_place: 'Nowhere' }
        });

        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.detail, 'Place not found');
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        await close(upstreamOnly);
        await close(stub.server);
        process.env.RECOMMEND_API_BASE_URL = original.base;
        process.env.AGENT_INTERNAL_TOKEN = original.token;
    }
});
