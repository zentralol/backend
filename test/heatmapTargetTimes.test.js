const test = require('node:test');
const assert = require('node:assert/strict');

const {
    formatManhattanNaiveIso,
    buildHeatmapTargetTimes,
    buildHeatmapRetentionCutoff
} = require('../src/utils/heatmapTargetTimes');

test('formatManhattanNaiveIso returns naive ISO in America/New_York', () => {
    const value = formatManhattanNaiveIso(new Date('2026-07-10T14:00:00.000Z'));
    assert.equal(value, '2026-07-10T10:00:00');
});

test('buildHeatmapTargetTimes returns Now plus eight future hourly buckets', () => {
    const now = new Date('2026-07-10T14:00:00.000Z');
    const targetTimes = buildHeatmapTargetTimes(now, 8);

    assert.equal(targetTimes.length, 9);
    assert.equal(targetTimes[0], '2026-07-10T10:00:00');
    assert.equal(targetTimes[1], '2026-07-10T11:00:00');
    assert.equal(targetTimes[8], '2026-07-10T18:00:00');
    assert.ok(targetTimes.every((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)));
});

test('buildHeatmapRetentionCutoff subtracts retention hours in Manhattan time', () => {
    const cutoff = buildHeatmapRetentionCutoff(new Date('2026-07-10T14:00:00.000Z'), 48);
    assert.equal(cutoff, '2026-07-08T10:00:00');
});
