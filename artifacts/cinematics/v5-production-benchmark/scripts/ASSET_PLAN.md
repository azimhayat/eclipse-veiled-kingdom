# V5 Benchmark Layer Plan

Every shot is composed on a native 1920x1080 canvas. Raster layers may be
cropped or reduced, never enlarged. Reusable procedural layers are generated at
master resolution by the local compositor.

## Required source layers

- `orun-skyline-master.png`: wide Orun environment plate without characters.
- `engine-chamber-master.png`: Crown Engine interior without foreground cast.
- `outer-veil-master.png`: buried cavern and path without Aren.
- `aren-awakening.png`: transparent Aren kneeling with broken oath-blade.
- `aren-standing.png`: transparent Aren standing/turning toward the Lamp.
- `serath-command.png`: transparent Serath in a restrained command gesture.
- `mira-lamp.png`: transparent Mira holding the Last Lamp.
- `unnamed-heir.png`: transparent backlit adult woman, face fully unreadable.

## Procedural independent layers

- architecture silhouettes at foreground, midground, and background depths;
- rotating Crown Engine rings and travelling memory-route particles;
- citizen silhouettes with independent breathing/gesture offsets;
- smoke, fog, falling dust, sparks, sand sheets, light shafts, and lens bloom;
- cloth and shadow masks with limited secondary motion;
- map-table routes and split-circle Cartographer geometry;
- title typography and eclipse-ring assembly.

## Motion rule

Each non-title shot must contain at least one semantic subject action and two
independently timed environmental actions in addition to camera motion. A shot
manifest records these actions so the rule can be inspected rather than
inferred from the final encode.
