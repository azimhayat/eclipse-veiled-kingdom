import { describe, expect, it } from 'vitest';
import { drawBoss, drawCombatEvents, drawHero, drawLevelMechanics, drawSoldier, drawVisibleChunks } from './render.js';
import { TILE } from './levels/constants.js';
import { createPilgrimsClimb } from './levels/outerVeil/pilgrimsClimb.js';
import { createParachuteChoir } from './levels/outerVeil/parachuteChoir.js';
import { createWardenOfDust } from './levels/outerVeil/wardenOfDust.js';

function recordingContext() {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(['addColorStop', ...args]) };
  const context = new Proxy({}, {
    get: (_target, property) => {
      if (property === 'calls') return calls;
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return (...args) => {
          calls.push([property, ...args]);
          return gradient;
        };
      }
      return (...args) => calls.push([property, ...args]);
    },
    set: (_target, property, value) => {
      calls.push([`set:${property}`, value]);
      return true;
    },
  });
  return context;
}

function civicScale({ restored = false, completedAt = null } = {}) {
  return {
    objective: {
      type: 'oathbind-restoration',
      restored,
      completedAt,
      finalMonument: {
        tx: 36.2,
        baseTy: 26,
        label: 'The Civic Promise',
        rotation: -.34,
      },
    },
  };
}

describe('bounded level-chunk rendering', () => {
  it('fails safely when a development reload evicts the current baked level', () => {
    const ctx = recordingContext();
    expect(drawVisibleChunks(ctx, undefined, { x: 0, y: 0 })).toBe(false);
    expect(drawVisibleChunks(ctx, [], { x: 0, y: 0 })).toBe(false);
    expect(ctx.calls.some((call) => call[0] === 'drawImage')).toBe(false);
  });
});

describe('deterministic combat rendering', () => {
  it('gives the Nameless Magistrate a distinct paint treatment without changing its authored bounds', () => {
    const geometry = { x: 100, y: 200, w: 58, h: 96, hp: 10, maxHp: 10 };
    const legacyBoss = { ...geometry };
    const magistrateBoss = { ...geometry, visualStyle: 'nameless-magistrate' };
    const legacy = recordingContext();
    const magistrate = recordingContext();
    drawBoss(legacy, legacyBoss, 8);
    drawBoss(magistrate, magistrateBoss, 8);
    expect(magistrate.calls).toContainEqual(['set:shadowColor', '#8ce9f1']);
    expect(magistrate.calls).toContainEqual(['set:fillStyle', '#72dfe8']);
    expect(legacy.calls).toContainEqual(['set:shadowColor', '#d8a746']);
    expect(legacy.calls).toContainEqual(['set:fillStyle', '#e8c56a']);
    expect(magistrateBoss).toEqual({ ...geometry, visualStyle: 'nameless-magistrate' });
    expect(legacyBoss).toEqual(geometry);
  });

  it('uses the authored attack-pose anchor and does not advance a paused presentation from wall time', () => {
    const player = {
      x: 100, y: 200, w: 28, h: 44, vx: 0, facing: 1,
      grounded: true, wallSide: 0, climbing: false, invuln: 0,
      attackTimer: .2, digTimer: 0, guarding: false,
      combatPresentationEnabled: true,
      combatAction: { phase: 'active', phaseProgress: .5 },
      presentation: { state: 'attack-active', clock: .12 },
    };
    const sheet = { width: 1536, height: 1024 };
    const first = recordingContext();
    const laterWallFrame = recordingContext();
    drawHero(first, player, 12, sheet);
    drawHero(laterWallFrame, player, 90, sheet);
    const firstImage = first.calls.find((call) => call[0] === 'drawImage');
    const laterImage = laterWallFrame.calls.find((call) => call[0] === 'drawImage');
    expect(firstImage).toEqual(laterImage);
    expect(firstImage.slice(1)).toEqual([
      sheet, 0, 512, 512, 512,
      -126 * .53, -126 * .82, 126, 126,
    ]);
  });

  it('uses the dedicated forward-strike art and mirrors it with Aren facing', () => {
    const player = {
      x: 100, y: 200, w: 28, h: 44, vx: 0, facing: 1,
      grounded: true, wallSide: 0, climbing: false, invuln: 0,
      attackTimer: .2, digTimer: 0, guarding: false,
      combatPresentationEnabled: false,
      presentation: { state: 'attack-active', clock: .12 },
    };
    const sheet = { width: 1536, height: 1024 };
    const forwardStrike = { width: 512, height: 512 };
    const facingRight = recordingContext();
    const facingLeft = recordingContext();
    drawHero(facingRight, player, 12, sheet, forwardStrike);
    drawHero(facingLeft, { ...player, facing: -1 }, 12, sheet, forwardStrike);
    expect(facingRight.calls).toContainEqual(['scale', 1, 1]);
    expect(facingLeft.calls).toContainEqual(['scale', -1, 1]);
    expect(facingRight.calls.find((call) => call[0] === 'drawImage')).toEqual([
      'drawImage', forwardStrike, 0, 0, 512, 512,
      -126 * .452, -126 * .82, 126, 126,
    ]);
  });

  it('derives contact flashes only from simulation timestamps', () => {
    const event = {
      id: 1, type: 'hit', createdAt: 8, expiresAt: 8.4,
      x: 120, y: 220, facing: -1,
    };
    const first = recordingContext();
    const second = recordingContext();
    drawCombatEvents(first, [event], 8.2);
    drawCombatEvents(second, [event], 8.2);
    expect(first.calls).toEqual(second.calls);
  });

  it('holds the Level 8 defeat pose briefly after gameplay removes the raider', () => {
    const event = {
      id: 2, type: 'defeat', actorKind: 'veil-raider',
      createdAt: 8, expiresAt: 8.52,
      x: 120, y: 220, feetY: 244, facing: -1,
    };
    const sheet = { width: 1536, height: 1024 };
    const context = recordingContext();
    drawCombatEvents(context, [event], 8.26, { veilRaider: sheet });
    expect(context.calls).toContainEqual([
      'drawImage', sheet, 1152, 512, 384, 512,
      -44.25, -113.28, 88.5, 118,
    ]);
  });

  it('uses the Level 8 production sheet when present and preserves the primitive fallback', () => {
    const soldier = {
      id: 'raider-1', x: 100, y: 200, w: 24, h: 44, facing: 1,
      hp: 2, maxHp: 2, mode: 'walk', kind: 'spear', raidMember: true,
      attackPhase: 'active', presentation: { state: 'contact', clock: .08 },
    };
    const sheet = { width: 1536, height: 1024 };
    const production = recordingContext();
    const fallback = recordingContext();
    drawSoldier(production, soldier, 8, sheet);
    drawSoldier(fallback, soldier, 8);
    expect(production.calls).toContainEqual([
      'drawImage', sheet, 0, 512, 384, 512,
      -44.25, -113.28, 88.5, 118,
    ]);
    expect(fallback.calls.some((call) => call[0] === 'drawImage')).toBe(false);
  });

  it('uses the equipment-specific production art for shared combat soldiers', () => {
    const base = {
      id: 'soldier', x: 100, y: 200, w: 24, h: 44, facing: 1,
      hp: 3, maxHp: 3, mode: 'walk', attackPhase: 'guard',
      presentation: { state: 'guard', clock: .08 }, readableMelee: true,
    };
    const raider = { width: 1536, height: 1024, id: 'raider' };
    const keeper = { width: 1536, height: 1024, id: 'keeper' };
    const spearman = { width: 1536, height: 1024, id: 'spearman' };
    const assets = { veilRaider: raider, veilKeeper: keeper, veilSpearman: spearman };
    const shieldContext = recordingContext();
    const spearContext = recordingContext();
    const archerContext = recordingContext();

    drawSoldier(shieldContext, { ...base, kind: 'shield', gateMember: true }, 8, assets);
    drawSoldier(spearContext, { ...base, kind: 'spear', standardCombatMember: true }, 8, assets);
    drawSoldier(archerContext, { ...base, kind: 'archer', standardCombatMember: true }, 8, assets);

    expect(shieldContext.calls.some((call) => call[0] === 'drawImage' && call[1] === keeper)).toBe(true);
    expect(spearContext.calls.some((call) => call[0] === 'drawImage' && call[1] === spearman)).toBe(true);
    expect(archerContext.calls.some((call) => call[0] === 'drawImage' && call[1] === raider)).toBe(true);
    expect(archerContext.calls.some((call) => call[0] === 'arc')).toBe(true);
  });
});

describe('Civic Promise restoration rendering', () => {
  it('keeps the pillar upright while the unrestored scale beam carries the crooked angle', () => {
    const ctx = recordingContext();
    drawLevelMechanics(ctx, civicScale(), 8, false);

    const pivotIndex = ctx.calls.findIndex((call) => call[0] === 'translate'
      && call[1] === 0 && call[2] === -94);
    const rotationIndex = ctx.calls.findIndex((call) => call[0] === 'rotate');
    expect(ctx.calls).toContainEqual(['translate', 36.2 * TILE, 26 * TILE]);
    expect(pivotIndex).toBeGreaterThan(-1);
    expect(rotationIndex).toBeGreaterThan(pivotIndex);
    expect(ctx.calls[rotationIndex][1]).toBeCloseTo(-.34, 5);
    expect(ctx.calls.filter((call) => call[0] === 'rotate').map((call) => call[1])).toEqual([
      -.34,
      .34,
      .34,
    ]);
  });

  it('levels the scale beam within the restoration beat after the final bind', () => {
    const midway = recordingContext();
    const settled = recordingContext();
    drawLevelMechanics(midway, civicScale({ restored: true, completedAt: 10 }), 10.55, false);
    drawLevelMechanics(settled, civicScale({ restored: true, completedAt: 10 }), 11.1, false);

    const midwayRotation = midway.calls.find((call) => call[0] === 'rotate')[1];
    const settledRotation = settled.calls.find((call) => call[0] === 'rotate')[1];
    expect(Math.abs(midwayRotation)).toBeLessThan(.34);
    expect(Math.abs(midwayRotation)).toBeGreaterThan(0);
    expect(settledRotation).toBeCloseTo(0, 5);
  });
});

describe('Pilgrim bell puzzle rendering', () => {
  it('renders three distinct clue-labelled chimes before the tower is restored', () => {
    const level = createPilgrimsClimb();
    const ctx = recordingContext();
    drawLevelMechanics(ctx, level, 8, false);

    const labels = ctx.calls
      .filter((call) => call[0] === 'fillText')
      .map((call) => call[1]);
    expect(labels).toEqual(expect.arrayContaining(['DAWN', 'VEIL', 'SHELTER']));

    level.objective.bell.restored = true;
    const restoredCtx = recordingContext();
    drawLevelMechanics(restoredCtx, level, 9, true);
    const restoredLabels = restoredCtx.calls
      .filter((call) => call[0] === 'fillText')
      .map((call) => call[1]);
    expect(restoredLabels).not.toEqual(expect.arrayContaining(['DAWN', 'VEIL', 'SHELTER']));
  });
});

describe('Parachute Choir skyboard rendering', () => {
  it('rotates the six-tile beam around its fixed support and shows the balance marks', () => {
    const level = createParachuteChoir();
    level.objective.skycut.seesaw.angle = .1;
    level.objective.skycut.seesaw.balanceSeconds = .4;
    const ctx = recordingContext();

    drawLevelMechanics(ctx, level, 8, false);

    const seesaw = level.objective.skycut.seesaw;
    const pivotIndex = ctx.calls.findIndex((call) => call[0] === 'translate'
      && call[1] === seesaw.pivotX && call[2] === seesaw.pivotY);
    const rotationIndex = ctx.calls.findIndex((call, index) => index > pivotIndex
      && call[0] === 'rotate' && call[1] === seesaw.angle);
    expect(pivotIndex).toBeGreaterThan(-1);
    expect(rotationIndex).toBeGreaterThan(pivotIndex);
    expect(ctx.calls.filter((call) => call[0] === 'fillRect' && call[3] === 8 && call[4] === 8)).toHaveLength(3);
  });

  it('renders the final cyan updraft and broad sky-ring only during the third puzzle', () => {
    const level = createParachuteChoir();
    level.objective.phase = 'updraft';
    level.objective.windLoom.state = 'lift';
    const ctx = recordingContext();

    drawLevelMechanics(ctx, level, 8, false);

    const ring = level.objective.windLoom.ring;
    expect(ctx.calls).toContainEqual([
      'ellipse', ring.tx * TILE, ring.ty * TILE, ring.radius, ring.radius * .38, 0, 0, Math.PI * 2,
    ]);
    expect(ctx.calls).toContainEqual(['fillText', 'RIDE', ring.tx * TILE, ring.ty * TILE - 18]);
  });
});

describe('Warden duel rendering', () => {
  it('selects the production contact frame when the optional Warden sheet is ready', () => {
    const level = createWardenOfDust();
    level.objective.phase = 'duel';
    level.objective.duel.active = true;
    level.objective.duel.boss.action = 'active';
    const sheet = { width: 1536, height: 1024 };
    const ctx = recordingContext();

    drawLevelMechanics(ctx, level, 8, false, { warden: sheet });

    expect(ctx.calls).toContainEqual([
      'drawImage', sheet, 1152, 0, 384, 512,
      -79.5, -203.51999999999998, 159, 212,
    ]);
  });

  it('draws a grounded moving fighter, phase pips, and an authored sand special', () => {
    const level = createWardenOfDust();
    level.objective.phase = 'duel';
    level.objective.crownPath.restored = true;
    level.objective.duel.active = true;
    level.objective.duel.phase = 'command';
    level.objective.duel.boss.phase = 'command';
    level.objective.duel.boss.action = 'windup';
    level.objective.duel.boss.attackKind = 'sand-wave';
    const ctx = recordingContext();

    drawLevelMechanics(ctx, level, 8, false);

    expect(ctx.calls).toContainEqual([
      'translate', level.objective.duel.boss.target.x, level.objective.duel.arena.feetTy * TILE,
    ]);
    expect(ctx.calls).toContainEqual(['scale', -1, 1]);
    expect(ctx.calls).toContainEqual(['lineTo', 72, 0]);
    expect(ctx.calls.filter((call) => call[0] === 'arc' && call[3] === 6)).toHaveLength(3);
    const pipColors = ctx.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call[0] === 'arc' && call[3] === 6)
      .map(({ index }) => ctx.calls.slice(0, index).findLast((call) => call[0] === 'set:fillStyle')?.[1]);
    expect(pipColors).toEqual(Array(3).fill('rgba(229,186,86,.45)'));
    expect(ctx.calls).toContainEqual(['set:strokeStyle', '#dfb653']);
  });

  it('changes the Warden pose between an active strike and recovery', () => {
    const level = createWardenOfDust();
    level.objective.phase = 'duel';
    level.objective.duel.active = true;
    level.objective.duel.boss.action = 'active';
    const danger = recordingContext();
    drawLevelMechanics(danger, level, 8, false);

    level.objective.duel.boss.action = 'recovery';
    const recovery = recordingContext();
    drawLevelMechanics(recovery, level, 8.2, false);

    expect(danger.calls).toContainEqual(['lineTo', 70, -71]);
    expect(recovery.calls).toContainEqual(['lineTo', 28, -58]);
  });

  it('draws a visible guard arc whose colour warns when the guard meter is nearly broken', () => {
    const level = createWardenOfDust();
    level.objective.phase = 'duel';
    level.objective.duel.active = true;
    level.objective.duel.boss.action = 'guard';
    level.objective.duel.boss.guarding = true;
    const held = recordingContext();
    drawLevelMechanics(held, level, 8, false);
    expect(held.calls).toContainEqual(['setLineDash', [18, 7]]);
    expect(held.calls).toContainEqual(['arc', 16, -78, 58, -1.22, 1.18]);
    expect(held.calls).toContainEqual(['set:strokeStyle', '#f3c969']);

    level.objective.duel.boss.guardMeter = 1;
    const exposed = recordingContext();
    drawLevelMechanics(exposed, level, 8.2, false);
    expect(exposed.calls).toContainEqual(['set:strokeStyle', '#ef7764']);
  });

  it('keeps the sweep local while the sand-wave special reaches farther across the fighting floor', () => {
    const level = createWardenOfDust();
    level.objective.phase = 'duel';
    level.objective.duel.active = true;
    level.objective.duel.boss.action = 'windup';
    level.objective.duel.boss.attackKind = 'dust-sweep';
    const sweep = recordingContext();
    drawLevelMechanics(sweep, level, 8, false);

    level.objective.duel.boss.attackKind = 'sand-wave';
    const sandWave = recordingContext();
    drawLevelMechanics(sandWave, level, 8, false);

    const edgeY = level.objective.duel.arena.feetTy * TILE - 8;
    expect(sweep.calls).toContainEqual(['moveTo', level.objective.duel.boss.target.x - 2.75 * TILE * .55, edgeY]);
    expect(sandWave.calls).toContainEqual(['moveTo', level.objective.duel.boss.target.x - 5.1 * TILE, edgeY]);
  });
});
