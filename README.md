# Eclipse of the Veiled Kingdom

A complete ten-level HTML5 Canvas action-adventure wrapped in React. The game uses a fixed 60 Hz simulation, three collision substeps, pre-baked world chunks, synthesized Web Audio, responsive touch controls, checkpoints, combat, destructible sand, moving blocks, pressure gates, crumble and crystal platforms, currents, moving lifts, crushers, veil bridges, mirror beams, a final guardian, and a local best-time record.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite. For a production bundle:

```bash
npm run build
```

## Play online

All three editions are published together so the earlier games remain playable:

- V1 — original release: https://azimhayat.github.io/eclipse-veiled-kingdom/
- V2 — expanded Stage I release: https://azimhayat.github.io/eclipse-veiled-kingdom/v2/
- V3 — current playtested Stage I release: https://azimhayat.github.io/eclipse-veiled-kingdom/v3/

The Pages workflow builds the preserved V1 commit at the root URL, the frozen `v2` branch at `/v2/`, and the current `v3` branch at `/v3/`. Ongoing development is maintained on `v3` so V1 and V2 remain independently playable.

## Controls

- Move: A / D or Left / Right
- Jump: Space; hold for height
- Wall climb: W or Up plus the direction of the wall
- Drop through: S or Down
- Strike: J or X
- Dig: K or Shift
- Pause: Escape or P

Touch controls appear automatically on compact or touch-first screens.

## Generated artwork

The original production assets live in `public/assets`: a title still, a wide kingdom panorama, a character/prop atlas, and the painted hero sheet. Runtime gameplay combines them with deterministic Canvas-drawn effects, ships, relics, traps, and designed slab tiles so collisions remain exact and every world mutation can be restamped into one chunk cell.
