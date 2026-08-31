import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill } from '../prototypes/shared.js';

const teethBank = (id, role, startTx, endTx, baseTy, offsetSeconds, damaging = true) => ({
  id,
  role,
  startTx,
  endTx,
  baseTy,
  offsetSeconds,
  damaging,
  bound: false,
  restored: false,
});

function recoveryLane(map, startTx, endTx, baseTy = 27) {
  fill(map, startTx, baseTy - 1, endTx - startTx + 1, 1, Tile.AIR);
  fill(map, startTx, baseTy, endTx - startTx + 1, 1, Tile.STONE);
}

export function createTeethBeneathDust() {
  const map = baseKingdom();

  // The first jaw can be watched from safety before Aren ever enters it.
  recoveryLane(map, 15, 18);

  // Two alternating controlled jumps, each with an unmistakable safe island.
  recoveryLane(map, 25, 28);
  recoveryLane(map, 32, 35);

  // One fixed Oathbind shelter. The block is never transported or counted.
  recoveryLane(map, 42, 51);
  fill(map, 51, 24, 6, 1, Tile.ONEWAY);

  // A west-to-east mastery breath with high, safe waiting perches.
  recoveryLane(map, 58, 78);
  fill(map, 57, 24, 3, 1, Tile.ONEWAY);
  fill(map, 60, 25, 3, 1, Tile.STONE);
  fill(map, 63, 22, 3, 1, Tile.ONEWAY);
  fill(map, 66, 23, 3, 1, Tile.STONE);
  fill(map, 69, 24, 3, 1, Tile.ONEWAY);
  fill(map, 72, 25, 3, 1, Tile.STONE);
  fill(map, 75, 21, 4, 1, Tile.ONEWAY);

  fill(map, 82, 17, 1, 9, Tile.GATE);

  const hazards = [
    teethBank('lesson-jaw', 'safe-lesson', 15, 18, 27, 0, false),
    teethBank('controlled-west', 'controlled-test', 25, 28, 27, 0),
    teethBank('controlled-east', 'controlled-test', 32, 35, 27, 2),
    teethBank('shelter-entry', 'combination-entry', 42, 45, 27, .4),
    teethBank('shelter-exit', 'oathbind-target', 48, 51, 27, 2.4),
    teethBank('mastery-west', 'mastery-wave', 60, 62, 25, 1.6),
    teethBank('mastery-heart', 'mastery-wave', 66, 68, 23, .8),
    teethBank('mastery-east', 'mastery-wave', 72, 74, 25, 0),
  ];

  return {
    id: 5,
    name: 'Teeth Beneath Dust',
    subtitle: 'The Petitioners’ Road',
    storyLine: 'The buried defenses faced inward. Every tooth was aimed at the people asking the crown to listen.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'Read the two dust pulses, then jump after the teeth fall.',
    theme: { top: '#1b2335', bottom: '#170f16', haze: '#bd6840', accent: '#f2bf62' },
    map,
    spawn: { x: 5 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [],
    relics: [],
    block: {
      x: 47 * TILE + 4,
      y: 27 * TILE - 40,
      w: 40,
      h: 40,
      bound: false,
      oathLift: 16,
      translationLocked: true,
    },
    plate: { x: 47 * TILE, y: 27 * TILE - 10, w: TILE, h: 10, disabled: true },
    gateColumn: 82,
    door: { x: 86 * TILE, y: 22 * TILE, w: 96, h: 160 },
    ships: [],
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    arenaStart: 90,
    targetTime: { parSeconds: 210, masterySeconds: 125 },
    objective: {
      type: 'timed-teeth-restoration',
      hudLabel: 'DUSTSTEP',
      title: 'Cross the buried jaw',
      requiresAbility: 'oathbind',
      phase: 'observe',
      hazardClock: 0,
      clockStarted: false,
      activationTx: 10,
      lessonComplete: false,
      controlledComplete: false,
      masteryComplete: false,
      timing: {
        safeSeconds: 2,
        warningSeconds: .8,
        activeSeconds: .7,
        recoverySeconds: .5,
      },
      hazards,
      thresholds: {
        lessonClearTx: 19,
        controlledClearTx: 39,
        masteryLanding: { minTx: 75, maxTx: 78, feetTy: 21 },
      },
      oathShelter: {
        id: 'petitioners-shelter',
        label: 'The Answering Stone',
        targetHazardId: 'shelter-exit',
        boundOnce: false,
      },
      finalMonument: {
        id: 'opened-petitioners-jaw',
        label: 'The Warning Road',
        tx: 80.2,
        baseTy: 26,
      },
      restorationTiles: Array.from({ length: 6 }, (_, index) => ({
        tx: 83 + index,
        ty: 26,
        tile: Tile.GLOW,
      })),
      complete: false,
      restored: false,
      completionHint: 'WARNING PATH RESTORED · the teeth remember mercy, not punishment.',
      phaseHints: {
        observe: 'READ THE RHYTHM · dust pulses twice before the buried teeth rise',
        controlled: 'CROSS THE TEETH · jump after each bank falls, and wait on solid islands',
        bind: 'OATHBIND SHELTER · cross the first jaw, then press DIG beside the answering stone',
        mastery: 'FOLLOW THE BREATH · climb the bound shelter and move with the west-to-east warning wave',
        complete: 'WARNING PATH RESTORED · follow the silent golden ribs',
      },
    },
    gameplay: {
      openingHint: 'DUSTSTEP · two amber pulses warn every bite · jump after the teeth fall',
      assumedAbilities: ['oathbind'],
      enemyRoster: [],
      tutorialCues: [
        { minX: 9, maxX: 19, text: 'SAFE LESSON · watch two complete dust pulses before crossing' },
        { minX: 24, maxX: 39, text: 'CONTROLLED TEST · one bank, one safe island, one repeated rhythm' },
        { minX: 40, maxX: 53, text: 'COMBINATION · Oathbind the fixed shelter, then launch from its raised top' },
        { minX: 57, maxX: 79, text: 'MASTERY · follow the warning wave west to east; every perch is safe' },
      ],
      deterministicRoute: [
        'lesson-jaw',
        'controlled-west',
        'controlled-east',
        'petitioners-shelter',
        'mastery-west',
        'mastery-heart',
        'mastery-east',
        'eclipse-door',
      ],
    },
  };
}
