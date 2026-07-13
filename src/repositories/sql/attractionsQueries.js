const SELECT_ATTRACTIONS_LIST = `
    SELECT
        id,
        "Name" AS name,
        "Category" AS category,
        "Neighborhood" AS neighborhood,
        "Description" AS description,
        lat,
        lon
    FROM attractions
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY name
    LIMIT $1
`;

const SELECT_ATTRACTIONS_NEARBY = `
    SELECT
        id,
        "Name" AS name,
        "Category" AS category,
        "Neighborhood" AS neighborhood,
        "Description" AS description,
        lat,
        lon,
        (
            6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians($1)) * cos(radians(lat)) * cos(radians(lon) - radians($2))
                    + sin(radians($1)) * sin(radians(lat))
                ))
            )
        )::int AS distance_meters
    FROM attractions
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY distance_meters ASC
    LIMIT $3
`;

const SELECT_RECENT_ATTRACTION_PREDICTIONS = `
    SELECT
        attraction_id,
        crowd_score,
        crowd_level,
        predicted_for
    FROM attraction_predictions
    WHERE predicted_for >= NOW() - INTERVAL '2 hours'
    ORDER BY predicted_for DESC
`;

module.exports = {
    SELECT_ATTRACTIONS_LIST,
    SELECT_ATTRACTIONS_NEARBY,
    SELECT_RECENT_ATTRACTION_PREDICTIONS
};
