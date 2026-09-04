# Level 8 Veil Raider sprite-sheet provenance

Status: **ACCEPTED after a final built-in background-extraction pass**

Date: 2026-09-04

Generation path: OpenAI built-in image generation, following the local `imagegen` skill. No CLI, API key, external service, or post-processing tool was used.

Accepted runtime asset:

- `public/assets/veil-raider-combat-v1.png`
- 1536 × 1024, 32-bit ARGB PNG
- SHA-256 `40D6F287D2A8A8DCF862F3FAE302645F71468038E4731C111165332C00905B9E`
- 2,052,189 bytes

Reference images:

- `artifacts/character-design/v5-core-cast-concepts/sheets/09-veil-paratrooper-concept.png` — character identity, dark segmented armor, bronze fittings, melee blade, and mechanical glider reference.
- `public/assets/character-prop-atlas.png` — project palette, rendering detail, silhouette, and material reference.

Requested runtime contract:

- Canvas: 1536 × 1024 RGBA PNG.
- Grid: 4 columns × 2 rows; each cell 384 × 512 pixels.
- Row 1: descent; landing; idle/advance; anticipation.
- Row 2: contact attack; guard/recovery; hit; defeat.
- One coherent right-facing full-body identity, true transparent background, no firearms, text, logos, scenery, or cell bleed.

Normalized generation prompt:

> Create one original Veil Raider paratrooper as eight coherent full-body right-facing side-view runtime poses in an exact 4 × 2 grid. Preserve the reference identity: dark indigo-black segmented armor, weathered bronze fittings, restrained cyan command glow, compact mechanical folded glider rig, and one short curved melee blade. Use a high-end hand-painted realistic fantasy-game finish with crisp mobile-readable silhouettes. Keep every pose and all equipment inside its 384 × 512 cell on a genuinely transparent RGBA background. Include descent, landing, idle/advance, anticipation, contact attack, guarded recovery, hit reaction, and non-gory defeat. No firearms, text, logos, watermark, scenery, floor shadow, grid lines, identity changes, protected-IP imitation, or opaque/checkerboard background.

Rejected candidates retained only in the built-in generator cache:

1. `exec-24c186d2-46db-44c5-bb19-f1e892163afe.png` — SHA-256 `4037348D52714EAD1FCE2FBF3A2982CCA53EA0C7120072D93F91892B0FF75A37`; 1,855,494 bytes.
2. `exec-9fdd89cf-00de-45e6-8057-62b96814cb01.png` — SHA-256 `00D62CA873629E2FA6115CAE3C9E50653FFA3E4350ECAE27F84FD8168B280794`; 1,948,548 bytes.
3. `exec-1041231c-ebfc-4611-98d2-c746df80575d.png` — SHA-256 `106FF53E94C41D659001C136A8F47E10536FEF9E8CCF5532BDB1C299968CE110`; 1,965,790 bytes.

Inspection result:

- All three candidates are 1536 × 1024 and visually contain the intended eight-pose grid.
- Identity, melee-only equipment, pose readability, and cell containment are broadly acceptable.
- All three fail the hard transparency gate: Windows bitmap inspection reports `Format24bppRgb`; sampled background alpha is 255 at both the corner and sheet centre. The visible checkerboard is baked color, not transparency.
- No candidate was copied into `public/assets`, because doing so would misrepresent an opaque image as a runtime-ready transparent sprite sheet.

Acceptance gate:

The root reviewer loaded candidate 1 through the built-in edit path and requested
background extraction only. The accepted result reports `Format32bppArgb`; both
the top-left corner and the centre gap have alpha 0. Visual inspection confirms
that all eight poses, their ordering, identity, silhouette, melee equipment and
cell containment remain intact. The original cached candidate was not modified.
No CLI, API key, local matte-removal script, external service, or downloaded
asset was used.
