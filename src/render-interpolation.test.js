import { describe, expect, it } from 'vitest';
import {
  captureMotion,
  consumeFixedSteps,
  interpolateMotion,
  interpolationAlpha,
  measureRenderCadence,
  resetMotion,
  snapMotionAxis,
} from './render-interpolation.js';
import { FIXED_DT } from './movement-physics.js';

function runAt(renderHz, seconds = 2) {
  let accumulator = 0;
  let simulationX = 0;
  let steps = 0;
  const rendered = [];
  const actor = { x: 0, y: 0 };
  resetMotion(actor);
  for (let frame = 0; frame < renderHz * seconds; frame += 1) {
    accumulator = consumeFixedSteps(accumulator, 1 / renderHz, (dt) => {
      captureMotion(actor);
      simulationX += 180 * dt;
      actor.x = simulationX;
      steps += 1;
    }, FIXED_DT);
    interpolateMotion(actor, interpolationAlpha(accumulator, FIXED_DT));
    rendered.push(actor.renderX);
  }
  return { steps, simulationX, rendered };
}

describe('fixed-step render interpolation', () => {
  it.each([60, 90, 120])('keeps deterministic 60 Hz simulation at %i Hz rendering', (renderHz) => {
    const result = runAt(renderHz);
    expect(result.steps).toBe(120);
    expect(result.simulationX).toBeCloseTo(360, 8);
  });

  it('reports the cadence-bound input presentation gap without hiding 90 Hz aliasing', () => {
    expect([60, 90, 120].map((hz) => measureRenderCadence(hz, FIXED_DT))).toEqual([
      { renderHz: 60, physicsSteps: 120, maximumInputToPhysicsPresentationMs: 16.667 },
      { renderHz: 90, physicsSteps: 120, maximumInputToPhysicsPresentationMs: 22.222 },
      { renderHz: 120, physicsSteps: 120, maximumInputToPhysicsPresentationMs: 16.667 },
    ]);
  });

  it('fills intermediate visual positions at 90 and 120 Hz', () => {
    for (const renderHz of [90, 120]) {
      const positions = runAt(renderHz, 1).rendered;
      const fractionalSamples = positions.filter((value) => Math.abs(value / 3 - Math.round(value / 3)) > .001);
      expect(fractionalSamples.length).toBeGreaterThan(renderHz / 4);
    }
  });

  it('resets teleports and can expose the first input-driven step without an extra interpolation tick', () => {
    const actor = { x: 20, y: 40 };
    resetMotion(actor);
    captureMotion(actor);
    actor.x = 180;
    actor.y = 240;
    resetMotion(actor);
    interpolateMotion(actor, .15);
    expect(actor).toMatchObject({ renderX: 180, renderY: 240 });

    captureMotion(actor);
    actor.x = 184;
    snapMotionAxis(actor, 'x');
    interpolateMotion(actor, 0);
    expect(actor.renderX).toBe(184);
  });
});
