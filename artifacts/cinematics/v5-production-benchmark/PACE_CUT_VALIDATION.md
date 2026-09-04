# V5 cinematic pace-cut validation

Validated on 2026-09-04. The version 2 media is a story-preserving editorial
recut of the reviewed version 1 masters. Picture, original procedural score,
ambience, effects and exact subtitle words are retimed together; no external
media was added.

| Film | V1 | V2 | H.264 / AAC contract | Integrated loudness | True peak |
| --- | ---: | ---: | --- | ---: | ---: |
| Opening prologue | 72 s | 34 s | 1920×1080, 30 fps, 48 kHz stereo | -15.7 LUFS | -2.0 dBFS |
| Chapter I introduction | 40 s | 20 s | 1920×1080, 30 fps, 48 kHz stereo | -15.4 LUFS | -5.1 dBFS |
| Chapter I → II bridge | 52 s | 23 s | 1920×1080, 30 fps, 48 kHz stereo | -15.7 LUFS | -2.5 dBFS |
| Chapter II → III bridge | 64 s | 29 s | 1920×1080, 30 fps, 48 kHz stereo | -16.4 LUFS | -3.5 dBFS |

Combined story-film runtime falls from 228 seconds to 106 seconds. Caption
timings are divided by the exact same pace ratio as picture and sound. The
opening retains a 3.2-second uncaptioned title resolve after its final line.

Runtime hashes:

- `opening-prologue-v2.mp4` —
  `45733C5FB729E6EB87A053D528FD2328834A54F9A3555C8381C586819A3C395D`
- `chapter-one-introduction-v2.mp4` —
  `ED1323DD2FAE65E260DDE0CAA80B6106ACF88F5DB42A1018BFB39D823374EB73`
- `chapter-one-to-two-bridge-v2.mp4` —
  `AAA8EAF9A28E652CBDF3E7E561864A947A8DA044DBEFD7E120731DBA4B8E6211`
- `chapter-two-to-three-bridge-v2.mp4` —
  `5D5434F8A0713B056B8BD48DFC11C0ADA05474FBD0FFAAF35868FEAAE61E814E`

Browser evidence:

- The opening reports 34 seconds and loads
  `opening-prologue-v2.mp4` only after the replay viewer is opened.
- Playback begins only after the Play gesture; English captions are showing.
- Skip returns cleanly through the existing one-shot sequence controller.
- Controls remain reachable at desktop 1440×900, landscape phone 844×390 and
  portrait phone 390×844.

The deterministic recut command is
`scripts/recut_cinematics.py`. Its audio finish uses high/low-pass cleanup,
small presence lifts and EBU loudness normalization with a -2 dBTP target.
