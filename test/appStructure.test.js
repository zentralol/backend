const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const app = require('../src/app');

test('Express app loads without starting the HTTP server', () => {
    assert.equal(typeof app, 'function');
    assert.equal(typeof app.listen, 'function');
});

test('server.js is only the startup entrypoint', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

    assert.match(source, /require\('\.\/src\/app'\)/);
    assert.doesNotMatch(source, /app\.get\(/);
    assert.doesNotMatch(source, /app\.post\(/);
    assert.doesNotMatch(source, /pool\.query\(/);
});

test('location endpoints are not registered in app source', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

    assert.doesNotMatch(appSource, /locations/);
});
