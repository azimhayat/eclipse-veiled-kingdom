# Eclipse of the Veiled Kingdom

A multi-edition HTML5 Canvas action-adventure wrapped in React. V4 combines twenty playable levels across two chapters—the Outer Veil and Inner Kingdom—while preserving the earlier ten-level releases. The game uses a fixed 60 Hz simulation, three collision substeps, pre-baked world chunks, synthesized Web Audio, responsive touch controls, checkpoints, combat, destructible sand, moving blocks, pressure gates, crumble and crystal platforms, currents, moving lifts, crushers, veil bridges, mirror beams, guardians, versioned progress, and personal Top 10 records.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite. For a production bundle:

```bash
npm run build
```

The current local V4 campaign opens at `http://127.0.0.1:4173/eclipse-veiled-kingdom/?campaign=v4`. The preserved V3 campaign remains available locally with `?campaign=outer-veil`.

## Play online

Four editions are published together so the earlier games remain playable:

- V1 — original release: https://azimhayat.github.io/eclipse-veiled-kingdom/
- V2 — expanded Stage I release: https://azimhayat.github.io/eclipse-veiled-kingdom/v2/
- V3 — current playtested Stage I release: https://azimhayat.github.io/eclipse-veiled-kingdom/v3/
- V4 — twenty-level review build: https://azimhayat.github.io/eclipse-veiled-kingdom/v4/

V1, V2, and V3 remain available at their existing URLs. V4 is the review build for the final playtest; the planned V5 will be the first formal release after the agreed final changes.

## V4 leaderboard

V4 always keeps a personal Top 10 on the device. A Supabase-backed Global Hall is implemented behind an explicit configuration boundary and remains disabled by default. See `docs/V4_LEADERBOARD_SETUP.md` for the reviewed security model and activation steps. Never expose a Supabase secret or service-role key in the browser build.

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
