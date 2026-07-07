-- Feedback statistics read functions for Zentra backend.
-- Keep feedback aggregation logic inside Supabase PostgreSQL instead of Node route code.

CREATE OR REPLACE FUNCTION public.zentra_get_feedback_stats(
    start_date text DEFAULT '',
    end_date text DEFAULT ''
)
RETURNS TABLE (
    total_feedback integer,
    average_rating double precision,
    useful_rate double precision
)
LANGUAGE sql
STABLE
AS $$
    WITH filtered_feedback AS (
        SELECT *
        FROM feedback
        WHERE
            (NULLIF(start_date, '') IS NULL OR created_at >= NULLIF(start_date, '')::timestamptz)
            AND (NULLIF(end_date, '') IS NULL OR created_at <= NULLIF(end_date, '')::timestamptz)
    )
    SELECT
        COUNT(*)::integer AS total_feedback,
        AVG(rating)::double precision AS average_rating,
        AVG(CASE
            WHEN was_useful IS TRUE THEN 1::double precision
            WHEN was_useful IS FALSE THEN 0::double precision
            ELSE NULL
        END)::double precision AS useful_rate
    FROM filtered_feedback;
$$;

CREATE OR REPLACE FUNCTION public.zentra_get_feedback_by_h3_cell(
    start_date text DEFAULT '',
    end_date text DEFAULT ''
)
RETURNS TABLE (
    h3_cell text,
    feedback_count integer,
    average_rating double precision,
    useful_rate double precision
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        feedback.h3_cell::text,
        COUNT(*)::integer AS feedback_count,
        AVG(feedback.rating)::double precision AS average_rating,
        AVG(CASE
            WHEN feedback.was_useful IS TRUE THEN 1::double precision
            WHEN feedback.was_useful IS FALSE THEN 0::double precision
            ELSE NULL
        END)::double precision AS useful_rate
    FROM feedback
    WHERE
        feedback.h3_cell IS NOT NULL
        AND (NULLIF(start_date, '') IS NULL OR feedback.created_at >= NULLIF(start_date, '')::timestamptz)
        AND (NULLIF(end_date, '') IS NULL OR feedback.created_at <= NULLIF(end_date, '')::timestamptz)
    GROUP BY feedback.h3_cell
    ORDER BY feedback_count DESC
    LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.zentra_get_recent_feedback_comments(
    start_date text DEFAULT '',
    end_date text DEFAULT ''
)
RETURNS TABLE (
    id text,
    h3_cell text,
    rating integer,
    was_useful boolean,
    comment text,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        feedback.id::text,
        feedback.h3_cell::text,
        feedback.rating::integer,
        feedback.was_useful,
        feedback.comment::text,
        feedback.created_at
    FROM feedback
    WHERE
        feedback.comment IS NOT NULL
        AND feedback.comment <> ''
        AND (NULLIF(start_date, '') IS NULL OR feedback.created_at >= NULLIF(start_date, '')::timestamptz)
        AND (NULLIF(end_date, '') IS NULL OR feedback.created_at <= NULLIF(end_date, '')::timestamptz)
    ORDER BY feedback.created_at DESC
    LIMIT 10;
$$;
