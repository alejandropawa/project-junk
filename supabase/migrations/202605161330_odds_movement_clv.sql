-- Odds movement / closing-line-value audit fields.

alter table public.prediction_reports
  add column if not exists published_odds numeric;

alter table public.prediction_reports
  add column if not exists current_odds numeric;

alter table public.prediction_reports
  add column if not exists odds_movement_pct numeric;

alter table public.prediction_reports
  add column if not exists moved_against_model boolean;

alter table public.prediction_reports
  add column if not exists moved_with_model boolean;

alter table public.prediction_reports
  add column if not exists closing_line_value_pct numeric;

create index if not exists prediction_reports_clv_pct_idx
  on public.prediction_reports (closing_line_value_pct);

create index if not exists prediction_reports_odds_movement_pct_idx
  on public.prediction_reports (odds_movement_pct);
