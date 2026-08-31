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
import { createParachuteChoir } from './parachuteChoir.js';

const identity = {
  levelKey: 'outer-veil-08-parachute-choir',
  campaignOrder: 8,
  legacyId: 8,
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
    repository: { campaignId: 'production-preview-parachute-choir', sessionKind: 'production-preview', length: 1 },
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
    recordPilgrimGrip: GameEngine.prototype.recordPilgrimGrip,
    recordPilgrimWallJump: GameEngine.prototype.recordPilgrimWallJump,
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    damagePlayer: GameEngine.prototype.damagePlayer,
    openGate: GameEngine.prototype.openGate,
    activateParachuteStage: GameEngine.prototype.activateParachuteStage,
    spawnParachuteRaider: GameEngine.prototype.spawnParachuteRaider,
    strikeParachuteTether: GameEngine.prototype.strikeParachuteTether,
    recordParachuteDefeat: GameEngine.prototype.recordParachuteDefeat,
    completeParachuteChoir: GameEngine.prototype.completeParachuteChoir,
    updateParachuteChoirObjective: GameEngine.prototype.updateParachuteChoirObjective,
    raidAttackBox: GameEngine.prototype.raidAttackBox,
    updateRaidSoldier: GameEngine.prototype.updateRaidSoldier,
    updateParachuteChoir: GameEngine.prototype.updateParachuteChoir,
    strikePilgrimBell: vi.fn(),
    resolveAttackHits: GameEngine.prototype.resolveAttackHits,
    checkHazards: vi.fn(),
    armCrumble: vi.fn(),
    armBellTowerCollapseLedge: vi.fn(),
  };
}

function attackSoldier(engine, id) {
  const soldier = engine.soldiers.find((item) => item.id === id);
  expect(soldier).toBeDefined();
  engine.player.x = soldier.x - engine.player.w + 8;
  engine.player.y = soldier.y;
  engine.player.facing = 1;
  engine.player.attackTimer = .2;
  engine.player.attackHits.clear();
  GameEngine.prototype.resolveAttackHits.call(engine);
}

function defeatActive(engine, id) {
  const soldier = engine.soldiers.find((item) => item.id === id);
  expect(soldier).toBeDefined();
  while (soldier.hp > 0) attackSoldier(engine, id);
}

describe('Outer Veil Level 8 production preview', () => {
  it('authors a five-member, max-two, melee-only advancing raid with one safe Skycut combination', () => {
    const level = assertValidAuthoredLevel(createParachuteChoir(), identity);
    expect(level).toMatchObject({
      id: 8,
      levelKey: identity.levelKey,
      campaignOrder: 8,
      abilityUnlock: { key: 'dawnstroke', name: 'Dawnstroke' },
      objective: {
        type: 'parachute-choir-restoration', requiresAbility: 'pilgrims-grip', phase: 'lesson',
        defeatedCount: 0, spawnedCount: 0, skyRestored: false, complete: false, restored: false,
      },
      targetTime: { parSeconds: 210, masterySeconds: 135 },
    });
    expect(level.objective.roster).toHaveLength(5);
    expect(level.objective.stages.map((stage) => stage.rosterIds.length)).toEqual([1, 2, 2]);
    expect(level.objective.roster.map((entry) => entry.id)).toEqual([
      'first-voice', 'low-tenor', 'high-answer', 'ground-bass', 'falling-cadence',
    ]);
    expect(level.objective.roster.every((entry) => entry.status === 'queued')).toBe(true);
    expect(level.objective.stages.every((stage) => stage.rosterIds.length <= 2)).toBe(true);
    expect(level.gameplay.enemyRoster).toEqual(['grunt', 'spear', 'shield']);
    expect(level.checkpoints).toEqual([]);
    expect(level.relics).toEqual([]);
    expect(level.spawnEvery).toBeUndefined();
    expect(level.maxEnemies).toBeUndefined();
    expect(level.map.flat()).not.toContain(Tile.SPIKE);
  });

  it('uses encounter-local landing warnings and spawns the stable lesson ID exactly once', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    engine.player.x = 13 * TILE;
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .5);
    expect(level.objective.stages[0]).toMatchObject({ active: true, startedAt: .5 });
    expect(engine.soldiers).toEqual([]);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .89);
    expect(engine.soldiers).toEqual([]);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .01);
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['first-voice']);
    expect(level.objective).toMatchObject({ spawnedCount: 1, defeatedCount: 0 });
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, 30);
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['first-voice']);
    expect(level.objective.spawnedCount).toBe(1);
  });

  it('keeps descent, body contact, landing, warning, and recovery harmless; one active attack damages once', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    engine.player.x = 20 * TILE;
    engine.player.y = 23 * TILE - engine.player.h;
    GameEngine.prototype.spawnParachuteRaider.call(engine, level.objective.roster[0]);
    const soldier = engine.soldiers[0];
    soldier.x = engine.player.x;
    soldier.y = engine.player.y;
    soldier.mode = 'walk';
    soldier.attackPhase = 'landing';
    soldier.attackClock = .4;
    GameEngine.prototype.updateRaidSoldier.call(engine, soldier, .2);
    expect(engine.player.hp).toBe(4);
    soldier.attackPhase = 'pursue';
    GameEngine.prototype.updateRaidSoldier.call(engine, soldier, 1 / 60);
    expect(soldier.attackPhase).toBe('windup');
    expect(engine.player.hp).toBe(4);
    soldier.attackClock = 0;
    GameEngine.prototype.updateRaidSoldier.call(engine, soldier, 1 / 60);
    expect(soldier.attackPhase).toBe('active');
    expect(engine.player.hp).toBe(4);
    GameEngine.prototype.updateRaidSoldier.call(engine, soldier, 1 / 60);
    expect(engine.player.hp).toBe(3);
    engine.player.invuln = 0;
    GameEngine.prototype.updateRaidSoldier.call(engine, soldier, 1 / 60);
    expect(engine.player.hp).toBe(3);
    soldier.attackPhase = 'recovery';
    soldier.attackClock = .5;
    engine.player.invuln = 0;
    GameEngine.prototype.updateRaidSoldier.call(engine, soldier, .2);
    expect(engine.player.hp).toBe(3);
  });

  it('counts a stable defeat once, unfurls its sail, and enters a quiet Grip flank', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    engine.player.x = 13 * TILE;
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .1);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .91);
    attackSoldier(engine, 'first-voice');
    expect(level.objective.defeatedCount).toBe(0);
    attackSoldier(engine, 'first-voice');
    expect(level.objective).toMatchObject({ phase: 'flank', defeatedCount: 1 });
    expect(level.objective.roster[0].status).toBe('defeated');
    expect(level.objective.windSails[0].unfurled).toBe(true);
    GameEngine.prototype.recordParachuteDefeat.call(engine, { raidMember: true, rosterId: 'first-voice' });
    expect(level.objective.defeatedCount).toBe(1);
    expect(engine.soldiers).toEqual([]);
  });

  it('requires the real right-wall spring, broad high landing, and a nearby strike to cut the tether', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    level.objective.phase = 'flank';
    GameEngine.prototype.recordPilgrimWallJump.call(engine, -1);
    expect(level.objective.skycut.gripJumpRecorded).toBe(false);

    engine.player.x = 36 * TILE - engine.player.w;
    engine.player.y = 23 * TILE;
    engine.player.vy = 180;
    engine.player.grounded = false;
    engine.input.right = true;
    engine.input.climb = true;
    engine.input.jump = true;
    engine.input.pressed.add('jump');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(engine.player.vx).toBeLessThan(0);
    expect(level.objective.skycut.gripJumpRecorded).toBe(true);

    const landing = level.objective.skycut.landing;
    engine.input.right = false;
    engine.input.climb = false;
    engine.input.jump = false;
    engine.input.pressed.clear();
    for (let frame = 0; frame < 90 && !level.objective.skycut.landed; frame += 1) {
      GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
      GameEngine.prototype.updateParachuteChoirObjective.call(engine, 1 / 60);
    }
    expect(level.objective.skycut.landed).toBe(true);
    engine.player.x = 30 * TILE;
    expect(GameEngine.prototype.strikeParachuteTether.call(engine)).toBe(false);
    engine.player.x = level.objective.skycut.tether.tx * TILE - engine.player.w / 2;
    engine.player.y = landing.feetTy * TILE - engine.player.h;
    expect(GameEngine.prototype.strikeParachuteTether.call(engine)).toBe(true);
    expect(level.objective).toMatchObject({ phase: 'chorus', skycut: { completed: true, tether: { cut: true } } });

    engine.input.right = true;
    engine.input.climb = true;
    engine.input.jump = true;
    engine.input.pressed.add('jump');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    engine.input.jump = false;
    engine.input.pressed.clear();
    for (let frame = 0; frame < 120; frame += 1) {
      GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    }
    expect(engine.player.x).toBeGreaterThan(37 * TILE);
  });

  it('deploys two advancing pairs, never exceeds five spawns, and restores only after every stable ID falls', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    level.objective.roster[0].status = 'defeated';
    level.objective.defeatedCount = 1;
    level.objective.spawnedCount = 1;
    level.objective.stages[0].active = true;
    level.objective.stages[0].complete = true;
    level.objective.skycut.gripJumpRecorded = true;
    level.objective.skycut.landed = true;
    level.objective.skycut.completed = true;
    level.objective.skycut.tether.cut = true;
    level.objective.phase = 'chorus';
    engine.player.x = 44 * TILE;
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .1);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .9);
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['low-tenor']);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .91);
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['low-tenor', 'high-answer']);
    defeatActive(engine, 'low-tenor');
    defeatActive(engine, 'high-answer');
    expect(level.objective.phase).toBe('finale');

    engine.player.x = 63 * TILE;
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .1);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, .91);
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['ground-bass']);
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, 1.21);
    expect(engine.soldiers.map((soldier) => soldier.id)).toEqual(['ground-bass', 'falling-cadence']);
    defeatActive(engine, 'ground-bass');
    defeatActive(engine, 'falling-cadence');
    expect(level.objective).toMatchObject({
      phase: 'complete', spawnedCount: 5, defeatedCount: 5,
      skyRestored: true, complete: true, restored: true,
    });
    expect(level.objective.windSails.every((sail) => sail.unfurled)).toBe(true);
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    GameEngine.prototype.updateParachuteChoirObjective.call(engine, 30);
    expect(level.objective.spawnedCount).toBe(5);
    expect(engine.soldiers).toEqual([]);
  });

  it('clamps authored fighters to their advancing court without inventing a defeat', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    GameEngine.prototype.spawnParachuteRaider.call(engine, level.objective.roster[0]);
    const soldier = engine.soldiers[0];
    soldier.mode = 'walk';
    soldier.attackPhase = 'pursue';
    soldier.x = -200;
    soldier.y = 26 * TILE - soldier.h;
    GameEngine.prototype.updateParachuteChoir.call(engine, 1 / 60);
    expect(soldier.x).toBeGreaterThanOrEqual(soldier.minX);
    expect(level.objective.roster[0].status).toBe('active');
    expect(level.objective.defeatedCount).toBe(0);
  });

  it('emits exact preview identity at the door after restoration', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createParachuteChoir(), identity));
    const engine = engineHarness(level);
    level.objective.skycut.completed = true;
    level.objective.skycut.tether.cut = true;
    level.objective.roster.forEach((entry) => { entry.status = 'defeated'; });
    level.objective.defeatedCount = level.objective.roster.length;
    engine.totalTime = 141;
    expect(GameEngine.prototype.completeParachuteChoir.call(engine)).toBe(true);
    engine.player.x = level.door.x + 20;
    engine.player.y = level.door.y + 20;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 141,
      deaths: 0,
      campaignId: 'production-preview-parachute-choir',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 210, masterySeconds: 135 },
      levelKey: identity.levelKey,
      campaignOrder: 8,
      objectiveType: 'parachute-choir-restoration',
    });
  });

  it('reforms every voice, formation, tether, sail, ship, projectile, health point, and gate after life-over', () => {
    const template = assertValidAuthoredLevel(createParachuteChoir(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.phase = 'finale';
    runtime.objective.encounterClock = 48;
    runtime.objective.spawnedCount = 4;
    runtime.objective.defeatedCount = 3;
    runtime.objective.roster.forEach((entry, index) => { entry.status = index < 3 ? 'defeated' : 'active'; });
    runtime.objective.stages.forEach((stage) => { stage.active = true; });
    runtime.objective.skycut.gripJumpRecorded = true;
    runtime.objective.skycut.landed = true;
    runtime.objective.skycut.completed = true;
    runtime.objective.skycut.tether.cut = true;
    runtime.objective.windSails.forEach((sail) => { sail.unfurled = true; });
    runtime.objective.skyRestored = true;
    runtime.ships[0].x += 500;
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
      engine.checkpoint = { kind: 'spawn', id: null, ...engine.level.spawn, facing: 1 };
    });
    GameEngine.prototype.respawn.call(engine);
    expect(engine.level.objective).toMatchObject({
      phase: 'lesson', encounterClock: 0, spawnedCount: 0, defeatedCount: 0,
      skyRestored: false, complete: false, restored: false,
      skycut: { gripJumpRecorded: false, landed: false, completed: false, tether: { cut: false } },
    });
    expect(engine.level.objective.roster.every((entry) => entry.status === 'queued')).toBe(true);
    expect(engine.level.objective.stages.every((stage) => !stage.active && !stage.complete)).toBe(true);
    expect(engine.level.objective.windSails.every((sail) => !sail.unfurled)).toBe(true);
    expect(engine.level.ships).toEqual(template.ships);
    expect(engine.soldiers).toEqual([]);
    expect(engine.projectiles).toEqual([]);
    expect(engine.player.hp).toBe(4);
    expect(engine.totalTime).toBe(88);
    expect(engine.deaths).toBe(2);
  });

  it('keeps named preview identity, ending, mutable state, and prototype Level 8 independent', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toContain('parachute-choir');
    const preview = createProductionPreviewRepository('parachute-choir');
    const first = await preview.loadTemplate(0);
    const runtimeA = preview.createRuntime(0);
    const runtimeB = preview.createRuntime(0);
    runtimeA.objective.roster[0].status = 'defeated';
    runtimeA.ships[0].x += 100;
    expect(runtimeB.objective.roster[0].status).toBe('queued');
    expect(runtimeB.ships[0].x).toBe(first.ships[0].x);
    expect(preview.campaignId).toBe('production-preview-parachute-choir');
    expect(preview.keyAt(0)).toBe(identity.levelKey);
    expect(getProductionPreviewDescriptor('parachute-choir').completion).toEqual({
      eyebrow: 'The last descent is broken',
      heading: 'The sky sings for the living',
      body: 'Aren breaks the Crown’s measured descent. Mira raises the abandoned parachutes as golden wind-banners, and the Outer Veil answers with its own chorus.',
    });
    expect(createLevels()[7].name).toBe('The Shifting Sepulchre');
  });

  it('rejects unsafe identity, infinite-spawn authority, unreadable timing, orphan roster, and route contamination', () => {
    const broken = createParachuteChoir();
    broken.id = 7;
    broken.abilityUnlock.key = 'ordinary-sword';
    broken.objective.requiresAbility = 'sanctum-recall';
    broken.objective.roster[1].id = broken.objective.roster[0].id;
    broken.objective.roster[2].stageId = 'unknown-wave';
    broken.objective.roster[3].telegraphSeconds = .1;
    broken.objective.roster[4].kind = 'archer';
    broken.objective.stages[2].rosterIds.push('extra-voice');
    broken.spawnEvery = 1;
    broken.checkpoints.push({ x: 100, spawnX: 100, spawnY: 100, label: 'wrong' });
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'legacy_id_mismatch',
      'invalid_dawnstroke',
      'invalid_raid_ability',
      'invalid_raid_member',
      'invalid_raid_stage',
      'invalid_raid_membership',
      'ambiguous_raid_checkpoint',
      'raid_route_contamination',
    ]));
  });
});
