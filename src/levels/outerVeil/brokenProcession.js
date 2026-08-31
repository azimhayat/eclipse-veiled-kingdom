import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill } from '../prototypes/shared.js';

const station = ({ id, label, role, tx, baseTy, pose, rotation, observeZone, text, requiresMemoryMark = false }) => ({
  id,
  label,
  role,
  tx,
  baseTy,
  pose,
  rotation,
  observeZone,
  text,
  requiresMemoryMark,
  observed: false,
});

function loweredRecovery(map, startX, endX) {
  fill(map, startX, 26, endX - startX + 1, 1, Tile.AIR);
  fill(map, startX, 27, endX - startX + 1, 1, Tile.STONE);
}

export function createBrokenProcession() {
  const map = baseKingdom();

  // Five calm traversal tableaux share a one-tile-deep recovery lane.
  loweredRecovery(map, 12, 23);
  fill(map, 12, 24, 4, 1, Tile.ONEWAY);
  fill(map, 17, 22, 4, 1, Tile.ONEWAY);
  fill(map, 22, 24, 2, 1, Tile.ONEWAY);

  loweredRecovery(map, 25, 36);
  fill(map, 25, 24, 3, 1, Tile.ONEWAY);
  fill(map, 29, 21, 4, 1, Tile.ONEWAY);
  fill(map, 34, 23, 3, 1, Tile.ONEWAY);

  loweredRecovery(map, 39, 53);
  fill(map, 39, 24, 4, 1, Tile.ONEWAY);
  fill(map, 44, 23, 3, 1, Tile.ONEWAY);
  fill(map, 49, 21, 4, 1, Tile.ONEWAY);
  fill(map, 51, 24, 3, 1, Tile.ONEWAY);
  // The seal is a body-height wall beside the high witness platform so the
  // existing horizontal Memory Carve action can read it.
  fill(map, 48, 20, 1, 1, Tile.SAND);

  loweredRecovery(map, 55, 68);
  fill(map, 55, 24, 4, 1, Tile.ONEWAY);
  fill(map, 60, 22, 4, 1, Tile.ONEWAY);
  fill(map, 65, 20, 3, 1, Tile.ONEWAY);
  fill(map, 67, 23, 2, 1, Tile.ONEWAY);

  loweredRecovery(map, 70, 82);
  fill(map, 70, 24, 3, 1, Tile.ONEWAY);
  fill(map, 74, 22, 4, 1, Tile.ONEWAY);
  fill(map, 79, 20, 3, 1, Tile.ONEWAY);
  fill(map, 81, 23, 2, 1, Tile.ONEWAY);

  fill(map, 84, 17, 1, 9, Tile.GATE);

  return {
    id: 3,
    name: 'The Broken Procession',
    subtitle: 'The Coup in Stone',
    storyLine: 'The statues fell in sequence. Their hands still accuse the living.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'Follow five fallen poses from west to east; together they preserve the coup the crown erased.',
    theme: { top: '#17223a', bottom: '#15101b', haze: '#b87942', accent: '#f1c96b' },
    map,
    spawn: { x: 5 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: 37 * TILE, spawnX: 37 * TILE, spawnY: 26 * TILE - 44, label: 'Processional rest' },
      { x: 69 * TILE, spawnX: 69 * TILE, spawnY: 26 * TILE - 44, label: 'Archive rest' },
    ],
    relics: [],
    block: { x: 3 * TILE, y: 26 * TILE - 40, w: 40, h: 40, disabled: true },
    plate: { x: 4 * TILE, y: 26 * TILE - 10, w: TILE, h: 10, disabled: true },
    gateColumn: 84,
    door: { x: 86 * TILE, y: 22 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    arenaStart: 90,
    targetTime: { parSeconds: 210, masterySeconds: 135 },
    objective: {
      type: 'procession-restoration',
      hudLabel: 'COUP',
      title: 'Follow the five fallen poses',
      requiresAbility: 'memory-carve',
      complete: false,
      restored: false,
      stations: [
        station({
          id: 'oath-bearer',
          label: 'I · Oath',
          role: 'safe-read',
          tx: 17.4,
          baseTy: 24.9,
          pose: 'kneel',
          rotation: -.38,
          observeZone: { minTx: 21.6, maxTx: 23.4, feetTy: 24 },
          text: 'MIRA · The king faces sunrise, but his own guard faces him.',
        }),
        station({
          id: 'warning-messenger',
          label: 'II · Warning',
          role: 'traversal-read',
          tx: 30.8,
          baseTy: 23.8,
          pose: 'warning',
          rotation: .33,
          observeZone: { minTx: 34.2, maxTx: 36.8, feetTy: 23 },
          text: 'AREN · The watch points toward the throne, not the walls.',
        }),
        station({
          id: 'hidden-blade',
          label: 'III · Betrayal',
          role: 'betrayal-reveal',
          tx: 46.6,
          baseTy: 23.7,
          pose: 'blade',
          rotation: -.56,
          observeZone: { minTx: 49.4, maxTx: 52.8, feetTy: 21 },
          requiresMemoryMark: true,
          text: 'MIRA · The archive calls this a defense.  AREN · Defenders face outward. Every blade here faces the crown.',
        }),
        station({
          id: 'inverted-crown',
          label: 'IV · Seizure',
          role: 'reversal-read',
          tx: 62.4,
          baseTy: 24.4,
          pose: 'crown',
          rotation: .4,
          observeZone: { minTx: 67, maxTx: 68.8, feetTy: 23 },
          text: 'MIRA · Serath stands over the heir with the crown inverted.',
        }),
        station({
          id: 'erased-record',
          label: 'V · Erasure',
          role: 'erasure-payoff',
          tx: 77.2,
          baseTy: 24.5,
          pose: 'erase',
          rotation: -.28,
          observeZone: { minTx: 81, maxTx: 82.8, feetTy: 23 },
          text: 'AREN · The scribes are cutting our names away while the guard watches the archive.',
        }),
      ],
      memoryMark: {
        id: 'buried-betrayal-blade',
        role: 'memory-carve-combination',
        tx: 48,
        ty: 20,
        revealed: false,
        revealText: 'The sand releases the hidden blade. The defenders were facing the crown.',
      },
      finalMonument: {
        id: 'truth-monument',
        label: 'The True Procession',
        tx: 85.3,
        baseTy: 26,
        pose: 'map',
        rotation: -1.36,
      },
      restorationTiles: Array.from({ length: 6 }, (_, index) => ({
        tx: 83 + index,
        ty: 26,
        tile: Tile.GLOW,
      })),
      completionHint: 'TRUTH RESTORED · the final witness stands in its original pose.',
    },
    gameplay: {
      openingHint: 'FOLLOW THE FALLEN POSES · the procession reads west to east',
      assumedAbilities: ['memory-carve'],
      enemyRoster: [],
      tutorialCues: [
        { minX: 8, maxX: 24, text: 'WITNESS I · cross the statue’s sightline to read its pose' },
        { minX: 28, maxX: 37, text: 'WITNESS II · the watch points inward, not toward an enemy' },
        { minX: 43, maxX: 53, text: 'WITNESS III · jump, face the cyan seal, and press K / SHIFT' },
        { minX: 74, maxX: 83, text: 'FINAL WITNESS · follow the last fallen pose to the gate' },
      ],
      deterministicRoute: [
        'oath-bearer',
        'warning-messenger',
        'buried-betrayal-blade',
        'hidden-blade',
        'inverted-crown',
        'erased-record',
        'eclipse-door',
      ],
    },
  };
}
