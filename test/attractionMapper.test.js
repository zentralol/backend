const test = require('node:test');
const assert = require('node:assert/strict');

const {
    attachCrowdToAttractions,
    mapAttractionRow,
    mapPredictionCrowd
} = require('../src/utils/attractionMapper');

test('mapAttractionRow maps lon to lng', () => {
    const attraction = mapAttractionRow({
        id: 1,
        name: 'Central Park',
        category: 'Parks & Outdoors',
        neighborhood: 'Midtown',
        description: 'Large park',
        lat: 40.7812,
        lon: -73.9665
    });

    assert.deepEqual(attraction, {
        id: 1,
        name: 'Central Park',
        category: 'Parks & Outdoors',
        neighborhood: 'Midtown',
        description: 'Large park',
        lat: 40.7812,
        lng: -73.9665
    });
});

test('mapPredictionCrowd normalizes fractional scores and levels', () => {
    const crowd = mapPredictionCrowd({
        crowd_score: 0.42,
        crowd_level: 'quiet',
        predicted_for: '2026-07-01T16:30:00-04:00'
    });

    assert.equal(crowd.score, 42);
    assert.equal(crowd.level, 'quiet');
    assert.equal(crowd.predictedFor, '2026-07-01T16:30:00-04:00');
});

test('attachCrowdToAttractions keeps the newest prediction per attraction', () => {
    const attractions = [
        mapAttractionRow({
            id: 1,
            name: 'A',
            category: 'Museum',
            neighborhood: 'Midtown',
            description: 'One',
            lat: 40.7,
            lon: -73.9
        }),
        mapAttractionRow({
            id: 2,
            name: 'B',
            category: 'Museum',
            neighborhood: 'Midtown',
            description: 'Two',
            lat: 40.8,
            lon: -73.95
        })
    ];

    const result = attachCrowdToAttractions(attractions, [
        {
            attraction_id: 1,
            crowd_score: 80,
            crowd_level: 'busy',
            predicted_for: '2026-07-01T16:30:00-04:00'
        },
        {
            attraction_id: 1,
            crowd_score: 20,
            crowd_level: 'very_quiet',
            predicted_for: '2026-07-01T15:30:00-04:00'
        },
        {
            attraction_id: 2,
            crowd_score: 55,
            crowd_level: 'moderate',
            predicted_for: '2026-07-01T16:30:00-04:00'
        }
    ]);

    assert.equal(result[0].crowd.level, 'busy');
    assert.equal(result[0].crowd.score, 80);
    assert.equal(result[1].crowd.level, 'moderate');
    assert.deepEqual(result[1].crowd.score, 55);
});
