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
import { TILE, Tile, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from '../constants.js';
import { createFirstSanctum } from './firstSanctum.js';

const identity = {
  levelKey: 'outer-veil-07-first-sanctum',
  campaignOrder: 7,
  legacyId: 7,
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
  const harness = {
    level,
    repository: { campaignId: 'production-preview-first-sanctum', sessionKind: 'production-preview', length: 1 },
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
    particles: [], soldiers: [], projectiles: [],
    crumble: new Map(),
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), mode: vi.fn() },
    setHint: vi.fn(), pushHud: vi.fn(), burst: vi.fn(),
    clearInputs: GameEngine.prototype.clearInputs,
    makePlayer: GameEngine.prototype.makePlayer,
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
    activateSanctumLamp: GameEngine.prototype.activateSanctumLamp,
    openSanctumArch: GameEngine.prototype.openSanctumArch,
    returnToSanctum: GameEngine.prototype.returnToSanctum,
    checkSanctumReturnFields: GameEngine.prototype.checkSanctumReturnFields,
    updateSanctumObjective: GameEngine.prototype.updateSanctumObjective,
    openGate: GameEngine.prototype.openGate,
    checkHazards: vi.fn(), resolveAttackHits: vi.fn(), armCrumble: vi.fn(), armBellTowerCollapseLedge: vi.fn(),
    totalTime: 0, deaths: 0, mode: 'play',
  };
  return harness;
}

function standInZone(engine, zone) {
  engine.player.x = zone.minTx * TILE;
  engine.player.y = zone.feetTy * TILE - engine.player.h;
  engine.player.vx = 0;
  engine.player.vy = 0;
  engine.player.grounded = true;
}

function bindLamp(engine) {
  const lamp = engine.level.objective.lamp;
  engine.player.x = lamp.tx * TILE - engine.player.w / 2;
  engine.player.y = lamp.baseTy * TILE - engine.player.h;
  engine.player.grounded = true;
  expect(GameEngine.prototype.activateSanctumLamp.call(engine)).toBe(true);
}

function openArch(engine) {
  const objective = engine.level.objective;
  GameEngine.prototype.recordPilgrimWallJump.call(engine, objective.arch.requiredWallSide);
  standInZone(engine, objective.arch.landing);
  GameEngine.prototype.updateSanctumObjective.call(engine);
}

describe('Outer Veil Level 7 production preview', () => {
  it('authors one non-combat lamp, return anchor, grip arch, witness, and westward sanctuary payoff', () => {
    const level = assertValidAuthoredLevel(createFirstSanctum(), identity);
    expect(level).toMatchObject({
      id: 7,
      levelKey: identity.levelKey,
      campaignOrder: 7,
      abilityUnlock: { key: 'sanctum-recall', name: 'Sanctum Recall' },
      objective: {
        type: 'sanctum-lamp-restoration', requiresAbility: 'oathbind', phase: 'find',
        returnCount: 0, returnProven: false, complete: false, restored: false,
      },
      targetTime: { parSeconds: 180, masterySeconds: 105 },
    });
    expect(level.checkpoints).toEqual([]);
    expect(level.relics).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.map.flat()).not.toContain(Tile.SPIKE);
    expect(level.map.flat()).not.toContain(Tile.CRUMBLE);
    expect(level.map.flat()).not.toContain(Tile.SAND);
    expect(level.objective.returnFields.filter((field) => field.role === 'return')).toHaveLength(1);
  });

  it('binds only from grounded lamp range and records the exact in-run checkpoint', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    engine.player.x = 2 * TILE;
    engine.player.y = 26 * TILE - engine.player.h;
    engine.player.grounded = true;
    expect(GameEngine.prototype.activateSanctumLamp.call(engine)).toBe(false);

    const lamp = level.objective.lamp;
    engine.player.x = lamp.tx * TILE - engine.player.w / 2;
    engine.player.y = lamp.baseTy * TILE - engine.player.h - 20;
    engine.player.grounded = false;
    expect(GameEngine.prototype.activateSanctumLamp.call(engine)).toBe(true);
    expect(lamp.bound).toBe(false);

    engine.player.y = lamp.baseTy * TILE - engine.player.h;
    engine.player.grounded = true;
    expect(GameEngine.prototype.activateSanctumLamp.call(engine)).toBe(true);
    expect(level.objective).toMatchObject({ phase: 'outward', lamp: { bound: true, boundAt: 0 } });
    expect(engine.checkpoint).toEqual({
      kind: 'sanctum-lamp',
      id: lamp.checkpoint.id,
      x: lamp.checkpoint.x,
      y: lamp.checkpoint.y,
      facing: lamp.checkpoint.facing,
    });
    GameEngine.prototype.activateSanctumLamp.call(engine);
    expect(engine.audio.play).toHaveBeenCalledTimes(1);
  });

  it('returns an early unbound fall to realm spawn without inventing checkpoint progress', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    const field = level.objective.returnFields[0];
    engine.player.x = field.x + 8;
    engine.player.y = field.y + 8;
    engine.player.hp = 3;
    engine.totalTime = 19;
    expect(GameEngine.prototype.checkSanctumReturnFields.call(engine)).toBe(true);
    expect(engine.player).toMatchObject({ x: level.spawn.x, y: level.spawn.y, hp: 3, vx: 0, vy: 0 });
    expect(level.objective).toMatchObject({ phase: 'find', returnCount: 0, returnProven: false });
    expect(engine.deaths).toBe(0);
  });

  it('arms each mist well below the floor line so a valid takeoff is never recalled', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    const fields = level.objective.returnFields.filter((field) => field.role === 'fall');
    expect(fields.every((field) => field.y > 26 * TILE)).toBe(true);

    const field = fields[1];
    engine.player.x = field.x - engine.player.w + 1;
    engine.player.y = 26 * TILE - engine.player.h;
    engine.player.grounded = true;
    expect(GameEngine.prototype.checkSanctumReturnFields.call(engine)).toBe(false);

    engine.player.y = field.y;
    expect(GameEngine.prototype.checkSanctumReturnFields.call(engine)).toBe(true);
  });

  it('makes mist recall atomic, non-damaging, camera-safe, and state-preserving after the lamp is bound', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    bindLamp(engine);
    level.objective.arch.gripJumpRecorded = true;
    engine.player.hp = 3;
    engine.player.vx = 280;
    engine.player.vy = 600;
    engine.input.right = true;
    engine.input.jump = true;
    engine.particles.push({});
    engine.projectiles.push({});
    engine.crumble.set('x', {});
    engine.totalTime = 44;
    engine.deaths = 2;
    const field = level.objective.returnFields[1];

    GameEngine.prototype.returnToSanctum.call(engine, field);

    expect(engine.player).toMatchObject({
      x: level.objective.lamp.checkpoint.x,
      y: level.objective.lamp.checkpoint.y,
      hp: 3, vx: 0, vy: 0, invuln: .6,
    });
    expect(level.objective).toMatchObject({
      phase: 'outward', returnCount: 1, lastReturnId: field.id,
      returnProven: false, arch: { gripJumpRecorded: true }, lamp: { bound: true },
    });
    expect(engine.totalTime).toBe(44);
    expect(engine.deaths).toBe(2);
    expect(engine.input.right).toBe(false);
    expect(engine.input.jump).toBe(false);
    expect(engine.particles).toEqual([]);
    expect(engine.projectiles).toEqual([]);
    expect(engine.crumble.size).toBe(0);
    expect(engine.camera.x).toBe(Math.max(0, Math.min(WORLD_W - VIEW_W, engine.player.x - VIEW_W * .4)));
  });

  it('requires a real right-wall spring and broad landing before opening the low arch', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    bindLamp(engine);
    standInZone(engine, level.objective.arch.landing);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(level.objective.arch.open).toBe(false);

    engine.player.x = 43 * TILE - engine.player.w;
    engine.player.y = 23 * TILE;
    engine.player.vy = 180;
    engine.player.grounded = false;
    engine.input.right = true;
    engine.input.climb = true;
    engine.input.jump = true;
    engine.input.pressed.add('jump');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(engine.player.vx).toBeLessThan(0);
    expect(engine.player.vy).toBeLessThan(-PHYSICS.WALL_SLIDE);
    expect(level.objective.arch.gripJumpRecorded).toBe(true);

    standInZone(engine, level.objective.arch.landing);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(level.objective.arch.open).toBe(true);
    for (const cell of level.objective.arch.openCells) expect(level.map[cell.ty][cell.tx]).toBe(Tile.AIR);
  });

  it('vetoes the witness before the arch and requires mist to carry its truth home', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    bindLamp(engine);
    standInZone(engine, level.objective.witness.zone);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(level.objective.witness.reached).toBe(false);

    openArch(engine);
    standInZone(engine, level.objective.witness.zone);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(level.objective).toMatchObject({ phase: 'return', witness: { reached: true } });
    standInZone(engine, level.objective.finalZone);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(level.objective.complete).toBe(false);

    const portal = level.objective.returnFields.find((field) => field.role === 'return');
    GameEngine.prototype.returnToSanctum.call(engine, portal);
    expect(level.objective).toMatchObject({
      phase: 'sanctum', returnProven: true, returnCount: 1,
      canopy: { restored: true },
    });
    expect(level.objective.lightColumns.every((column) => column.lit)).toBe(true);
  });

  it('completes once on the westward return and emits exact preview identity at the door', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createFirstSanctum(), identity));
    const engine = engineHarness(level);
    bindLamp(engine);
    openArch(engine);
    standInZone(engine, level.objective.witness.zone);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    const portal = level.objective.returnFields.find((field) => field.role === 'return');
    GameEngine.prototype.returnToSanctum.call(engine, portal);
    standInZone(engine, level.objective.finalZone);
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(level.objective).toMatchObject({ phase: 'complete', complete: true, restored: true });
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    GameEngine.prototype.updateSanctumObjective.call(engine);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();

    engine.totalTime = 106;
    engine.player.x = level.door.x + 20;
    engine.player.y = level.door.y + 20;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 106,
      deaths: 0,
      campaignId: 'production-preview-first-sanctum',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 180, masterySeconds: 105 },
      levelKey: identity.levelKey,
      campaignOrder: 7,
      objectiveType: 'sanctum-lamp-restoration',
    });
  });

  it('fully extinguishes the lamp and reforms every route after life-over restart', () => {
    const template = assertValidAuthoredLevel(createFirstSanctum(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.lamp.bound = true;
    runtime.objective.arch.gripJumpRecorded = true;
    runtime.objective.arch.open = true;
    runtime.objective.arch.openCells.forEach((cell) => { runtime.map[cell.ty][cell.tx] = Tile.AIR; });
    runtime.objective.witness.reached = true;
    runtime.objective.returnCount = 3;
    runtime.objective.returnProven = true;
    runtime.objective.canopy.restored = true;
    runtime.objective.lightColumns.forEach((column) => { column.lit = true; });
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    const engine = {
      levelIndex: 0, level: runtime, totalTime: 92, deaths: 4,
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
      cancelLevelTransition: vi.fn(), loadLevel: vi.fn(), clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() }, setHint: vi.fn(), pushHud: vi.fn(),
    };
    engine.loadLevel.mockImplementation(() => {
      engine.level = engine.repository.createRuntime(0);
      engine.gateOpen = false;
      engine.player = basePlayer();
      engine.checkpoint = { kind: 'spawn', id: null, ...engine.level.spawn, facing: 1 };
    });

    GameEngine.prototype.respawn.call(engine);

    expect(engine.level.objective).toMatchObject({
      phase: 'find', returnCount: 0, lastReturnId: null, returnProven: false,
      lamp: { bound: false, boundAt: null },
      arch: { gripJumpRecorded: false, open: false },
      witness: { reached: false, reachedAt: null },
      canopy: { restored: false }, complete: false, restored: false,
    });
    expect(engine.level.objective.lightColumns.every((column) => !column.lit)).toBe(true);
    for (const cell of engine.level.objective.arch.openCells) expect(engine.level.map[cell.ty][cell.tx]).toBe(Tile.STONE);
    expect(engine.checkpoint).toMatchObject({ kind: 'spawn', x: template.spawn.x, y: template.spawn.y });
    expect(engine.totalTime).toBe(92);
    expect(engine.deaths).toBe(4);
  });

  it('keeps named preview identity, ending, mutable state, and prototype Level 7 independent', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toContain('first-sanctum');
    const preview = createProductionPreviewRepository('first-sanctum');
    const first = await preview.loadTemplate(0);
    const runtimeA = preview.createRuntime(0);
    const runtimeB = preview.createRuntime(0);
    runtimeA.objective.lamp.bound = true;
    expect(runtimeB.objective.lamp.bound).toBe(false);
    expect(preview.campaignId).toBe('production-preview-first-sanctum');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(first.name).toBe('The First Sanctum');
    expect(getProductionPreviewDescriptor('first-sanctum').completion).toEqual({
      eyebrow: 'Mira’s first lamp endures',
      heading: 'The sanctum remembers Aren',
      body: 'Aren restores the lamp with a truth the Crown buried. Mira binds its light to his return, and the dark can no longer erase the path home.',
    });
    expect(createLevels()[6].name).toBe('Observatory of Mirrors');
  });

  it('rejects unsafe identity, lamp, anchor, mist coverage, arch, target, and combat contamination', () => {
    const broken = createFirstSanctum();
    broken.id = 6;
    broken.abilityUnlock.key = 'ordinary-checkpoint';
    broken.objective.requiresAbility = 'memory-carve';
    broken.objective.lamp.checkpoint.y = -2;
    broken.objective.arch.openCells[0].tile = Tile.GLOW;
    broken.objective.returnFields[1].id = broken.objective.returnFields[0].id;
    broken.objective.returnFields[0].w -= TILE;
    broken.targetTime.masterySeconds = broken.targetTime.parSeconds;
    broken.gameplay.enemyRoster = ['shade'];
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'legacy_id_mismatch',
      'invalid_sanctum_recall',
      'invalid_sanctum_ability',
      'invalid_sanctum_lamp',
      'invalid_sanctum_arch',
      'invalid_return_field',
      'uncovered_sanctum_pit',
      'invalid_target_time',
      'sanctum_route_contamination',
    ]));
  });
});
