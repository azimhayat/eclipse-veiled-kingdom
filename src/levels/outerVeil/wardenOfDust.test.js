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
    mode: 'play', totalTime: 0, deaths: 0, demo: false,
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), death: vi.fn(), mode: vi.fn() },
    setHint: vi.fn(), pushHud: vi.fn(), burst: vi.fn(),
    clearInputs: GameEngine.prototype.clearInputs,
    makePlayer: GameEngine.prototype.makePlayer,
    tileAt: GameEngine.prototype.tileAt,
    isSolidTile: GameEngine.prototype.isSolidTile,
    solidProbe: GameEngine.prototype.solidProbe,
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
    strikeWardenBridle: GameEngine.prototype.strikeWardenBridle,
    completeWarden: GameEngine.prototype.completeWarden,
    damagePlayer: GameEngine.prototype.damagePlayer,
    strikePilgrimBell: vi.fn(),
    checkSanctumReturnFields: vi.fn(() => false),
    armCrumble: vi.fn(),
    armBellTowerCollapseLedge: vi.fn(),
  };
}

describe('Outer Veil Level 10 production preview', () => {
  it('authors the exact guardian identity as one four-ability objective, not a boss or fifth unlock', () => {
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
      phase: 'first-path', complete: true, restored: true, completedAt: 132,
      rememberedHand: { restored: true },
      bridle: { struck: true },
      warden: { state: 'kneeling', kneeling: true, commandBroken: true },
      crownPath: { restored: true },
    });
    expect(objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);
    for (let ty = objective.rememberedHand.rib.topTy + 1; ty <= objective.rememberedHand.rib.bottomTy; ty += 1) {
      expect(level.map[ty][objective.rememberedHand.rib.tx]).toBe(Tile.GLOW);
    }
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
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
    engine.totalTime = 132;
    expect(GameEngine.prototype.completeWarden.call(engine)).toBe(true);
    engine.player.x = level.door.x + 20;
    engine.player.y = level.door.y + 20;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 132,
      deaths: 0,
      campaignId: 'production-preview-warden-of-dust',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 210, masterySeconds: 135 },
      levelKey: identity.levelKey,
      campaignOrder: 10,
      objectiveType: 'warden-restoration',
    });
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
    runtimeA.objective.warden.kneeling = true;
    runtimeA.objective.restorationTiles[0].tile = Tile.AIR;
    runtimeA.map[25][22] = Tile.AIR;
    expect(runtimeB.objective.breath.firstBreathComplete).toBe(false);
    expect(runtimeB.objective.memorySeam.revealed).toBe(false);
    expect(runtimeB.objective.heartstone.zone.x).toBe(template.objective.heartstone.zone.x);
    expect(runtimeB.objective.rememberedHand.landing.minTx).toBe(template.objective.rememberedHand.landing.minTx);
    expect(runtimeB.objective.bridle.struck).toBe(false);
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
      'invalid_warden_identity',
      'unsafe_warden_restoration',
      'warden_route_contamination',
      'invalid_warden_gate',
      'unsafe_warden_floor',
    ]));
  });
});
