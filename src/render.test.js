import { describe, expect, it } from 'vitest';
import { drawLevelMechanics } from './render.js';
import { TILE } from './levels/constants.js';
import { createPilgrimsClimb } from './levels/outerVeil/pilgrimsClimb.js';

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
