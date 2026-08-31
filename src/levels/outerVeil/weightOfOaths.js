import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, staircase } from '../prototypes/shared.js';

export function createWeightOfOaths() {
  const map = baseKingdom();

  // The archive ledge is deliberately four tiles above the civic road: Aren
  // cannot reach it until the oath block is bound into a stable platform.
  fill(map, 20, 21, 6, 1, Tile.ONEWAY);
  fill(map, 26, 20, 1, 1, Tile.SAND);

  // The gate hangs above the reversible block corridor. It remains a strong
  // visual seal without ever pinning the only puzzle block against a wall.
  fill(map, 39, 15, 1, 10, Tile.GATE);

  // A calm restored promenade carries the story payoff toward the exit.
  fill(map, 43, 24, 4, 1, Tile.ONEWAY);
  fill(map, 49, 22, 5, 1, Tile.ONEWAY);
  fill(map, 56, 24, 4, 1, Tile.ONEWAY);
  fill(map, 63, 21, 5, 1, Tile.ONEWAY);
  staircase(map);

  const lessonZone = {
    id: 'oathbind-lesson-sigil',
    label: 'The Bearer’s Sigil',
    x: 19 * TILE,
    y: 26 * TILE - 10,
    w: 2 * TILE,
    h: 10,
  };
  const finalSeal = {
    id: 'public-civic-seal',
    label: 'The Public Scale',
    x: 31 * TILE,
    y: 26 * TILE - 10,
    w: 2 * TILE,
    h: 10,
  };

  return {
    id: 4,
    name: 'The Weight of Oaths',
    subtitle: 'The Law That Bent',
    storyLine: 'A law made to protect Orun was rewritten until its citizens carried the crown.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'OATHBIND · press DIG beside the rune block to anchor or release it.',
    theme: { top: '#172238', bottom: '#151018', haze: '#aa7040', accent: '#efc96c' },
    map,
    spawn: { x: 6 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: 41 * TILE, spawnX: 41 * TILE, spawnY: 26 * TILE - 44, label: 'Civic promise' },
    ],
    relics: [],
    block: {
      x: 15 * TILE + 4,
      y: 26 * TILE - 40,
      w: 40,
      h: 40,
      bound: false,
      oathLift: 16,
    },
    plate: { ...finalSeal },
    gateColumn: 39,
    door: { x: 86 * TILE, y: 12 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    arenaStart: 90,
    targetTime: { parSeconds: 240, masterySeconds: 150 },
    abilityUnlock: {
      key: 'oathbind',
      name: 'Oathbind',
      input: 'K / SHIFT / DIG beside a rune block',
      description: 'Anchor a civic rune block in memory so it becomes an immovable foothold; bind again to release it.',
    },
    objective: {
      type: 'oathbind-restoration',
      hudLabel: 'OATHBIND',
      title: 'Restore the civic promise',
      requiresAbility: 'memory-carve',
      phase: 'learn',
      lessonComplete: false,
      lessonZone,
      memoryMark: {
        id: 'cartographer-oath-record',
        role: 'combination-test',
        tx: 26,
        ty: 20,
        revealed: false,
        revealText: 'AREN VALE · Crown Cartographer · certified the burden transfer.',
      },
      finalSeal,
      finalMonument: {
        id: 'balanced-civic-scale',
        label: 'The Civic Promise',
        tx: 36.2,
        baseTy: 26,
        rotation: -.34,
      },
      restorationTiles: Array.from({ length: 31 }, (_, index) => ({
        tx: 8 + index,
        ty: 26,
        tile: Tile.GLOW,
      })),
      complete: false,
      restored: false,
      completionHint: 'CIVIC OATH RESTORED · the burden returns to the crown, not its people.',
      phaseHints: {
        learn: 'LEARN TO BIND · push the rune block into the cyan sigil, then press DIG',
        cross: 'CROSS ON YOUR OATH · jump from the bound block to the archive ledge',
        carve: 'MEMORY CARVE · face the cyan record and press DIG',
        seal: 'RESTORE THE SEAL · release the block, push it east, then bind it on the public scale',
        complete: 'OATH RESTORED · follow the golden civic road',
      },
    },
    gameplay: {
      openingHint: 'OATHBIND AWAKENED · DIG beside the rune block anchors it in memory',
      assumedAbilities: ['memory-carve'],
      enemyRoster: [],
      tutorialCues: [
        { minX: 7, maxX: 21, text: 'Push the rune block into the cyan lesson sigil · press K / SHIFT / DIG to bind' },
        { minX: 19, maxX: 27, text: 'Bound blocks hold fast · jump from the oath to the high archive ledge' },
        { minX: 24, maxX: 28, text: 'Face the cyan record and use Memory Carve' },
        { minX: 28, maxX: 36, text: 'Release the block · push it onto the public scale · bind the oath in place' },
      ],
      deterministicRoute: [
        'oathbind-lesson-sigil',
        'cartographer-oath-record',
        'public-civic-seal',
        'eclipse-door',
      ],
    },
  };
}
