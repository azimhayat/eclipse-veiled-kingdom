# V5 Cinematic Benchmark Validation

Validation date: 2026-09-04.

## Delivery results

| Film | Duration | Frames | Video | Audio | Final bitrate |
| --- | ---: | ---: | --- | --- | ---: |
| Opening prologue | 72.00 s | 2160 | H.264 High, 1920x1080, 30 fps, yuv420p, BT.709 | AAC-LC, 48 kHz stereo, 255 kb/s | 3615 kb/s |
| Chapter I introduction | 40.00 s | 1200 | H.264 High, 1920x1080, 30 fps, yuv420p, BT.709 | AAC-LC, 48 kHz stereo, 256 kb/s | 2324 kb/s |

Both public MP4 copies completed a full video-and-audio decode with zero decoder
errors. Both have `moov` before `mdat` (`36 < 77966` opening; `36 < 44582`
Chapter I), so progressive browser playback is enabled.

## Audio measurements

Measured from the final AAC stream with FFmpeg EBU R128/true-peak analysis.

| Film | Integrated | True peak | LRA | Full-stream RMS peak | Silence >=1 s below -50 dB |
| --- | ---: | ---: | ---: | ---: | --- |
| Opening prologue | -15.98 LUFS | -2.85 dBTP | 10.90 LU | -8.14 dBFS | None detected |
| Chapter I introduction | -16.24 LUFS | -5.45 dBTP | 2.60 LU | -12.29 dBFS | None detected |

Both streams contain two differentiated channels, no NaN, infinity or denormal
samples, and remain below the -1.5 dBTP ceiling.

## Subtitle checks

`scripts/validate_delivery.py` parsed and validated cue order, start/end bounds,
line count and reading speed.

| Track | Cues | Last cue end | Maximum lines | Maximum reading speed | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `opening-prologue-v1.en.vtt` | 8 | 65.20 s | 1 | 1.60 words/s | PASS |
| `chapter-one-introduction-v1.en.vtt` | 6 | 39.70 s | 1 | 1.84 words/s | PASS |

## Visual review

- Opening: nine sampled frames, one from each shot.
- Chapter I: six sampled frames, one from each shot.
- Characters remain coherent with the approved concept family; the unnamed heir
  stays unreadable.
- Story progression and distinct composition are visible across every sampled
  beat. No sampled substantive shot is a static whole-frame zoompan.
- Motion-proof sampling at 1, 4 and 7 seconds in OP-03 separately confirms
  Serath movement, independently rotating Engine geometry, travelling memory
  lines and particles.
- Motion-proof sampling at 0.2, 3 and 6.5 seconds in C1-05 separately confirms
  that the Crown Path draws across the cavern while the ring, particles, fog and
  camera continue independently.
- Frame MD5 verification found 2160/2160 unique opening frames and 1200/1200
  unique Chapter I frames; there are zero exactly duplicated encoded frames.

A conservative whole-frame freeze heuristic reports a few 1.0-1.7 second
low-global-motion spans during sparse effects beats, plus the intentionally held
opening title card. These are not duplicated frames. The dedicated proofs show
the sparse elements continuing to move, so they do not trigger the static-slide
reject criterion.

Review artifacts:

- `review/opening-prologue-contact-sheet.png`
- `review/chapter-one-introduction-contact-sheet.png`
- `review/op-03-motion-proof.mp4`
- `review/c1-05-motion-proof.mp4`
- `review/validation-summary.json`

## Final public hashes

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `opening-prologue-v1.mp4` | 32,543,802 | `e485bd76b593970154592ce623933fb1dce3100afffa3d6b62ce26ea7deb7f4e` |
| `opening-prologue-v1.en.vtt` | 641 | `f18a6254961b47501cb495faacad59318fa34a0f3e46780292ed20416499a4a3` |
| `chapter-one-introduction-v1.mp4` | 11,624,305 | `ac5c088857d16eaa6799d38c8f7bc1b85cd51b6fc255cd729f9bd45323304253` |
| `chapter-one-introduction-v1.en.vtt` | 471 | `4d984d2e3236987d4e40b61ce98f0cd2864c384d561c9cf9d8cdb7e6b50db846` |

## V5 story bridge delivery

| Film | Duration | Frames | Video | Audio | Final bitrate |
| --- | ---: | ---: | --- | --- | ---: |
| Chapter I to II bridge | 52.00 s | 1560 | H.264 High, 1920x1080, 30 fps, yuv420p, BT.709 | AAC-LC, 48 kHz stereo, 253 kb/s | 2173 kb/s |
| Chapter II to III bridge | 64.00 s | 1920 | H.264 High, 1920x1080, 30 fps, yuv420p, BT.709 | AAC-LC, 48 kHz stereo, 254 kb/s | 2567 kb/s |

Both bridge MP4s completed a full video-and-audio decode with zero decoder
errors. Both have `moov` before `mdat` (`36 < 57834` Chapter I bridge;
`36 < 71374` Chapter II bridge), enabling progressive browser playback.

Final AAC measurements:

| Film | Integrated | True peak | LRA | Silence >=1 s below -50 dB |
| --- | ---: | ---: | ---: | --- |
| Chapter I to II bridge | -16.4 LUFS | -3.1 dBTP | 3.4 LU | None detected |
| Chapter II to III bridge | -16.9 LUFS | -3.9 dBTP | 3.8 LU | None detected |

Bridge caption checks:

| Track | Cues | Last cue end | Maximum lines | Maximum reading speed | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `chapter-one-to-two-bridge-v1.en.vtt` | 7 | 51.50 s | 1 | 1.67 words/s | PASS |
| `chapter-two-to-three-bridge-v1.en.vtt` | 8 | 63.50 s | 2 | 2.00 words/s | PASS |

Visual and motion review:

- Seven Chapter I bridge shots and eight Chapter II bridge shots were sampled
  at their midpoints and inspected in native-source contact sheets.
- The first Inner Kingdom aperture render was rejected for reading as a flat
  cyan plane. The accepted re-render adds translucent depth strata, moving
  route lines, distant towers and independently moving particles.
- `review/b10-03-motion-proof.mp4` confirms independent heir fragment assembly,
  camera drift, orbit motion and particles. `review/b20-02-motion-proof.mp4`
  confirms Liora's independently moving fragment strips, living-light layer,
  camera drift and particles.
- Frame MD5 checks found 1560/1560 unique Chapter I bridge frames and 1920/1920
  unique Chapter II bridge frames, with zero exactly duplicated encoded frames.

Bridge review artifacts:

- `review/chapter-one-to-two-bridge-contact-sheet.png`
- `review/chapter-two-to-three-bridge-contact-sheet.png`
- `review/b10-03-motion-proof.mp4`
- `review/b20-02-motion-proof.mp4`
- `review/bridge-validation-summary.json`

Bridge public hashes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `chapter-one-to-two-bridge-v1.mp4` | 14,130,139 | `2baa149ef129d35e76fe72a873772dc85c2316404d8b32c3546c1004dae81bc6` |
| `chapter-one-to-two-bridge-v1.en.vtt` | 572 | `296342f75644cf2c3fe903ec00f155b971ccfe6936f42edac7163cfe114a2f1d` |
| `chapter-two-to-three-bridge-v1.mp4` | 20,543,144 | `bc687cf936b65142817ed8756c36a26fe80bbb2eefde42ff2f0cfd9174bd5b14` |
| `chapter-two-to-three-bridge-v1.en.vtt` | 752 | `d62e35571a566625ac9231bf18801e31f3724dc4d83852108583c7980e930179` |
| `liora-memory-fragment-v1.png` | 975,202 | `a2200d8d755a0f4b00a67301fa82c3cda88d7ff5835df96df6050baa8efbb457` |

## Hard-reject assessment and limitation

All stated benchmark reject criteria pass: correct durations, native delivery
canvas, no low-resolution upscale, independent subject/environment motion,
original audio, no unapproved voice, valid subtitles, browser-safe encode, and
full-stream decode.

This is a deliberately authored 2.5D motion-graphic cinematic benchmark. It is
not full 3D skeletal acting, facial performance capture, cloth simulation, or a
claim of GTA/COD-scale studio production. A human creative director should still
perform the final subjective playback sign-off before any public release or
20-level scale-up.
