import { describe, expect, it, vi } from 'vitest';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
  PRODUCTION_PREVIEW_KEYS,
} from '../../campaign/productionPreview.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine } from '../../engine.js';
import { createLevels } from '../../levels.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile, VIEW_H, WORLD_H } from '../constants.js';
import { completeWardenDuel, damageWardenDuelBoss } from '../../warden-duel-state.js';
import { createWardenOfDust } from './wardenOfDust.js';

const identity = {
  levelKey: 'outer-veil-10-warden-of-dust',
  campaignOrder: 10,
  legacyId: 10,
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
    grounded: true, wallSide: 0, climbing: false, hp: 4, invuln: 0,
    coyote: 0, jumpBuffer: 0, dropTimer: 0, attackTimer: 0, attackBuffer: 0,
    attackBufferKind: null, attackKind: null,
    digTimer: 0, attackHits: new Set(), inWater: false,
  };
}

function engineHarness(level) {
  return {
    level,
    repository: { campaignId: 'production-preview-warden-of-dust', sessionKind: 'production-preview', length: 1 },
    levelIndex: 0,
    bank: { get: () => canvasChunks() },
    player: basePlayer(),
    checkpoint: { kind: 'spawn', id: null, ...level.spawn, facing: 1 },
    camera: { x: 0, y: WORLD_H - VIEW_H },
    input: {
      left: false, right: false, climb: false, down: false, jump: false, attack: false, dig: false,
      pressed: new Set(), released: new Set(),
    },
    gateOpen: false,
    particles: [], soldiers: [], projectiles: [], crumble: new Map(),
    mode: 'play', totalTime: 0, levelTime: 0, deaths: 0, levelDeaths: 0, demo: false,
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), levelComplete: vi.fn(), death: vi.fn(), mode: vi.fn() },
    setHint: vi.fn(), pushHud: vi.fn(), burst: vi.fn(),
    setInput: GameEngine.prototype.setInput,
    clearInputs: GameEngine.prototype.clearInputs,
    makePlayer: GameEngine.prototype.makePlayer,
    restartWardenDuelAttempt: GameEngine.prototype.restartWardenDuelAttempt,
    cancelLevelTransition: vi.fn(),
    tileAt: GameEngine.prototype.tileAt,
    isSolidTile: GameEngine.prototype.isSolidTile,
    solidProbe: GameEngine.prototype.solidProbe,
    updatePlayer: GameEngine.prototype.updatePlayer,
    movePlayerHorizontal: GameEngine.prototype.movePlayerHorizontal,
    movePlayerVertical: GameEngine.prototype.movePlayerVertical,
    canMoveBlock: GameEngine.prototype.canMoveBlock,
    recordPilgrimGrip: GameEngine.prototype.recordPilgrimGrip,
    recordPilgrimWallJump: GameEngine.prototype.recordPilgrimWallJump,
    blockOnOathZone: GameEngine.prototype.blockOnOathZone,
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    openGate: GameEngine.prototype.openGate,
    revealMemoryMark: GameEngine.prototype.revealMemoryMark,
    toggleOathbind: GameEngine.prototype.toggleOathbind,
    applyWardenHand: GameEngine.prototype.applyWardenHand,
    updateWardenObjective: GameEngine.prototype.updateWardenObjective,
    beginWardenDuel: GameEngine.prototype.beginWardenDuel,
    updateWardenDuel: GameEngine.prototype.updateWardenDuel,
    regroupWardenDuel: GameEngine.prototype.regroupWardenDuel,
    wardenDuelRecoverySeconds: GameEngine.prototype.wardenDuelRecoverySeconds,
    wardenDuelTelegraphSeconds: GameEngine.prototype.wardenDuelTelegraphSeconds,
    setWardenDuelSeal: GameEngine.prototype.setWardenDuelSeal,
    resolveWardenDuelStrike: GameEngine.prototype.resolveWardenDuelStrike,
    strikeWardenBridle: GameEngine.prototype.strikeWardenBridle,
    completeWarden: GameEngine.prototype.completeWarden,
    damagePlayer: GameEngine.prototype.damagePlayer,
    checkHazards: GameEngine.prototype.checkHazards,
    resolveAttackHits: GameEngine.prototype.resolveAttackHits,
    strikePilgrimBell: vi.fn(),
    checkSanctumReturnFields: vi.fn(() => false),
    armCrumble: vi.fn(),
    armBellTowerCollapseLedge: vi.fn(),
  };
}

function beginDuelHarness() {
  const level = cloneLevel(assertValidAuthoredLevel(createWardenOfDust(), identity));
  const engine = engineHarness(level);
  const objective = level.objective;
  objective.phase = 'unbind';
  objective.breath.firstBreathComplete = true;
  objective.memorySeam.revealed = true;
  objective.heartstone.bound = true;
  objective.heartstone.locked = true;
  objective.rememberedHand.raised = true;
  objective.rememberedHand.reached = true;
  objective.bridle.exposed = true;
  objective.bridle.struck = true;
  level.block.bound = true;
  expect(GameEngine.prototype.beginWardenDuel.call(engine)).toBe(true);
  return { level, engine, objective, duel: objective.duel };
}

describe('Outer Veil Level 10 production preview', () => {
  it('authors the exact guardian identity and a separate pristine duel contract without a fifth unlock', () => {
    const level = assertValidAuthoredLevel(createWardenOfDust(), identity);
    expect(level).toMatchObject({
      id: 10,
      levelKey: identity.levelKey,
      campaignOrder: 10,
      name: 'Warden of Dust',
      subtitle: 'The Guardian We Buried',
      objective: {
        type: 'warden-restoration', phase: 'listen', complete: false, restored: false,
        warden: { id: 'warden-of-dust', state: 'sleeping', kneeling: false, commandBroken: false },
      },
      targetTime: { parSeconds: 210, masterySeconds: 135 },
    });
    expect(level.storyLine).toBe('Beyond the inward seal, the dust rises in the shape of a guardian that still knows Aren’s name.');
    expect(level.objective.requiresAbilities).toEqual(['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke']);
    expect(level.gameplay.assumedAbilities).toEqual(level.objective.requiresAbilities);
    expect(level.abilityUnlock).toBeUndefined();
    expect(level.boss).toBeNull();
    expect(level.objective.warden).not.toHaveProperty('hp');
    expect(level.objective.duel).toMatchObject({
      phase: 'sealed', active: false, complete: false,
      arena: {
        minTx: 46, maxTx: 67, feetTy: 20,
        seal: { leftTx: 45, topTy: 12, bottomTy: 19 },
        checkpoint: { tx: 48, feetTy: 20, facing: 1 },
      },
      boss: {
        maxHp: 48, hp: 48, phase: 'guardian', action: 'idle',
        openingEarned: false, recoveryHits: 0, armored: false, armorBreakReady: false,
      },
      player: {
        comboStep: 0, comboClock: 0, guarding: false, parryClock: 0,
        guardLessonComplete: false,
      },
      attempt: { count: 0, elapsed: 0, damageTaken: 0 },
      totals: { elapsed: 0, damageTaken: 0 },
      finale: { ready: false, struck: false },
    });
    expect(level.checkpoints).toEqual([]);
    expect(level.relics).toEqual([]);
    expect(level.ships).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.map.flat().filter((tile) => tile === Tile.SAND)).toHaveLength(1);
    expect(level.map.slice(12, 20).every((row) => row[68] === Tile.GATE)).toBe(true);
  });

  it('orders harmless breath, carve, correct heartstone, dynamic hand, genuine Grip, and one cyan Dawnstroke', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWardenOfDust(), identity));
    const engine = engineHarness(level);
    const objective = level.objective;
    const seam = objective.memorySeam;
    const zone = objective.heartstone.zone;

    expect(GameEngine.prototype.strikeWardenBridle.call(engine)).toBe(false);
    engine.player.x = 25 * TILE;
    engine.player.y = 26 * TILE - engine.player.h;
    GameEngine.prototype.updateWardenObjective.call(
      engine,
      objective.breath.warningSeconds + objective.breath.activeSeconds - .01,
    );
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(4);
    expect(objective).toMatchObject({ phase: 'listen', breath: { firstBreathComplete: false, strikeCount: 0 } });
    GameEngine.prototype.updateWardenObjective.call(engine, .02);
    expect(objective).toMatchObject({ phase: 'carve', breath: { firstBreathComplete: true, clock: 0 } });

    engine.player.x = seam.tx * TILE - engine.player.w - 7;
    engine.player.y = 26 * TILE - engine.player.h;
    engine.player.facing = 1;
    GameEngine.prototype.dig.call(engine);
    expect(level.map[seam.ty][seam.tx]).toBe(Tile.AIR);
    expect(objective).toMatchObject({ phase: 'anchor', memorySeam: { revealed: true } });

    level.block.x = 32 * TILE;
    level.block.y = 26 * TILE - level.block.h;
    engine.player.x = level.block.x - engine.player.w - 4;
    engine.player.y = level.block.y;
    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(objective).toMatchObject({
      phase: 'anchor',
      heartstone: { bound: false, locked: false },
      rememberedHand: { raised: false },
    });
    expect(level.block.bound).toBe(true);
    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(level.block.bound).toBe(false);

    level.block.x = zone.x + 8;
    level.block.y = 26 * TILE - level.block.h;
    engine.player.x = level.block.x - engine.player.w - 4;
    engine.player.y = level.block.y;
    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(objective).toMatchObject({
      phase: 'ascend',
      heartstone: { bound: true, locked: true },
      rememberedHand: { raised: true, gripJumpRecorded: false, reached: false },
      warden: { state: 'remembering' },
    });
    for (let ty = objective.rememberedHand.rib.topTy + 1; ty <= objective.rememberedHand.rib.bottomTy; ty += 1) {
      expect(level.map[ty][objective.rememberedHand.rib.tx]).toBe(Tile.SAND);
    }

    const landing = objective.rememberedHand.landing;
    engine.player.x = 50 * TILE - engine.player.w / 2;
    engine.player.y = landing.feetTy * TILE - engine.player.h;
    engine.player.grounded = true;
    GameEngine.prototype.updateWardenObjective.call(engine, .1);
    expect(objective).toMatchObject({ phase: 'ascend', rememberedHand: { retryHintShown: true, reached: false } });
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('pass beneath it'), 5.6);

    GameEngine.prototype.recordPilgrimWallJump.call(engine, -1);
    expect(objective.rememberedHand.gripJumpRecorded).toBe(false);
    GameEngine.prototype.recordPilgrimWallJump.call(engine, 1);
    engine.player.grounded = true;
    GameEngine.prototype.updateWardenObjective.call(engine, .1);
    expect(objective).toMatchObject({
      phase: 'unbind',
      rememberedHand: { gripJumpRecorded: true, reached: true },
      bridle: { exposed: true, struck: false, clock: 0 },
      warden: { state: 'bridled' },
    });

    const targetX = objective.bridle.tx * TILE;
    const targetY = objective.bridle.baseTy * TILE - 72;
    engine.player.x = targetX - engine.player.w / 2;
    engine.player.y = targetY - engine.player.h / 2;
    objective.bridle.clock = objective.bridle.guardSeconds - .01;
    expect(GameEngine.prototype.strikeWardenBridle.call(engine)).toBe(false);
    expect(objective.bridle.struck).toBe(false);
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('AMBER GUARD'), 2.6);

    engine.totalTime = 132;
    objective.bridle.clock = objective.bridle.guardSeconds;
    expect(GameEngine.prototype.strikeWardenBridle.call(engine)).toBe(true);
    expect(objective).toMatchObject({
      phase: 'duel', complete: false, restored: false,
      rememberedHand: { restored: true },
      bridle: { struck: true },
      warden: { state: 'commanded', kneeling: false, commandBroken: false },
      crownPath: { restored: true },
      duel: {
        phase: 'guardian', active: true, complete: false,
        boss: { hp: 48, action: 'intro', invulnerable: true },
        attempt: { count: 1, elapsed: 0, damageTaken: 0 },
      },
    });
    expect(objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);
    for (let ty = objective.rememberedHand.rib.topTy + 1; ty <= objective.rememberedHand.rib.bottomTy; ty += 1) {
      expect(level.map[ty][objective.rememberedHand.rib.tx]).toBe(Tile.GLOW);
    }
    expect(engine.checkpoint).toMatchObject({ kind: 'warden-duel', id: 'warden-duel', facing: 1 });
    expect(engine.player).toMatchObject({ hp: 4, facing: 1, grounded: true });
    expect(level.map.slice(12, 20).every((row) => row[45] === Tile.GATE)).toBe(true);
    expect(engine.gateOpen).toBe(false);
    expect(engine.callbacks.gate).not.toHaveBeenCalled();
  });

  it('makes the warned breath cost at most one health per active pulse and honors bound shelter', () => {
    const first = cloneLevel(assertValidAuthoredLevel(createWardenOfDust(), identity));
    const firstEngine = engineHarness(first);
    first.objective.breath.clock = first.objective.breath.warningSeconds + .01;
    firstEngine.player.x = 25 * TILE;
    firstEngine.player.y = 26 * TILE - firstEngine.player.h;
    GameEngine.prototype.checkHazards.call(firstEngine);
    expect(firstEngine.player.hp).toBe(4);
    expect(first.objective.breath.strikeCount).toBe(0);

    const level = cloneLevel(assertValidAuthoredLevel(createWardenOfDust(), identity));
    const engine = engineHarness(level);
    const objective = level.objective;
    objective.phase = 'anchor';
    objective.breath.firstBreathComplete = true;
    objective.memorySeam.revealed = true;
    objective.breath.clock = objective.breath.warningSeconds + .01;
    engine.player.x = 25 * TILE;
    engine.player.y = 26 * TILE - engine.player.h;
    GameEngine.prototype.checkHazards.call(engine);
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(3);
    expect(engine.player.invuln).toBe(.9);
    expect(objective.breath.strikeCount).toBe(1);

    engine.player.invuln = 0;
    level.block.bound = true;
    engine.player.x = level.block.x - TILE;
    engine.player.y = 26 * TILE - engine.player.h;
    GameEngine.prototype.checkHazards.call(engine);
    expect(engine.player.hp).toBe(3);
    expect(objective.breath.strikeCount).toBe(1);
  });

  it('requires the guard lesson and rewards one three-hit chain only in the earned cyan recovery', () => {
    const { engine, duel } = beginDuelHarness();
    const boss = duel.boss;
    const target = boss.target;
    Object.assign(engine.player, {
      x: target.x - 14,
      y: target.y - 22,
      grounded: true,
      invuln: 0,
    });

    boss.action = 'active';
    boss.actionClock = .2;
    boss.attackKind = 'high';
    boss.attackConsumed = false;
    engine.input.down = true;
    engine.input.pressed.add('down');
    expect(engine.updateWardenDuel(.05)).toBe(true);
    expect(engine.player.hp).toBe(4);
    expect(boss).toMatchObject({ action: 'recovery', attackConsumed: true, invulnerable: false });
    expect(duel.player.guardLessonComplete).toBe(true);
    expect(boss.actionClock).toBeGreaterThan(duel.timing.guardianRecovery);

    boss.action = 'telegraph';
    boss.actionClock = .5;
    boss.invulnerable = true;
    engine.player.attackHits.clear();
    expect(engine.resolveWardenDuelStrike()).toBe(false);
    expect(boss).toMatchObject({ action: 'telegraph', invulnerable: true });
    expect(boss.hp).toBe(48);

    boss.action = 'recovery';
    boss.actionClock = duel.timing.guardianRecovery;
    boss.invulnerable = false;
    engine.input.down = false;
    for (const expectedHp of [47, 46, 44]) {
      engine.player.attackHits.clear();
      expect(engine.resolveWardenDuelStrike()).toBe(true);
      expect(boss.hp).toBe(expectedHp);
    }
    expect(boss).toMatchObject({ action: 'regroup', invulnerable: true, recoveryHits: 0 });
    expect(duel.player).toMatchObject({ comboStep: 0, comboClock: 0 });
  });

  it('makes the Command armour require a clean sand-wave evade and one heavy break without damage or stun-lock', () => {
    const { engine, duel } = beginDuelHarness();
    const boss = duel.boss;
    const target = boss.target;
    boss.invulnerable = false;
    expect(damageWardenDuelBoss(duel, 16)).toBe(true);
    expect(boss).toMatchObject({ hp: 32, phase: 'command', action: 'intro', armored: true });
    Object.assign(engine.player, {
      x: target.x - 14,
      y: duel.arena.feetTy * TILE - engine.player.h - 24,
      grounded: false,
      invuln: 0,
      attackKind: 'heavy',
    });
    boss.action = 'active';
    boss.actionClock = .01;
    boss.attackKind = 'sand-wave';
    boss.attackConsumed = false;
    expect(engine.updateWardenDuel(.02)).toBe(true);
    expect(boss).toMatchObject({ action: 'recovery', armored: true, armorBreakReady: true, invulnerable: false });

    engine.player.grounded = true;
    engine.input.down = true;
    engine.player.attackHits.clear();
    expect(engine.resolveWardenDuelStrike()).toBe(true);
    expect(boss).toMatchObject({ hp: 32, action: 'regroup', armored: false, armorBreakReady: false, invulnerable: true });

    engine.player.attackHits.clear();
    expect(engine.resolveWardenDuelStrike()).toBe(false);
    expect(boss.hp).toBe(32);
  });

  it('buffers an early heavy press and preserves its intent after Down is released', () => {
    const { engine, duel } = beginDuelHarness();
    const boss = duel.boss;
    Object.assign(engine.player, {
      x: boss.target.x - 14,
      y: duel.arena.feetTy * TILE - engine.player.h,
      grounded: true,
      invuln: 0,
      attackTimer: .09,
    });
    boss.action = 'recovery';
    boss.actionClock = duel.timing.guardianRecovery;
    boss.invulnerable = false;
    engine.setInput('down', true);
    engine.setInput('attack', true);
    engine.updatePlayer(1 / 60);
    expect(engine.player).toMatchObject({ attackBufferKind: 'heavy' });
    expect(engine.player.attackBuffer).toBeGreaterThan(0);
    expect(boss.hp).toBe(48);

    engine.input.pressed.clear();
    engine.setInput('attack', false);
    engine.setInput('down', false);
    for (let frame = 0; frame < 7; frame += 1) {
      engine.updateWardenDuel(1 / 60);
      engine.updatePlayer(1 / 60);
      engine.input.pressed.clear();
      engine.input.released.clear();
    }
    expect(engine.player.attackKind).toBe('heavy');
    expect(boss).toMatchObject({ hp: 46, action: 'regroup', invulnerable: true });
  });

  it.each(['high', 'sweep', 'sand-wave'])('lets one %s active window damage the hero only once', (attackKind) => {
    const { engine, duel } = beginDuelHarness();
    const boss = duel.boss;
    Object.assign(engine.player, {
      x: boss.target.x - 14,
      y: duel.arena.feetTy * TILE - engine.player.h,
      grounded: true,
      invuln: 0,
    });
    boss.action = 'active';
    boss.actionClock = .2;
    boss.attackKind = attackKind;
    boss.attackConsumed = false;
    engine.input.down = false;
    engine.updateWardenDuel(.01);
    expect(engine.player.hp).toBe(3);
    expect(boss.attackConsumed).toBe(true);
    engine.player.invuln = 0;
    engine.updateWardenDuel(.25);
    expect(engine.player.hp).toBe(3);
    expect(boss).toMatchObject({ action: 'regroup', invulnerable: true, openingEarned: false });
  });

  it('keeps DOWN as guard on the one-way arena and fits three separate touch-like strikes inside every recovery', () => {
    const { engine, duel } = beginDuelHarness();
    const boss = duel.boss;
    const target = boss.target;
    Object.assign(engine.player, {
      x: target.x - 14,
      y: duel.arena.feetTy * TILE - engine.player.h,
      grounded: true,
      invuln: 0,
    });
    boss.action = 'recovery';
    boss.hp = 16;
    boss.actionClock = duel.timing.eclipseRecovery;
    boss.phase = 'eclipse';
    boss.invulnerable = false;
    duel.phase = 'eclipse';

    engine.setInput('down', true);
    engine.updateWardenDuel(1 / 60);
    engine.updatePlayer(1 / 60);
    expect(engine.player).toMatchObject({
      y: duel.arena.feetTy * TILE - engine.player.h,
      grounded: true,
      dropTimer: 0,
    });
    engine.setInput('down', false);
    engine.input.pressed.clear();
    engine.input.released.clear();

    for (let strike = 0; strike < 3; strike += 1) {
      engine.setInput('attack', true);
      engine.updatePlayer(1 / 60);
      engine.input.pressed.clear();
      engine.setInput('attack', false);
      engine.input.released.clear();
      if (strike >= 2) continue;
      for (let frame = 0; frame < 20; frame += 1) {
        engine.updateWardenDuel(1 / 60);
        engine.updatePlayer(1 / 60);
        engine.input.pressed.clear();
        engine.input.released.clear();
      }
    }

    expect(boss.hp).toBe(12);
    expect(boss.action).toBe('regroup');
    expect(duel.player).toMatchObject({ comboStep: 0, comboClock: 0 });
  });

  it('keeps the arena sealed until Dawnstroke, then restarts only the duel after a fatal attempt', () => {
    const { level, engine, objective, duel } = beginDuelHarness();
    engine.player.invuln = 0;
    GameEngine.prototype.damagePlayer.call(engine, 4, -390);
    expect(engine).toMatchObject({ mode: 'dead', deaths: 1, gateOpen: false });
    expect(duel).toMatchObject({
      attempt: { count: 1, damageTaken: 4 },
      totals: { damageTaken: 4 },
      boss: { hp: 48 },
    });

    GameEngine.prototype.respawn.call(engine);
    expect(engine).toMatchObject({ mode: 'play', deaths: 1, gateOpen: false });
    expect(objective).toMatchObject({
      phase: 'duel', complete: false,
      memorySeam: { revealed: true },
      heartstone: { locked: true },
      rememberedHand: { reached: true, restored: true },
      crownPath: { restored: true },
      duel: {
        active: true, phase: 'guardian',
        boss: { hp: 48, action: 'intro' },
        attempt: { count: 2, elapsed: 0, damageTaken: 0 },
        totals: { damageTaken: 4 },
      },
    });
    expect(level.map[objective.restorationTiles[0].ty][objective.restorationTiles[0].tx]).toBe(Tile.GLOW);

    const target = duel.boss.target;
    Object.assign(engine.player, {
      x: target.x - 14,
      y: target.y - 22,
      grounded: true,
      invuln: 0,
    });
    duel.boss.hp = 1;
    duel.boss.phase = 'eclipse';
    duel.phase = 'eclipse';
    duel.boss.action = 'recovery';
    duel.boss.invulnerable = false;
    engine.player.attackHits.clear();
    expect(engine.resolveWardenDuelStrike()).toBe(true);
    expect(objective).toMatchObject({ phase: 'finale', complete: false });
    expect(duel).toMatchObject({ phase: 'finale', active: true, complete: false, finale: { ready: true, struck: false } });
    expect(engine.gateOpen).toBe(false);

    engine.player.invuln = 0;
    GameEngine.prototype.damagePlayer.call(engine, 4, -390);
    GameEngine.prototype.respawn.call(engine);
    expect(engine).toMatchObject({ mode: 'play', deaths: 2, gateOpen: false });
    expect(objective).toMatchObject({
      phase: 'duel', complete: false,
      duel: {
        phase: 'guardian', active: true, complete: false,
        boss: { hp: 48, action: 'intro' },
        attempt: { count: 3 },
        finale: { ready: false, struck: false },
      },
    });

    Object.assign(engine.player, {
      x: target.x - 14,
      y: target.y - 22,
      grounded: true,
      invuln: 0,
    });
    duel.boss.hp = 1;
    duel.boss.phase = 'eclipse';
    duel.phase = 'eclipse';
    duel.boss.action = 'recovery';
    duel.boss.invulnerable = false;
    engine.player.attackHits.clear();
    expect(engine.resolveWardenDuelStrike()).toBe(true);
    engine.player.attackHits.clear();
    expect(engine.resolveWardenDuelStrike()).toBe(true);
    expect(objective).toMatchObject({
      phase: 'first-path', complete: true, restored: true,
      warden: { state: 'kneeling', commandBroken: true },
      duel: { phase: 'complete', active: false, complete: true, finale: { ready: true, struck: true } },
    });
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    expect(level.map.slice(12, 20).every((row) => row[45] === Tile.AIR)).toBe(true);
  });

  it('emits the exact isolated preview identity and ending at the restored door', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createWardenOfDust(), identity));
    const engine = engineHarness(level);
    const objective = level.objective;
    objective.breath.firstBreathComplete = true;
    objective.memorySeam.revealed = true;
    objective.heartstone.bound = true;
    objective.heartstone.locked = true;
    objective.rememberedHand.raised = true;
    objective.rememberedHand.reached = true;
    objective.bridle.struck = true;
    objective.duel.active = true;
    objective.duel.attempt.count = 2;
    objective.duel.totals.elapsed = 88;
    objective.duel.totals.damageTaken = 7;
    objective.duel.boss.invulnerable = false;
    expect(damageWardenDuelBoss(objective.duel, objective.duel.boss.maxHp)).toBe(true);
    expect(completeWardenDuel(objective.duel)).toBe(true);
    engine.totalTime = 132;
    expect(GameEngine.prototype.completeWarden.call(engine)).toBe(true);
    engine.player.x = level.door.x + 20;
    engine.player.y = level.door.y + 20;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 132,
      deaths: 0,
      levelDeaths: 0,
      completionStats: {
        provenance: 'live-run-v1', attempts: 2, damageTaken: 7, combatTimeSeconds: 88,
      },
      campaignId: 'production-preview-warden-of-dust',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 210, masterySeconds: 135 },
      levelKey: identity.levelKey,
      campaignOrder: 10,
      objectiveType: 'warden-restoration',
    });
    expect(engine.callbacks.levelComplete).toHaveBeenCalledWith(expect.objectContaining({
      levelKey: identity.levelKey,
      realmComplete: true,
      levelDeaths: 0,
      completionStats: {
        provenance: 'live-run-v1', attempts: 2, damageTaken: 7, combatTimeSeconds: 88,
      },
    }));
  });

  it('deep-clones preview state and reforms the complete transformation after life-over', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toContain('warden-of-dust');
    const preview = createProductionPreviewRepository('warden-of-dust');
    const template = await preview.loadTemplate(0);
    const runtimeA = preview.createRuntime(0);
    const runtimeB = preview.createRuntime(0);
    runtimeA.objective.breath.firstBreathComplete = true;
    runtimeA.objective.memorySeam.revealed = true;
    runtimeA.objective.heartstone.zone.x += TILE;
    runtimeA.objective.rememberedHand.landing.minTx += 1;
    runtimeA.objective.bridle.struck = true;
    runtimeA.objective.duel.phase = 'eclipse';
    runtimeA.objective.duel.active = true;
    runtimeA.objective.duel.complete = true;
    runtimeA.objective.duel.boss.hp = 1;
    runtimeA.objective.duel.boss.action = 'sand-wave';
    runtimeA.objective.duel.player.comboStep = 3;
    runtimeA.objective.duel.player.guarding = true;
    runtimeA.objective.duel.attempt.count = 4;
    runtimeA.objective.duel.attempt.elapsed = 44;
    runtimeA.objective.duel.attempt.damageTaken = 3;
    runtimeA.objective.duel.totals.elapsed = 88;
    runtimeA.objective.duel.totals.damageTaken = 7;
    runtimeA.objective.duel.finale.ready = true;
    runtimeA.objective.duel.finale.struck = true;
    runtimeA.objective.warden.kneeling = true;
    runtimeA.objective.restorationTiles[0].tile = Tile.AIR;
    runtimeA.map[25][22] = Tile.AIR;
    expect(runtimeB.objective.breath.firstBreathComplete).toBe(false);
    expect(runtimeB.objective.memorySeam.revealed).toBe(false);
    expect(runtimeB.objective.heartstone.zone.x).toBe(template.objective.heartstone.zone.x);
    expect(runtimeB.objective.rememberedHand.landing.minTx).toBe(template.objective.rememberedHand.landing.minTx);
    expect(runtimeB.objective.bridle.struck).toBe(false);
    expect(runtimeB.objective.duel).toMatchObject({
      phase: 'sealed', active: false, complete: false,
      boss: { hp: 48, phase: 'guardian', action: 'idle' },
      player: { comboStep: 0, guarding: false },
      attempt: { count: 0, elapsed: 0, damageTaken: 0 },
      totals: { elapsed: 0, damageTaken: 0 },
      finale: { ready: false, struck: false },
    });
    expect(runtimeB.objective.warden.kneeling).toBe(false);
    expect(runtimeB.objective.restorationTiles[0].tile).toBe(Tile.GLOW);
    expect(runtimeB.map[25][22]).toBe(Tile.SAND);

    runtimeA.objective.phase = 'first-path';
    runtimeA.objective.complete = true;
    runtimeA.objective.restored = true;
    runtimeA.objective.heartstone.bound = true;
    runtimeA.objective.heartstone.locked = true;
    runtimeA.objective.rememberedHand.gripJumpRecorded = true;
    runtimeA.objective.rememberedHand.reached = true;
    runtimeA.objective.rememberedHand.retryHintShown = true;
    runtimeA.objective.rememberedHand.raised = true;
    runtimeA.objective.rememberedHand.restored = true;
    runtimeA.objective.bridle.exposed = true;
    runtimeA.objective.bridle.clock = 9;
    runtimeA.objective.warden.state = 'kneeling';
    runtimeA.objective.warden.commandBroken = true;
    runtimeA.objective.crownPath.restored = true;
    runtimeA.block.bound = true;
    const rib = runtimeA.objective.rememberedHand.rib;
    for (let ty = rib.topTy + 1; ty <= rib.bottomTy; ty += 1) runtimeA.map[ty][rib.tx] = Tile.GLOW;
    for (const restoration of runtimeA.objective.restorationTiles) runtimeA.map[restoration.ty][restoration.tx] = Tile.GLOW;
    for (let ty = 12; ty < 20; ty += 1) runtimeA.map[ty][runtimeA.gateColumn] = Tile.AIR;

    const engine = {
      levelIndex: 0, level: runtimeA, totalTime: 88, deaths: 2,
      soldiers: [{}], projectiles: [{}], particles: [{}],
      repository: { createRuntime: vi.fn(() => preview.createRuntime(0)) },
      restartWardenDuelAttempt: GameEngine.prototype.restartWardenDuelAttempt,
      cancelLevelTransition: vi.fn(), loadLevel: vi.fn(), clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() }, setHint: vi.fn(), pushHud: vi.fn(),
    };
    engine.loadLevel.mockImplementation(() => {
      engine.level = engine.repository.createRuntime(0);
      engine.soldiers = [];
      engine.projectiles = [];
      engine.particles = [];
      engine.gateOpen = false;
      engine.player = GameEngine.prototype.makePlayer.call(engine, engine.level.spawn);
    });
    GameEngine.prototype.respawn.call(engine);
    expect(engine.level.objective).toMatchObject({
      phase: 'listen', complete: false, restored: false,
      breath: { clock: 0, firstBreathComplete: false, strikeCount: 0 },
      memorySeam: { revealed: false },
      heartstone: { bound: false, locked: false },
      rememberedHand: {
        gripJumpRecorded: false, reached: false, retryHintShown: false,
        raised: false, restored: false,
      },
      bridle: { exposed: false, struck: false, clock: 0 },
      duel: {
        phase: 'sealed', active: false, complete: false,
        boss: { hp: 48, phase: 'guardian', action: 'idle' },
        player: { comboStep: 0, guarding: false },
        attempt: { count: 0, elapsed: 0, damageTaken: 0 },
        totals: { elapsed: 0, damageTaken: 0 },
        finale: { ready: false, struck: false },
      },
      warden: { state: 'sleeping', kneeling: false, commandBroken: false },
      crownPath: { restored: false },
    });
    expect(engine.level.block.bound).toBe(false);
    expect(engine.level.map[25][22]).toBe(Tile.SAND);
    expect(engine.level.map[21][55]).toBe(Tile.AIR);
    expect(engine.level.map.slice(12, 20).some((row) => row[68] === Tile.GATE)).toBe(true);
    expect(engine.soldiers).toEqual([]);
    expect(engine.projectiles).toEqual([]);
    expect(engine.player.hp).toBe(4);

    expect(preview.campaignId).toBe('production-preview-warden-of-dust');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(getProductionPreviewDescriptor('warden-of-dust').completion).toEqual({
      eyebrow: 'The first Crown Path returns',
      heading: 'The guardian chooses a road',
      body: 'Aren frees the Warden from Serath’s inverted command. It does not die; it carries one narrow current of the unreturned toward Orun while the deeper archive remains sealed.',
    });
    expect(createLevels()[9].name).toBe('Throne of the Eclipse');
  });

  it('rejects a fifth unlock, unreadable breath, ambiguous vow, unsafe hand, contaminated route, and broken restoration', () => {
    const broken = createWardenOfDust();
    broken.id = 9;
    broken.abilityUnlock = { key: 'fifth', name: 'Fifth', input: 'Q', description: 'No.' };
    broken.objective.requiresAbilities.push('fifth');
    broken.objective.breath.warningSeconds = .1;
    broken.map[25][23] = Tile.SAND;
    broken.objective.heartstone.zone.w = 10;
    broken.map[20][46] = Tile.AIR;
    broken.objective.bridle.guardSeconds = .1;
    broken.objective.duel.boss.hp = 1;
    broken.objective.duel.arena.checkpoint.tx = broken.objective.duel.arena.maxTx;
    broken.objective.warden.w = TILE;
    broken.objective.restorationTiles.pop();
    broken.boss = { hp: 1 };
    broken.gameplay.enemyRoster.push('shield');
    broken.map[12][68] = Tile.AIR;
    broken.map[26][35] = Tile.AIR;
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'legacy_id_mismatch',
      'invalid_warden_abilities',
      'invalid_warden_breath',
      'ambiguous_warden_memory',
      'invalid_warden_heartstone',
      'unsafe_warden_landing',
      'invalid_warden_bridle',
      'invalid_warden_duel',
      'invalid_warden_identity',
      'unsafe_warden_restoration',
      'warden_route_contamination',
      'invalid_warden_gate',
      'unsafe_warden_floor',
    ]));
  });
});
