const SELECT_PREDICTION_STATS = `
    WITH filtered_requests AS (
        SELECT *
        FROM prediction_requests
        WHERE
            ($1 = '' OR created_at >= $1::timestamptz)
            AND ($2 = '' OR created_at <= $2::timestamptz)
    )
    SELECT
        COUNT(*)::int AS total_requests,
        AVG(response_crowd_score) AS average_crowd_score,
        COUNT(*) FILTER (WHERE source = 'ml_fastapi')::int AS ml_requests,
        COUNT(*) FILTER (WHERE source = 'h3_grid_scores')::int AS cached_requests,
        COUNT(DISTINCT matched_h3_cell)::int AS unique_h3_cells
    FROM filtered_requests
`;

const SELECT_TOP_PREDICTION_CELLS = `
    SELECT
        matched_h3_cell,
        COUNT(*)::int AS request_count,
        AVG(response_crowd_score) AS average_crowd_score
    FROM prediction_requests
    WHERE
        matched_h3_cell IS NOT NULL
        AND ($1 = '' OR created_at >= $1::timestamptz)
        AND ($2 = '' OR created_at <= $2::timestamptz)
    GROUP BY matched_h3_cell
    ORDER BY request_count DESC
    LIMIT 10
`;

module.exports = {
    SELECT_PREDICTION_STATS,
    SELECT_TOP_PREDICTION_CELLS
};
