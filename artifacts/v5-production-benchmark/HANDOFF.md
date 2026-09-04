# V5 Production Benchmark Handoff

Review date: 2026-09-04
Branch: `v5-production-benchmark`
Release status: local benchmark only; V4 publication is untouched.

## Completed benchmark

- Integrated two original rendered story films into the game: a 72-second
  opening prologue and a 40-second Chapter I introduction.
- Added captions-on playback, gesture-only start, play/pause, skip, skip-all,
  readable story fallback and replay controls.
- Routed film volume through the persistent Music setting and isolated game
  simulation/audio while a film is open.
- Added a production Veil Raider combat sheet to Level 8 with authored descent,
  landing, anticipation, contact, recovery, hit and fading defeat presentation.
- Added a production Warden of Dust sheet to the Level 10 duel with authored
  guard, windup, contact, recovery, hit, Eclipse and restoration presentation.
- Preserved Level 8 and Level 10 geometry, objectives, encounter counts, damage,
  checkpoints and completion rules.
- Added a localhost-only built-production review address for the Warden fight.
  It cannot activate on the public GitHub host.

## Validation evidence

- Automated suite: 37 files, 328 tests passing.
- Production build: 67 modules, successful.
- Final MP4 full-stream audio/video decode: PASS for both films.
- Subtitle validator: PASS; 8 opening cues and 6 Chapter I cues.
- Browser media contract: both films report 1920 x 1080; durations 72 and 40
  seconds; English captions are showing; playback is paused until Play.
- Browser controls: pause held the playhead unchanged; skip advanced to Film 2;
  skip-all returned to the title.
- Responsive checks: desktop 1440 x 900, landscape phone 844 x 390 and portrait
  phone 390 x 844 for films and combat presentation.
- Touch checks: Level 8 movement triggered the authored landing encounter; the
  generated raider rendered in combat. Level 10 guard held Aren at 4/4 through
  an attack and exposed the Warden recovery window.
- Fresh production-browser sessions for the Level 10 checkpoint and cinematic
  viewer reported no console warnings or errors.
- Lazy-loading evidence: title inventory contained zero video resources before
  opening the story viewer. Level 10 loaded its Warden sheet and no cinematic
  files.
- Bounded localhost metrics: Warden route DCL 60 ms, first meaningful paint
  368 ms and 5.80 MB used JS heap. Title/cinematic route DCL 52 ms, first
  meaningful paint 277 ms and 8.51 MB used JS heap after opening the viewer.
  These are local CDP observations, not field Core Web Vitals.

## Media and provenance

Film hashes, encode details, subtitle speeds, audio loudness and visual review
are recorded in `artifacts/cinematics/v5-production-benchmark/VALIDATION.md`.
All music, ambience and effects were synthesized locally by the deterministic
pipeline described in `artifacts/cinematics/v5-production-benchmark/PROVENANCE.md`.
There is no voice acting, stock media, downloaded sound, franchise asset or
third-party model output.

The accepted Level 8 and Level 10 runtime PNGs are genuine 32-bit ARGB assets.
Their generation, rejected opaque drafts and acceptance checks are recorded in
`artifacts/character-design/v5-production-benchmark/`.

## Agent findings reviewed by root

- Accepted: the cinematic pipeline and validation package after visual, decode,
  subtitle and audio review.
- Rejected: the first Level 8 and Level 10 sheet candidates because their
  checkerboards were baked opaque.
- Accepted after correction: targeted built-in background extraction produced
  true alpha while preserving identity, grid order and pose containment.
- No agent output was accepted without root inspection.

## Remaining quality gates

- Human creative-direction playback approval is still required before scaling
  the benchmark to the other levels or publishing V5.
- The main JavaScript chunk is 553.63 kB minified / 159.20 kB gzip, which passes
  the build but triggers Vite's 500 kB advisory. Code-splitting is the next
  technical optimization before broader cinematic rollout.
- Automated Core Web Vitals tracing is not available in the current toolset;
  no LCP, INP or CLS claim is made.
- The Warden timing should receive a final human balance pass with a full
  90-120 second victory run. Deterministic state tests cover phases, controls,
  checkpoint reset and completion, but subjective duel feel remains a gate.
- This benchmark is high-quality original 2.5D motion graphics and illustrated
  combat presentation. It is not full 3D performance capture or a claim of
  GTA/COD/Fortnite-scale studio production.

## Recovery and next safe milestone

Pre-work recovery remains available at tag
`backup-v5-benchmark-prework-20260904` and bundle
`C:/Users/azimh/Documents/Codex/backups/eclipse-veiled-kingdom/2026-09-04-v5-benchmark-prework/eclipse-veiled-kingdom-v5-benchmark-prework.bundle`.

The next safe milestone is a human review of the two films and the Level 8/10
benchmark. If accepted, scale in reviewed batches rather than attempting all
20 levels at once: Levels 1-5, 6-10, 11-15 and 16-20, with a build, playthrough
and rollback point after every batch.
