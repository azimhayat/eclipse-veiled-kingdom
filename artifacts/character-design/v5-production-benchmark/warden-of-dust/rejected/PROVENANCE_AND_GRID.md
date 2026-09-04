# Warden of Dust 4x2 candidate - rejected evidence

Status: **REJECTED - DO NOT INSTALL OR SHIP**

The candidate preserves the accepted Warden identity and provides a useful action-layout reference, but it fails the required true-transparency gate. It is retained only so a separate reviewer can attempt a final built-in background-extraction pass.

## Provenance

- Generated: 2026-09-04 with the built-in OpenAI image-generation workflow; no CLI/API fallback.
- Use case: `stylized-concept`.
- Visual reference: `artifacts/character-design/v5-core-cast-concepts/sheets/06-warden-of-dust-concept.png`.
- Reference role: locked identity, silhouette, palette, scale and material reference; not an edit target.
- Exact generator cache source: `C:\Users\azimh\.codex\generated_images\01a06964-ad2d-71f1-9cff-6410e8ae4922\exec-8c40002c-89ee-4b8d-bd69-73ac01de9c48.png`.
- Candidate SHA-256: `952709D9B3893584027E4509DE4F48C3D3A37705121F8427B1F2A3FE60B13F2E`.
- Reference SHA-256: `8CA21C157977A55536A09DB2E1225FACF70F6CE1E71FB499A170167F6316EB67`.
- Dimensions: 1536 x 1024 pixels.
- File format inspection: PNG decoded as `Format24bppRgb`; sampled empty pixels are alpha 255. The visible checkerboard is baked RGB, not transparency.

## Regular cell map

Grid: 4 columns x 2 rows. Cell size: 384 x 512 pixels. Coordinates use an inclusive zero-based range.

| Cell | Pixel bounds | Intended pose |
|---|---|---|
| R1C1 | x 0-383, y 0-511 | Idle |
| R1C2 | x 384-767, y 0-511 | Guarded stance |
| R1C3 | x 768-1151, y 0-511 | Attack windup |
| R1C4 | x 1152-1535, y 0-511 | Attack active/contact |
| R2C1 | x 0-383, y 512-1023 | Recovery/punish window |
| R2C2 | x 384-767, y 512-1023 | Hit reaction |
| R2C3 | x 768-1151, y 512-1023 | Eclipse phase power pose |
| R2C4 | x 1152-1535, y 512-1023 | Nonlethal Dawnstroke/restoration finale |

## Inspection result

- Pass: all eight intended beats are present, readable and contained in their assigned cells.
- Pass: one consistent stone/bronze guardian identity, cyan-gold heart and vermilion bridle language.
- Pass: no text, watermark, weapon, gore, death or extra character.
- Limitation: frames R2C3 and R2C4 are three-quarter/front-biased rather than strict side profile.
- Limitation: active-frame dust approaches the right cell edge and needs a final bleed/padding check after extraction.
- Fail: background is opaque and cannot enter `public/assets` in this state.

## Selected-candidate prompt record

The selected candidate was generated as a strict 4x2, right-facing, equal-scale side-scrolling boss sheet. The prompt locked the concept's monumental sandstone-and-aged-bronze civic body, column legs, helmet and architectural crown cage, cyan-gold heart, and vermilion bridle; requested the eight poses in the cell order above; required a protective unchanged restoration state; prohibited weapons, death, redesign, frame bleed, labels and scenery; and explicitly required alpha-zero empty pixels with no simulated checkerboard.
