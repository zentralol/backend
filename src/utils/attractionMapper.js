const { busynessLevel, normalizeScore } = require('./busyness');

const CROWD_LEVELS = new Set([
    'very_quiet',
    'quiet',
    'moderate',
    'busy',
    'very_busy'
]);

function isCrowdLevel(value) {
    return typeof value === 'string' && CROWD_LEVELS.has(value);
}

function mapAttractionRow(row, options = {}) {
    const attraction = {
        id: row.id,
        name: row.name,
        category: row.category,
        neighborhood: row.neighborhood,
        description: row.description,
        lat: Number(row.lat),
        lng: Number(row.lon)
    };

    if (Number.isFinite(row.distance_meters)) {
        attraction.distanceMeters = row.distance_meters;
    }

    if (options.includeDistanceMeters && Number.isFinite(options.distanceMeters)) {
        attraction.distanceMeters = options.distanceMeters;
    }

    return attraction;
}

function mapPredictionCrowd(row) {
    const score = normalizeScore(row.crowd_score);
    const level = row.crowd_level || (score === null ? null : busynessLevel(score));

    if (score === null || !isCrowdLevel(level)) {
        return null;
    }

    return {
        score,
        level,
        predictedFor: row.predicted_for
    };
}

function attachCrowdToAttractions(attractions, predictions) {
    const crowdByAttractionId = new Map();

    for (const row of predictions) {
        if (crowdByAttractionId.has(row.attraction_id)) {
            continue;
        }

        const crowd = mapPredictionCrowd(row);
        if (crowd) {
            crowdByAttractionId.set(row.attraction_id, crowd);
        }
    }

    return attractions.map((attraction) => {
        const crowd = crowdByAttractionId.get(attraction.id);
        return crowd ? { ...attraction, crowd } : attraction;
    });
}

module.exports = {
    attachCrowdToAttractions,
    isCrowdLevel,
    mapAttractionRow,
    mapPredictionCrowd
};
