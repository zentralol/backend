const test = require('node:test');
const assert = require('node:assert/strict');

const { mapWithConcurrency } = require('../src/utils/concurrency');

test('returns results in input order', async () => {
    // Arrange
    const items = [30, 10, 20];
    const delayedDouble = (ms) =>
        new Promise((resolve) => setTimeout(() => resolve(ms * 2), ms));

    // Act
    const results = await mapWithConcurrency(items, 2, delayedDouble);

    // Assert
    assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled', 'fulfilled']);
    assert.deepEqual(results.map((r) => r.value), [60, 20, 40]);
});

test('never exceeds the concurrency limit', async () => {
    // Arrange
    const limit = 3;
    let inFlight = 0;
    let maxInFlight = 0;
    const track = async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
    };

    // Act
    await mapWithConcurrency(Array.from({ length: 10 }), limit, track);

    // Assert
    assert.ok(maxInFlight <= limit, `max in-flight ${maxInFlight} exceeded limit ${limit}`);
});

test('captures rejections per item without aborting the rest', async () => {
    // Arrange
    const items = [1, 2, 3];
    const failOnTwo = async (item) => {
        if (item === 2) throw new Error('boom');
        return item;
    };

    // Act
    const results = await mapWithConcurrency(items, 2, failOnTwo);

    // Assert
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.message, 'boom');
    assert.equal(results[2].status, 'fulfilled');
    assert.equal(results[2].value, 3);
});

test('returns an empty array for empty input', async () => {
    // Act
    const results = await mapWithConcurrency([], 4, async () => 1);

    // Assert
    assert.deepEqual(results, []);
});

test('handles a limit larger than the item count', async () => {
    // Act
    const results = await mapWithConcurrency([1, 2], 10, async (item) => item);

    // Assert
    assert.deepEqual(results.map((r) => r.value), [1, 2]);
});

test('passes the item index to the worker function', async () => {
    // Act
    const results = await mapWithConcurrency(['a', 'b'], 2, async (item, index) => `${item}${index}`);

    // Assert
    assert.deepEqual(results.map((r) => r.value), ['a0', 'b1']);
});
