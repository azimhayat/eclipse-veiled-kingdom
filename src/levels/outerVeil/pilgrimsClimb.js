import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, put } from '../prototypes/shared.js';

const collapseLedge = (id, tx, ty) => ({
  id,
  x: tx * TILE,
  y: ty * TILE,
  w: 2 * TILE,
  h: 12,
  tx,
  ty,
  widthTiles: 2,
  state: 'stable',
  timer: 0,
  triggeredAt: null,
});

export function createPilgrimsClimb() {
  const map = baseKingdom();

  // Safe lesson: the two-row entrance and full ground floor make a missed
  // grip cost only height. Alternating wall ends prevent one infinite climb.
  fill(map, 12, 18, 1, 6, Tile.STONE);
  fill(map, 16, 20, 1, 6, Tile.STONE);
  fill(map, 13, 22, 2, 1, Tile.ONEWAY);
  fill(map, 13, 19, 12, 1, Tile.ONEWAY);

  // Controlled alternating shaft. Permanent catch ledges are deliberately
  // two tiles wide, and the four-tile interior remains touch-friendly.
  fill(map, 25, 8, 1, 10, Tile.STONE);
  fill(map, 30, 11, 1, 8, Tile.STONE);
  fill(map, 24, 19, 6, 1, Tile.ONEWAY);
  fill(map, 26, 17, 2, 1, Tile.ONEWAY);
  fill(map, 28, 14, 2, 1, Tile.ONEWAY);
  fill(map, 26, 11, 2, 1, Tile.ONEWAY);
  fill(map, 28, 9, 14, 1, Tile.ONEWAY);

  // Memory Carve is used once from a safe upper perch. The sand plug is not
  // load-bearing; opening it cannot remove the catch beneath Aren.
  fill(map, 40, 3, 1, 6, Tile.STONE);
  fill(map, 44, 3, 1, 3, Tile.STONE);
  put(map, 44, 6, Tile.SAND);
  fill(map, 44, 7, 1, 2, Tile.STONE);
  fill(map, 41, 7, 3, 1, Tile.ONEWAY);
  fill(map, 45, 7, 6, 1, Tile.ONEWAY);

  // The broken exterior spiral descends to a broad mastery base. Any miss in
  // the final shaft lands on row 15 or the permanent row-17 recovery balcony.
  fill(map, 49, 8, 5, 1, Tile.ONEWAY);
  fill(map, 53, 10, 5, 1, Tile.ONEWAY);
  fill(map, 57, 12, 5, 1, Tile.ONEWAY);
  fill(map, 61, 14, 8, 1, Tile.ONEWAY);
  fill(map, 62, 15, 11, 1, Tile.ONEWAY);
  fill(map, 45, 17, 24, 1, Tile.ONEWAY);

  // The mastery walls never collapse. Only the four optional overlay ledges
  // fall, so even their all-gone state retains a complete wall-jump route.
  fill(map, 68, 2, 1, 11, Tile.STONE);
  fill(map, 73, 5, 1, 10, Tile.STONE);
  fill(map, 73, 4, 10, 1, Tile.ONEWAY);
  fill(map, 83, 4, 6, 1, Tile.ONEWAY);
  fill(map, 82, 1, 1, 3, Tile.GATE);

  const collapseSections = [
    collapseLedge('lower-breath', 69, 13),
    collapseLedge('second-breath', 71, 10),
    collapseLedge('third-breath', 69, 7),
    collapseLedge('last-breath', 71, 4),
  ];

  return {
    id: 6,
    name: "Pilgrim's Climb",
    subtitle: 'The Bell Without a Voice',
    storyLine: 'The Crown broke the pilgrim stair, then called every fall a failure of faith.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'Jump into stone · hold toward it to grip · W or touch UP climbs · hold JUMP to spring away.',
    theme: { top: '#121c31', bottom: '#17121d', haze: '#946c53', accent: '#83d8e8' },
    map,
    spawn: { x: 5 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [],
    relics: [],
    block: { x: 6 * TILE, y: 26 * TILE - 40, w: 40, h: 40, disabled: true },
    plate: { x: 7 * TILE, y: 26 * TILE - 10, w: TILE, h: 10, disabled: true },
    gateColumn: 82,
    door: { x: 85 * TILE, y: TILE, w: 96, h: 160 },
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
      key: 'pilgrims-grip',
      name: "Pilgrim's Grip",
      input: 'Jump into a wall and hold toward it to grip; W or touch UP climbs, and held JUMP springs away.',
      description: 'A deliberate wall hold and kick that turns the tower’s broken edges into a path.',
    },
    objective: {
      type: 'bell-tower-restoration',
      hudLabel: 'ASCENT',
      title: 'Wake the pilgrim bell',
      requiresAbility: 'memory-carve',
      phase: 'learn',
      gripSeconds: 0,
      wallJumps: [],
      lessonComplete: false,
      alternatingComplete: false,
      masteryReached: false,
      lesson: {
        wallSide: 1,
        minGripSeconds: .45,
        jumpRecorded: false,
        landing: { minTx: 13, maxTx: 24, feetTy: 19 },
      },
      alternating: {
        requiredJumpSides: [1, -1],
        landing: { minTx: 28, maxTx: 41, feetTy: 9 },
        retryHintShown: false,
      },
      memoryBrace: {
        id: 'silenced-bell-rope',
        tx: 44,
        ty: 6,
        role: 'wall-cling-carve',
        revealed: false,
        safeLanding: { minTx: 41, maxTx: 50, feetTy: 7 },
        revealText: 'The cut rope remembers the pilgrim vow: leave at DAWN, cross beneath the VEIL, return to SHELTER.',
      },
      collapse: {
        warningSeconds: 1.1,
        goneSeconds: 3.4,
        sections: collapseSections,
      },
      masteryExit: { minCenterTx: 73, maxFeetTy: 4 },
      bell: {
        id: 'pilgrims-bell',
        label: "The Pilgrims' Bell",
        tx: 78,
        baseTy: 4,
        strikeRadius: 1.35 * TILE,
        awakened: false,
        restored: false,
        ringStartedAt: null,
        puzzle: {
          clue: 'Leave at dawn · cross beneath the veil · return to shelter',
          sequence: ['dawn', 'veil', 'shelter'],
          progress: [],
          mistakes: 0,
          chimes: [
            { id: 'veil', label: 'Veil', tx: 74.5, baseTy: 4, struck: false },
            { id: 'shelter', label: 'Shelter', tx: 78, baseTy: 4, struck: false },
            { id: 'dawn', label: 'Dawn', tx: 81, baseTy: 4, struck: false },
          ],
        },
      },
      lightWindows: [
        { id: 'lower-light', tx: 65, ty: 13, lit: false },
        { id: 'middle-light', tx: 66, ty: 9, lit: false },
        { id: 'upper-light', tx: 66, ty: 5, lit: false },
      ],
      phaseHints: {
        learn: "PILGRIM'S GRIP · jump into the right wall · hold RIGHT + UP to climb · release UP and hold JUMP",
        alternate: 'CHANGE WALLS · the stone ends on purpose; spring right, then left',
        carve: 'FREE THE BELL ROPE · climb the short chimney and Memory Carve its only sand brace',
        collapse: 'OUTCLIMB THE FALL · gold cracks warn each optional rest before it drops',
        ring: 'REMEMBER THE JOURNEY · the carved vow moves from departure, through eclipse, to refuge — position is a false guide',
        complete: 'THE BELL ANSWERS · cross the opened chamber while its light holds',
      },
      completionHint: 'THE TOWER FINDS ITS VOICE · the pilgrim bell calls travelers to shelter again.',
      complete: false,
      restored: false,
      completedAt: null,
    },
    gameplay: {
      openingHint: "PILGRIM'S GRIP AWAKENED · jump into stone · hold toward + UP to climb · release UP and hold JUMP",
      assumedAbilities: ['memory-carve'],
      enemyRoster: [],
      cameraHorizontalLead: 0,
      tutorialCues: [
        { minX: 10, maxX: 24, text: 'SAFE LESSON · jump into wall; hold toward + UP; release UP and hold JUMP' },
        { minX: 24, maxX: 41, text: 'CONTROLLED TEST · alternate walls; every permanent ledge catches a miss' },
        { minX: 39, maxX: 51, text: 'COMBINATION · climb to the lone sand brace, then press DIG from the safe perch' },
        { minX: 61, maxX: 82, text: 'MASTERY · optional rests crack for 1.1 seconds; the tower walls never fall' },
      ],
      deterministicRoute: [
        'lesson-right-wall',
        'controlled-right-wall',
        'controlled-left-wall',
        'silenced-bell-rope',
        'lower-breath',
        'second-breath',
        'third-breath',
        'last-breath',
        'dawn',
        'veil',
        'shelter',
        'eclipse-door',
      ],
    },
  };
}
