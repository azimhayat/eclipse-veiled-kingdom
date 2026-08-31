import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill } from '../prototypes/shared.js';

const stage = (id, label, triggerTx, rosterIds) => ({
  id,
  label,
  triggerTx,
  rosterIds,
  active: false,
  complete: false,
  startedAt: null,
  completedAt: null,
});

const raider = ({
  id, label, stageId, kind, dropTx, shipId, delay = 0, hp = 1,
  telegraphSeconds = .72, recoverySeconds = .78, requiresGripStrike = false,
}) => ({
  id,
  label,
  stageId,
  kind,
  dropTx,
  shipId,
  delay,
  hp,
  telegraphSeconds,
  recoverySeconds,
  requiresGripStrike,
  status: 'queued',
  spawnedAt: null,
  defeatedAt: null,
  gripStrikeLanded: false,
});

export function createParachuteChoir() {
  const map = baseKingdom();

  // The first lesson remains deliberately flat and retreatable. The raid then
  // travels east across one uninterrupted recovery road.

  // The single combination pillar turns Pilgrim's Grip into the safe setup
  // for Dawnstroke: spring west, land broadly, then sever the command line.
  fill(map, 30, 24, 6, 1, Tile.ONEWAY);
  fill(map, 36, 23, 1, 3, Tile.STONE);
  fill(map, 37, 24, 7, 1, Tile.ONEWAY);

  // Broad choir terraces vary height without pits, moving platforms, or
  // damaging floor. Soldiers may descend onto them, then safely step down.
  fill(map, 48, 24, 8, 1, Tile.ONEWAY);
  fill(map, 57, 22, 8, 1, Tile.ONEWAY);
  fill(map, 67, 24, 7, 1, Tile.ONEWAY);
  fill(map, 75, 22, 8, 1, Tile.ONEWAY);

  // The exit remains physically sealed until every authored raider has been
  // disarmed. Nothing spawns forever behind this gate.
  fill(map, 84, 20, 1, 6, Tile.GATE);

  const ships = [
    { id: 'low-cantor', x: 19 * TILE, y: 6.8 * TILE, phase: .4 },
    { id: 'high-cantor', x: 48 * TILE, y: 5.4 * TILE, phase: 2.1 },
    { id: 'far-cantor', x: 76 * TILE, y: 7.2 * TILE, phase: 4.2 },
  ];

  const roster = [
    raider({
      id: 'first-voice', label: 'First Voice', stageId: 'lesson', kind: 'grunt', hp: 2,
      dropTx: 20, shipId: 'low-cantor', delay: .9, telegraphSeconds: 1.08, recoverySeconds: 1.05,
    }),
    raider({
      id: 'low-tenor', label: 'Low Tenor', stageId: 'chorus', kind: 'spear', hp: 2,
      dropTx: 51, shipId: 'low-cantor', delay: .9, telegraphSeconds: .88, recoverySeconds: .96,
    }),
    raider({
      id: 'high-answer', label: 'High Answer', stageId: 'chorus', kind: 'grunt', hp: 2,
      dropTx: 61, shipId: 'far-cantor', delay: 1.8, telegraphSeconds: .82, recoverySeconds: .9,
    }),
    raider({
      id: 'ground-bass', label: 'Ground Bass', stageId: 'finale', kind: 'shield',
      dropTx: 70, shipId: 'low-cantor', delay: .9, hp: 3, telegraphSeconds: 1, recoverySeconds: 1.05,
    }),
    raider({
      id: 'falling-cadence', label: 'Falling Cadence', stageId: 'finale', kind: 'spear', hp: 2,
      dropTx: 81, shipId: 'far-cantor', delay: 2.1, telegraphSeconds: .9, recoverySeconds: .98,
    }),
  ];

  return {
    id: 8,
    name: 'Parachute Choir',
    subtitle: 'Five Voices Against the Dawn',
    storyLine: 'The Crown taught its raiders to fall as one song. Aren remembers where that rhythm breaks.',
    backgroundKey: 'outerVeilBackground',
    mechanic: 'DAWNSTROKE · wait for the amber tell, STRIKE once, then move through the blue recovery.',
    theme: { top: '#10172c', bottom: '#21131c', haze: '#ad6c5d', accent: '#f0c868' },
    map,
    spawn: { x: 5 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [],
    relics: [],
    block: { x: 8 * TILE, y: 26 * TILE - 40, w: 40, h: 40, disabled: true },
    plate: { x: 9 * TILE, y: 26 * TILE - 10, w: TILE, h: 10, disabled: true },
    gateColumn: 84,
    door: { x: 86 * TILE, y: 22 * TILE, w: 96, h: 160 },
    ships,
    movers: [],
    water: [],
    crushers: [],
    mirrors: [],
    veilPlatforms: [],
    boss: null,
    arenaStart: 90,
    targetTime: { parSeconds: 210, masterySeconds: 135 },
    abilityUnlock: {
      key: 'dawnstroke',
      name: 'Dawnstroke',
      input: 'Press STRIKE / J / X after the amber attack tell; move or answer during blue recovery.',
      description: 'Aren turns one measured sword stroke against the Crown rhythm he once helped chart.',
    },
    objective: {
      type: 'parachute-choir-restoration',
      hudLabel: 'CHOIR',
      title: 'Break the measured descent',
      requiresAbility: 'pilgrims-grip',
      phase: 'lesson',
      encounterClock: 0,
      stages: [
        stage('lesson', 'The First Voice', 13, ['first-voice']),
        stage('chorus', 'The Moving Pair', 44, ['low-tenor', 'high-answer']),
        stage('finale', 'The Falling Cadence', 63, ['ground-bass', 'falling-cadence']),
      ],
      roster,
      defeatedCount: 0,
      spawnedCount: 0,
      skycut: {
        requiredWallSide: 1,
        gripJumpRecorded: false,
        landed: false,
        landing: { minTx: 30, maxTx: 36, feetTy: 24 },
        tether: { id: 'cantor-command-line', tx: 33, baseTy: 24, strikeRadius: 2.5 * TILE, cut: false },
        completed: false,
      },
      formations: {
        lesson: [
          { shipId: 'low-cantor', tx: 20, ty: 6.8 },
          { shipId: 'high-cantor', tx: 48, ty: 5.4 },
          { shipId: 'far-cantor', tx: 76, ty: 7.2 },
        ],
        flank: [
          { shipId: 'low-cantor', tx: 29, ty: 7.4 },
          { shipId: 'high-cantor', tx: 34, ty: 5.2 },
          { shipId: 'far-cantor', tx: 53, ty: 7.5 },
        ],
        chorus: [
          { shipId: 'low-cantor', tx: 50, ty: 7.1 },
          { shipId: 'high-cantor', tx: 57, ty: 5.5 },
          { shipId: 'far-cantor', tx: 64, ty: 7.1 },
        ],
        finale: [
          { shipId: 'low-cantor', tx: 69, ty: 7.8 },
          { shipId: 'high-cantor', tx: 76, ty: 4.9 },
          { shipId: 'far-cantor', tx: 82, ty: 7.8 },
        ],
        complete: [
          { shipId: 'low-cantor', tx: 93, ty: 3 },
          { shipId: 'high-cantor', tx: 97, ty: 1.5 },
          { shipId: 'far-cantor', tx: 101, ty: 3.4 },
        ],
      },
      windSails: roster.map((entry, index) => ({
        id: `wind-sail-${index + 1}`,
        rosterId: entry.id,
        tx: 15 + index * 10.5,
        ty: 14 - (index % 2) * 2,
        unfurled: false,
      })),
      skyRestored: false,
      phaseHints: {
        lesson: 'SAFE LESSON · let the amber tell finish, then STRIKE during blue recovery',
        flank: "SKYCUT · spring from the gold pillar with Pilgrim's Grip, then STRIKE the command tether",
        chorus: 'MOVING PAIR · cross with RIGHT + UP + JUMP, then answer each landing while travelling east',
        finale: 'FALLING CADENCE · two final voices descend once; break the formation, not your rhythm',
        complete: 'THE SKY-SAILS SING · follow the restored wind through the eastern gate',
      },
      completionHint: 'THE PARACHUTE CHOIR BREAKS · five Crown shrouds become wind-sails for the Outer Veil.',
      complete: false,
      restored: false,
      completedAt: null,
    },
    gameplay: {
      openingHint: 'DAWNSTROKE · the amber tell is danger; the blue recovery is your answer',
      assumedAbilities: ['memory-carve', 'oathbind', 'pilgrims-grip', 'sanctum-recall'],
      enemyRoster: ['grunt', 'spear', 'shield'],
      cameraHorizontalLead: 70,
      tutorialCues: [
        { minX: 10, maxX: 27, text: 'SAFE LESSON · one slow attacker, one clear amber tell, one blue recovery' },
        { minX: 27, maxX: 43, text: "COMBINATION · wall spring from the gold pillar, land high, then STRIKE the tether" },
        { minX: 43, maxX: 63, text: 'DEVELOPMENT · fight while travelling; every raider is authored and finite' },
        { minX: 63, maxX: 85, text: 'MASTERY · read the staggered descent and break its voices in your own order' },
      ],
      deterministicRoute: [
        'first-voice',
        'cantor-command-line',
        'low-tenor',
        'high-answer',
        'ground-bass',
        'falling-cadence',
        'eclipse-door',
      ],
    },
  };
}
