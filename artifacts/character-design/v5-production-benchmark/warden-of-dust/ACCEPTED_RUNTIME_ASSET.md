# Warden of Dust accepted runtime sprite

Status: **ACCEPTED after root review and a final built-in background-extraction pass**

Date: 2026-09-04

Runtime asset: `public/assets/warden-of-dust-combat-v1.png`

- 1536 × 1024, 32-bit ARGB PNG
- Grid: 4 columns × 2 rows; each cell 384 × 512 pixels
- SHA-256: `A78E6DA3DF171E9CA8F490FBA2B4431E505DB1B8FB231AA15D72885DFA2725DE`
- Size: 2,454,435 bytes

Cell order remains the authored order documented in
`rejected/PROVENANCE_AND_GRID.md`: idle, guard, windup, contact, recovery,
hit, Eclipse phase, Dawnstroke restoration.

The root reviewer used the built-in OpenAI ImageGen edit path for one targeted
background-extraction pass over the retained candidate. The prompt required all
eight poses, identity, layout, armour, bindings, heart light, sand effects and
spacing to remain unchanged while replacing only the baked checkerboard with
genuine transparent alpha. Inspection reports `Format32bppArgb`; the top-left
corner and centre gap both have alpha 0. Visual inspection confirms the eight
poses and effects remain contained within their cells. The more frontal Eclipse
and restoration beats are intentional phase/finale hero poses; locomotion and
contact poses retain a readable side silhouette.

No CLI, API key, third-party service, local matte-removal script, internet
download, stock asset or protected franchise identity was used. The rejected
opaque source remains preserved separately as production evidence.
