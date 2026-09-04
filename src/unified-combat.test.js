import { describe, expect, it, vi } from 'vitest';
import { GameEngine, PHYSICS } from './engine.js';
import { TILE, Tile } from './levels/constants.js';
import { advanceCombatTimeline, createPlayerCombatTimeline } from './combat-presentation.js';
import { cloneLevel } from './levels/cloneLevel.js';
import { createHollowBarracks } from './levels/prototypes/hollowBarracks.js';

function combatHarness(overrides = {}) {
  const level = cloneLevel(createHollowBarracks());
  level.levelKey = 'inner-kingdom-06-hollow-barracks';
  level.campaignOrder = 16;
  level.gameplay = {
    enemyRoster: ['shield', 'spear', 'archer'],
    combat: {
      style: 'unified',
      maxActive: 2,
      maxSpawns: 3,
      controls: 'UNIFIED COMBAT',
    },
  };
  Object.assign(level.gameplay.combat, overrides.combat || {});

  const engine = Object.assign(Object.create(GameEngine.prototype), {
    level,
    mode: 'play',
    demo: false,
    totalTime: 0,
    levelTime: 0,
    deaths: 0,
    levelDeaths: 0,
    spawnClock: 0,
    combatSpawned: 0,
    combatDefeated: 0,
    soldiers: [],
    projectiles: [],
    particles: [],
    crumble: new Map(),
    input: {
      left: false, right: false, climb: false, down: false,
      jump: false, attack: false, dig: false,
      attackIntent: null,
      pressed: new Set(), released: new Set(),
    },
    audio: { play: vi.fn() },
    callbacks: { death: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
    checkHazards: vi.fn(),
    armCrumble: vi.fn(),
    armBellTowerCollapseLedge: vi.fn(),
  });
  engine.player = GameEngine.prototype.makePlayer.call(engine, {
    x: (level.arenaStart + 1) * TILE,
    y: 26 * TILE - 44,
  });
  engine.player.grounded = true;
  return engine;
}

function openStrikeContact(engine, kind = 'normal', comboStep = 1) {
  const p = engine.player;
  p.attackKind = kind;
  p.attackSequenceStep = comboStep;
  p.attackDamage = kind === 'normal' && comboStep < 3 ? 1 : 2;
  p.attackFacing = p.facing;
  p.attackHits.clear();
  p.combatAction = createPlayerCombatTimeline({ id: `test-${kind}-${comboStep}`, kind, comboStep });
  p.attackTimer = p.combatAction.totalSeconds;
  advanceCombatTimeline(p.combatAction, p.combatAction.startupSeconds);
}

function standardSoldier(engine, kind = 'spear') {
  const hp = kind === 'shield' ? 4 : kind === 'spear' ? 3 : 2;
  return {
    id: `${kind}-test`,
    standardCombatMember: true,
    readableMelee: true,
    x: engine.player.x + 45,
    y: engine.player.y,
    w: 24,
    h: 44,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    mode: 'walk',
    facing: -1,
    kind,
    attackPhase: 'pursue',
    attackClock: 0,
    attackConsumed: true,
    telegraphSeconds: .66,
    recoverySeconds: .62,
    activeSeconds: .18,
    minX: 0,
    maxX: 90 * TILE,
  };
}

function activeGuardian(engine, overrides = {}) {
  return {
    id: 'veiled-guardian',
    kind: 'guardian',
    active: true,
    x: engine.player.x + 44,
    y: engine.player.y - 48,
    w: 64,
    h: 92,
    vx: 0,
    hp: 10,
    maxHp: 10,
    minX: engine.player.x - 4 * TILE,
    maxX: engine.player.x + 5 * TILE,
    facing: -1,
    attackPhase: 'pursue',
    attackClock: 0,
    attackConsumed: true,
    telegraphSeconds: .72,
    activeSeconds: .18,
    recoverySeconds: .68,
    ...overrides,
  };
}

describe('shared V4 combat language', () => {
  it('captures normal, heavy, and aerial intentions without rewarding whiffs', () => {
    const engine = combatHarness();
    const p = engine.player;

    GameEngine.prototype.setInput.call(engine, 'attack', true);
    GameEngine.prototype.setInput.call(engine, 'attack', false);
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(p).toMatchObject({ attackKind: 'normal', comboStep: 0, attackSequenceStep: 1 });

    p.attackTimer = 0;
    p.combatAction = null;
    p.grounded = true;
    engine.input.pressed.clear(); engine.input.released.clear();
    GameEngine.prototype.setInput.call(engine, 'down', true);
    GameEngine.prototype.setInput.call(engine, 'attack', true);
    GameEngine.prototype.setInput.call(engine, 'attack', false);
    GameEngine.prototype.setInput.call(engine, 'down', false);
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(p).toMatchObject({ attackKind: 'heavy', attackDamage: 2, comboStep: 0 });

    p.attackTimer = 0;
    p.combatAction = null;
    p.grounded = true;
    engine.input.pressed.clear(); engine.input.released.clear();
    GameEngine.prototype.setInput.call(engine, 'jump', true);
    GameEngine.prototype.setInput.call(engine, 'attack', true);
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(p).toMatchObject({ attackKind: 'aerial', attackDamage: 2, comboStep: 0 });
  });

  it.each([
    ['down', 'heavy'],
    ['jump', 'aerial'],
  ])('recognises either touch order for %s plus Strike', (modifier, expectedKind) => {
    for (const order of [[modifier, 'attack'], ['attack', modifier]]) {
      const engine = combatHarness();
      for (const action of order) GameEngine.prototype.setInput.call(engine, action, true);
      GameEngine.prototype.setInput.call(engine, 'attack', false);
      GameEngine.prototype.setInput.call(engine, modifier, false);
      GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
      expect(engine.player.attackKind).toBe(expectedKind);
    }
  });

  it.each([
    ['down', 'heavy'],
    ['jump', 'aerial'],
  ])('upgrades Strike when %s arrives on the following frame', (modifier, expectedKind) => {
    const engine = combatHarness();
    GameEngine.prototype.setInput.call(engine, 'attack', true);
    GameEngine.prototype.setInput.call(engine, 'attack', false);
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(engine.player).toMatchObject({ attackKind: 'normal' });
    expect(engine.player.combatAction.phase).toBe('startup');

    engine.input.pressed.clear();
    engine.input.released.clear();
    GameEngine.prototype.setInput.call(engine, modifier, true);
    expect(engine.player).toMatchObject({ attackKind: expectedKind, attackDamage: 2, attackSequenceStep: 1 });
    expect(engine.player.combatAction).toMatchObject({ kind: expectedKind, phase: 'startup' });
  });

  it('advances a three-hit chain only once per connected action, including multi-target contact', () => {
    const engine = combatHarness();
    const first = standardSoldier(engine, 'spear');
    const second = { ...standardSoldier(engine, 'spear'), id: 'spear-second', x: first.x + 3 };
    first.hp = first.maxHp = second.hp = second.maxHp = 12;
    engine.soldiers = [first, second];
    for (const expected of [1, 2, 0]) {
      const step = engine.player.comboClock > 0 ? engine.player.comboStep + 1 : 1;
      openStrikeContact(engine, 'normal', step);
      GameEngine.prototype.resolveAttackHits.call(engine);
      expect(engine.player.comboStep).toBe(expected);
    }
    expect(first.hp).toBe(8);
    expect(second.hp).toBe(8);
  });

  it('makes shields reject normal pressure and open to DOWN plus STRIKE', () => {
    const engine = combatHarness();
    const shield = standardSoldier(engine, 'shield');
    engine.soldiers = [shield];
    openStrikeContact(engine, 'normal', 1);

    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(shield).toMatchObject({ hp: 4, attackPhase: 'guard' });
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('DOWN + STRIKE'), 2.4);

    openStrikeContact(engine, 'heavy', 1);
    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(shield).toMatchObject({ hp: 2, attackPhase: 'stun' });
    expect(engine.audio.play).toHaveBeenLastCalledWith('heavy');
  });

  it('lets a correctly faced held guard stop one telegraphed melee hit', () => {
    const engine = combatHarness();
    const spear = standardSoldier(engine, 'spear');
    Object.assign(spear, { attackPhase: 'active', attackClock: .1, attackConsumed: false });
    engine.soldiers = [spear];
    Object.assign(engine.player, { grounded: true, facing: 1, attackTimer: 0 });
    engine.input.down = true;

    GameEngine.prototype.updateRaidSoldier.call(engine, spear, .01);
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP);
    expect(spear).toMatchObject({ attackPhase: 'recovery', attackConsumed: true });
    expect(engine.audio.play).toHaveBeenLastCalledWith('block');

    engine.input.down = false;
    Object.assign(spear, { attackPhase: 'active', attackClock: .1, attackConsumed: false });
    GameEngine.prototype.updateRaidSoldier.call(engine, spear, .01);
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP - 1);
  });

  it('shares finite guard, late parry, guard break, and wrong-facing rules across melee and arrows', () => {
    const engine = combatHarness();
    const spear = standardSoldier(engine, 'spear');
    engine.soldiers = [spear];
    Object.assign(engine.player, { grounded: true, facing: 1, attackTimer: 0, guardMeter: 1, parryClock: .1 });
    engine.input.down = true;
    expect(GameEngine.prototype.resolveSoldierAttack.call(engine, spear)).toBe('parried');
    expect(engine.player).toMatchObject({ hp: PHYSICS.MAX_HP, guardMeter: 1, parryClock: 0 });

    Object.assign(spear, { attackPhase: 'active', attackClock: .1, attackConsumed: false });
    expect(GameEngine.prototype.resolveSoldierAttack.call(engine, spear)).toBe('guard-broken');
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP - 1);
    expect(engine.player.guardBrokenClock).toBeGreaterThan(0);

    Object.assign(engine.player, { invuln: 0, facing: -1, guardBrokenClock: 0, guardMeter: 3 });
    expect(GameEngine.prototype.resolveProjectileAttack.call(engine, { vx: -285 }, engine.player.x + TILE)).toBe('hit');
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP - 2);
  });

  it('uses DOWN to guard and DOWN plus JUMP as an explicit combat drop gesture', () => {
    const engine = combatHarness();
    engine.input.down = true;
    engine.input.pressed.add('down');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(engine.player).toMatchObject({ guarding: true, dropTimer: 0 });

    engine.player.grounded = true;
    engine.input.pressed.clear();
    engine.input.pressed.add('jump');
    engine.input.jump = true;
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(engine.player.dropTimer).toBeGreaterThan(0);
  });

  it('cancels an attack and its buffered follow-up when Aren takes damage', () => {
    const engine = combatHarness();
    openStrikeContact(engine, 'normal', 1);
    Object.assign(engine.player, { attackBuffer: .2, attackBufferKind: 'normal' });
    GameEngine.prototype.damagePlayer.call(engine, 1, -200, -120);
    expect(engine.player).toMatchObject({ attackTimer: 0, attackBuffer: 0, attackBufferKind: null, combatAction: null });
  });

  it('releases stale attack ownership and refuses to walk readable soldiers into walls or pits', () => {
    const engine = combatHarness();
    const spear = standardSoldier(engine, 'spear');
    engine.soldiers = [spear];
    engine.meleeAttackToken = 'missing-soldier';
    expect(GameEngine.prototype.releaseStaleMeleeAttackToken.call(engine)).toBe(true);
    const leadingTx = Math.floor((spear.x + spear.w + 3) / TILE);
    const floorTy = Math.floor((spear.y + spear.h + 4) / TILE);
    engine.level.map[floorTy][leadingTx] = Tile.AIR;
    expect(GameEngine.prototype.readableSoldierCanAdvance.call(engine, spear, 1)).toBe(false);
  });

  it('keeps non-owning melee roles in a readable formation instead of dogpiling', () => {
    const engine = combatHarness();
    const shield = standardSoldier(engine, 'shield');
    const spear = { ...standardSoldier(engine, 'spear'), id: 'spear-support' };
    engine.soldiers = [shield, spear];
    engine.meleeAttackToken = shield.id;
    spear.x = engine.player.x + 76;

    GameEngine.prototype.updateRaidSoldier.call(engine, spear, 1 / 60);

    expect(spear.attackPhase).toBe('pursue');
    expect(spear.vx).toBeGreaterThan(0);
    expect(spear.vx).toBeLessThanOrEqual(6);
  });

  it('decelerates a readable soldier before turning to face Aren', () => {
    const engine = combatHarness();
    const spear = standardSoldier(engine, 'spear');
    engine.soldiers = [spear];
    Object.assign(spear, {
      x: engine.player.x - 90,
      facing: -1,
      vx: -72,
    });

    GameEngine.prototype.updateRaidSoldier.call(engine, spear, 1 / 60);

    expect(spear.facing).toBe(-1);
    expect(spear.vx).toBeGreaterThan(-72);
    expect(spear.vx).toBeLessThan(0);
  });

  it('carries grounded fighters with a moving platform and preserves support', () => {
    const engine = combatHarness();
    const platform = { x: 300, y: 500, w: 160, h: 18, dx: 3, dy: 2 };
    engine.level.movers = [platform];
    const spear = standardSoldier(engine, 'spear');
    Object.assign(spear, {
      x: 330,
      y: platform.y - spear.h,
      vx: 0,
      vy: 0,
      groundPlatform: platform,
    });

    const carry = GameEngine.prototype.carrySoldierWithPlatform.call(engine, spear, 1 / 60);
    spear.vy += PHYSICS.GRAVITY_DOWN / 60;
    const landed = GameEngine.prototype.moveSoldierVertical.call(engine, spear, 1 / 60);

    expect(carry).toMatchObject({ platform, velocityX: 180, velocityY: 120 });
    expect(spear.x).toBeCloseTo(333);
    expect(spear.y).toBeCloseTo(platform.y - spear.h);
    expect(spear.groundPlatform).toBe(platform);
    expect(landed).toBe(true);
  });

  it('qualifies and smooths camera look-ahead by velocity across a fast reversal', () => {
    const engine = combatHarness();
    engine.camera = {
      x: engine.player.x - 300,
      y: engine.player.y - 200,
      focusX: engine.player.x + engine.player.w / 2,
      focusY: engine.player.y + engine.player.h / 2,
      lookAheadX: 105,
    };
    engine.player.vx = -PHYSICS.RUN_SPEED;

    GameEngine.prototype.updateCamera.call(engine, 1 / 60);
    expect(engine.camera.lookAheadX).toBeGreaterThan(0);

    for (let frame = 0; frame < 30; frame += 1) {
      GameEngine.prototype.updateCamera.call(engine, 1 / 60);
    }
    expect(engine.camera.lookAheadX).toBeLessThan(0);
  });

  it('caps ordinary reinforcements by both total roster and simultaneous attackers', () => {
    const engine = combatHarness({ combat: { maxActive: 2, maxSpawns: 3 } });
    engine.level.spawnEvery = .01;
    engine.level.ships = [{ x: engine.player.x + 100, y: engine.player.y - 28 }];

    GameEngine.prototype.updateStandardUnifiedCombat.call(engine, .02);
    GameEngine.prototype.updateStandardUnifiedCombat.call(engine, .02);
    GameEngine.prototype.updateStandardUnifiedCombat.call(engine, .02);
    expect(engine.soldiers).toHaveLength(2);
    expect(engine.combatSpawned).toBe(2);

    engine.soldiers = [];
    GameEngine.prototype.updateStandardUnifiedCombat.call(engine, .02);
    GameEngine.prototype.updateStandardUnifiedCombat.call(engine, .02);
    expect(engine.combatSpawned).toBe(3);
    expect(engine.soldiers).toHaveLength(1);
  });

  it('telegraphs archer shots and allows a faced guard to block the arrow', () => {
    const engine = combatHarness({ combat: { maxActive: 1, maxSpawns: 1 } });
    engine.level.gameplay.enemyRoster = ['archer'];
    GameEngine.prototype.spawnStandardSoldier.call(engine);
    const archer = engine.soldiers[0];
    Object.assign(archer, {
      mode: 'walk', y: engine.player.y, x: engine.player.x + 180,
      attackPhase: 'pursue', attackClock: 0,
    });

    GameEngine.prototype.updateStandardArcher.call(engine, archer, .01);
    expect(archer.attackPhase).toBe('windup');
    GameEngine.prototype.updateStandardArcher.call(engine, archer, archer.telegraphSeconds + .01);
    expect(archer.attackPhase).toBe('active');
    GameEngine.prototype.updateStandardArcher.call(engine, archer, .01);
    expect(engine.projectiles).toHaveLength(1);

    const arrow = engine.projectiles[0];
    arrow.x = engine.player.x + engine.player.w / 2;
    arrow.y = engine.player.y + 18;
    arrow.vx = -285;
    Object.assign(engine.player, { facing: 1, grounded: true, attackTimer: 0 });
    engine.input.down = true;
    GameEngine.prototype.updateStandardUnifiedCombat.call(engine, .01);
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP);
    expect(engine.player.guardMeter).toBe(2);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.audio.play).toHaveBeenLastCalledWith('block');
  });

  it('gives the Veiled Guardian one readable contact window instead of body-overlap damage', () => {
    const engine = combatHarness();
    const boss = activeGuardian(engine);
    engine.level.boss = boss;

    GameEngine.prototype.updateBoss.call(engine, .01);
    expect(boss).toMatchObject({ attackPhase: 'windup', attackConsumed: true, facing: -1 });
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP);

    for (let step = 0; step < 7; step += 1) GameEngine.prototype.updateBoss.call(engine, .11);
    expect(boss).toMatchObject({ attackPhase: 'active', attackConsumed: false, facing: -1 });
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP);

    GameEngine.prototype.updateBoss.call(engine, .01);
    expect(boss.attackConsumed).toBe(true);
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP - 1);
    GameEngine.prototype.updateBoss.call(engine, .01);
    expect(engine.player.hp).toBe(PHYSICS.MAX_HP - 1);
  });

  it('uses the authored Nameless Magistrate identity without changing the guardian fight language', () => {
    const engine = combatHarness();
    const boss = activeGuardian(engine, {
      active: false,
      displayName: 'The Nameless Magistrate',
      hudLabel: 'NAMELESS MAGISTRATE',
      visualStyle: 'nameless-magistrate',
      x: 67 * TILE,
    });
    engine.level.boss = boss;
    engine.player.x = 69 * TILE;
    engine.callbacks.hud = vi.fn();

    GameEngine.prototype.updateBoss.call(engine, .01);
    expect(boss).toMatchObject({ active: true, kind: 'guardian' });
    expect(engine.setHint).toHaveBeenCalledWith(expect.stringContaining('NAMELESS MAGISTRATE'));
    GameEngine.prototype.pushHud.call(engine, true);
    expect(engine.callbacks.hud).toHaveBeenCalledWith(expect.objectContaining({
      bossLabel: 'NAMELESS MAGISTRATE',
    }));
  });

  it('lets a late, correctly faced guard parry the Veiled Guardian into longer recovery', () => {
    const engine = combatHarness();
    const boss = activeGuardian(engine, {
      attackPhase: 'active',
      attackClock: .1,
      attackConsumed: false,
    });
    engine.level.boss = boss;
    engine.input.down = true;
    Object.assign(engine.player, {
      facing: 1,
      grounded: true,
      attackTimer: 0,
      guardMeter: 3,
      parryClock: .1,
    });

    GameEngine.prototype.updateBoss.call(engine, .01);
    expect(engine.player).toMatchObject({ hp: PHYSICS.MAX_HP, guardMeter: 3, parryClock: 0 });
    expect(boss.attackPhase).toBe('recovery');
    expect(boss.attackClock).toBeGreaterThan(boss.recoverySeconds);
    expect(engine.audio.play).toHaveBeenLastCalledWith('parry');
  });

  it('applies the connected three-hit chain and authored damage to the Veiled Guardian', () => {
    const engine = combatHarness();
    const boss = activeGuardian(engine, { x: engine.player.x + 45, y: engine.player.y });
    engine.level.boss = boss;

    openStrikeContact(engine, 'normal', 1);
    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(boss).toMatchObject({ hp: 9, attackPhase: 'stun' });
    expect(engine.player.comboStep).toBe(1);
    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(boss.hp).toBe(9);

    openStrikeContact(engine, 'normal', 2);
    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(boss.hp).toBe(8);
    expect(engine.player.comboStep).toBe(2);

    openStrikeContact(engine, 'normal', 3);
    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(boss.hp).toBe(6);
    expect(engine.player.comboStep).toBe(0);
  });
});
