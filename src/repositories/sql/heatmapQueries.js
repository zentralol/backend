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
    UPSERT_HEATMAP_PREDICTION,
    DELETE_STALE_HEATMAP_PREDICTIONS
};
