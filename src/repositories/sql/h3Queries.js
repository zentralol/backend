const SELECT_H3_GRID_CELLS = `
    SELECT h3_cell, lat, lon
    FROM h3_grid_cells
    ORDER BY h3_cell ASC
    LIMIT $1
`;

const SELECT_HEATMAP_SCORES = `
    SELECT *
    FROM public.zentra_get_heatmap_scores($1::timestamptz, $2::integer)
`;

const SELECT_NEAREST_PREDICTION_SCORE = `
    SELECT *
    FROM public.zentra_get_nearest_prediction_score($1::double precision, $2::double precision, $3::timestamptz)
`;

const SELECT_NEAREST_H3_CELL = `
    SELECT *
    FROM public.zentra_get_nearest_h3_cell($1::double precision, $2::double precision)
`;

const SELECT_FORECAST_SCORES = `
    SELECT *
    FROM public.zentra_get_forecast_scores($1::text, $2::timestamptz, $3::timestamptz, $4::integer)
`;

const SELECT_QUIETER_NEARBY_SCORES = `
    SELECT *
    FROM public.zentra_get_quieter_nearby_scores($1::double precision, $2::double precision, $3::timestamptz, $4::integer)
`;

// One row per (h3_cell, query_timestamp) bucket. On conflict, only the fields
// the refresh job actually produces are overwritten; enrichment columns from
// the original batch-scored data (poi_total, tlc_trip_count, etc.) are left
// untouched.
const UPSERT_H3_GRID_SCORE = `
    INSERT INTO h3_grid_scores
        (h3_cell, lat, lon, period, query_timestamp, crowd_score, pedestrians_pred)
    VALUES
        ($1, $2, $3, $4, $5::timestamptz, $6, $7)
    ON CONFLICT (h3_cell, query_timestamp)
    DO UPDATE SET
        period = EXCLUDED.period,
        crowd_score = EXCLUDED.crowd_score,
        pedestrians_pred = EXCLUDED.pedestrians_pred
`;

module.exports = {
    SELECT_H3_GRID_CELLS,
    SELECT_HEATMAP_SCORES,
    SELECT_NEAREST_PREDICTION_SCORE,
    SELECT_NEAREST_H3_CELL,
    SELECT_FORECAST_SCORES,
    SELECT_QUIETER_NEARBY_SCORES,
    UPSERT_H3_GRID_SCORE
};
