# Shared V5 soldier sprite-sheet provenance

Status: **ACCEPTED for Level 9 and the shared combat renderer**

Date: 2026-09-04

Generation path: OpenAI built-in image generation following the local
`imagegen` skill. No CLI image model, API key, internet download, franchise
asset, or third-party media was used.

Accepted runtime assets:

- `public/assets/veil-keeper-combat-v1.png` — shield specialist — 1536 × 1024
  RGBA, SHA-256
  `AB61A9A6377D8236C504EC0F7537FA797CBE6F24FE14199C465A2FEFF9F36B30`.
- `public/assets/veil-spearman-combat-v1.png` — spear specialist — 1536 × 1024
  RGBA, SHA-256
  `977890288145EDAFAB5708D7FBAFFA158904CC4B0CCA17676DCAF6E7829FC295`.

Both sheets use the existing deterministic 4 × 2 gameplay contract:

- Row 1: descent, landing, idle/advance, attack anticipation.
- Row 2: contact attack, guard/recovery, hurt, non-gory defeat.
- One coherent right-facing full-body identity per sheet, with all equipment
  contained in its 384 × 512 cell.

Normalized final keeper prompt:

> Create one original Veil Keeper shield soldier as eight coherent full-body
> right-facing side-view runtime poses in an exact 4 × 2 grid. Preserve the
> game's dark indigo-black segmented armour, weathered bronze-gold fittings,
> restrained cyan recovery light, short curved sword and unmistakable round
> sun shield. Use a premium hand-painted realistic fantasy-game finish with
> crisp mobile-readable silhouettes. Keep each pose and all equipment inside
> its 384 × 512 cell on a genuinely transparent RGBA background. Include
> descent, landing, idle/advance, anticipation, contact attack, shield guard,
> hurt reaction and non-gory defeat. No firearms, text, logos, watermark,
> scenery, floor shadow, grid lines, identity changes or protected-IP
> imitation.

Normalized final spearman prompt:

> Create one original Veil Spearman as eight coherent full-body right-facing
> side-view runtime poses in an exact 4 × 2 grid. Preserve the game's dark
> indigo-black segmented armour, weathered bronze-gold fittings, restrained
> cyan recovery light, long spear and compact folded descent rig. Use a premium
> hand-painted realistic fantasy-game finish with crisp mobile-readable
> silhouettes. Keep each pose and all equipment inside its 384 × 512 cell on a
> genuinely transparent RGBA background. Include descent, landing,
> idle/advance, anticipation, contact thrust, guarded recovery, hurt reaction
> and non-gory defeat. No firearms, text, logos, watermark, scenery, floor
> shadow, grid lines, identity changes or protected-IP imitation.

Inspection result:

- Both accepted files report RGBA with alpha extrema 0–254 and 255 distinct
  alpha values; transparent gaps are real alpha, not a baked checkerboard.
- Visual inspection confirms readable equipment silhouettes, stable identity,
  correct pose order and no cell bleed.
- Three attempted dedicated archer sheets were rejected because they retained
  a baked background. They were not copied into the project. The shared raider
  identity is used for archers with a deterministic canvas-drawn bow overlay.
