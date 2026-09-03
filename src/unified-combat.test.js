import { describe, expect, it, vi } from 'vitest';
import { GameEngine, PHYSICS } from './engine.js';
import { TILE } from './levels/constants.js';
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
      pressed: new Set(), released: new Set(),
    },
    audio: { play: vi.fn() },
    callbacks: { death: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
  });
  engine.player = GameEngine.prototype.makePlayer.call(engine, {
    x: (level.arenaStart + 1) * TILE,
    y: 26 * TILE - 44,
  });
  engine.player.grounded = true;
  return engine;
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

describe('shared V4 combat language', () => {
  it('buffers the same normal chain, heavy, and aerial intentions outside the Warden duel', () => {
    const engine = combatHarness();
    const p = engine.player;

    for (const expected of [1, 2, 0]) {
      p.attackTimer = 0;
      p.grounded = true;
      p.y = 26 * TILE - p.h;
      p.vy = 0;
      engine.input.pressed.clear();
      engine.input.pressed.add('attack');
      GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
      expect(p.attackKind).toBe('normal');
      expect(p.comboStep).toBe(expected);
    }
    expect(p.attackDamage).toBe(2);

    p.attackTimer = 0;
    p.grounded = true;
    engine.input.down = true;
    engine.input.pressed.clear();
    engine.input.pressed.add('attack');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(p).toMatchObject({ attackKind: 'heavy', attackDamage: 2, comboStep: 0 });

    p.attackTimer = 0;
    p.grounded = false;
    engine.input.down = false;
    engine.input.pressed.clear();
    engine.input.pressed.add('attack');
    GameEngine.prototype.updatePlayer.call(engine, 1 / 60);
    expect(p).toMatchObject({ attackKind: 'aerial', attackDamage: 2, comboStep: 0 });
  });

  it('makes shields reject normal pressure and open to DOWN plus STRIKE', () => {
    const engine = combatHarness();
    const shield = standardSoldier(engine, 'shield');
    engine.soldiers = [shield];
    Object.assign(engine.player, { attackTimer: .2, attackKind: 'normal', attackDamage: 1 });

    GameEngine.prototype.resolveAttackHits.call(engine);
    expect(shield).toMatchObject({ hp: 4, attackPhase: 'guard' });
    expect(engine.setHint).toHaveBeenLastCalledWith(expect.stringContaining('DOWN + STRIKE'), 2.4);

    engine.player.attackHits.clear();
    Object.assign(engine.player, { attackTimer: .2, attackKind: 'heavy', attackDamage: 2 });
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
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.audio.play).toHaveBeenLastCalledWith('block');
  });
});
