-- Câmpuri opționale pentru urmărire post‑meci / ROI / transparență (setate de job‑uri dedicate).

alter table public.prediction_reports
  add column if not exists final_home_goals int;

alter table public.prediction_reports
  add column if not exists final_away_goals int;

alter table public.prediction_reports
  add column if not exists settled_at timestamptz;

alter table public.prediction_reports
  add column if not exists outcome_summary text;

alter table public.prediction_reports
  add column if not exists stats_actual jsonb;
