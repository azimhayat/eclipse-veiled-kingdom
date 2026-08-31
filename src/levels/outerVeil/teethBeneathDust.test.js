import { describe, expect, it, vi } from 'vitest';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
  PRODUCTION_PREVIEW_KEYS,
} from '../../campaign/productionPreview.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine } from '../../engine.js';
import { createLevels } from '../../levels.js';
import { getTimedTeethState, timedTeethCycleSeconds } from '../../teeth-timing.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile } from '../constants.js';
import { createTeethBeneathDust } from './teethBeneathDust.js';

const identity = { levelKey: 'outer-veil-05-teeth-beneath-dust', campaignOrder: 5 };

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

function engineHarness(level) {
  return {
    level,
    repository: { campaignId: 'production-preview-teeth-beneath-dust', sessionKind: 'production-preview', length: 1 },
    levelIndex: 0,
    bank: { get: () => canvasChunks() },
    player: {
      x: level.spawn.x, y: level.spawn.y, w: 28, h: 44, facing: 1,
      hp: 4, invuln: 0, vy: 0, vx: 0, digTimer: 0, dropTimer: 0, grounded: true,
    },
    input: { down: false, pressed: new Set() },
    gateOpen: false,
    particles: [],
    soldiers: [],
    projectiles: [],
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), mode: vi.fn(), death: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    damagePlayer: GameEngine.prototype.damagePlayer,
    updateTimedTeethObjective: GameEngine.prototype.updateTimedTeethObjective,
    toggleOathbind: GameEngine.prototype.toggleOathbind,
    openGate: GameEngine.prototype.openGate,
    tileAt: GameEngine.prototype.tileAt,
    isSolidTile: GameEngine.prototype.isSolidTile,
    totalTime: 0,
    deaths: 0,
    mode: 'play',
  };
}

function standBesideShelter(engine) {
  const block = engine.level.block;
  engine.player.x = block.x - engine.player.w - 4;
  engine.player.y = 27 * TILE - engine.player.h;
  engine.player.grounded = true;
}

describe('Outer Veil Level 5 production preview', () => {
  it('authors one deterministic breathing jaw with safe lesson, Oathbind shelter, and mastery wave', () => {
    const level = assertValidAuthoredLevel(createTeethBeneathDust(), identity);
    expect(level).toMatchObject({
      levelKey: identity.levelKey,
      campaignOrder: 5,
      objective: {
        type: 'timed-teeth-restoration',
        requiresAbility: 'oathbind',
        phase: 'observe',
        hazardClock: 0,
        complete: false,
      },
    });
    expect(level.objective.hazards).toHaveLength(8);
    expect(level.objective.hazards.filter((hazard) => !hazard.damaging)).toHaveLength(1);
    expect(level.objective.hazards.filter((hazard) => hazard.role === 'oathbind-target')).toHaveLength(1);
    expect(level.map.flat()).not.toContain(Tile.SPIKE);
    expect(level.map.flat()).not.toContain(Tile.CRUMBLE);
    expect(level.relics).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.targetTime).toEqual({ parSeconds: 210, masterySeconds: 125 });
  });

  it('uses exact half-open safe, warning, active, and recovery boundaries from one pure clock', () => {
    const level = createTeethBeneathDust();
    const { timing } = level.objective;
    const hazard = { ...level.objective.hazards[1], offsetSeconds: 0 };
    expect(timedTeethCycleSeconds(timing)).toBe(4);
    expect(getTimedTeethState(timing, hazard, 1.999).state).toBe('safe');
    expect(getTimedTeethState(timing, hazard, 2).state).toBe('warning');
    expect(getTimedTeethState(timing, hazard, 2.799).state).toBe('warning');
    expect(getTimedTeethState(timing, hazard, 2.8).state).toBe('active');
    expect(getTimedTeethState(timing, hazard, 3.499).state).toBe('active');
    expect(getTimedTeethState(timing, hazard, 3.5).state).toBe('recovery');
    expect(getTimedTeethState(timing, hazard, 4).state).toBe('safe');
    expect(getTimedTeethState(timing, { ...hazard, offsetSeconds: -8 }, 10.8).state).toBe('active');
    expect(getTimedTeethState(timing, { ...hazard, bound: true }, 2.9)).toMatchObject({ state: 'bound', active: false });
  });

  it('sends the mastery warning wave west to east as instructed', () => {
    const level = createTeethBeneathDust();
    const { timing, hazards } = level.objective;
    const mastery = Object.fromEntries(
      hazards.filter((hazard) => hazard.role === 'mastery-wave')
        .map((hazard) => [hazard.id, hazard]),
    );

    expect(getTimedTeethState(timing, mastery['mastery-west'], 1.2).state).toBe('active');
    expect(getTimedTeethState(timing, mastery['mastery-heart'], 1.2).state).not.toBe('active');
    expect(getTimedTeethState(timing, mastery['mastery-east'], 1.2).state).not.toBe('active');
    expect(getTimedTeethState(timing, mastery['mastery-heart'], 2).state).toBe('active');
    expect(getTimedTeethState(timing, mastery['mastery-east'], 2.8).state).toBe('active');
  });

  it('starts one local hazard clock at the observation threshold and never uses global run time', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createTeethBeneathDust(), identity));
    const engine = engineHarness(level);
    engine.totalTime = 97;
    engine.player.x = 8 * TILE;
    GameEngine.prototype.updateLevelMechanics.call(engine, 1 / 60);
    expect(level.objective).toMatchObject({ hazardClock: 0, clockStarted: false });
    engine.player.x = 10 * TILE;
    GameEngine.prototype.updateLevelMechanics.call(engine, 1 / 60);
    expect(level.objective.clockStarted).toBe(true);
    expect(level.objective.hazardClock).toBeCloseTo(1 / 60);
    expect(engine.totalTime).toBe(97);
  });

  it('damages only an inset foot contact during an active damaging bank, once per invulnerability window', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createTeethBeneathDust(), identity));
    const engine = engineHarness(level);
    const hazard = level.objective.hazards.find((item) => item.id === 'controlled-west');
    engine.player.x = hazard.startTx * TILE + 16;
    engine.player.y = hazard.baseTy * TILE - engine.player.h;

    level.objective.hazardClock = 2.4;
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(4);

    level.objective.hazardClock = 2.81;
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(3);
    expect(engine.player.vx).toBeLessThan(0);
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(3);

    engine.player.invuln = 0;
    engine.player.x = level.objective.hazards[0].startTx * TILE + 16;
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(3);
  });

  it('keeps the shelter fixed, refuses sequence skipping, and permanently binds the target jaw', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createTeethBeneathDust(), identity));
    const engine = engineHarness(level);
    standBesideShelter(engine);
    const homeY = level.block.y;

    expect(GameEngine.prototype.canMoveBlock.call(engine, 8)).toBe(false);
    GameEngine.prototype.toggleOathbind.call(engine);
    expect(level.block.bound).toBe(false);
    expect(level.objective.oathShelter.boundOnce).toBe(false);

    level.objective.lessonComplete = true;
    level.objective.controlledComplete = true;
    level.objective.phase = 'bind';
    GameEngine.prototype.toggleOathbind.call(engine);
    const target = level.objective.hazards.find((hazard) => hazard.id === level.objective.oathShelter.targetHazardId);
    expect(level.block).toMatchObject({ bound: true, y: homeY - 16 });
    expect(level.objective).toMatchObject({ phase: 'mastery', oathShelter: { boundOnce: true } });
    expect(target.bound).toBe(true);
    GameEngine.prototype.toggleOathbind.call(engine);
    expect(level.block.bound).toBe(true);
  });

  it('advances the continuous route in order, restores once, and emits the exact completion identity', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createTeethBeneathDust(), identity));
    const engine = engineHarness(level);
    const thresholds = level.objective.thresholds;

    engine.player.x = thresholds.lessonClearTx * TILE;
    GameEngine.prototype.updateTimedTeethObjective.call(engine);
    expect(level.objective.phase).toBe('controlled');
    engine.player.x = thresholds.controlledClearTx * TILE;
    GameEngine.prototype.updateTimedTeethObjective.call(engine);
    expect(level.objective.phase).toBe('bind');
    standBesideShelter(engine);
    GameEngine.prototype.toggleOathbind.call(engine);
    expect(level.objective.phase).toBe('mastery');

    const landing = thresholds.masteryLanding;
    engine.player.x = landing.minTx * TILE;
    engine.player.y = 27 * TILE - engine.player.h;
    engine.player.grounded = true;
    GameEngine.prototype.updateTimedTeethObjective.call(engine);
    expect(level.objective).toMatchObject({ phase: 'mastery', complete: false, restored: false });
    expect(engine.callbacks.gate).not.toHaveBeenCalled();

    engine.player.x = (landing.maxTx + 1) * TILE;
    engine.player.y = landing.feetTy * TILE - engine.player.h - 80;
    engine.player.grounded = false;
    GameEngine.prototype.updateTimedTeethObjective.call(engine);

    expect(engine.objectiveStatus()).toMatchObject({ current: 1, target: 1, complete: true, progressText: 'WARNING PATH RESTORED' });
    expect(level.objective.hazards.every((hazard) => hazard.restored)).toBe(true);
    expect(level.objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    GameEngine.prototype.updateTimedTeethObjective.call(engine);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();

    engine.totalTime = 126;
    engine.player.x = level.door.x;
    engine.player.y = level.door.y;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 126,
      deaths: 0,
      campaignId: 'production-preview-teeth-beneath-dust',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 210, masterySeconds: 125 },
      levelKey: identity.levelKey,
      campaignOrder: 5,
      objectiveType: 'timed-teeth-restoration',
    });
  });

  it('deep-resets timing, teeth, shelter, restoration, and gate while preserving run time and deaths', () => {
    const template = assertValidAuthoredLevel(createTeethBeneathDust(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.hazardClock = 3.1;
    runtime.objective.clockStarted = true;
    runtime.objective.lessonComplete = true;
    runtime.objective.controlledComplete = true;
    runtime.objective.masteryComplete = true;
    runtime.objective.oathShelter.boundOnce = true;
    runtime.objective.hazards.forEach((hazard) => { hazard.bound = true; hazard.restored = true; });
    runtime.objective.phase = 'complete';
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    runtime.block.bound = true;
    runtime.block.y -= runtime.block.oathLift;
    for (const tile of runtime.objective.restorationTiles) runtime.map[tile.ty][tile.tx] = Tile.GLOW;
    const engine = {
      levelIndex: 0,
      level: runtime,
      totalTime: 88,
      deaths: 2,
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
      cancelLevelTransition: vi.fn(), loadLevel: vi.fn(), clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() }, setHint: vi.fn(), pushHud: vi.fn(),
    };
    engine.loadLevel.mockImplementation(() => {
      engine.level = engine.repository.createRuntime(0);
      engine.gateOpen = false;
    });

    GameEngine.prototype.respawn.call(engine);

    expect(engine.level.objective).toMatchObject({
      hazardClock: 0, clockStarted: false, phase: 'observe', lessonComplete: false,
      controlledComplete: false, masteryComplete: false, complete: false, restored: false,
      oathShelter: { boundOnce: false },
    });
    expect(engine.level.objective.hazards.every((hazard) => !hazard.bound && !hazard.restored)).toBe(true);
    expect(engine.level.block).toMatchObject({ x: template.block.x, y: template.block.y, bound: false });
    expect(engine.level.map.some((row) => row[engine.level.gateColumn] === Tile.GATE)).toBe(true);
    expect(engine.level.objective.restorationTiles.every(({ tx, ty }) => engine.level.map[ty][tx] === Tile.STONE)).toBe(true);
    expect(engine.totalTime).toBe(88);
    expect(engine.deaths).toBe(2);
  });

  it('keeps preview identity, ending, save isolation, dynamic chunk, and prototype Level 5 distinct', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toContain('teeth-beneath-dust');
    const preview = createProductionPreviewRepository('teeth-beneath-dust');
    const level = await preview.loadTemplate(0);
    expect(preview.campaignId).toBe('production-preview-teeth-beneath-dust');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(level.name).toBe('Teeth Beneath Dust');
    expect(getProductionPreviewDescriptor('teeth-beneath-dust').completion.heading).toBe('The teeth fall silent');
    expect(createLevels()[4].name).toBe('The Gardens of Glass');
  });

  it('rejects unreadable timing, overlapping banks, unsafe recovery, and contaminated combat routes', () => {
    const broken = createTeethBeneathDust();
    broken.objective.timing.warningSeconds = .1;
    broken.objective.hazards[1].id = broken.objective.hazards[0].id;
    broken.objective.hazards[1].startTx = broken.objective.hazards[0].startTx;
    broken.objective.hazards[1].endTx = broken.objective.hazards[0].endTx;
    broken.map[27][15] = Tile.AIR;
    broken.map[26][5] = Tile.SPIKE;
    broken.gameplay.enemyRoster = ['grunt'];
    broken.objective.oathShelter.targetHazardId = 'missing';
    broken.objective.restorationTiles[0] = { tx: 4, ty: 4, tile: Tile.GLOW };
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unsafe_teeth_timing',
      'duplicate_teeth_id',
      'overlapping_teeth_banks',
      'unsafe_teeth_recovery',
      'teeth_route_contamination',
      'invalid_oath_shelter',
      'unsafe_restoration',
    ]));
  });
});
