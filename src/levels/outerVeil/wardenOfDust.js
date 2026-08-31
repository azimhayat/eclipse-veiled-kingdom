import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, put } from '../prototypes/shared.js';

export function createWardenOfDust() {
  const map = baseKingdom();

  // The Warden begins as a silhouette behind one readable buried vow. Its
  // later hand/forearm is runtime geometry, so the authored arena starts flat
  // and remains recoverable even before the transformation.
  put(map, 22, 25, Tile.SAND);
  fill(map, 46, 20, 28, 1, Tile.ONEWAY);
  fill(map, 68, 12, 1, 8, Tile.GATE);

  const anchorZone = {
    id: 'warden-heartstone-seat',
    label: 'The Dividing Current',
    x: 37 * TILE,
    y: 26 * TILE - 10,
    w: 2.5 * TILE,
    h: 10,
  };

  return {
    id: 10,
    name: 'Warden of Dust',
    subtitle: 'The Guardian We Buried',
    storyLine: 'Beyond the inward seal, the dust rises in the shape of a guardian that still knows Aren’s name.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'FREE THE WARDEN · read its breath, restore its vow, anchor its heart, climb its hand, and break the Crown’s command.',
    theme: { top: '#0d1529', bottom: '#211313', haze: '#a46e48', accent: '#f4d276' },
    map,
    spawn: { x: 7 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [],
    relics: [],
    block: {
      id: 'warden-heartstone',
      x: 30 * TILE + 4,
      y: 26 * TILE - 40,
      w: 40,
      h: 40,
      bound: false,
      oathLift: 16,
    },
    plate: { x: anchorZone.x, y: anchorZone.y, w: anchorZone.w, h: anchorZone.h, disabled: true },
    gateColumn: 68,
    door: { x: 72 * TILE, y: 16 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    targetTime: { parSeconds: 210, masterySeconds: 135 },
    objective: {
      type: 'warden-restoration',
      hudLabel: 'WARDEN',
      title: 'Free the guardian beneath the seal',
      requiresAbilities: ['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke'],
      phase: 'listen',
      breath: {
        clock: 0,
        cycleSeconds: 4.2,
        warningSeconds: 1.35,
        activeSeconds: .38,
        firstBreathComplete: false,
        strikeCount: 0,
      },
      memorySeam: {
        id: 'warden-original-vow',
        role: 'warden-memory',
        tx: 22,
        ty: 25,
        revealed: false,
        revealText: 'WARDEN · I CARRIED THE UNRETURNED. THE CROWN SAID KEEP THEM. · MIRA · Its vow was inverted. It was built to guide them home.',
      },
      heartstone: {
        id: 'warden-heartstone-anchor',
        blockId: 'warden-heartstone',
        zone: anchorZone,
        bound: false,
        locked: false,
      },
      rememberedHand: {
        id: 'warden-remembered-hand',
        requiredWallSide: 1,
        gripJumpRecorded: false,
        reached: false,
        retryHintShown: false,
        raised: false,
        restored: false,
        rib: { tx: 55, topTy: 20, bottomTy: 24 },
        landing: { minTx: 46, maxTx: 67, feetTy: 20 },
      },
      bridle: {
        id: 'crown-inversion-bridle',
        label: 'The Crown’s Inverted Command',
        tx: 58.5,
        baseTy: 20,
        strikeRadius: 2.7 * TILE,
        exposed: false,
        struck: false,
        clock: 0,
        guardSeconds: 1.35,
        recoverySeconds: 1.2,
      },
      warden: {
        id: 'warden-of-dust',
        state: 'sleeping',
        kneeling: false,
        commandBroken: false,
        x: 60 * TILE,
        feetY: 26 * TILE,
        w: 8 * TILE,
        h: 12 * TILE,
      },
      crownPath: {
        id: 'outer-veil-crown-path',
        restored: false,
      },
      restorationTiles: Array.from({ length: 28 }, (_, index) => ({
        tx: 46 + index,
        ty: 20,
        tile: Tile.GLOW,
      })),
      phaseHints: {
        listen: 'READ THE BREATH · cyan shows where the dust will stand; the first breath is harmless',
        carve: 'MEMORY CARVE · free the original vow inside the settled flood',
        anchor: 'OATHBIND · fix the heartstone where the current divides',
        ascend: 'PILGRIM’S GRIP · climb only after the remembered hand becomes gold',
        unbind: 'DAWNSTROKE · answer the black bridle during cyan recovery',
        'first-path': 'THE WARDEN KNEELS · cross the first Crown Path',
      },
      completionHint: 'ONE PATH, NOT EVERY GRAVE · the Warden carries a narrow current home while the deeper archive remains sealed.',
      complete: false,
      restored: false,
      completedAt: null,
    },
    gameplay: {
      openingHint: 'THE DUST KNOWS YOUR NAME · follow its cyan shape; the first breath is harmless',
      assumedAbilities: ['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke'],
      enemyRoster: [],
      cameraHorizontalLead: 0,
      tutorialCues: [
        { minX: 16, maxX: 25, text: 'READ THE BREATH · wait for the harmless cyan contour, then carve the settled vow' },
        { minX: 27, maxX: 41, text: 'HEARTSTONE · jump the warned sweep, push the rune stone east, then Oathbind it in cyan' },
        { minX: 45, maxX: 57, text: 'REMEMBERED HAND · grip the raised right wall and spring onto its broad palm' },
        { minX: 54, maxX: 64, text: 'BLACK BRIDLE · wait through amber guard; STRIKE once when it turns cyan' },
      ],
      deterministicRoute: [
        'warden-first-breath',
        'warden-original-vow',
        'warden-heartstone',
        'warden-heartstone-seat',
        'warden-remembered-hand',
        'crown-inversion-bridle',
        'outer-veil-crown-path',
        'eclipse-door',
      ],
    },
  };
}
