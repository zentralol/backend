const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';

const SERVICE_TOKEN = 'test-internal-token';

// Minimal stand-in for the FastAPI agent. Records what the gateway forwarded
// (auth header + parsed body) and replies with a small SSE stream.
function createStubAgent() {
    const received = {};

    const server = http.createServer((req, res) => {
        received.token = req.headers['x-internal-service-token'];
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            received.body = JSON.parse(raw || '{}');
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.write('data: {"type":"message_delta","text":"hi"}\n\n');
            res.write('data: {"type":"done"}\n\n');
            res.end();
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

// Boots a stub agent + the real app, points the gateway at the stub, runs `fn`,
// then restores env and tears both down.
async function withChatServers(fn, { configureAgent = true, token = SERVICE_TOKEN } = {}) {
    const original = {
        base: process.env.AGENT_API_BASE_URL,
        token: process.env.AGENT_INTERNAL_TOKEN
    };

    const stub = createStubAgent();
    const agentPort = await listen(stub.server);

    process.env.AGENT_INTERNAL_TOKEN = token;
    process.env.AGENT_API_BASE_URL = configureAgent ? `http://127.0.0.1:${agentPort}` : '';

    const app = require('../src/app');
    const server = app.listen(0);

    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address();
        await fn(`http://127.0.0.1:${port}`, stub.received);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        await close(stub.server);
        process.env.AGENT_API_BASE_URL = original.base;
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

test('chat stream rejects requests with neither Clerk auth nor service token', async () => {
    await withChatServers(async (baseUrl) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', { body: { message: 'hi' } });
        assert.equal(res.status, 401);
    });
});

test('chat stream forwards Clerk user id and streams the agent SSE response', async () => {
    await withChatServers(async (baseUrl, received) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'x-test-user-id': 'user_123' },
            body: { message: 'hello', clientType: 'web' }
        });

        assert.equal(res.status, 200);
        assert.ok(res.headers.get('content-type').startsWith('text/event-stream'));

        const text = await res.text();
        assert.ok(text.includes('message_delta'));
        assert.equal(received.token, SERVICE_TOKEN);
        assert.equal(received.body.user_id, 'user_123');
        assert.equal(received.body.client_type, 'web');
        assert.equal(received.body.message, 'hello');
    });
});

test('chat stream ignores a spoofed body userId when authenticated via Clerk', async () => {
    await withChatServers(async (baseUrl, received) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'x-test-user-id': 'user_123' },
            body: { message: 'hi', userId: 'attacker' }
        });

        assert.equal(res.status, 200);
        assert.equal(received.body.user_id, 'user_123');
    });
});

test('chat stream does not accept the internal service token (Clerk only)', async () => {
    await withChatServers(async (baseUrl) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'X-Internal-Service-Token': SERVICE_TOKEN },
            body: { message: 'hi', userId: 'user_abc' }
        });

        assert.equal(res.status, 401);
    });
});

test('chat stream returns 400 when message is missing', async () => {
    await withChatServers(async (baseUrl) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'x-test-user-id': 'user_123' },
            body: { clientType: 'web' }
        });

        assert.equal(res.status, 400);
    });
});

test('chat stream returns 503 when the agent base url is not configured', async () => {
    await withChatServers(
        async (baseUrl) => {
            const res = await post(baseUrl, '/api/v1/chat/stream', {
                headers: { 'x-test-user-id': 'user_123' },
                body: { message: 'hi' }
            });

            assert.equal(res.status, 503);
        },
        { configureAgent: false }
    );
});

test('chat stream forwards device coordinates to the agent', async () => {
    await withChatServers(async (baseUrl, received) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'x-test-user-id': 'user_123' },
            body: { message: 'nearby?', lat: 40.758, lng: -73.9855 }
        });

        assert.equal(res.status, 200);
        assert.equal(received.body.lat, 40.758);
        assert.equal(received.body.lng, -73.9855);
    });
});

test('chat stream sends null coordinates when none are provided', async () => {
    await withChatServers(async (baseUrl, received) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'x-test-user-id': 'user_123' },
            body: { message: 'hi' }
        });

        assert.equal(res.status, 200);
        assert.equal(received.body.lat, null);
        assert.equal(received.body.lng, null);
    });
});

test('chat stream rejects out-of-range coordinates', async () => {
    await withChatServers(async (baseUrl) => {
        const res = await post(baseUrl, '/api/v1/chat/stream', {
            headers: { 'x-test-user-id': 'user_123' },
            body: { message: 'hi', lat: 200, lng: 0 }
        });

        assert.equal(res.status, 400);
    });
});
