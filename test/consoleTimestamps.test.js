const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createTimestampedConsole,
    installConsoleTimestamps
} = require('../src/utils/consoleTimestamps');

const FIXED_NOW = () => new Date('2026-07-12T10:23:45.000Z');
const FIXED_PREFIX = '[2026-07-12T10:23:45.000Z]';

function buildRecordingConsole() {
    const calls = { log: [], info: [], warn: [], error: [] };
    return {
        calls,
        log: (...args) => calls.log.push(args),
        info: (...args) => calls.info.push(args),
        warn: (...args) => calls.warn.push(args),
        error: (...args) => calls.error.push(args)
    };
}

test('wrapped methods prefix an ISO timestamp and pass arguments through', () => {
    // Arrange
    const base = buildRecordingConsole();
    const wrapped = createTimestampedConsole(base, FIXED_NOW);

    // Act
    wrapped.log('hello', 42);
    wrapped.warn('careful');
    wrapped.error('boom', { code: 1 });
    wrapped.info('fyi');

    // Assert
    assert.deepEqual(base.calls.log, [[FIXED_PREFIX, 'hello', 42]]);
    assert.deepEqual(base.calls.warn, [[FIXED_PREFIX, 'careful']]);
    assert.deepEqual(base.calls.error, [[FIXED_PREFIX, 'boom', { code: 1 }]]);
    assert.deepEqual(base.calls.info, [[FIXED_PREFIX, 'fyi']]);
});

test('install overrides the target console methods in place', () => {
    // Arrange
    const base = buildRecordingConsole();

    // Act
    installConsoleTimestamps(base, FIXED_NOW);
    base.log('after install');

    // Assert
    assert.deepEqual(base.calls.log, [[FIXED_PREFIX, 'after install']]);
});

test('install is idempotent and never double-prefixes', () => {
    // Arrange
    const base = buildRecordingConsole();

    // Act
    installConsoleTimestamps(base, FIXED_NOW);
    installConsoleTimestamps(base, FIXED_NOW);
    base.log('once');

    // Assert
    assert.deepEqual(base.calls.log, [[FIXED_PREFIX, 'once']]);
});
