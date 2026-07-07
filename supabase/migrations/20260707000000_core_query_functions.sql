-- Backend-owned read functions for Zentra.
-- These keep complex H3 query logic inside Supabase PostgreSQL instead of Node route code.

CREATE OR REPLACE FUNCTION public.zentra_get_heatmap_scores(
    target_time timestamptz,
    result_limit integer DEFAULT 100
)
RETURNS TABLE (
    h3_cell text,
    lat double precision,
    lon double precision,
    period text,
    query_timestamp timestamptz,
    crowd_score double precision,
    pedestrians_pred double precision,
    poi_total double precision
)
LANGUAGE sql
STABLE
AS $$
    WITH ranked_scores AS (
        SELECT
            hgs.h3_cell,
            hgs.lat,
            hgs.lon,
            hgs.period,
            hgs.query_timestamp,
            hgs.crowd_score,
            hgs.pedestrians_pred,
            hgs.poi_total,
            ROW_NUMBER() OVER (
                PARTITION BY hgs.h3_cell
                ORDER BY
                    ABS(EXTRACT(EPOCH FROM (hgs.query_timestamp - target_time))) ASC,
                    hgs.query_timestamp DESC NULLS LAST
            ) AS row_rank
        FROM h3_grid_scores hgs
        WHERE hgs.crowd_score IS NOT NULL
    )
    SELECT
        ranked_scores.h3_cell::text,
        ranked_scores.lat::double precision,
        ranked_scores.lon::double precision,
        ranked_scores.period::text,
        ranked_scores.query_timestamp,
        ranked_scores.crowd_score::double precision,
        ranked_scores.pedestrians_pred::double precision,
        ranked_scores.poi_total::double precision
    FROM ranked_scores
    WHERE ranked_scores.row_rank = 1
    ORDER BY ranked_scores.crowd_score DESC
    LIMIT GREATEST(1, LEAST(result_limit, 524));
$$;

CREATE OR REPLACE FUNCTION public.zentra_get_nearest_prediction_score(
    input_lat double precision,
    input_lng double precision,
    target_time timestamptz
)
RETURNS TABLE (
    id bigint,
    h3_cell text,
    lat double precision,
    lon double precision,
    period text,
    query_timestamp timestamptz,
    crowd_score double precision,
    pedestrians_pred double precision,
    ensemble_log_pred double precision,
    poi_total double precision,
    poi_density_score double precision,
    tlc_trip_count double precision,
    mta_ridership_total double precision,
    citibike_trip_count double precision,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        hgs.id::bigint,
        hgs.h3_cell::text,
        hgs.lat::double precision,
        hgs.lon::double precision,
        hgs.period::text,
        hgs.query_timestamp,
        hgs.crowd_score::double precision,
        hgs.pedestrians_pred::double precision,
        hgs.ensemble_log_pred::double precision,
        hgs.poi_total::double precision,
        hgs.poi_density_score::double precision,
        hgs.tlc_trip_count::double precision,
        hgs.mta_ridership_total::double precision,
        hgs.citibike_trip_count::double precision,
        hgs.created_at
    FROM h3_grid_scores hgs
    WHERE hgs.crowd_score IS NOT NULL
    ORDER BY
        ((hgs.lat - input_lat) * (hgs.lat - input_lat) + (hgs.lon - input_lng) * (hgs.lon - input_lng)) ASC,
        ABS(EXTRACT(EPOCH FROM (hgs.query_timestamp - target_time))) ASC NULLS LAST
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.zentra_get_nearest_h3_cell(
    input_lat double precision,
    input_lng double precision
)
RETURNS TABLE (
    h3_cell text
)
LANGUAGE sql
STABLE
AS $$
    SELECT hgs.h3_cell::text
    FROM h3_grid_scores hgs
    WHERE hgs.crowd_score IS NOT NULL
    ORDER BY ((hgs.lat - input_lat) * (hgs.lat - input_lat) + (hgs.lon - input_lng) * (hgs.lon - input_lng)) ASC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.zentra_get_forecast_scores(
    input_h3_cell text,
    start_time timestamptz,
    end_time timestamptz,
    result_limit integer DEFAULT 24
)
RETURNS TABLE (
    h3_cell text,
    lat double precision,
    lon double precision,
    period text,
    query_timestamp timestamptz,
    crowd_score double precision,
    pedestrians_pred double precision
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        hgs.h3_cell::text,
        hgs.lat::double precision,
        hgs.lon::double precision,
        hgs.period::text,
        hgs.query_timestamp,
        hgs.crowd_score::double precision,
        hgs.pedestrians_pred::double precision
    FROM h3_grid_scores hgs
    WHERE
        hgs.h3_cell = input_h3_cell
        AND hgs.crowd_score IS NOT NULL
        AND hgs.query_timestamp >= start_time
        AND hgs.query_timestamp <= end_time
    ORDER BY hgs.query_timestamp ASC
    LIMIT GREATEST(1, LEAST(result_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.zentra_get_quieter_nearby_scores(
    input_lat double precision,
    input_lng double precision,
    target_time timestamptz,
    result_limit integer DEFAULT 5
)
RETURNS TABLE (
    h3_cell text,
    lat double precision,
    lon double precision,
    period text,
    query_timestamp timestamptz,
    crowd_score double precision,
    pedestrians_pred double precision,
    distance_score double precision
)
LANGUAGE sql
STABLE
AS $$
    WITH ranked_scores AS (
        SELECT
            hgs.h3_cell,
            hgs.lat,
            hgs.lon,
            hgs.period,
            hgs.query_timestamp,
            hgs.crowd_score,
            hgs.pedestrians_pred,
            ((hgs.lat - input_lat) * (hgs.lat - input_lat) + (hgs.lon - input_lng) * (hgs.lon - input_lng)) AS distance_score,
            ROW_NUMBER() OVER (
                PARTITION BY hgs.h3_cell
                ORDER BY ABS(EXTRACT(EPOCH FROM (hgs.query_timestamp - target_time))) ASC
            ) AS row_rank
        FROM h3_grid_scores hgs
        WHERE hgs.crowd_score IS NOT NULL
    )
    SELECT
        ranked_scores.h3_cell::text,
        ranked_scores.lat::double precision,
        ranked_scores.lon::double precision,
        ranked_scores.period::text,
        ranked_scores.query_timestamp,
        ranked_scores.crowd_score::double precision,
        ranked_scores.pedestrians_pred::double precision,
        ranked_scores.distance_score::double precision
    FROM ranked_scores
    WHERE ranked_scores.row_rank = 1
    ORDER BY ranked_scores.crowd_score ASC, ranked_scores.distance_score ASC
    LIMIT GREATEST(1, LEAST(result_limit, 20));
$$;
