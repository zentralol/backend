const SELECT_ATTRACTIONS_COLUMNS = `
    id,
    "Name" AS name,
    "Category" AS category,
    "Neighborhood" AS neighborhood,
    "Description" AS description,
    lat,
    lon
`;

const SELECT_ATTRACTIONS_LIST = `
    SELECT
        ${SELECT_ATTRACTIONS_COLUMNS}
    FROM attractions
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY name
    LIMIT $1
`;

const SELECT_ATTRACTION_BY_ID = `
    SELECT
        ${SELECT_ATTRACTIONS_COLUMNS}
    FROM attractions
    WHERE id = $1
      AND lat IS NOT NULL
      AND lon IS NOT NULL
    LIMIT 1
`;

const SELECT_ATTRACTIONS_SEARCH = `
    SELECT
        ${SELECT_ATTRACTIONS_COLUMNS}
    FROM attractions
    WHERE lat IS NOT NULL
      AND lon IS NOT NULL
      AND (
          $1::text IS NULL
          OR "Name" ILIKE '%' || $1 || '%'
          OR "Description" ILIKE '%' || $1 || '%'
          OR "Neighborhood" ILIKE '%' || $1 || '%'
      )
      AND ($2::text IS NULL OR "Category" ILIKE $2)
    ORDER BY name
    LIMIT $3
`;

const SELECT_ATTRACTIONS_NEARBY = `
    SELECT
        ${SELECT_ATTRACTIONS_COLUMNS},
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

const SELECT_ATTRACTIONS_SEARCH_NEARBY = `
    SELECT
        ${SELECT_ATTRACTIONS_COLUMNS},
        (
            6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians($3)) * cos(radians(lat)) * cos(radians(lon) - radians($4))
                    + sin(radians($3)) * sin(radians(lat))
                ))
            )
        )::int AS distance_meters
    FROM attractions
    WHERE lat IS NOT NULL
      AND lon IS NOT NULL
      AND (
          $1::text IS NULL
          OR "Name" ILIKE '%' || $1 || '%'
          OR "Description" ILIKE '%' || $1 || '%'
          OR "Neighborhood" ILIKE '%' || $1 || '%'
      )
      AND ($2::text IS NULL OR "Category" ILIKE $2)
    ORDER BY distance_meters ASC, name
    LIMIT $5
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
    SELECT_ATTRACTION_BY_ID,
    SELECT_ATTRACTIONS_SEARCH,
    SELECT_ATTRACTIONS_NEARBY,
    SELECT_ATTRACTIONS_SEARCH_NEARBY,
    SELECT_RECENT_ATTRACTION_PREDICTIONS
};