const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const {
    mapSavedItineraryRow,
    parseSaveItineraryBody,
    parseTitle,
    parseNote,
    normalizeTargetTime,
    deriveItineraryTitle
} = require('../src/utils/savedItinerary');

const sampleItem = {
    candidateId: 'poi_1',
    rank: 1,
    name: 'Central Park',
    lat: 40.7829,
    lng: -73.9654,
    reason: 'Quiet now',
    subtitle: 'Park',
    detail: 'Great for a walk'
};

test('mapSavedItineraryRow converts snake_case db columns to camelCase', () => {
    const mapped = mapSavedItineraryRow({
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Park walk',
        source: 'nearby',
        items: [sampleItem],
        description: 'A stroll',
        note: 'Bring water',
        target_time: '2026-07-20T16:00:00',
        conversation_id: 'conv_1',
        created_at: new Date('2026-07-20T12:00:00.000Z')
    });

    assert.equal(mapped.targetTime, '2026-07-20T16:00:00');
    assert.equal(mapped.conversationId, 'conv_1');
    assert.equal(mapped.createdAt, '2026-07-20T12:00:00.000Z');
    assert.equal(mapped.items[0].name, 'Central Park');
});

test('parseSaveItineraryBody accepts a valid payload and derives title', () => {
    const parsed = parseSaveItineraryBody({
        source: 'nearby',
        items: [sampleItem, { ...sampleItem, candidateId: 'poi_2', rank: 2, name: 'Museum' }]
    });

    assert.equal(parsed.error, undefined);
    assert.equal(parsed.value.title, 'Central Park + 1 more');
    assert.equal(parsed.value.items.length, 2);
    assert.equal(parsed.value.targetTime, null);
});

test('parseSaveItineraryBody rejects invalid source or empty items', () => {
    assert.equal(parseSaveItineraryBody({ source: 'nope', items: [sampleItem] }).error, 'Invalid itinerary');
    assert.equal(parseSaveItineraryBody({ source: 'nearby', items: [] }).error, 'Invalid itinerary');
});

test('title note and target time validators enforce caps and formats', () => {
    assert.equal(parseTitle('  Hello  ', { required: true }).value, 'Hello');
    assert.equal(parseTitle('', { required: true }).error, true);
    assert.equal(parseNote('x'.repeat(2001)).error, true);
    assert.equal(normalizeTargetTime('2026-07-20T16:00').value, '2026-07-20T16:00:00');
    assert.equal(normalizeTargetTime('bad').error, true);
    assert.equal(deriveItineraryTitle([]), 'Saved trip');
});
