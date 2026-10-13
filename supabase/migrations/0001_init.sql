-- Fretline backend, first migration. Run once on a fresh Supabase project.
-- See docs/backend.md.

-- Tables

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  daily_goal_minutes int not null default 10
    check (daily_goal_minutes between 1 and 240),
  settings jsonb not null default '{}' check (pg_column_size(settings) <= 2048),
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now()
);

create table public.best_scores (
  user_id uuid not null references public.profiles on delete cascade,
  song_id text not null check (char_length(song_id) <= 64),
  speed numeric(3, 2) not null check (speed in (0.5, 0.75, 1)),
  score int not null check (score between 0 and 100000),
  stars int not null check (stars between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id, speed)
);

create table public.practice_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  song_id text not null check (char_length(song_id) <= 64),
  speed numeric(3, 2) not null check (speed in (0.5, 0.75, 1)),
  seconds int not null check (seconds between 1 and 7200),
  score int check (score between 0 and 100000),
  stars int check (stars between 0 and 3),
  local_day date not null,
  created_at timestamptz not null default now(),
  -- The player's calendar day is within two days of the server's.
  check (local_day between (created_at at time zone 'utc')::date - 2
                       and (created_at at time zone 'utc')::date + 2)
);

create index practice_sessions_user_day_idx
  on public.practice_sessions (user_id, local_day);

create table public.songs (
  id text primary key,
  title text not null,
  kind text not null check (kind in ('exercise', 'lesson')),
  position int not null default 0,
  bpm numeric,
  tuning int[],
  sections jsonb,
  notes jsonb,
  is_premium boolean not null default false,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Views

create view public.practice_days
  with (security_invoker = true) as
select user_id,
       local_day,
       sum(seconds)::int as seconds,
       count(*)::int as sessions
from public.practice_sessions
group by user_id, local_day;

-- Not security_invoker on purpose: everyone sees every published title.
create view public.song_catalog as
select id, title, kind, position, bpm, is_premium
from public.songs
where published;

-- Helper for the songs policy. Security definer so anon can run it
-- without read access to profiles.
create function public.is_premium_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and plan = 'premium'
  );
$$;

-- Row-level security

alter table public.profiles enable row level security;
alter table public.best_scores enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.songs enable row level security;

create policy "profiles: select own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "best_scores: select own" on public.best_scores
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "practice_sessions: select own" on public.practice_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "practice_sessions: insert own" on public.practice_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "songs: read published" on public.songs
  for select to anon, authenticated
  using (published and (not is_premium or (select public.is_premium_user())));

-- Grants. Supabase grants broadly by default, so start from nothing.

revoke all on public.profiles, public.best_scores,
  public.practice_sessions, public.songs,
  public.practice_days, public.song_catalog
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, daily_goal_minutes, settings)
  on public.profiles to authenticated;

-- Writes go only through save_best, so the keep-higher rule holds.
grant select on public.best_scores to authenticated;

grant select, insert on public.practice_sessions to authenticated;
grant usage on sequence public.practice_sessions_id_seq to authenticated;

grant select on public.songs to anon, authenticated;
grant select on public.song_catalog to anon, authenticated;
grant select on public.practice_days to authenticated;

revoke all on function public.is_premium_user() from public;
grant execute on function public.is_premium_user() to anon, authenticated;

-- Cap practice rows per user per day, so one account can't fill the database.

create function public.limit_practice_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.practice_sessions
      where user_id = new.user_id and local_day = new.local_day) >= 500 then
    raise exception 'too many practice sessions today';
  end if;
  return new;
end;
$$;

revoke all on function public.limit_practice_sessions() from public, anon, authenticated;

create trigger practice_sessions_daily_cap
  before insert on public.practice_sessions
  for each row execute function public.limit_practice_sessions();

-- New user -> profile

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Save a best score. Keeps the higher score; true when it wrote a row.
-- Security definer because clients have no direct write access to best_scores.

create function public.save_best(
  p_song_id text,
  p_speed numeric,
  p_score int,
  p_stars int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  rows_changed int;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  insert into public.best_scores as b (user_id, song_id, speed, score, stars)
  values ((select auth.uid()), p_song_id, p_speed, p_score, p_stars)
  on conflict (user_id, song_id, speed) do update
    set score = excluded.score,
        stars = excluded.stars,
        updated_at = now()
    where excluded.score > b.score;
  get diagnostics rows_changed = row_count;
  return rows_changed > 0;
end;
$$;

revoke all on function public.save_best(text, numeric, int, int) from public, anon;
grant execute on function public.save_best(text, numeric, int, int) to authenticated;
