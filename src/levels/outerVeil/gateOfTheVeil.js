import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, put } from '../prototypes/shared.js';

const stage = (id, label, rosterIds) => ({
  id,
  label,
  rosterIds,
  active: false,
  complete: false,
  startedAt: null,
  completedAt: null,
});

const keeper = ({
  id,
  label,
  stageId,
  spawnTx,
  feetTy,
  minTx,
  maxTx,
  delay,
  hp,
  telegraphSeconds,
  recoverySeconds,
}) => ({
  id,
  label,
  stageId,
  kind: 'shield',
  spawnTx,
  feetTy,
  minTx,
  maxTx,
  delay,
  hp,
  telegraphSeconds,
  recoverySeconds,
  status: 'queued',
  spawnedAt: null,
  defeatedAt: null,
});

export function createGateOfTheVeil() {
  const map = baseKingdom();

  // The buried seal, its counterweight, and the full gate share one unbroken
  // recovery floor. Every failed attempt costs position rather than a life.
  put(map, 22, 25, Tile.SAND);
  fill(map, 45, 12, 1, 14, Tile.GATE);

  // The gate's western face is the only Grip route to the lintel. Stone at
  // the wall crown remains valid support inside the broad one-way walkway.
  fill(map, 29, 20, 16, 1, Tile.ONEWAY);
  fill(map, 46, 20, 7, 1, Tile.ONEWAY);
  fill(map, 38, 20, 1, 6, Tile.STONE);

  const counterweightZone = {
    id: 'first-seal-counterweight-seat',
    label: 'The Inward Counterweight',
    x: 29 * TILE,
    y: 26 * TILE - 10,
    w: 2 * TILE,
    h: 10,
  };

  const roster = [
    keeper({
      id: 'keeper-of-the-first-seal',
      label: 'Keeper of the First Seal',
      stageId: 'crown-watch',
      spawnTx: 34,
      feetTy: 20,
      minTx: 29,
      maxTx: 45,
      delay: .9,
      hp: 3,
      telegraphSeconds: 1.08,
      recoverySeconds: 1.12,
    }),
  ];

  return {
    id: 9,
    name: 'Gate of the Veil',
    subtitle: 'The Seal We Chose',
    storyLine: 'The final gate remembers its maker—and Aren’s mark lies on the side meant to face Orun.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'RESTORE THE INWARD LOCK · carve its record, bind its counterweight, climb its face, then turn its sunstone.',
    theme: { top: '#11182d', bottom: '#1b1118', haze: '#9b684a', accent: '#f2ce72' },
    map,
    spawn: { x: 6 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [],
    relics: [],
    block: {
      id: 'veil-counterweight',
      x: 24 * TILE + 4,
      y: 26 * TILE - 40,
      w: 40,
      h: 40,
      bound: false,
      oathLift: 16,
    },
    plate: { x: 29 * TILE, y: 26 * TILE - 10, w: 2 * TILE, h: 10, disabled: true },
    gateColumn: 45,
    door: { x: 49 * TILE, y: 16 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    targetTime: { parSeconds: 240, masterySeconds: 150 },
    objective: {
      type: 'veil-gate-restoration',
      hudLabel: 'VEIL GATE',
      title: 'Open the lock built inward',
      requiresAbilities: ['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke'],
      phase: 'carve',
      memoryMark: {
        id: 'buried-inward-seal',
        role: 'gate-memory',
        tx: 22,
        ty: 25,
        revealed: false,
        revealText: 'AREN VALE · Crown Cartographer · witness to the inward seal.',
      },
      counterweight: {
        id: 'inward-counterweight',
        blockId: 'veil-counterweight',
        zone: counterweightZone,
        seatSnapPadding: TILE * .25,
        bound: false,
        locked: false,
      },
      upperLatch: {
        id: 'first-seal-upper-latch',
        requiredWallSide: 1,
        gripJumpRecorded: false,
        reached: false,
        retryHintShown: false,
        landing: { minTx: 29, maxTx: 45, feetTy: 20 },
      },
      encounter: {
        clock: 0,
        spawnedCount: 0,
        defeatedCount: 0,
        maxActive: 1,
        stages: [
          stage('crown-watch', 'The Keeper at the Inward Lock', ['keeper-of-the-first-seal']),
        ],
        roster,
      },
      cartographersTurn: {
        id: 'cartographers-turn',
        label: "The Cartographer's Turn",
        restored: false,
      },
      gateRestored: false,
      relayBanners: [
        { id: 'west-relay-banner', label: 'The Veilward Relay', tx: 31.5, baseTy: 20, restored: false },
        { id: 'east-relay-banner', label: 'The Orunward Relay', tx: 48.5, baseTy: 20, restored: false },
      ],
      sunstone: {
        id: 'first-seal-sunstone',
        label: 'Sunstone of the First Seal',
        tx: 43,
        baseTy: 20,
        strikeRadius: 2.5 * TILE,
        exposed: false,
        struck: false,
      },
      restorationTiles: Array.from({ length: 18 }, (_, index) => ({
        tx: 29 + index,
        ty: 20,
        tile: Tile.GLOW,
      })),
      phaseHints: {
        carve: 'MEMORY CARVE · free the cyan maker’s seal buried beside the gate road',
        counterweight: 'OATHBIND · seat the rune block in the inward counterweight and bind it fast',
        ascent: "PILGRIM'S GRIP · climb the western gate face and take the high latch",
        relay: 'CROWN WATCH · answer the lone keeper’s amber tell during blue recovery',
        keystone: 'DAWNSTROKE · strike the exposed sunstone and turn the lock toward Orun',
        complete: 'THE FIRST SEAL OPENS · cross beneath the restored cartographer’s light',
      },
      completionHint: 'THE CARTOGRAPHER’S TURN · the lock opens toward Orun, and something beyond remembers the light.',
      complete: false,
      restored: false,
      completedAt: null,
    },
    gameplay: {
      openingHint: 'THE LOCK WAS BUILT INWARD · begin with the buried cyan seal',
      assumedAbilities: ['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke'],
      enemyRoster: ['shield'],
      cameraHorizontalLead: 0,
      tutorialCues: [
        { minX: 17, maxX: 24, text: 'MEMORY CARVE · face the buried maker’s seal and press DIG' },
        { minX: 23, maxX: 32, text: 'COUNTERWEIGHT · push the rune block into the cyan seat, then Oathbind it' },
        { minX: 31, maxX: 40, text: "ASCENT · use Pilgrim's Grip on the gate’s western face" },
        { minX: 29, maxX: 45, text: 'CROWN WATCH · one keeper, one readable amber tell, one blue answer' },
        { minX: 40, maxX: 49, text: 'KEYSTONE · the defeated watch exposes the sunstone; STRIKE once to turn it' },
      ],
      deterministicRoute: [
        'buried-inward-seal',
        'veil-counterweight',
        'first-seal-upper-latch',
        'keeper-of-the-first-seal',
        'west-relay-banner',
        'east-relay-banner',
        'first-seal-sunstone',
        'cartographers-turn',
        'eclipse-door',
      ],
    },
  };
}
