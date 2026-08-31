import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, spikePit } from '../prototypes/shared.js';

const memoryMark = (id, label, role, tx, ty, revealText) => ({
  id, label, role, tx, ty, revealText, revealed: false,
});

export function createSandThatRemembers() {
  const map = baseKingdom();

  // Safe lesson: a floor-level carve with no hazard or timing pressure.
  fill(map, 14, 21, 1, 5, Tile.SAND);
  fill(map, 10, 26, 4, 1, Tile.GLOW);

  // Combination test: jump to the terrace, then carve at chest height.
  fill(map, 25, 24, 8, 1, Tile.ONEWAY);
  fill(map, 33, 20, 1, 6, Tile.SAND);
  fill(map, 36, 23, 7, 3, Tile.STONE);
  spikePit(map, 45, 2);

  // Story reveal and mastery: read the elevation, jump, and carve in motion.
  fill(map, 49, 22, 6, 4, Tile.STONE);
  fill(map, 54, 22, 5, 1, Tile.ONEWAY);
  fill(map, 59, 18, 1, 8, Tile.SAND);
  fill(map, 60, 22, 7, 1, Tile.ONEWAY);
  fill(map, 67, 24, 5, 2, Tile.STONE);

  // The gate seals an unlit memorial road. Completing the map restores it.
  fill(map, 72, 17, 1, 9, Tile.GATE);

  return {
    id: 2,
    name: 'Sand That Remembers',
    subtitle: 'Memory Carve',
    storyLine: 'Beneath the dunes, Aren finds the mark of the mapmaker he used to be.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'Carve the three glowing memory-lines hidden inside living sand.',
    theme: { top: '#18243a', bottom: '#171018', haze: '#c88945', accent: '#ffd276' },
    map,
    spawn: { x: 5 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: 21 * TILE, spawnX: 21 * TILE, spawnY: 26 * TILE - 44, label: 'First remembered line' },
      { x: 48 * TILE, spawnX: 48 * TILE, spawnY: 26 * TILE - 44, label: 'Cartographer terrace' },
    ],
    relics: [],
    block: { x: 3 * TILE, y: 26 * TILE - 40, w: 40, h: 40, disabled: true },
    plate: { x: 4 * TILE, y: 26 * TILE - 10, w: TILE, h: 10, disabled: true },
    gateColumn: 72,
    door: { x: 85 * TILE, y: 22 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    arenaStart: 90,
    targetTime: { parSeconds: 180, masterySeconds: 120 },
    abilityUnlock: {
      key: 'memory-carve',
      name: 'Memory Carve',
      input: 'K / SHIFT',
      description: 'Aren can cut remembered paths through living sand.',
    },
    objective: {
      type: 'memory-carve',
      hudLabel: 'MAP',
      title: 'Reveal Aren’s buried cartographer mark',
      complete: false,
      marks: [
        memoryMark('first-line', 'First Line', 'safe-lesson', 14, 25, 'A road returns: the first line was drawn by your hand.'),
        memoryMark('broken-arc', 'Broken Arc', 'combination-test', 33, 23, 'The curve remembers a city that history erased.'),
        memoryMark('maker-seal', 'Maker’s Seal', 'mastery-payoff', 59, 21, 'AREN VALE · CROWN CARTOGRAPHER. The buried signature is yours.'),
      ],
      restorationTiles: Array.from({ length: 10 }, (_, index) => ({
        tx: 74 + index,
        ty: 26,
        tile: Tile.GLOW,
      })),
      completionHint: 'MEMORY RESTORED · the Cartographer Road rises again.',
    },
    gameplay: {
      openingHint: 'MEMORY CARVE AWAKENED · face glowing sand and press K / SHIFT',
      enemyRoster: [],
      tutorialCues: [
        { minX: 8, maxX: 16, text: 'SAFE LESSON · face the glowing line and press K / SHIFT' },
        { minX: 24, maxX: 35, text: 'COMBINATION · jump to the terrace, then carve at chest height' },
        { minX: 53, maxX: 61, text: 'MASTERY · carry your jump into the high memory-line' },
      ],
      deterministicRoute: ['first-line', 'broken-arc', 'maker-seal', 'eclipse-door'],
    },
  };
}
