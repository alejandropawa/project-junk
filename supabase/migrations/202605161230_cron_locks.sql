-- Lock-uri pentru cron jobs: acquire/release atomic in Postgres, apelate prin RPC Supabase.

create table if not exists public.cron_locks (
  name text primary key,
  owner text,
  expires_at timestamptz not null,
  locked_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_skipped_at timestamptz,
  last_duration_ms int,
  last_created_count int not null default 0,
  last_updated_count int not null default 0,
  run_count bigint not null default 0,
  completed_count bigint not null default 0,
  skipped_count bigint not null default 0,
  created_count bigint not null default 0,
  updated_count bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cron_locks enable row level security;

create index if not exists cron_locks_expires_at_idx
  on public.cron_locks (expires_at);

create or replace function public.acquire_cron_lock(
  p_name text,
  p_ttl_seconds int,
  p_owner text
)
returns table (
  acquired boolean,
  name text,
  owner text,
  expires_at timestamptz,
  run_count bigint,
  skipped_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ttl int := greatest(1, p_ttl_seconds);
begin
  return query
  with upserted as (
    insert into public.cron_locks (
      name,
      owner,
      expires_at,
      locked_at,
      last_started_at,
      run_count,
      metadata,
      updated_at
    )
    values (
      p_name,
      p_owner,
      v_now + make_interval(secs => v_ttl),
      v_now,
      v_now,
      1,
      jsonb_build_object('last_event', 'started'),
      v_now
    )
    on conflict (name) do update
      set owner = excluded.owner,
          expires_at = excluded.expires_at,
          locked_at = excluded.locked_at,
          last_started_at = excluded.last_started_at,
          run_count = public.cron_locks.run_count + 1,
          metadata = public.cron_locks.metadata || jsonb_build_object('last_event', 'started'),
          updated_at = v_now
      where public.cron_locks.expires_at <= v_now
    returning
      true,
      public.cron_locks.name,
      public.cron_locks.owner,
      public.cron_locks.expires_at,
      public.cron_locks.run_count,
      public.cron_locks.skipped_count
  )
  select * from upserted;

  if not found then
    update public.cron_locks
      set skipped_count = skipped_count + 1,
          last_skipped_at = v_now,
          metadata = metadata || jsonb_build_object('last_event', 'skipped'),
          updated_at = v_now
      where cron_locks.name = p_name;

    return query
    select
      false,
      l.name,
      l.owner,
      l.expires_at,
      l.run_count,
      l.skipped_count
    from public.cron_locks l
    where l.name = p_name;
  end if;
end;
$$;

create or replace function public.release_cron_lock(
  p_name text,
  p_owner text,
  p_duration_ms int default null,
  p_created_count int default 0,
  p_updated_count int default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  released boolean,
  name text,
  completed_count bigint,
  created_count bigint,
  updated_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  return query
  update public.cron_locks
    set owner = null,
        expires_at = v_now,
        last_completed_at = v_now,
        last_duration_ms = p_duration_ms,
        last_created_count = greatest(0, p_created_count),
        last_updated_count = greatest(0, p_updated_count),
        completed_count = completed_count + 1,
        created_count = created_count + greatest(0, p_created_count),
        updated_count = updated_count + greatest(0, p_updated_count),
        metadata = metadata || p_metadata || jsonb_build_object('last_event', 'completed'),
        updated_at = v_now
    where cron_locks.name = p_name
      and cron_locks.owner = p_owner
    returning
      true,
      public.cron_locks.name,
      public.cron_locks.completed_count,
      public.cron_locks.created_count,
      public.cron_locks.updated_count;

  if not found then
    return query
    select
      false,
      l.name,
      l.completed_count,
      l.created_count,
      l.updated_count
    from public.cron_locks l
    where l.name = p_name;
  end if;
end;
$$;

revoke all on function public.acquire_cron_lock(text, int, text)
  from public, anon, authenticated;
revoke all on function public.release_cron_lock(text, text, int, int, int, jsonb)
  from public, anon, authenticated;

grant execute on function public.acquire_cron_lock(text, int, text)
  to service_role;
grant execute on function public.release_cron_lock(text, text, int, int, int, jsonb)
  to service_role;
