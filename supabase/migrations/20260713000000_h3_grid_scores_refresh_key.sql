-- Enables ON CONFLICT upserts for the periodic h3_grid_scores refresh job
-- (src/jobs/h3GridScoreRefreshJob.js). IF NOT EXISTS keeps this safe to
-- apply against the already-provisioned h3_grid_scores table.
CREATE UNIQUE INDEX IF NOT EXISTS h3_grid_scores_cell_timestamp_key
    ON public.h3_grid_scores (h3_cell, query_timestamp);
