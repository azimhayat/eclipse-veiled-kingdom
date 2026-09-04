import { describe, expect, it } from 'vitest';
import {
  clampTouchVector,
  getTouchDirectionActions,
  resolveTouchDirection,
  TOUCH_DIRECTION_DEAD_ZONE,
} from './touch-direction.js';

describe('eight-direction touch movement', () => {
  const radius = 100;

  it.each([
    ['right', 80, 0],
    ['down-right', 70, 70],
    ['down', 0, 80],
    ['down-left', -70, 70],
    ['left', -80, 0],
    ['up-left', -70, -70],
    ['up', 0, -80],
    ['up-right', 70, -70],
  ])('snaps %s from the pointer vector', (direction, dx, dy) => {
    expect(resolveTouchDirection(dx, dy, radius)).toBe(direction);
  });

  it('keeps the stick neutral inside its activation dead zone', () => {
    const inside = radius * TOUCH_DIRECTION_DEAD_ZONE - 0.01;
    expect(resolveTouchDirection(inside, 0, radius)).toBeNull();
  });

  it('registers both axes for every diagonal', () => {
    expect(getTouchDirectionActions('up-right')).toEqual(['right', 'climb']);
    expect(getTouchDirectionActions('up-left')).toEqual(['left', 'climb']);
    expect(getTouchDirectionActions('down-right')).toEqual(['right', 'down']);
    expect(getTouchDirectionActions('down-left')).toEqual(['left', 'down']);
  });

  it('holds the current sector near a direction boundary to prevent flicker', () => {
    const twentyEightDegrees = 28 * Math.PI / 180;
    const dx = Math.cos(twentyEightDegrees) * radius;
    const dy = Math.sin(twentyEightDegrees) * radius;
    expect(resolveTouchDirection(dx, dy, radius)).toBe('down-right');
    expect(resolveTouchDirection(dx, dy, radius, 'right')).toBe('right');
  });

  it('releases cleanly near centre after a direction was active', () => {
    expect(resolveTouchDirection(8, -8, radius, 'up-right')).toBeNull();
  });

  it('clamps the presented thumb without changing its direction', () => {
    const clamped = clampTouchVector(60, -80, 40);
    expect(clamped.x).toBeCloseTo(24, 5);
    expect(clamped.y).toBeCloseTo(-32, 5);
    expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(40, 5);
  });
});
