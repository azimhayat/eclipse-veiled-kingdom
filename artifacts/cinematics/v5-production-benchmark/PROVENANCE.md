# V5 Cinematic Benchmark Provenance

Generated on 2026-09-04 for the `v5-production-benchmark` branch.

## Story and character authority

- Narrative authority: `docs/STORY_ONE_LOCK.md`, especially the locked opening
  prologue and Chapter I introduction.
- Character references: the approved sheets in
  `artifacts/character-design/v5-core-cast-concepts/sheets/`.
- The second woman in the prologue remains an unnamed, unreadable silhouette.
  The cinematic does not reveal or label her identity.
- No voice acting was generated or introduced. Narrative copy is supplied only
  as optional English WebVTT subtitles.

## Visual provenance

- Three environments and six character performance sources were generated with
  built-in OpenAI ImageGen from the prompt record in `PROMPTS.md`.
- No stock images, internet downloads, franchise assets, or third-party model
  outputs are present.
- Environment masters are 1672x941 and are placed at 1:1 pixel scale on a native
  1920x1080 canvas. The narrow uncovered edge field is generated procedurally;
  source plates are never enlarged.
- Character sources are 941-1086 pixels wide and 1449-1672 pixels tall. They are
  composited at native size or reduced. They are never enlarged.
- Four checker-backed character sources were converted to alpha by
  `scripts/prepare_layers.py`; the original source files are retained beside the
  processed layers.

## Motion provenance

`scripts/render_cinematics.py` is the deterministic compositor. It generates
independently timed character translation, limited breathing/cloth offsets,
performance-pose transitions, multi-depth camera parallax, Crown Engine ring
rotation, travelling route/memory light, cloud/fog drift, dust, sparks, falling
debris, moving dawn shafts, map-path ignition, lamp flame, eclipse assembly and
shot transitions at native 1920x1080 and 30 fps.

The compositor does not use whole-frame zoompan as a substantive shot. Each
non-title shot has a semantic subject action plus at least two independently
timed environmental actions, as locked in `scripts/PRODUCTION_LOCK.md`.

## Audio provenance

`scripts/generate_audio.py` creates every sample locally at 48 kHz stereo using
deterministic oscillators, filtered procedural noise and synthesized impact or
shimmer events. Seeds are `2026090401` (opening) and `2026090402` (Chapter I).

Each film retains separate `music`, `ambience`, `effects` and `master` WAV files.
No samples, songs, licensed recordings, voice models, or downloaded sound effects
are used. The MP4 mux applies a web-cinematic loudness pass and a fixed -1.4 dB
post-normalization trim verified after AAC encoding.

## Encoding

- Video: H.264 High profile, yuv420p, progressive, BT.709, 1920x1080, 30 fps.
- Audio: AAC-LC, 48 kHz stereo, nominal 256 kb/s.
- Container: MP4 with `moov` before `mdat` for browser progressive playback.
- Working renders and source stems remain in this artifact tree. Runtime copies
  are placed only in `public/assets/cinematics/` under the fixed media contract.
