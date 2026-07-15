const SELECT_HEATMAP_PREDICTIONS = `
    WITH selected_target AS (
        SELECT target_time
        FROM heatmap_predictions
        ORDER BY ABS(EXTRACT(EPOCH FROM (target_time - $1::timestamp))) ASC,
                 target_time DESC
        LIMIT 1
    )
    SELECT
        hp.target_time,
        hp.h3_cell,
        hp.lat,
        hp.lon,
        hp.crowd_score,
        hp.crowd_level,
        hp.pedestrians_pred,
        hp.period,
        hp.crowd_category,
        hp.source,
        hp.generated_at
    FROM heatmap_predictions hp
    JOIN selected_target st ON hp.target_time = st.target_time
    ORDER BY hp.h3_cell ASC
    LIMIT $2::integer
`;

const UPSERT_HEATMAP_PREDICTION = `
    INSERT INTO heatmap_predictions
        (target_time, h3_cell, lat, lon, crowd_score, crowd_level,
         pedestrians_pred, period, crowd_category, source, generated_at)
    VALUES
        ($1::timestamp, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
    ON CONFLICT (target_time, h3_cell)
    DO UPDATE SET
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon,
        crowd_score = EXCLUDED.crowd_score,
        crowd_level = EXCLUDED.crowd_level,
        pedestrians_pred = EXCLUDED.pedestrians_pred,
        period = EXCLUDED.period,
        crowd_category = EXCLUDED.crowd_category,
        source = EXCLUDED.source,
        generated_at = now()
`;

const DELETE_STALE_HEATMAP_PREDICTIONS = `
    DELETE FROM heatmap_predictions
    WHERE target_time < $1::timestamp
`;

module.exports = {
    SELECT_HEATMAP_PREDICTIONS,
    UPSERT_HEATMAP_PREDICTION,
    DELETE_STALE_HEATMAP_PREDICTIONS
};
