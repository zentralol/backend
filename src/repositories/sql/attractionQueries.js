// The attractions table was created externally with capitalized column
// names, so "Name" must stay quoted.
const SELECT_ATTRACTIONS_FOR_PREDICTION = `
    SELECT id, "Name" AS name, lat, lon
    FROM attractions
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY id
`;

// One row per attraction per target hour: predicted_for is truncated to the
// hour so repeated runs within the hour refresh the same row.
const UPSERT_ATTRACTION_PREDICTION = `
    INSERT INTO attraction_predictions
        (attraction_id, predicted_for, crowd_score, crowd_level,
         crowd_category, pedestrians_pred, h3_cell, source)
    VALUES
        ($1, date_trunc('hour', $2::timestamptz), $3, $4, $5, $6, $7, $8)
    ON CONFLICT (attraction_id, predicted_for)
    DO UPDATE SET
        crowd_score = EXCLUDED.crowd_score,
        crowd_level = EXCLUDED.crowd_level,
        crowd_category = EXCLUDED.crowd_category,
        pedestrians_pred = EXCLUDED.pedestrians_pred,
        h3_cell = EXCLUDED.h3_cell,
        source = EXCLUDED.source,
        updated_at = now()
`;

module.exports = {
    SELECT_ATTRACTIONS_FOR_PREDICTION,
    UPSERT_ATTRACTION_PREDICTION
};
