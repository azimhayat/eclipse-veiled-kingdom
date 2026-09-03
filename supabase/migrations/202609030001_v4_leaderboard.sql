-- V4 global leaderboard. The browser can read only a reduced Top 10 projection;
-- it cannot insert, update, delete, or enumerate player identities.
create table if not exists public.v4_leaderboard_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id text not null check (char_length(run_id) between 8 and 160),
  player_name text not null check (char_length(player_name) between 1 and 64),
  campaign_id text not null check (campaign_id = 'veiled-kingdom-v4-20'),
  total_time_seconds numeric(10,3) not null check (total_time_seconds between 600 and 28800),
  deaths integer not null check (deaths between 0 and 999),
  warden_attempts integer check (warden_attempts between 1 and 999),
  damage_taken integer check (damage_taken between 0 and 9999),
  client_completed_at timestamptz not null,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, run_id)
);

alter table public.v4_leaderboard_runs enable row level security;
revoke all on table public.v4_leaderboard_runs from public, anon, authenticated;

create index if not exists v4_leaderboard_rank_idx
  on public.v4_leaderboard_runs (total_time_seconds, deaths, damage_taken, created_at)
  where accepted = true;
create index if not exists v4_leaderboard_user_rate_idx
  on public.v4_leaderboard_runs (user_id, created_at desc);

create or replace function public.get_v4_top_ten()
returns table (
  position bigint,
  player_name text,
  total_time_seconds numeric,
  deaths integer,
  warden_attempts integer,
  damage_taken integer,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    row_number() over (order by total_time_seconds, deaths, damage_taken nulls last, created_at),
    player_name,
    total_time_seconds,
    deaths,
    warden_attempts,
    damage_taken,
    client_completed_at
  from public.v4_leaderboard_runs
  where accepted = true and campaign_id = 'veiled-kingdom-v4-20'
  order by total_time_seconds, deaths, damage_taken nulls last, created_at
  limit 10;
$$;

revoke all on function public.get_v4_top_ten() from public;
grant execute on function public.get_v4_top_ten() to anon, authenticated;
