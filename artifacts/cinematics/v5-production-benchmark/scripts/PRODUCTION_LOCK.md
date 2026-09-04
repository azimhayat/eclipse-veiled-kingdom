# V5 Production Benchmark — Script and Shot Lock

Status: locked for the local benchmark render on 2026-09-04. The authority is
`docs/STORY_ONE_LOCK.md`. This lock may be revised only if a review finding
shows a narrative contradiction or a hard reject condition.

## Delivery format

- Opening prologue: 72 seconds.
- Chapter I introduction: 40 seconds.
- Master canvas: native 1920x1080, constant 30 fps.
- Final video: H.264 High, yuv420p, AAC-LC stereo at 48 kHz, fast-start.
- Dialogue treatment: subtitle-led; no generated or unapproved voice acting.
- Captions: external English WebVTT, default on in the future runtime player.
- Audio: original local procedural music, ambience, Foley, and effects only.

## Visual continuity lock

- Premium dark-fantasy stylised realism with painterly materials.
- Aren keeps the sand-gold hood/mantle, dark field layers, cyan compass, and
  broken oath-blade. He remains vulnerable and human-scale.
- Serath remains human and controlled, with a narrow black-navy silhouette,
  hollow architectural ring, and restrained vermilion command lines.
- Liora is an active unnamed silhouette in the prologue. Her face, name,
  living-light identity, and fragmentation are not revealed.
- Mira is an older living archivist seen through the Last Lamp. Her amber light
  is distinct from cyan unstable memory.
- Warm gold means memory and restoration; cyan means unstable or forgotten
  memory; vermilion means imposed authority; navy/charcoal means Eclipse.
- No modern objects, franchise references, logos, watermarks, or generated
  lettering. Exact titles are rendered by the deterministic compositor.

## Opening prologue — 72 seconds

| Shot | Time | Picture and required independent motion | Subtitle |
|---|---:|---|---|
| OP-01 | 00:00–00:07 | Darkness opens onto Orun. Three architectural depth planes drift independently; clouds cross the skyline; hundreds of small memory lights rise toward the distant Engine. | Before the Eclipse, Orun taught light to remember. |
| OP-02 | 00:07–00:15 | The Crown Engine turns in nested counter-rotating rings. Individual gold memory streams travel from moving citizen silhouettes into separate archive paths. | Within the Crown Engine: every name. Every oath. Every life. |
| OP-03 | 00:15–00:23 | Serath approaches the Engine. His cloak and hollow ring move independently; a controlled hand gesture gathers thin vermilion command lines. | Regent Serath promised mercy from pain. |
| OP-04 | 00:23–00:31 | Serath closes his hand. Gold streams reverse, the central aperture contracts, and the artificial black sun forms while cyan fragments recoil. | Then he turned memory into a throne. |
| OP-05 | 00:31–00:40 | At a fractured map table, Aren and an unnamed heir work as equals. Their hands move on different paths; the map lines split and run outward while falling dust crosses the frame. | In the final hour, two hands redrew the road. |
| OP-06 | 00:40–00:49 | Names lift from civic monuments as distinct light forms. Bridges shear, banners pull in the inversion wind, and the memory current accelerates toward the black sun. | The sun was not extinguished. It was taken. |
| OP-07 | 00:49–00:57 | Orun falls beneath sand and shadow. Foreground masonry drops, the city recedes, and the remaining gold lamps fail one by one. | And a kingdom forgot that it had ever been free. |
| OP-08 | 00:57–01:06 | Aren awakens below the Outer Veil. His shoulders breathe, fingers close on the broken sword, cloth moves, dust falls, and an impossible shaft of sunrise advances across the floor. | Beneath the Veil, one cartographer remembered a sunrise. |
| OP-09 | 01:06–01:12 | A black eclipse ring resolves from moving dust and living-gold fragments; the title emerges cleanly from the compositor and the final light continues to orbit. | — |

## Chapter I introduction — 40 seconds

| Shot | Time | Picture and required independent motion | Subtitle |
|---|---:|---|---|
| C1-01 | 00:00–00:06 | The Last Lamp wakes in a buried sanctum. Amber flame, smoke, hanging chains, dust, and the camera move on separate paths. Mira gradually coheres inside the flame. | Aren Vale. The kingdom kept one light for you. |
| C1-02 | 00:06–00:13 | Mira raises the archival lamp while Aren turns toward her call. Her image ripples with flame without changing identity; Aren's mantle and compass respond to the light. | Not to make you whole. To show you where you broke. |
| C1-03 | 00:13–00:20 | Close view of the broken oath-blade. Aren's hand tightens, granular cyan dust crosses the fracture, and warm recovered light travels along only the surviving edge. | Your blade remembers what you chose to forget. |
| C1-04 | 00:20–00:27 | An impossible sunrise memory crosses the dark cavern. Arches reveal sequentially, dust turns gold, and Aren shields his eyes as the light moves past him. | You saw the sun rise over a kingdom history denies. |
| C1-05 | 00:27–00:34 | The first buried Crown Path uncovers. Sand pours between route stones, separate gold lines ignite in sequence, and the Last Lamp projects a split-circle Cartographer mark. | Follow the first buried Crown Path. |
| C1-06 | 00:34–00:40 | Aren rises and takes the first deliberate step toward the path. Mira recedes into the Lamp, the compass aligns, and the final composition matches the Level 1 opening direction. | Remember before the Eclipse remembers you. |

## Hard reject gate

The benchmark fails rather than ships if any of the following is true:

1. A substantive shot is only a pan, zoom, crop, fade, or particle overlay on a
   flattened still. Title cards are the only static exception.
2. Aren, Mira, Serath, or the unnamed heir visibly changes face, proportions,
   costume, equipment, or apparent age between shots.
3. The unnamed heir's identity or face is revealed.
4. Faces, hands, weapons, cloth, or architecture morph or flicker.
5. A source layer is enlarged beyond its native raster dimensions.
6. Captions exceed two lines, obscure essential action, or are available only
   as burned-in pixels.
7. Audio clips, overlaps game music, lacks synchronized effects, or misses the
   web target by more than one LU without an explained exception.
8. The MP4 is not 1920x1080 CFR 30 fps H.264/yuv420p with AAC 48 kHz stereo and
   fast-start metadata.
9. Sampled frames read as a slideshow rather than a scene with subject and
   environmental motion.
