import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill } from '../prototypes/shared.js';

const returnField = (id, label, x, y, w, h, role = 'fall') => ({
  id, label, role, x, y, w, h,
});

export function createFirstSanctum() {
  const map = baseKingdom();

  // The exit is deliberately behind Aren. Restoring the sanctum turns the
  // whole chapter into one outward-and-returning pilgrimage instead of a
  // conventional left-to-right collectible route.
  fill(map, 4, 21, 1, 5, Tile.GATE);

  // Three visible mist wells sit beneath permanent, generous footholds. The
  // mist is a level-local return field, never a damaging tile or death pit.
  fill(map, 31, 26, 5, 2, Tile.AIR);
  fill(map, 31, 24, 2, 1, Tile.ONEWAY);
  fill(map, 34, 23, 2, 1, Tile.ONEWAY);

  // A single low sanctuary arch combines the newly bound return light with
  // Pilgrim's Grip. The upper landing cannot be reached by an ordinary jump;
  // a recorded spring opens a two-tile passage at its base.
  fill(map, 43, 19, 1, 7, Tile.STONE);
  fill(map, 38, 21, 5, 1, Tile.ONEWAY);

  fill(map, 50, 26, 7, 2, Tile.AIR);
  fill(map, 50, 24, 4, 1, Tile.ONEWAY);
  fill(map, 55, 24, 2, 1, Tile.ONEWAY);

  fill(map, 61, 26, 6, 2, Tile.AIR);
  fill(map, 61, 23, 3, 1, Tile.ONEWAY);
  fill(map, 65, 24, 2, 1, Tile.ONEWAY);

  // The witness is one story destination, not an item. A vertical return
  // veil beyond it sends Aren back to the one lamp and proves its promise.
  fill(map, 69, 23, 6, 1, Tile.ONEWAY);
  fill(map, 80, 20, 1, 6, Tile.STONE);

  const lamp = {
    id: 'miras-first-lamp',
    label: "Mira's First Lamp",
    tx: 24,
    baseTy: 26,
    interactRadius: 2.35 * TILE,
    bound: false,
    boundAt: null,
    checkpoint: {
      id: 'first-sanctum-return',
      x: 21 * TILE + 10,
      y: 26 * TILE - 44,
      facing: 1,
    },
  };

  const returnFields = [
    returnField('first-mist-well', 'The Near Forgetting', 31 * TILE, 26 * TILE + 8, 5 * TILE, 2 * TILE - 8),
    returnField('middle-mist-well', 'The Hollow Nave', 50 * TILE, 26 * TILE + 8, 7 * TILE, 2 * TILE - 8),
    returnField('last-mist-well', 'The Far Forgetting', 61 * TILE, 26 * TILE + 8, 6 * TILE, 2 * TILE - 8),
    returnField('witness-return-veil', 'The Returning Veil', 76 * TILE, 19 * TILE, 4 * TILE, 7 * TILE, 'return'),
  ];

  return {
    id: 7,
    name: 'The First Sanctum',
    subtitle: 'A Light Kept in Secret',
    storyLine: 'Mira kept one flame burning for a cartographer whose name the Crown had already erased.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'SANCTUM RECALL · press DIG beside the lamp to bind it; cyan mist returns you without ending this life.',
    theme: { top: '#111a31', bottom: '#17101d', haze: '#866b72', accent: '#8ce9e7' },
    map,
    spawn: { x: 6 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [],
    relics: [],
    block: { x: 7 * TILE, y: 26 * TILE - 40, w: 40, h: 40, disabled: true },
    plate: { x: 8 * TILE, y: 26 * TILE - 10, w: TILE, h: 10, disabled: true },
    gateColumn: 4,
    door: { x: 2 * TILE, y: 22 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    arenaStart: 90,
    targetTime: { parSeconds: 180, masterySeconds: 105 },
    abilityUnlock: {
      key: 'sanctum-recall',
      name: 'Sanctum Recall',
      input: 'Press DIG beside a sanctuary lamp; its light returns Aren from visible forgetting mist.',
      description: 'Bind one safe place to living memory so a failed crossing becomes a return, not an erasure.',
    },
    objective: {
      type: 'sanctum-lamp-restoration',
      hudLabel: 'SANCTUM',
      title: "Restore Mira's first lamp",
      requiresAbility: 'oathbind',
      phase: 'find',
      lamp,
      arch: {
        id: 'pilgrim-light-arch',
        requiredWallSide: 1,
        gripJumpRecorded: false,
        open: false,
        landing: { minTx: 38, maxTx: 43, feetTy: 21 },
        openCells: [
          { tx: 43, ty: 24, tile: Tile.AIR },
          { tx: 43, ty: 25, tile: Tile.AIR },
        ],
      },
      witness: {
        id: 'cartographers-witness',
        label: "The Cartographer's Witness",
        tx: 72,
        baseTy: 23,
        zone: { minTx: 69, maxTx: 75, feetTy: 23 },
        reached: false,
        reachedAt: null,
      },
      returnFields,
      returnCount: 0,
      lastReturnId: null,
      returnProven: false,
      returnProvenAt: null,
      canopy: {
        id: 'first-sanctum-canopy',
        label: 'The Kept Constellation',
        x: 6 * TILE,
        y: 15 * TILE,
        w: 21 * TILE,
        h: 9 * TILE,
        restored: false,
      },
      lightColumns: [
        { id: 'western-vow', tx: 9, ty: 20, lit: false },
        { id: 'miras-window', tx: 16, ty: 18, lit: false },
        { id: 'returning-star', tx: 24, ty: 17, lit: false },
      ],
      finalZone: { minTx: 6, maxTx: 11, feetTy: 26 },
      phaseHints: {
        find: 'FIND THE LAST LAMP · press DIG beside its cold cyan flame',
        outward: 'TRUST THE RETURN · reach the far witness; cyan mist recalls you to Mira',
        return: 'THE WITNESS IS KNOWN · step into the tall cyan veil to carry it home',
        sanctum: 'THE LAMP REMEMBERS · follow its gold canopy west to the sealed entrance',
        complete: 'THE FIRST SANCTUM ENDURES · enter the opened western door',
      },
      completionHint: 'THE SANCTUM REMEMBERS AREN · Mira kept this light in his name before he woke.',
      complete: false,
      restored: false,
      completedAt: null,
    },
    gameplay: {
      openingHint: 'SANCTUM RECALL · seek Mira’s cold lamp and bind it with DIG',
      assumedAbilities: ['memory-carve', 'oathbind', 'pilgrims-grip'],
      enemyRoster: [],
      tutorialCues: [
        { minX: 16, maxX: 29, text: 'SAFE LESSON · DIG beside the lamp; its light becomes your return' },
        { minX: 30, maxX: 37, text: 'VISIBLE FAILURE · cyan mist returns you safely; the stone islands remain' },
        { minX: 37, maxX: 46, text: "COMBINATION · use Pilgrim's Grip to spring onto the lamp-lit arch" },
        { minX: 67, maxX: 80, text: 'MASTERY · witness the hidden map, then carry it home through the tall veil' },
      ],
      deterministicRoute: [
        'miras-first-lamp',
        'first-mist-well',
        'pilgrim-light-arch',
        'middle-mist-well',
        'last-mist-well',
        'cartographers-witness',
        'witness-return-veil',
        'first-sanctum-canopy',
        'eclipse-door',
      ],
    },
  };
}
