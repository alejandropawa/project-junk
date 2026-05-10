-- Rulează în Supabase SQL Editor (Development / Production).

create table if not exists public.prediction_reports (
  fixture_id bigint not null,
  date_ro text not null,
  home_name text not null,
  away_name text not null,
  league_name text not null,
  kickoff_iso timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (fixture_id, date_ro)
);

alter table public.prediction_reports enable row level security;

-- Utilizatori autentificați: doar citire (predicții generate de cron cu service_role).
drop policy if exists "prediction_reports_select_authenticated"
  on public.prediction_reports;

create policy "prediction_reports_select_authenticated"
  on public.prediction_reports
  for select
  to authenticated
  using (true);
