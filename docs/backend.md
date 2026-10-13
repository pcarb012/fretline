# Fretline backend

Fretline stays a static Vite site. Supabase gives it sign-in and a Postgres database. Vercel hosts the site. The browser talks to Supabase directly; row-level security (RLS) decides what each user can read and write. Vercel Functions come later, only for code that needs a secret (Stripe webhooks).

Signing in is optional. With no Supabase settings, or signed out, the app works exactly as before from `localStorage`.

## Environment

| Name | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel env, `.env.local` | no |
| `VITE_SUPABASE_ANON_KEY` | Vercel env, `.env.local` | no (public by design; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | only on Peter's PC for `npm run seed`, never in the repo or Vercel client env | yes |

If either `VITE_` value is missing, `src/backend/client.js` returns `null` and every backend call becomes a no-op.

## Tables (`supabase/migrations/0001_init.sql`)

**profiles**: one row per user, created by a trigger on `auth.users` insert.
- `id uuid pk references auth.users on delete cascade`
- `display_name text`
- `daily_goal_minutes int not null default 10 check (between 1 and 240)`
- `settings jsonb not null default '{}'`: `{ speed, tuning }` only. Latency and input device stay per-device in `localStorage`.
- `plan text not null default 'free' check (plan in ('free','premium'))`
- `created_at timestamptz default now()`
- Users can select and update their own row, but only `display_name`, `daily_goal_minutes` and `settings` (column grants). `plan` changes only with the service role (the future Stripe webhook).

**best_scores**: best result per song and speed.
- `user_id uuid references profiles on delete cascade`, `song_id text`, `speed numeric(3,2) check (speed in (0.5,0.75,1))`, `score int check (0..100000)`, `stars int check (0..3)`, `updated_at timestamptz default now()`
- primary key `(user_id, song_id, speed)`
- Own rows only. Writes go through `save_best(p_song_id, p_speed, p_score, p_stars)`, which inserts or keeps the higher score and returns true when it is a new best.

**practice_sessions**: one row per finished or quit play-through.
- `id bigint identity pk`, `user_id`, `song_id text`, `speed numeric(3,2)`, `seconds int check (1..7200)`, `score int`, `stars int`, `local_day date not null` (the player's own calendar day, sent by the client), `created_at timestamptz default now()`
- Insert and select own rows only. No update or delete from the client.

**practice_days** view (`security_invoker = true`): `user_id, local_day, seconds = sum(seconds), sessions = count(*)`, grouped. Streaks and the weekly chart are computed in the client from this.

**songs**: the song library.
- `id text pk`, `title text`, `kind text check (kind in ('exercise','lesson'))`, `position int`, `bpm numeric`, `tuning int[]`, `sections jsonb`, `notes jsonb`, `is_premium bool default false`, `published bool default true`, `updated_at timestamptz default now()`
- Select: `published and (not is_premium or the caller's profile plan = 'premium')`. Open to `anon` and `authenticated`. No client writes.

**song_catalog** view (no `security_invoker`, so everyone sees every published title, premium included, without the notes): `id, title, kind, position, bpm, is_premium` where `published`.

## Client (`src/backend/`)

- `client.js`: `getSupabase()` returns the client or `null`.
- `auth.js`: `getUser()`, `onAuthChange(cb)`, `signUp(email, password)`, `signIn(email, password)`, `signOut()`.
- `sync.js`: on sign-in, push every local best through `save_best`, then pull all remote bests and merge into `localStorage` (higher score wins). `pushBest(...)` after each run when signed in. Settings (`speed`, `tuning`) sync the same way, remote wins on sign-in.
- `practice.js`: `logSession({...})`, `fetchPracticeDays()`, `getGoal()/setGoal()`.
- `catalog.js`: fetch `song_catalog` and `songs`, validate each with the existing song validator, merge over the bundled songs by `id` (server wins), keep bundled songs when offline. Premium songs without notes show as locked.
- Pure logic lives in `src/logic/` with unit tests: `mergeBests`, `streak` (current streak, best streak, today's minutes vs goal, last 7 days), `mergeCatalog`.

## Seeding

`npm run seed` (`tools/seed-songs.mjs`) upserts the bundled exercises and lessons into `songs` with the service-role key. Every song is free for now (`is_premium = false`); the flag gets set once payments exist.

## Later: payments

Stripe Checkout plus a Vercel Function webhook that sets `profiles.plan` with the service role. Get a legal check before charging money (see the private notes).
