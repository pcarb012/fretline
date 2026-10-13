# Supabase setup

Do this once per Supabase project. The full design is in `docs/backend.md`.

## 1. Create the tables

1. Open your project in the Supabase dashboard.
2. Go to **SQL Editor** and click **New query**.
3. Paste all of `supabase/migrations/0001_init.sql`.
4. Click **Run**. It should say "Success". Run it only once; a second run fails because the tables exist.

## 2. Set Auth

1. Go to **Authentication > Sign In / Providers**.
2. Under **Email**, turn on **Enable Email provider** and **Confirm email**.
3. Leave email and password sign-in on.
4. Under **Authentication > URL Configuration**, set **Site URL** to your Vercel address.

## 3. Add the settings

Find them under **Project Settings > API**.

- Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`, and in Vercel's environment variables.
- Put `SUPABASE_SERVICE_ROLE_KEY` only in your shell on your own PC. Never commit it. Never add it to Vercel.

## 4. Seed the songs

In a terminal at the project root, test first:

```
node tools/seed-songs.mjs --dry-run
```

Then run it for real, with the URL and service key set in your shell:

```
npm run seed
```

It prints how many songs it saved. Run it again any time the bundled songs change.
