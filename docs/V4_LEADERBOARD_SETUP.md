# V4 leaderboard activation boundary

The V4 game always keeps a personal Top 10 in browser storage. The global hall is optional and remains visibly unavailable until a Supabase project is explicitly connected.

## Security model

- The browser receives only `VITE_SUPABASE_URL` and a publishable key.
- Anonymous Supabase Auth supplies a short-lived user JWT for score submission.
- Direct table access is revoked from both `anon` and `authenticated` roles.
- A JWT-protected Edge Function validates ranges, player-name safety, campaign identity, origin, duplicate runs, and a 30-second per-user submission interval.
- The service-role key stays inside the Edge Function environment. It must never be added to Vite variables, Git, or GitHub Pages.
- Public reads use a bounded database function that returns only the ten display fields.

This is anti-abuse validation, not authoritative anti-cheat. Browser gameplay can be modified by a determined player. Server-issued run tickets and signed gameplay events are a later hardening milestone if prizes or competitive stakes are introduced.

## Files ready for a separately approved activation

- `supabase/migrations/202609030001_v4_leaderboard.sql`
- `supabase/functions/submit-v4-score/index.ts`
- `supabase/config.toml`
- `.env.example`

Before activation, create or select the approved Supabase project, enable anonymous sign-ins, configure `LEADERBOARD_ALLOWED_ORIGINS` with the exact public origins, apply the reviewed migration, deploy the function, and add only the public URL and publishable key to the V4 build environment. None of those external actions are performed by this repository change.
