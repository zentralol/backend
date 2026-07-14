CREATE TABLE public.heatmap_predictions (
  id               bigserial PRIMARY KEY,
  target_time      timestamp NOT NULL,
  h3_cell          text NOT NULL,
  lat              double precision NOT NULL,
  lon              double precision NOT NULL,
  crowd_score      smallint NOT NULL CHECK (crowd_score BETWEEN 0 AND 100),
  crowd_level      text NOT NULL,
  pedestrians_pred double precision,
  period           text,
  crowd_category   text,
  source           text NOT NULL DEFAULT 'ml_fastapi',
  generated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_time, h3_cell)
);

CREATE INDEX idx_heatmap_predictions_target_time
  ON public.heatmap_predictions (target_time);

CREATE INDEX idx_heatmap_predictions_target_h3
  ON public.heatmap_predictions (target_time, h3_cell);
