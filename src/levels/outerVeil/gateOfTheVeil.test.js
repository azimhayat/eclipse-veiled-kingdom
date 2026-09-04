import { describe, expect, it, vi } from 'vitest';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
  PRODUCTION_PREVIEW_KEYS,
} from '../../campaign/productionPreview.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine } from '../../engine.js';
import { advanceCombatTimeline, createPlayerCombatTimeline } from '../../combat-presentation.js';
import { createLevels } from '../../levels.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile, VIEW_H, WORLD_H } from '../constants.js';
import { createGateOfTheVeil } from './gateOfTheVeil.js';

const identity = {
  levelKey: 'outer-veil-09-gate-of-the-veil',
  campaignOrder: 9,
  legacyId: 9,
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
    repository: { campaignId: 'production-preview-gate-of-the-veil', sessionKind: 'production-preview', length: 1 },
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
    mode: 'play', totalTime: 0, deaths: 0,
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
    resolveAttackHits: GameEngine.prototype.resolveAttackHits,
    blockOnOathZone: GameEngine.prototype.blockOnOathZone,
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    openGate: GameEngine.prototype.openGate,
    revealMemoryMark: GameEngine.prototype.revealMemoryMark,
    toggleOathbind: GameEngine.prototype.toggleOathbind,
    updateVeilGateObjective: GameEngine.prototype.updateVeilGateObjective,
    spawnVeilGateMember: GameEngine.prototype.spawnVeilGateMember,
    recordVeilGateDefeat: GameEngine.prototype.recordVeilGateDefeat,
    strikeVeilSunstone: GameEngine.prototype.strikeVeilSunstone,
    completeVeilGate: GameEngine.prototype.completeVeilGate,
    updateRaidSoldier: GameEngine.prototype.updateRaidSoldier,
    strikePilgrimBell: vi.fn(),
    checkHazards: vi.fn(),
    armCrumble: vi.fn(),
    armBellTowerCollapseLedge: vi.fn(),
  };
}

function strikeKeeper(engine, kind = 'normal') {
  const soldier = engine.soldiers[0];
  engine.player.x = soldier.x - engine.player.w + 8;
  engine.player.y = soldier.y;
  engine.player.facing = 1;
  engine.player.attackKind = kind;
  engine.player.attackSequenceStep = 1;
  engine.player.attackDamage = kind === 'heavy' ? 2 : 1;
  engine.player.attackFacing = 1;
  engine.player.combatAction = createPlayerCombatTimeline({ id: 'keeper-test', kind, comboStep: 1 });
  engine.player.attackTimer = engine.player.combatAction.totalSeconds;
  advanceCombatTimeline(engine.player.combatAction, engine.player.combatAction.startupSeconds);
  engine.player.attackHits.clear();
  GameEngine.prototype.resolveAttackHits.call(engine);
}

describe('Outer Veil Level 9 production preview', () => {
  it('authors one safe clockwise four-ability synthesis around the inward gate', () => {
    const level = assertValidAuthoredLevel(createGateOfTheVeil(), identity);
    expect(level).toMatchObject({
      id: 9,
      levelKey: identity.levelKey,
      campaignOrder: 9,
      name: 'Gate of the Veil',
      subtitle: 'The Seal We Chose',
      objective: {
        type: 'veil-gate-restoration', phase: 'carve', gateRestored: false,
        complete: false, restored: false,
      },
      targetTime: { parSeconds: 240, masterySeconds: 150 },
    });
    expect(level.storyLine).toBe('The final gate remembers its maker—and Aren’s mark lies on the side meant to face Orun.');
    expect(level.objective.requiresAbilities).toEqual(['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke']);
    expect(level.gameplay.assumedAbilities).toEqual(level.objective.requiresAbilities);
    expect(level.abilityUnlock).toBeUndefined();
    expect(level.objective.encounter).toMatchObject({ spawnedCount: 0, defeatedCount: 0, maxActive: 1 });
    expect(level.objective.encounter.roster.map((entry) => entry.id)).toEqual(['keeper-of-the-first-seal']);
    expect(level.checkpoints).toEqual([]);
    expect(level.relics).toEqual([]);
    expect(level.ships).toEqual([]);
    expect(level.map.flat().filter((tile) => tile === Tile.SAND)).toHaveLength(1);
    expect(level.map.slice(12, 26).every((row) => row[45] === Tile.GATE)).toBe(true);
  });

  it('keeps the carve, counterweight, real Grip proof, keeper, and sunstone causally ordered', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createGateOfTheVeil(), identity));
    const engine = engineHarness(level);
    const mark = level.objective.memoryMark;
    const zone = level.objective.counterweight.zone;

    expect(GameEngine.prototype.strikeVeilSunstone.call(engine)).toBe(false);
    engine.player.x = mark.tx * TILE - engine.player.w - 7;
    engine.player.y = 26 * TILE - engine.player.h;
    GameEngine.prototype.dig.call(engine);
    expect(level.map[mark.ty][mark.tx]).toBe(Tile.AIR);
    expect(level.objective).toMatchObject({ phase: 'counterweight', memoryMark: { revealed: true } });

    level.block.x = zone.x + 8;
    level.block.y = 26 * TILE - level.block.h;
    engine.player.x = level.block.x - engine.player.w - 4;
    engine.player.y = level.block.y;
    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(level.objective).toMatchObject({ phase: 'ascent', counterweight: { bound: true, locked: false } });

    engine.input.right = true;
    engine.input.jump = true;
    engine.input.pressed.add('jump');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    engine.input.jump = false;
    engine.input.pressed.clear();
    for (let frame = 0; frame < 90; frame += 1) GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(engine.player.x).toBeGreaterThan(level.block.x + level.block.w);
    engine.input.right = false;

    const landing = level.objective.upperLatch.landing;
    engine.player.x = 39 * TILE;
    engine.player.y = landing.feetTy * TILE - engine.player.h;
    engine.player.grounded = true;
    GameEngine.prototype.updateVeilGateObjective.call(engine, .1);
    expect(level.objective).toMatchObject({ phase: 'ascent', upperLatch: { retryHintShown: true, reached: false } });
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('hold DOWN to drop through'), 5.4);

    GameEngine.prototype.recordPilgrimWallJump.call(engine, -1);
    expect(level.objective.upperLatch.gripJumpRecorded).toBe(false);
    GameEngine.prototype.recordPilgrimWallJump.call(engine, 1);
    engine.player.x = 39 * TILE;
    engine.player.y = landing.feetTy * TILE - engine.player.h;
    engine.player.grounded = true;
    GameEngine.prototype.updateVeilGateObjective.call(engine, .1);
    expect(level.objective).toMatchObject({
      phase: 'relay',
      counterweight: { locked: true },
      upperLatch: { gripJumpRecorded: true, reached: true },
      encounter: { spawnedCount: 1, defeatedCount: 0 },
    });
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['keeper-of-the-first-seal']);
    GameEngine.prototype.updateVeilGateObjective.call(engine, 20);
    expect(level.objective.encounter.spawnedCount).toBe(1);

    const keeper = engine.soldiers[0];
    keeper.attackPhase = 'windup';
    strikeKeeper(engine);
    expect(keeper.hp).toBe(3);
    expect(keeper).toMatchObject({ attackPhase: 'guard', attackConsumed: true, vx: 0 });
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('DOWN + STRIKE'), 2.4);
    strikeKeeper(engine, 'heavy');
    expect(keeper.hp).toBe(1);
    expect(keeper).toMatchObject({ attackPhase: 'stun', attackConsumed: true });
    while (keeper.hp > 0) strikeKeeper(engine);
    expect(level.objective).toMatchObject({
      phase: 'keystone',
      sunstone: { exposed: true, struck: false },
      encounter: { spawnedCount: 1, defeatedCount: 1 },
    });

    engine.player.x = level.objective.sunstone.tx * TILE - engine.player.w / 2;
    engine.player.y = landing.feetTy * TILE - engine.player.h;
    engine.totalTime = 147;
    expect(GameEngine.prototype.strikeVeilSunstone.call(engine)).toBe(true);
    expect(level.objective).toMatchObject({
      phase: 'complete', complete: true, restored: true, gateRestored: true,
      cartographersTurn: { restored: true, turnedAt: 147 },
    });
    expect(level.objective.relayBanners.every((banner) => banner.restored)).toBe(true);
    expect(level.objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
  });

  it('seats a visibly overlapping counterweight instead of rejecting it by a few pixels', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createGateOfTheVeil(), identity));
    const engine = engineHarness(level);
    const { zone } = level.objective.counterweight;
    level.objective.memoryMark.revealed = true;
    level.objective.phase = 'counterweight';
    level.block.x = zone.x - level.block.w + 17;
    level.block.y = zone.y + zone.h - level.block.h;
    engine.player.x = level.block.x + level.block.w + 4;
    engine.player.y = level.block.y;

    expect(GameEngine.prototype.blockOnOathZone.call(engine, zone)).toBe(false);
    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(level.block.x).toBe(zone.x + (zone.w - level.block.w) / 2);
    expect(level.block.bound).toBe(true);
    expect(level.objective).toMatchObject({
      phase: 'ascent',
      counterweight: { bound: true, locked: false },
    });
    expect(engine.setHint).toHaveBeenLastCalledWith(
      expect.stringContaining('COUNTERWEIGHT HELD'),
      4.2,
    );
  });

  it('does not pull a clearly misplaced counterweight into the cyan seat', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createGateOfTheVeil(), identity));
    const engine = engineHarness(level);
    const counterweight = level.objective.counterweight;
    const { zone } = counterweight;
    level.objective.memoryMark.revealed = true;
    level.objective.phase = 'counterweight';
    level.block.x = zone.x - level.block.w - counterweight.seatSnapPadding - 1;
    level.block.y = zone.y + zone.h - level.block.h;
    const originalX = level.block.x;
    engine.player.x = level.block.x - engine.player.w - 4;
    engine.player.y = level.block.y;

    expect(GameEngine.prototype.toggleOathbind.call(engine)).toBe(true);
    expect(level.block.x).toBe(originalX);
    expect(level.block.bound).toBe(true);
    expect(level.objective).toMatchObject({
      phase: 'counterweight',
      counterweight: { bound: false, locked: false },
    });
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('WRONG AXLE'), 3.8);
  });

  it('emits the exact isolated preview identity and ending at the restored door', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createGateOfTheVeil(), identity));
    const engine = engineHarness(level);
    level.objective.memoryMark.revealed = true;
    level.objective.counterweight.bound = true;
    level.objective.counterweight.locked = true;
    level.objective.upperLatch.reached = true;
    level.objective.encounter.roster[0].status = 'defeated';
    level.objective.encounter.defeatedCount = 1;
    level.objective.sunstone.exposed = true;
    level.objective.sunstone.struck = true;
    engine.totalTime = 147;
    expect(GameEngine.prototype.completeVeilGate.call(engine)).toBe(true);
    engine.player.x = level.door.x + 20;
    engine.player.y = level.door.y + 20;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 147,
      deaths: 0,
      campaignId: 'production-preview-gate-of-the-veil',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 240, masterySeconds: 150 },
      levelKey: identity.levelKey,
      campaignOrder: 9,
      objectiveType: 'veil-gate-restoration',
    });
  });

  it('reforms the complete causal chain, finite keeper, restoration, block, health, and gate after life-over', () => {
    const template = assertValidAuthoredLevel(createGateOfTheVeil(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.phase = 'complete';
    runtime.objective.memoryMark.revealed = true;
    runtime.objective.counterweight.bound = true;
    runtime.objective.counterweight.locked = true;
    runtime.objective.upperLatch.gripJumpRecorded = true;
    runtime.objective.upperLatch.reached = true;
    runtime.objective.encounter.clock = 48;
    runtime.objective.encounter.spawnedCount = 1;
    runtime.objective.encounter.defeatedCount = 1;
    runtime.objective.encounter.roster[0].status = 'defeated';
    runtime.objective.encounter.stages[0].active = true;
    runtime.objective.encounter.stages[0].complete = true;
    runtime.objective.sunstone.exposed = true;
    runtime.objective.sunstone.struck = true;
    runtime.objective.cartographersTurn.restored = true;
    runtime.objective.cartographersTurn.turnedAt = 48;
    runtime.objective.relayBanners.forEach((banner) => { banner.restored = true; });
    runtime.objective.gateRestored = true;
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    runtime.block.bound = true;
    const engine = {
      levelIndex: 0, level: runtime, totalTime: 88, deaths: 2,
      soldiers: [{}], projectiles: [{}], particles: [{}],
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
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
      phase: 'carve', complete: false, restored: false, gateRestored: false,
      memoryMark: { revealed: false },
      counterweight: { bound: false, locked: false },
      upperLatch: { gripJumpRecorded: false, reached: false, retryHintShown: false },
      encounter: { clock: 0, spawnedCount: 0, defeatedCount: 0 },
      sunstone: { exposed: false, struck: false },
      cartographersTurn: { restored: false, turnedAt: null },
    });
    expect(engine.level.objective.encounter.roster[0].status).toBe('queued');
    expect(engine.level.objective.encounter.stages[0]).toMatchObject({ active: false, complete: false });
    expect(engine.level.objective.relayBanners.every((banner) => !banner.restored)).toBe(true);
    expect(engine.level.block.bound).toBe(false);
    expect(engine.level.map[25][22]).toBe(Tile.SAND);
    expect(engine.level.map.some((row) => row[45] === Tile.GATE)).toBe(true);
    expect(engine.soldiers).toEqual([]);
    expect(engine.projectiles).toEqual([]);
    expect(engine.player.hp).toBe(4);
  });

  it('keeps named preview state and ending independent from prototype Level 9', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toContain('gate-of-the-veil');
    const preview = createProductionPreviewRepository('gate-of-the-veil');
    const first = await preview.loadTemplate(0);
    const runtimeA = preview.createRuntime(0);
    const runtimeB = preview.createRuntime(0);
    runtimeA.objective.encounter.roster[0].status = 'defeated';
    runtimeA.map[25][22] = Tile.AIR;
    expect(runtimeB.objective.encounter.roster[0].status).toBe('queued');
    expect(runtimeB.map[25][22]).toBe(first.map[25][22]);
    expect(preview.campaignId).toBe('production-preview-gate-of-the-veil');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(getProductionPreviewDescriptor('gate-of-the-veil').completion).toEqual({
      eyebrow: 'The old quarantine breaks',
      heading: 'The seal was ours',
      body: 'Aren opens the gate he once helped Mira close. Beyond it, the dust draws one enormous breath; the reason for their fear remains unseen.',
    });
    expect(createLevels()[8].name).toBe('The Crown Under Siege');
  });

  it('rejects an extra unlock, ambiguous memory, unsafe floor, infinite encounter, and unreadable keeper', () => {
    const broken = createGateOfTheVeil();
    broken.id = 8;
    broken.abilityUnlock = { key: 'fifth', name: 'Fifth', input: 'Q', description: 'No.' };
    broken.map[25][23] = Tile.SAND;
    broken.map[26][35] = Tile.AIR;
    broken.objective.encounter.maxActive = 2;
    broken.objective.encounter.roster[0].telegraphSeconds = .1;
    broken.gameplay.enemyRoster.push('archer');
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'legacy_id_mismatch',
      'invalid_veil_gate_abilities',
      'ambiguous_veil_memory',
      'invalid_veil_encounter',
      'invalid_veil_keeper',
      'veil_gate_route_contamination',
      'unsafe_veil_floor',
    ]));
  });
});
