import { describe, expect, it } from 'vitest';
import {
  FIXED_DT,
  PHYSICS,
  gravityForVelocity,
  measureMovementFeel,
  settlingSeconds,
} from './movement-physics.js';

const BASELINE = Object.freeze({
  ...PHYSICS,
  GROUND_ACCEL: 2400,
  AIR_ACCEL: 1500,
  GROUND_FRICTION: 2100,
  AIR_DRAG: 280,
  JUMP_VEL: -860,
  GRAVITY_DOWN: 3050,
  APEX_SPEED: 0,
  APEX_GRAVITY_SCALE: 1,
  COYOTE: .1,
  JUMP_BUFFER: .12,
  WALL_JUMP_X: 340,
  WALL_JUMP_Y_SCALE: .88,
  WALL_JUMP_CONTROL_LOCK: 0,
});

describe('movement feel diagnostics', () => {
  it('measures a faster but still weighted ground response', () => {
    const before = measureMovementFeel(BASELINE);
    const after = measureMovementFeel(PHYSICS);

    expect(after.acceleration.seconds).toBeLessThan(before.acceleration.seconds);
    expect(after.acceleration.seconds).toBeGreaterThan(.09);
    expect(after.stop.seconds).toBeLessThanOrEqual(.14);
    expect(after.stop.distance).toBeLessThan(before.stop.distance);
    expect(after.reversal.seconds).toBeLessThan(before.reversal.seconds);
  });

  it('cuts released air drift without changing the authored jump envelope materially', () => {
    const before = measureMovementFeel(BASELINE);
    const after = measureMovementFeel(PHYSICS);

    expect(after.airRelease.distance).toBeLessThan(before.airRelease.distance * .78);
    expect(after.fullJump.height).toBeGreaterThan(before.fullJump.height - 8);
    expect(after.fullJump.height).toBeLessThan(before.fullJump.height + 8);
    expect(after.fullJump.distance).toBeGreaterThan(230);
    expect(after.shortJump.height).toBeLessThan(after.fullJump.height * .55);
    expect(Math.abs(after.airReverse.distance)).toBeGreaterThan(Math.abs(before.airReverse.distance));
  });

  it('softens gravity only near apex and retains one fixed physical model', () => {
    expect(gravityForVelocity(-PHYSICS.APEX_SPEED - 1)).toBe(PHYSICS.GRAVITY_UP);
    expect(gravityForVelocity(-1)).toBeCloseTo(PHYSICS.GRAVITY_UP * PHYSICS.APEX_GRAVITY_SCALE);
    expect(gravityForVelocity(1)).toBeCloseTo(PHYSICS.GRAVITY_DOWN * PHYSICS.APEX_GRAVITY_SCALE);
    expect(measureMovementFeel(PHYSICS).fixedStepMs).toBeCloseTo(FIXED_DT * 1000, 2);
  });

  it('keeps camera follow responsive while changing directional lead more deliberately', () => {
    const diagnostics = measureMovementFeel(PHYSICS).camera;
    expect(diagnostics.follow90PercentSeconds).toBeCloseTo(.333, 3);
    expect(diagnostics.lookAhead90PercentSeconds).toBeCloseTo(.333, 3);
    expect(settlingSeconds(1)).toBe(0);
  });
});
