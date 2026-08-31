import { describe, expect, it, vi } from 'vitest';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
} from '../../campaign/productionPreview.js';
import {
  createOuterVeilCampaignRepository,
  OUTER_VEIL_LEVEL_KEYS,
} from '../../campaign/outerVeilCampaign.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine } from '../../engine.js';
import { createLevels } from '../../levels.js';
import {
  createCampaignSave,
  getOuterVeilContinueTarget,
  recordProductionLevelCompletion,
} from '../../save-data.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile } from '../constants.js';
import { createWeightOfOaths } from './weightOfOaths.js';

const identity = {
  levelKey: 'outer-veil-04-weight-of-oaths',
  campaignOrder: 4,
};

function canvasSurface() {
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({}, {
    get: (_target, property) => (
      property === 'createLinearGradient' || property === 'createRadialGradient'
        ? () => gradient
        : vi.fn()
    ),
    set: () => true,
  });
  return { width: 0, height: 0, getContext: () => context };
}

function canvasChunks() {
  return Array.from({ length: 5 }, () => canvasSurface());
}

function engineHarness(level) {
  return {
    level,
    repository: { campaignId: 'production-preview-weight-of-oaths', sessionKind: 'production-preview', length: 1 },
    levelIndex: 0,
    bank: { get: () => canvasChunks() },
    player: {
      x: 0, y: 0, w: 28, h: 44, vx: 0, vy: 0, facing: 1,
      grounded: true, wallSide: 0, climbing: false, hp: 4, invuln: 0,
      coyote: 0, jumpBuffer: 0, dropTimer: 0, attackTimer: 0, attackBuffer: 0,
      digTimer: 0, attackHits: new Set(), inWater: false,
    },
    input: {
      left: false, right: false, climb: false, down: false, jump: false, attack: false, dig: false,
      pressed: new Set(), released: new Set(),
    },
    gateOpen: false,
    particles: [],
    soldiers: [],
    projectiles: [],
    crumble: new Map(),
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), mode: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    revealMemoryMark: GameEngine.prototype.revealMemoryMark,
    blockOnOathZone: GameEngine.prototype.blockOnOathZone,
    toggleOathbind: GameEngine.prototype.toggleOathbind,
    updateOathbindObjective: GameEngine.prototype.updateOathbindObjective,
    openGate: GameEngine.prototype.openGate,
    tileAt: GameEngine.prototype.tileAt,
    isSolidTile: GameEngine.prototype.isSolidTile,
    solidProbe: GameEngine.prototype.solidProbe,
    movePlayerHorizontal: GameEngine.prototype.movePlayerHorizontal,
    movePlayerVertical: GameEngine.prototype.movePlayerVertical,
    canMoveBlock: GameEngine.prototype.canMoveBlock,
    recordPilgrimGrip: GameEngine.prototype.recordPilgrimGrip,
    recordPilgrimWallJump: GameEngine.prototype.recordPilgrimWallJump,
    resolveAttackHits: GameEngine.prototype.resolveAttackHits,
    strikePilgrimBell: vi.fn(),
    checkHazards: vi.fn(),
    armCrumble: vi.fn(),
    armBellTowerCollapseLedge: vi.fn(),
    hintHoldUntil: 0,
    lastHint: '',
    totalTime: 0,
    deaths: 0,
    mode: 'play',
  };
}

function placeBlock(level, zone) {
  level.block.x = zone.x + (zone.w - level.block.w) / 2;
  level.block.y = 26 * TILE - level.block.h;
  level.block.vy = 0;
}

function standBeside(engine, side = 'left') {
  const block = engine.level.block;
  engine.player.x = side === 'left' ? block.x - engine.player.w - 4 : block.x + block.w + 4;
  engine.player.y = 26 * TILE - engine.player.h;
  engine.player.grounded = true;
}

function carveRecord(engine) {
  const mark = engine.level.objective.memoryMark;
  engine.player.x = mark.tx * TILE - engine.player.w - 7;
  engine.player.y = mark.ty * TILE + 4;
  engine.player.facing = 1;
  GameEngine.prototype.dig.call(engine);
}

describe('Outer Veil Level 4 production preview', () => {
  it('authors one named Oathbind lesson, combination record, and final civic seal', () => {
    const level = assertValidAuthoredLevel(createWeightOfOaths(), identity);
    expect(level).toMatchObject({
      levelKey: identity.levelKey,
      campaignOrder: 4,
      abilityUnlock: { key: 'oathbind', name: 'Oathbind' },
      objective: {
        type: 'oathbind-restoration',
        requiresAbility: 'memory-carve',
        phase: 'learn',
        complete: false,
        restored: false,
      },
    });
    expect(level.map.flat().filter((tile) => tile === Tile.SAND)).toHaveLength(1);
    expect(level.block.w).toBe(TILE);
    expect(level.map.flat()).not.toContain(Tile.SPIKE);
    expect(level.relics).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.targetTime).toEqual({ parSeconds: 240, masterySeconds: 150 });
  });

  it('makes the archive unreachable from the road but fair from the raised bound block', () => {
    const level = createWeightOfOaths();
    const roadTop = 26 * TILE;
    const archiveTop = 21 * TILE;
    const raisedBlockTop = level.block.y - level.block.oathLift;
    expect(roadTop - archiveTop).toBe(240);
    expect(raisedBlockTop - archiveTop).toBe(168);
    expect(200 - (raisedBlockTop - archiveTop)).toBeGreaterThanOrEqual(TILE / 2);
    for (let tx = 14; tx <= 34; tx += 1) {
      expect(level.map[25][tx]).toBe(Tile.AIR);
      expect(level.map[26][tx]).toBe(Tile.STONE);
    }
  });

  it('lands a full held jump from the bound block on the archive ledge', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWeightOfOaths(), identity));
    const engine = engineHarness(level);
    placeBlock(level, level.objective.lessonZone);
    standBeside(engine);
    GameEngine.prototype.toggleOathbind.call(engine);

    engine.player.x = level.block.x + 6;
    engine.player.y = level.block.y - engine.player.h;
    engine.player.grounded = true;
    engine.input.right = true;
    engine.input.jump = true;
    engine.input.pressed.add('jump');
    let landedArchive = false;
    for (let frame = 0; frame < 120; frame += 1) {
      GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
      engine.input.pressed.clear();
      if (engine.player.grounded && Math.abs((engine.player.y + engine.player.h) - 21 * TILE) < 1) {
        landedArchive = true;
        break;
      }
    }

    expect(landedArchive).toBe(true);
    expect(engine.player.x).toBeGreaterThanOrEqual(20 * TILE - engine.player.w);
  });

  it('keeps bound hints causal across the climb, carve, and release phases', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWeightOfOaths(), identity));
    const engine = engineHarness(level);
    placeBlock(level, level.objective.lessonZone);
    level.block.bound = true;
    level.block.y -= level.block.oathLift;
    engine.player.x = level.block.x - engine.player.w - 4;
    engine.player.y = 26 * TILE - engine.player.h;

    for (const [phase, expected] of [
      ['cross', 'KEEP IT BOUND'],
      ['carve', 'FACE RIGHT INTO THE CYAN RECORD'],
      ['seal', 'DROP TO THE ROAD'],
    ]) {
      level.objective.phase = phase;
      engine.setHint.mockClear();
      GameEngine.prototype.updateHints.call(engine);
      expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining(expected));
      if (phase !== 'seal') expect(engine.setHint.mock.calls.at(-1)[0]).not.toMatch(/release/i);
    }
  });

  it('records the complete bind, climb, carve, release, push, and rebind route', () => {
    const route = createWeightOfOaths().gameplay.deterministicRoute;
    expect(route).toEqual([
      'push-to-oathbind-lesson-sigil',
      'oathbind-lesson-sigil',
      'bind-oath-foothold',
      'archive-ledge',
      'cartographer-oath-record',
      'drop-to-civic-road',
      'release-oath-foothold',
      'push-to-public-civic-seal',
      'public-civic-seal',
      'rebind-public-civic-seal',
      'eclipse-door',
    ]);
  });

  it('keeps preview identity, ending copy, and the original prototype independently addressable', async () => {
    const preview = createProductionPreviewRepository('weight-of-oaths');
    const level = await preview.loadTemplate(0);
    expect(preview.campaignId).toBe('production-preview-weight-of-oaths');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(level.name).toBe('The Weight of Oaths');
    expect(getProductionPreviewDescriptor('weight-of-oaths').completion.heading).toBe('The gate remembers its promise');
    expect(createLevels()[3].name).toBe('The Buried Foundry');
  });

  it('rejects an unnamed unlock, missing record, unsafe route, and broken restoration', () => {
    const broken = createWeightOfOaths();
    broken.abilityUnlock.key = 'ordinary-block';
    broken.map[broken.objective.memoryMark.ty][broken.objective.memoryMark.tx] = Tile.AIR;
    broken.map[25][18] = Tile.STONE;
    broken.objective.restorationTiles[0] = { tx: 9, ty: 19, tile: Tile.GLOW };
    broken.objective.finalMonument.tx = 999;
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid_oathbind_unlock',
      'mark_not_sand',
      'unsafe_oath_corridor',
      'unsafe_restoration',
      'invalid_final_monument',
    ]));
  });

  it('binds only a settled nearby block and turns the lesson bind into a stable platform', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWeightOfOaths(), identity));
    const engine = engineHarness(level);
    placeBlock(level, level.objective.lessonZone);
    standBeside(engine);
    const restingY = level.block.y;

    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(level.block).toMatchObject({ bound: true, y: restingY - level.block.oathLift });
    expect(level.objective).toMatchObject({ lessonComplete: true, phase: 'cross' });
    expect(GameEngine.prototype.canMoveBlock.call(engine, 4)).toBe(false);

    engine.player.x = level.block.x + 4;
    engine.player.y = level.block.y - engine.player.h - 8;
    engine.player.vy = 300;
    engine.player.grounded = false;
    GameEngine.prototype.movePlayerVertical.call(engine, 16);
    expect(engine.player.y + engine.player.h).toBe(level.block.y);
    expect(engine.player.grounded).toBe(true);

    GameEngine.prototype.toggleOathbind.call(engine);
    expect(level.block.bound).toBe(true);
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('STEP BESIDE'), 3.2);
  });

  it('vetoes the archive carve before the safe lesson, then reveals it exactly once', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWeightOfOaths(), identity));
    const engine = engineHarness(level);
    const mark = level.objective.memoryMark;

    carveRecord(engine);
    expect(level.map[mark.ty][mark.tx]).toBe(Tile.SAND);
    expect(mark.revealed).toBe(false);

    placeBlock(level, level.objective.lessonZone);
    standBeside(engine);
    GameEngine.prototype.toggleOathbind.call(engine);
    carveRecord(engine);
    expect(level.map[mark.ty][mark.tx]).toBe(Tile.AIR);
    expect(mark.revealed).toBe(true);
    expect(level.objective.phase).toBe('seal');
    carveRecord(engine);
    expect(mark.revealed).toBe(true);
  });

  it('requires the final bind, restores the road, opens once, and emits the exact win identity', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWeightOfOaths(), identity));
    const engine = engineHarness(level);
    level.objective.lessonComplete = true;
    level.objective.memoryMark.revealed = true;
    level.objective.phase = 'seal';
    placeBlock(level, level.objective.finalSeal);
    standBeside(engine);

    GameEngine.prototype.updateOathbindObjective.call(engine);
    expect(level.objective.complete).toBe(false);
    GameEngine.prototype.toggleOathbind.call(engine);
    GameEngine.prototype.updateOathbindObjective.call(engine);

    expect(engine.objectiveStatus()).toMatchObject({ current: 3, target: 3, complete: true, progressText: 'OATH RESTORED' });
    expect(level.objective.restored).toBe(true);
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    expect(level.objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);

    GameEngine.prototype.updateOathbindObjective.call(engine);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    engine.totalTime = 142;
    engine.player.x = level.door.x;
    engine.player.y = level.door.y;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 142,
      deaths: 0,
      campaignId: 'production-preview-weight-of-oaths',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 240, masterySeconds: 150 },
      levelKey: identity.levelKey,
      campaignOrder: 4,
      objectiveType: 'oathbind-restoration',
    });
  });

  it('explains how to recover after reaching the public scale before carving the record', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWeightOfOaths(), identity));
    const engine = engineHarness(level);
    level.objective.lessonComplete = true;
    level.objective.phase = 'seal';
    placeBlock(level, level.objective.finalSeal);
    level.block.bound = true;
    level.block.y -= level.block.oathLift;
    standBeside(engine, 'right');

    GameEngine.prototype.updateOathbindObjective.call(engine);
    expect(level.objective.complete).toBe(false);
    expect(engine.setHint).toHaveBeenLastCalledWith(
      expect.stringContaining('release the block and return west beneath the archive'),
      3.8,
    );
    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(level.block.bound).toBe(false);
  });

  it('fully reforms the block, record, seal, road, monument, and gate after life ends', () => {
    const template = assertValidAuthoredLevel(createWeightOfOaths(), identity);
    const runtime = cloneLevel(template);
    runtime.block.x = runtime.objective.finalSeal.x;
    runtime.block.y -= runtime.block.oathLift;
    runtime.block.bound = true;
    runtime.objective.lessonComplete = true;
    runtime.objective.memoryMark.revealed = true;
    runtime.objective.phase = 'complete';
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    runtime.map[runtime.objective.memoryMark.ty][runtime.objective.memoryMark.tx] = Tile.AIR;
    for (const tile of runtime.objective.restorationTiles) runtime.map[tile.ty][tile.tx] = Tile.GLOW;
    const engine = {
      levelIndex: 0,
      level: runtime,
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
      cancelLevelTransition: vi.fn(),
      loadLevel: vi.fn(),
      clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() },
      setHint: vi.fn(),
      pushHud: vi.fn(),
    };
    engine.loadLevel.mockImplementation(() => {
      engine.level = engine.repository.createRuntime(0);
      engine.gateOpen = false;
    });

    GameEngine.prototype.respawn.call(engine);

    expect(engine.level.block).toMatchObject({ x: template.block.x, y: template.block.y, bound: false });
    expect(engine.level.objective).toMatchObject({
      lessonComplete: false,
      phase: 'learn',
      complete: false,
      restored: false,
      completedAt: null,
    });
    expect(engine.level.objective.memoryMark.revealed).toBe(false);
    expect(engine.level.map[template.objective.memoryMark.ty][template.objective.memoryMark.tx]).toBe(Tile.SAND);
    expect(engine.level.map.some((row) => row[engine.level.gateColumn] === Tile.GATE)).toBe(true);
    expect(engine.level.objective.restorationTiles.every(({ tx, ty }) => engine.level.map[ty][tx] === Tile.STONE)).toBe(true);
    expect(engine.mode).toBe('play');
  });

  it('uses the real campaign loader after fatal damage without advancing the save', async () => {
    const timestamp = new Date('2026-08-31T17:30:00.000Z');
    const repository = createOuterVeilCampaignRepository();
    repository.retainAround(3);
    await repository.loadTemplate(3);
    const template = repository.peekTemplate(3);
    const runtime = repository.createRuntime(3);

    let save = createCampaignSave({ now: () => timestamp });
    for (const [index, levelKey] of OUTER_VEIL_LEVEL_KEYS.slice(0, 3).entries()) {
      save = recordProductionLevelCompletion(save, {
        levelKey,
        levelTime: 40 + index,
        campaignTime: 120 + index,
        completedAt: timestamp,
        now: () => timestamp,
      });
    }
    const saveBeforeDeath = structuredClone(save);
    const rendered = new Map([[identity.levelKey, canvasChunks()]]);
    const bank = {
      retain: vi.fn(() => bank),
      has: vi.fn((key) => rendered.has(key)),
      get: vi.fn((key) => rendered.get(key)),
      set: vi.fn((key, chunks) => {
        rendered.set(key, chunks);
        return bank;
      }),
    };
    const callbacks = {
      death: vi.fn(),
      mode: vi.fn(),
      level: vi.fn(),
      levelComplete: vi.fn((completion) => {
        save = recordProductionLevelCompletion(save, {
          ...completion,
          completedAt: timestamp,
          now: () => timestamp,
        });
      }),
    };
    const engine = {
      repository,
      bank,
      levelIndex: 3,
      level: runtime,
      player: GameEngine.prototype.makePlayer(runtime.spawn),
      checkpoint: { kind: 'checkpoint', id: 'dirty-checkpoint', x: 999, y: 999, facing: -1 },
      camera: { x: 0, y: 0 },
      input: {
        left: true, right: true, climb: true, down: true, jump: true, attack: true, dig: true,
        pressed: new Set(['jump']), released: new Set(['dig']),
      },
      soldiers: [{ id: 'dirty-soldier' }],
      projectiles: [{ id: 'dirty-projectile' }],
      particles: [{ id: 'dirty-particle' }],
      crumble: new Map([['dirty', { phase: 'falling' }]]),
      gateOpen: true,
      mode: 'play',
      demo: false,
      running: true,
      totalTime: 88,
      levelTime: 31,
      deaths: 0,
      levelCompletionEmitted: true,
      spawnClock: 2,
      transitionRetryBlocked: true,
      hintHoldUntil: 4,
      prefetchGeneration: 0,
      prefetchController: null,
      prefetchHandle: null,
      prefetchTargetIndex: null,
      prefetchPromise: null,
      prefetchStart: null,
      transitionGeneration: 0,
      transitionController: null,
      transitioning: false,
      transitionTargetIndex: null,
      callbacks,
      audio: { play: vi.fn() },
      makePlayer: GameEngine.prototype.makePlayer,
      cancelLevelPrefetch: GameEngine.prototype.cancelLevelPrefetch,
      cancelLevelTransition: GameEngine.prototype.cancelLevelTransition,
      loadLevel: GameEngine.prototype.loadLevel,
      clearInputs: GameEngine.prototype.clearInputs,
      burst: vi.fn(),
      setHint: vi.fn(),
      pushHud: vi.fn(),
      scheduleNextLevel: vi.fn(),
    };

    runtime.block.x = runtime.objective.finalSeal.x;
    runtime.block.y -= runtime.block.oathLift;
    runtime.block.vx = 140;
    runtime.block.vy = -80;
    runtime.block.bound = true;
    runtime.objective.lessonComplete = true;
    runtime.objective.memoryMark.revealed = true;
    runtime.objective.phase = 'complete';
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    runtime.objective.completedAt = 19;
    runtime.map[runtime.objective.memoryMark.ty][runtime.objective.memoryMark.tx] = Tile.AIR;
    for (const tile of runtime.objective.restorationTiles) runtime.map[tile.ty][tile.tx] = Tile.GLOW;
    engine.player.hp = 1;

    expect(template.objective).toMatchObject({ phase: 'learn', complete: false, restored: false });
    expect(template.map[template.objective.memoryMark.ty][template.objective.memoryMark.tx]).toBe(Tile.SAND);

    GameEngine.prototype.damagePlayer.call(engine, 1);
    expect(engine).toMatchObject({ mode: 'dead', deaths: 1 });
    expect(engine.player.hp).toBe(0);
    expect(callbacks.death).toHaveBeenCalledOnce();
    expect(callbacks.death).toHaveBeenCalledWith({ deaths: 1, demo: false });
    expect(callbacks.levelComplete).not.toHaveBeenCalled();

    vi.stubGlobal('document', { createElement: vi.fn(() => canvasSurface()) });
    try {
      GameEngine.prototype.respawn.call(engine);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(engine.level).not.toBe(runtime);
    expect(engine.level).not.toBe(template);
    expect(engine).toMatchObject({
      levelIndex: 3,
      mode: 'play',
      deaths: 1,
      totalTime: 88,
      levelTime: 31,
      gateOpen: false,
      levelCompletionEmitted: false,
    });
    expect(engine.level).toMatchObject(identity);
    expect(engine.player).toMatchObject({ ...template.spawn, hp: 4, invuln: 0, digTimer: 0 });
    expect(engine.checkpoint).toEqual({ kind: 'spawn', id: null, ...template.spawn, facing: 1 });
    expect(engine.level.block).toMatchObject({
      x: template.block.x,
      y: template.block.y,
      vx: 0,
      vy: 0,
      bound: false,
    });
    expect(engine.level.objective).toMatchObject({
      phase: 'learn',
      lessonComplete: false,
      complete: false,
      restored: false,
      completedAt: null,
      memoryMark: { revealed: false },
    });
    expect(engine.level.map[template.objective.memoryMark.ty][template.objective.memoryMark.tx]).toBe(Tile.SAND);
    expect(engine.level.objective.restorationTiles.every(({ tx, ty }) => engine.level.map[ty][tx] === Tile.STONE)).toBe(true);
    expect(engine.level.map.some((row) => row[engine.level.gateColumn] === Tile.GATE)).toBe(true);
    expect(engine.soldiers).toEqual([]);
    expect(engine.projectiles).toEqual([]);
    expect(engine.particles).toEqual([]);
    expect(engine.crumble.size).toBe(0);
    expect(bank.set).toHaveBeenCalledOnce();
    expect(bank.set.mock.calls[0][0]).toBe(identity.levelKey);
    expect(bank.set.mock.calls[0][1]).toHaveLength(5);
    expect(callbacks.mode).toHaveBeenLastCalledWith('play');
    expect(callbacks.level).not.toHaveBeenCalled();
    expect(callbacks.levelComplete).not.toHaveBeenCalled();
    expect(engine.setHint).toHaveBeenLastCalledWith('The realm reforms. Begin the level anew.');
    expect(save).toEqual(saveBeforeDeath);
    expect(getOuterVeilContinueTarget(save)).toEqual({
      kind: 'level',
      levelKey: identity.levelKey,
      campaignOrder: 4,
    });
    expect(repository.peekTemplate(3)).toBe(template);
    expect(template.objective).toMatchObject({ phase: 'learn', complete: false, restored: false });
  });
});
