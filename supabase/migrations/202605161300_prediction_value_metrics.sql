-- Value betting audit fields for reporting / CLV / ROI.

alter table public.prediction_reports
  add column if not exists raw_probability numeric;

alter table public.prediction_reports
  add column if not exists calibrated_probability numeric;

alter table public.prediction_reports
  add column if not exists implied_probability numeric;

alter table public.prediction_reports
  add column if not exists edge numeric;

alter table public.prediction_reports
  add column if not exists opening_odds numeric;

alter table public.prediction_reports
  add column if not exists closing_odds numeric;

alter table public.prediction_reports
  add column if not exists clv_percent numeric;

alter table public.prediction_reports
  add column if not exists flat_stake_profit numeric;

create index if not exists prediction_reports_edge_idx
  on public.prediction_reports (edge);

create index if not exists prediction_reports_flat_stake_profit_idx
  on public.prediction_reports (flat_stake_profit);
