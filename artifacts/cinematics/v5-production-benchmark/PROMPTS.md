# ImageGen Prompt Record

Mode: built-in OpenAI ImageGen. No web search, stock library, external download,
or third-party generation service was used. This record normalizes the submitted
production prompts while preserving their creative and technical constraints.

## Environment plates (new generation, no reference image)

### `orun-skyline-master.png`

> Cinematic widescreen environment plate of Orun before the Eclipse: immense
> Afro-futurist stone capital carved across bridges and cliffs, restrained
> ancient-machinery details, a monumental circular Crown aperture in the distant
> citadel, warm impossible sunrise, layered atmospheric depth, grounded premium
> dark-fantasy realism, indigo/obsidian/brass palette with sacred gold light.
> Empty foreground staging area, no hero, no readable text, no logo, no border,
> 16:9 composition.

### `engine-chamber-master.png`

> Cinematic widescreen empty Crown Engine chamber in Orun: vast subterranean
> black-stone cathedral, concentric brass memory rings and radial mechanisms,
> reflective floor, monumental depth, restrained amber practical light, premium
> grounded dark-fantasy production design. Clear foreground performance space,
> no people, no readable text, no logo, no border, 16:9 composition.

### `outer-veil-master.png`

> Cinematic widescreen Outer Veil ruin: buried circular Crown Path inside a
> colossal eroded cavern, broken arches, drifting dust, narrow shaft of impossible
> dawn, scorched stone and deep indigo shadow, premium grounded dark-fantasy
> realism. Empty foreground staging area, no characters, no readable text, no
> logo, no border, 16:9 composition.

## Character performance layers (reference-guided generation)

All character prompts required a full isolated silhouette, preserved costume
language and ethnicity from the approved concept, realistic anatomy, clean edge
separation, no text, no border, and no additional character.

### Aren Vale

Reference: `artifacts/character-design/v5-core-cast-concepts/sheets/01-aren-existing-reference.png`

- `aren-awakening-source.png`: Aren kneeling low after impact, one hand on the
  ground and the other braced on his broken oath-blade, hooded face obscured,
  exhausted but alert, three-quarter cinematic pose.
- `aren-standing-source.png`: Aren standing and turning toward a distant call,
  broken oath-blade lowered, cloak hanging with a readable trailing edge, wary
  grounded posture, three-quarter cinematic pose.

### Regent Serath

Reference: `artifacts/character-design/v5-core-cast-concepts/sheets/04-serath-concept.png`

- `serath-command.png`: Serath in a restrained open-hand command gesture as he
  operates the Crown Engine, controlled expression, complete costume silhouette.
- `serath-fist-source.png`: matching Serath closing the working hand into a
  decisive fist, same camera side, costume, proportions and lighting family.

### Mira Sol

Reference: `artifacts/character-design/v5-core-cast-concepts/sheets/03-mira-concept.png`

- `mira-lamp.png`: Mira standing with the Last Lamp raised, other hand open in a
  calm warning gesture, warm practical glow, complete costume silhouette.

### Unnamed heir silhouette

Reference: `artifacts/character-design/v5-core-cast-concepts/sheets/02-liora-concept.png`

- `unnamed-heir-source.png`: backlit adult woman in a cartographer/royal field
  silhouette, face entirely unreadable, one hand reaching toward the map plane,
  no identifying facial detail and no on-screen name.

## Post-generation treatment

`scripts/prepare_layers.py` removes only edge-connected neutral checker pixels
from four source images that arrived without true alpha. It does not rescale,
repaint, or synthesize content. Native source dimensions are retained.
