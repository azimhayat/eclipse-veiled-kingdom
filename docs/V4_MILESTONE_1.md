# V4 Milestone 1 — twenty-level campaign and Top 10 foundation

Updated: 2026-09-03 Asia/Dubai
Scope: local V4 branch only. V1, V2, V3, their public URLs, and the pre-V4 recovery point remain unchanged.

## Completed

- Combined the complete V3 Outer Veil campaign as Chapters 1–10 with the strongest retained V2 realm designs as Chapters 11–20.
- Kept all V3 Stage I level identities, geometry, bespoke objectives, story, restoration, audio, and the Level 10 arcade Warden duel unchanged.
- Assigned stable V4 string identities and explicit campaign order to every Stage II chapter. Chapters 12–20 preserve their V2 geometry and mechanisms while adding distinct story, objective, route, timing, and encounter metadata.
- Made Chapter 11 an honest restored return to the Outer Veil: the route is intentionally familiar, selected floor tiles visibly glow, relic names reflect restoration, and the mixed shield/spear/archer roster tests mastery.
- Preserved lazy level loading and the bounded three-level cache across the Chapter 10 → 11 boundary.
- Added a separate V4 save key with contiguous-prefix validation, checkpoint recovery, per-level time/death metrics, Warden-stat carry, and safe migration from the current V3 save. Earlier save keys remain untouched.
- Added an on-device Top 10 with deterministic tie-breaking and transparent S/A/B/C ranking criteria.
- Added the V4 completion/name flow and responsive personal/global Top 10 interface.
- Added a disabled-by-default Supabase integration: public browser configuration only, anonymous Auth JWT submission, JWT-protected Edge Function, server-only service role, input/origin/rate validation, direct table access revoked, and a bounded public Top 10 database function.
- Added a safe render-cache guard for development reloads after a live browser test exposed a missing baked-frame exception.

## Validation evidence

- Complete automated suite: **291 tests across 32 files passed**.
- Production build: **62 modules transformed** with all Stage I and Stage II level modules retained as lazy chunks.
- `git diff --check`: passed with expected Windows line-ending notices only.
- Desktop 1280×720: V4 title, migrated 10/20 continuation, and two-column Top 10 panel fit without overflow.
- Landscape phone 844×390: Top 10 and Chapter 11 gameplay fit; all seven touch controls remained inside the viewport.
- Portrait phone 390×844: Top 10 collapsed to one column and Chapter 11 kept the full touch control set inside the viewport.
- The real campaign boundary opened Chapter 11 with `INNER KINGDOM · LVL 11`, `Outer Veil Restored`, and `Realm II · Chapter 11 of 20` presentation.
- A clean post-fix browser run through title → Top 10 → Chapter 11 reported no warnings or errors.
- The preserved explicit V3 route still showed its ten-chapter Stage I copy and 10/10 completed state.

## Global Hall status

- The local/personal Top 10 is active and requires no network.
- The Supabase schema, Edge Function, frontend client, tests, and setup guide are present locally.
- No Supabase project was created or changed, no migration was applied remotely, no function was deployed, and no key was requested or exposed.
- Global score validation is an anti-abuse first pass, not authoritative anti-cheat. Browser code can be modified by a determined player. Competitive prizes would require server-issued run tickets and signed gameplay evidence.

## Backup and rollback

- Pre-V4 commit: `a05c6bde1058b7745b1eced5df8b9bfd6714d2df`.
- Recovery branch: `backup/v3-before-v4-20260903`.
- Recovery tag: `backup-v3-before-v4-20260903`.
- Verified bundle: `C:\Users\azimh\Documents\Codex\backups\eclipse-veiled-kingdom\2026-09-03-v4-start\eclipse-veiled-kingdom-before-v4.bundle`.

## Remaining quality gaps

- Chapters 12–20 retain proven V2 mechanics and geometry, but their newly combined V4 sequence still needs an uninterrupted human playthrough for pacing, difficulty progression, encounter repetition, and Chapter 20 finale quality.
- Chapter 11 is an intentional restored revisit rather than a twentieth unique layout; its familiarity must be judged as a narrative mastery test in a natural play session.
- The Level 20 V2 guardian remains mechanically simpler than the V3 Warden. It is playable, but a bespoke Stage II finale is the largest remaining world-class-quality gap.
- The production bundle’s main JavaScript entry is about 517 kB minified and triggers Vite’s advisory size warning. Level maps already load separately; deeper UI/engine splitting is future performance polish.
- Supabase remains unconnected by design. Global Top 10 cannot function until a project, exact allowed origin, migration, Edge Function, anonymous sign-in setting, and public keys receive explicit activation approval.

## Exact next milestone

Play Chapters 11–20 in order on desktop and a physical phone. Record only reproduced softlocks, unfair encounters, unclear objectives, repetitive patterns, or pacing failures. Fix those narrowly, then replace the simple Chapter 20 guardian with an original Stage II climax while preserving the accepted map and route. Rerun the full suite, build, three responsive browser checks, save migration/reload, and both leaderboard paths. Do not activate Supabase or publish V4 without separate explicit approval.
