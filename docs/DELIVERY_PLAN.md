# World-Class 100-Level Delivery Plan

This project will grow through reviewed realm packs, not a one-shot rewrite. The existing public game remains untouched until a local milestone is approved.

## Chunk 1 — Foundation and Level 1 vertical slice

- Lock the creative bible, campaign spine, visual language, and production constraints.
- Make Level 1, **Buried Dawn**, the quality benchmark.
- Fix viewport readability, title asset routing, mobile objectives, hero scale, and puzzle guidance.
- Add original environment art, a chapter opening, narrative relics, and a full-level death reset.
- Acceptance: automated tests, production build, desktop and mobile visual inspection, no console errors.

## Chunk 2 — Scalable campaign architecture

- Wrap existing level objects in a validated authored schema.
- Separate stable level identity from numeric campaign order.
- Load and paint the current level only, prefetch the next, and keep a maximum three-level cache.
- Version save data so future level additions do not invalidate player progress.
- Preserve the current ten realm prototypes as regression references during the refactor.
- Acceptance: unchanged prototype geometry and behavior, bounded memory, faster title readiness, validator coverage.

## Chunk 3 — Outer Veil pack, Levels 1–10

- Build the complete first realm as ten individually authored levels.
- Give each permanent ability a named unlock, safe lesson, combination test, and mastery payoff.
- Vary level climaxes instead of repeating the same tutorial-puzzle-arena pattern.
- Use finite authored encounters, readable objectives, and visible world restoration.
- Acceptance: deterministic completion replays, target completion times, difficulty curve review, touch and keyboard QA.

## Chunk 4 — Core production systems

- Add animation timing and anchors, hit-stop, hit-stun, telegraphs, finite encounters, and responsive audio layers.
- Add gamepad and remapping support plus reduced-motion, reduced-flash, and scalable-text options.
- Build reusable system families for water, sand, mirrors, foundry machinery, veil states, and gravity.
- Simulate large spectacle with authored states rather than unbounded physics.
- Acceptance: stable frame time, accessibility checks, encounter readability, no control surprises.

## Chunks 5–13 — Realm packs 2–10

Each chunk ships one ten-level realm through the same gate: authored mechanics, dedicated art/audio identity, narrative continuity, a varied climax, deterministic completion, performance validation, and lead review. Production does not advance merely because placeholder levels exist.

## Chunk 14 — Campaign integration and release candidate

- Verify all 100 levels, progression, save migration, endings, credits, and recovery paths.
- Run full keyboard, touch, and gamepad campaigns plus performance and accessibility passes.
- Review public-release packaging separately; deployment requires explicit approval.

## Narrative and design corrections adopted during review

- Track player choices through play so the ending is earned, not a final menu prompt.
- Rebuild Levels 91–100 around one mastery recap, one Hollow Sun systems boss, and one definitive Serath finale.
- Keep Mira and Captain Ysra present through recurring encounters before their major turns.
- Never remove controls or contradict established rules without explicit, fair telegraphing.
- Make every defeated realm guardian restore a visible Crown Path and transform the kingdom.
