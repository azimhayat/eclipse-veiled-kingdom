import { describe, expect, it, vi } from 'vitest';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
  PRODUCTION_PREVIEW_KEYS,
} from '../../campaign/productionPreview.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine, PHYSICS } from '../../engine.js';
import { createLevels } from '../../levels.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile } from '../constants.js';
import { createPilgrimsClimb } from './pilgrimsClimb.js';

const identity = {
  levelKey: 'outer-veil-06-pilgrims-climb',
  campaignOrder: 6,
  legacyId: 6,
};

function canvasChunks() {
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({}, {
    get: (_target, property) => (
      property === 'createLinearGradient' || property === 'createRadialGradient'
        ? () => gradient
        : vi.fn()
    ),
    set: () => true,
  });
  return Array.from({ length: 5 }, () => ({ getContext: () => context }));
}

function basePlayer() {
  return {
    x: 0, y: 0, w: 28, h: 44, vx: 0, vy: 0, facing: 1,
    grounded: false, wallSide: 0, climbing: false, hp: 4, invuln: 0,
    coyote: 0, jumpBuffer: 0, dropTimer: 0, attackTimer: 0, digTimer: 0,
    attackHits: new Set(), inWater: false,
  };
}

function engineHarness(level) {
  return {
    level,
    repository: { campaignId: 'production-preview-pilgrims-climb', sessionKind: 'production-preview', length: 1 },
    levelIndex: 0,
    bank: { get: () => canvasChunks() },
    player: basePlayer(),
    input: {
      left: false, right: false, climb: false, down: false, jump: false, attack: false, dig: false,
      pressed: new Set(), released: new Set(),
    },
    gateOpen: false,
    particles: [],
    soldiers: [],
    projectiles: [],
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), mode: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    tileAt: GameEngine.prototype.tileAt,
    isSolidTile: GameEngine.prototype.isSolidTile,
    solidProbe: GameEngine.prototype.solidProbe,
    movePlayerHorizontal: GameEngine.prototype.movePlayerHorizontal,
    movePlayerVertical: GameEngine.prototype.movePlayerVertical,
    recordPilgrimGrip: GameEngine.prototype.recordPilgrimGrip,
    recordPilgrimWallJump: GameEngine.prototype.recordPilgrimWallJump,
    armBellTowerCollapseLedge: GameEngine.prototype.armBellTowerCollapseLedge,
    updateBellTowerObjective: GameEngine.prototype.updateBellTowerObjective,
    updateBellTowerCollapse: GameEngine.prototype.updateBellTowerCollapse,
    strikePilgrimBell: GameEngine.prototype.strikePilgrimBell,
    revealMemoryMark: GameEngine.prototype.revealMemoryMark,
    openGate: GameEngine.prototype.openGate,
    checkHazards: vi.fn(),
    resolveAttackHits: vi.fn(),
    armCrumble: vi.fn(),
    totalTime: 0,
    deaths: 0,
    mode: 'play',
  };
}

function standAtLanding(engine, landing) {
  engine.player.x = landing.minTx * TILE;
  engine.player.y = landing.feetTy * TILE - engine.player.h;
  engine.player.vx = 0;
  engine.player.vy = 0;
  engine.player.grounded = true;
}

function completeToCarve(engine) {
  const objective = engine.level.objective;
  GameEngine.prototype.recordPilgrimGrip.call(engine, objective.lesson.minGripSeconds, 1);
  GameEngine.prototype.recordPilgrimWallJump.call(engine, 1);
  standAtLanding(engine, objective.lesson.landing);
  GameEngine.prototype.updateBellTowerObjective.call(engine);
  GameEngine.prototype.recordPilgrimWallJump.call(engine, 1);
  GameEngine.prototype.recordPilgrimWallJump.call(engine, -1);
  standAtLanding(engine, objective.alternating.landing);
  GameEngine.prototype.updateBellTowerObjective.call(engine);
}

function carveBrace(engine) {
  const brace = engine.level.objective.memoryBrace;
  engine.player.x = brace.tx * TILE - engine.player.w - 7;
  engine.player.y = brace.safeLanding.feetTy * TILE - engine.player.h;
  engine.player.facing = 1;
  engine.player.grounded = true;
  GameEngine.prototype.dig.call(engine);
}

function standByChime(engine, id) {
  const chime = engine.level.objective.bell.puzzle.chimes.find((candidate) => candidate.id === id);
  engine.player.x = chime.tx * TILE - engine.player.w / 2;
  engine.player.y = chime.baseTy * TILE - engine.player.h;
  engine.player.vx = 0;
  engine.player.vy = 0;
  engine.player.grounded = true;
}

describe("Outer Veil Level 6 production preview", () => {
  it("authors Pilgrim's Grip as a finite, non-combat bell-tower climb", () => {
    const level = assertValidAuthoredLevel(createPilgrimsClimb(), identity);
    expect(level).toMatchObject({
      levelKey: identity.levelKey,
      campaignOrder: 6,
      abilityUnlock: { key: 'pilgrims-grip', name: "Pilgrim's Grip" },
      objective: {
        type: 'bell-tower-restoration', requiresAbility: 'memory-carve', phase: 'learn',
        lessonComplete: false, alternatingComplete: false, complete: false, restored: false,
        bell: {
          puzzle: {
            sequence: ['dawn', 'veil', 'shelter'],
            progress: [],
            mistakes: 0,
          },
        },
      },
      targetTime: { parSeconds: 240, masterySeconds: 150 },
    });
    expect(level.relics).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.map.flat()).not.toContain(Tile.SPIKE);
    expect(level.map.flat()).not.toContain(Tile.CRUMBLE);
    expect(level.map.flat().filter((tile) => tile === Tile.SAND)).toHaveLength(1);
    for (const section of level.objective.collapse.sections) {
      for (let tx = section.tx; tx < section.tx + section.widthTiles; tx += 1) {
        expect(level.map[section.ty][tx]).toBe(Tile.AIR);
      }
    }
    for (let tx = Math.ceil(level.objective.masteryExit.minCenterTx); tx <= level.gateColumn; tx += 1) {
      expect(level.map[level.objective.masteryExit.maxFeetTy][tx]).toBe(Tile.ONEWAY);
    }
  });

  it('uses the existing mirrored grip and wall-jump physics without changing prototypes', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    engine.player.x = 16 * TILE - engine.player.w;
    engine.player.y = 23 * TILE;
    engine.player.vy = 220;
    engine.input.right = true;
    engine.input.climb = true;
    engine.input.jump = true;
    engine.input.pressed.add('jump');
    level.objective.gripSeconds = level.objective.lesson.minGripSeconds;

    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);

    expect(engine.player.vx).toBeLessThan(0);
    expect(engine.player.vy).toBeLessThan(-PHYSICS.WALL_SLIDE);
    expect(engine.player.facing).toBe(-1);
    expect(engine.player.jumpBuffer).toBe(0);
    expect(level.objective.lesson.jumpRecorded).toBe(true);

    const prototype = createLevels()[5];
    expect(prototype.name).toBe('The Hollow Barracks');
    expect(prototype.abilityUnlock).toBeUndefined();
  });

  it('requires real grip, a wall jump, and the broad landing for the safe lesson', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    standAtLanding(engine, level.objective.lesson.landing);
    GameEngine.prototype.updateBellTowerObjective.call(engine);
    expect(level.objective.phase).toBe('learn');

    GameEngine.prototype.recordPilgrimGrip.call(engine, .45, 1);
    GameEngine.prototype.recordPilgrimWallJump.call(engine, 1);
    GameEngine.prototype.updateBellTowerObjective.call(engine);
    expect(level.objective).toMatchObject({ lessonComplete: true, phase: 'alternate' });
  });

  it('records the authored alternating sequence and vetoes an early Memory Carve', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    level.objective.gripSeconds = .45;
    level.objective.lesson.jumpRecorded = true;
    standAtLanding(engine, level.objective.lesson.landing);
    GameEngine.prototype.updateBellTowerObjective.call(engine);

    carveBrace(engine);
    expect(level.objective.memoryBrace.revealed).toBe(false);
    expect(level.map[level.objective.memoryBrace.ty][level.objective.memoryBrace.tx]).toBe(Tile.SAND);

    GameEngine.prototype.recordPilgrimWallJump.call(engine, -1);
    GameEngine.prototype.recordPilgrimWallJump.call(engine, 1);
    GameEngine.prototype.recordPilgrimWallJump.call(engine, -1);
    standAtLanding(engine, level.objective.alternating.landing);
    GameEngine.prototype.updateBellTowerObjective.call(engine);
    expect(level.objective).toMatchObject({ alternatingComplete: true, phase: 'carve', wallJumps: [1, -1] });
  });

  it('opens the one non-structural brace and starts the finite mastery climb', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    completeToCarve(engine);
    carveBrace(engine);
    const brace = level.objective.memoryBrace;
    expect(brace.revealed).toBe(true);
    expect(level.map[brace.ty][brace.tx]).toBe(Tile.AIR);
    expect(level.objective.phase).toBe('collapse');
    expect(engine.setHint).toHaveBeenCalledWith(expect.stringContaining('descend the broken spiral'), 5.5);
  });

  it('arms one grouped ledge, keeps it collidable through warning, then reforms it once', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    level.objective.phase = 'collapse';
    const section = level.objective.collapse.sections[0];
    engine.player.x = section.x + 8;
    engine.player.y = section.y - engine.player.h;
    engine.player.grounded = true;

    GameEngine.prototype.armBellTowerCollapseLedge.call(engine);
    expect(section.state).toBe('warning');
    GameEngine.prototype.updateBellTowerCollapse.call(engine, 1.09);
    expect(section.state).toBe('warning');
    GameEngine.prototype.updateBellTowerCollapse.call(engine, .02);
    expect(section.state).toBe('gone');
    GameEngine.prototype.updateBellTowerCollapse.call(engine, 3.4);
    expect(section.state).toBe('spent');
    GameEngine.prototype.armBellTowerCollapseLedge.call(engine);
    expect(section.state).toBe('spent');
  });

  it('reveals a fair three-chime puzzle, resets a wrong answer, and restores on the remembered order', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    completeToCarve(engine);
    carveBrace(engine);
    engine.player.x = 74 * TILE;
    engine.player.y = 3 * TILE - engine.player.h - 40;
    engine.player.grounded = false;
    GameEngine.prototype.updateBellTowerObjective.call(engine);
    expect(level.objective).toMatchObject({ masteryReached: true, phase: 'ring', complete: false });

    standByChime(engine, 'veil');
    expect(GameEngine.prototype.strikePilgrimBell.call(engine)).toBe(true);
    expect(level.objective).toMatchObject({
      phase: 'ring',
      complete: false,
      bell: { puzzle: { progress: [], mistakes: 1 } },
    });
    expect(level.objective.bell.puzzle.chimes.every((chime) => !chime.struck)).toBe(true);
    expect(engine.callbacks.gate).not.toHaveBeenCalled();

    for (const id of level.objective.bell.puzzle.sequence) {
      standByChime(engine, id);
      expect(GameEngine.prototype.strikePilgrimBell.call(engine)).toBe(true);
    }
    expect(level.objective).toMatchObject({ phase: 'complete', complete: true, restored: true, bell: { awakened: true, restored: true } });
    expect(level.objective.bell.puzzle.progress).toEqual(['dawn', 'veil', 'shelter']);
    expect(level.objective.bell.puzzle.chimes.every((chime) => chime.struck)).toBe(true);
    expect(level.objective.collapse.sections.every((section) => section.state === 'restored')).toBe(true);
    expect(level.objective.lightWindows.every((window) => window.lit)).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    GameEngine.prototype.strikePilgrimBell.call(engine);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();

    engine.totalTime = 151;
    engine.player.x = level.door.x;
    engine.player.y = level.door.y + 20;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 151,
      deaths: 0,
      campaignId: 'production-preview-pilgrims-climb',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 240, masterySeconds: 150 },
      levelKey: identity.levelKey,
      campaignOrder: 6,
      objectiveType: 'bell-tower-restoration',
    });
  });

  it('lets STRIKE at the bells work even when every earlier objective tracker was missed', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createPilgrimsClimb(), identity));
    const engine = engineHarness(level);
    const brace = level.objective.memoryBrace;
    expect(level.objective).toMatchObject({
      phase: 'learn', lessonComplete: false, alternatingComplete: false, masteryReached: false,
    });
    expect(brace.revealed).toBe(false);
    expect(level.map[brace.ty][brace.tx]).toBe(Tile.SAND);

    standByChime(engine, 'dawn');
    expect(GameEngine.prototype.strikePilgrimBell.call(engine)).toBe(true);

    expect(level.objective).toMatchObject({
      phase: 'ring',
      lessonComplete: true,
      alternatingComplete: true,
      masteryReached: true,
      memoryBrace: { revealed: true },
      bell: { puzzle: { progress: ['dawn'], mistakes: 0 } },
    });
    expect(level.objective.gripSeconds).toBeGreaterThanOrEqual(level.objective.lesson.minGripSeconds);
    expect(level.objective.lesson.jumpRecorded).toBe(true);
    expect(level.objective.wallJumps).toEqual(level.objective.alternating.requiredJumpSides);
    expect(level.map[brace.ty][brace.tx]).toBe(Tile.AIR);
    expect(level.objective.bell.puzzle.chimes.find((chime) => chime.id === 'dawn').struck).toBe(true);
    expect(engine.callbacks.gate).not.toHaveBeenCalled();
  });

  it('scrambles physical placement and clears all bell-puzzle runtime state when cloned', () => {
    const authored = createPilgrimsClimb();
    expect(authored.objective.bell.puzzle.chimes.map((chime) => chime.id)).toEqual(['veil', 'shelter', 'dawn']);
    expect(authored.objective.bell.puzzle.sequence).toEqual(['dawn', 'veil', 'shelter']);

    authored.objective.bell.puzzle.progress.push('dawn', 'veil');
    authored.objective.bell.puzzle.mistakes = 3;
    authored.objective.bell.puzzle.chimes.forEach((chime) => { chime.struck = true; });
    const clone = cloneLevel(authored);

    expect(clone.objective.bell.puzzle).toMatchObject({ progress: [], mistakes: 0 });
    expect(clone.objective.bell.puzzle.chimes.every((chime) => !chime.struck)).toBe(true);
  });

  it('deep-resets grip, sequence, brace, grouped collapse, bell, lights, gate, and hero state after life ends', () => {
    const template = assertValidAuthoredLevel(createPilgrimsClimb(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.gripSeconds = 2;
    runtime.objective.wallJumps.push(1, -1);
    runtime.objective.lessonComplete = true;
    runtime.objective.alternatingComplete = true;
    runtime.objective.memoryBrace.revealed = true;
    runtime.objective.masteryReached = true;
    runtime.objective.collapse.sections.forEach((section) => { section.state = 'gone'; section.timer = 2; });
    runtime.objective.bell.awakened = true;
    runtime.objective.bell.restored = true;
    runtime.objective.bell.puzzle.progress.push('dawn', 'veil');
    runtime.objective.bell.puzzle.mistakes = 2;
    runtime.objective.bell.puzzle.chimes.slice(0, 2).forEach((chime) => { chime.struck = true; });
    runtime.objective.lightWindows.forEach((window) => { window.lit = true; });
    runtime.objective.phase = 'complete';
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    runtime.map[runtime.objective.memoryBrace.ty][runtime.objective.memoryBrace.tx] = Tile.AIR;
    const engine = {
      levelIndex: 0, level: runtime, totalTime: 92, deaths: 3,
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
      cancelLevelTransition: vi.fn(), loadLevel: vi.fn(), clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() }, setHint: vi.fn(), pushHud: vi.fn(),
    };
    engine.loadLevel.mockImplementation(() => {
      engine.level = engine.repository.createRuntime(0);
      engine.gateOpen = false;
      engine.player = basePlayer();
    });

    GameEngine.prototype.respawn.call(engine);

    expect(engine.level.objective).toMatchObject({
      phase: 'learn', gripSeconds: 0, wallJumps: [], lessonComplete: false,
      alternatingComplete: false, masteryReached: false, complete: false, restored: false,
      memoryBrace: { revealed: false },
      bell: { awakened: false, restored: false, puzzle: { progress: [], mistakes: 0 } },
    });
    expect(engine.level.objective.bell.puzzle.chimes.every((chime) => !chime.struck)).toBe(true);
    expect(engine.level.objective.collapse.sections.every((section) => section.state === 'stable' && section.timer === 0)).toBe(true);
    expect(engine.level.objective.lightWindows.every((window) => !window.lit)).toBe(true);
    expect(engine.level.map[engine.level.objective.memoryBrace.ty][engine.level.objective.memoryBrace.tx]).toBe(Tile.SAND);
    expect(engine.totalTime).toBe(92);
    expect(engine.deaths).toBe(3);
  });

  it('keeps named preview identity and preserved numeric prototype Level 6 independent', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toContain('pilgrims-climb');
    const preview = createProductionPreviewRepository('pilgrims-climb');
    const level = await preview.loadTemplate(0);
    expect(preview.campaignId).toBe('production-preview-pilgrims-climb');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(level.name).toBe("Pilgrim's Climb");
    expect(getProductionPreviewDescriptor('pilgrims-climb').completion).toEqual({
      eyebrow: 'The pilgrims’ bell answers',
      heading: 'The tower finds its voice',
      body: 'Aren frees the bell the Crown buried. Its first clear note carries Mira’s light across the Outer Veil.',
    });
    expect(createLevels()[5].name).toBe('The Hollow Barracks');
  });

  it('rejects unsafe grip, wrong identity, ambiguous brace, structural collapse, invalid time, and combat contamination', () => {
    const broken = createPilgrimsClimb();
    broken.id = 5;
    broken.abilityUnlock.key = 'ordinary-climb';
    broken.objective.lesson.minGripSeconds = .1;
    broken.objective.alternating.requiredJumpSides = [1, 1];
    broken.map[6][43] = Tile.SAND;
    broken.map[broken.objective.collapse.sections[0].ty][broken.objective.collapse.sections[0].tx] = Tile.STONE;
    broken.map[broken.objective.masteryExit.maxFeetTy][broken.gateColumn] = Tile.AIR;
    broken.objective.collapse.warningSeconds = .2;
    broken.objective.bell.puzzle.sequence = ['dawn', 'dawn', 'shelter'];
    broken.targetTime.masterySeconds = broken.targetTime.parSeconds;
    broken.gameplay.enemyRoster = ['grunt'];
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'legacy_id_mismatch',
      'invalid_pilgrims_grip',
      'unsafe_grip_lesson',
      'invalid_wall_sequence',
      'ambiguous_memory_brace',
      'structural_collapse',
      'unsafe_summit',
      'unsafe_grouped_collapse',
      'invalid_bell_sequence',
      'invalid_target_time',
      'bell_route_contamination',
    ]));
  });
});
