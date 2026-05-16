-- Cache pentru polling live: populat doar de cron / service role.

create table if not exists public.live_fixture_snapshots (
  fixture_id bigint primary key,
  league_id bigint not null,
  kickoff_at timestamptz not null,
  kickoff_date date not null,
  status text not null,
  bucket text not null check (bucket in ('live', 'upcoming', 'finished', 'other')),
  minute int,
  home_goals int,
  away_goals int,
  score jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  normalized_fixture jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.live_fixture_snapshots enable row level security;

create index if not exists live_fixture_snapshots_status_idx
  on public.live_fixture_snapshots (status);

create index if not exists live_fixture_snapshots_kickoff_date_idx
  on public.live_fixture_snapshots (kickoff_date);

create index if not exists live_fixture_snapshots_league_id_idx
  on public.live_fixture_snapshots (league_id);

create index if not exists live_fixture_snapshots_updated_at_idx
  on public.live_fixture_snapshots (updated_at);
