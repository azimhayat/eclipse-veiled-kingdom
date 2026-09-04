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

  it.each([
    ['right', 29],
    ['down-right', 31],
    ['down-right', 59],
    ['down', 61],
    ['down', 119],
    ['down-left', 121],
    ['left', 151],
    ['up-left', 211],
    ['up', 241],
    ['up-right', 301],
    ['right', 331],
  ])('uses wider cardinal zones and deliberate diagonals: %s at %d degrees', (direction, degrees) => {
    const angle = degrees * Math.PI / 180;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    expect(resolveTouchDirection(dx, dy, radius)).toBe(direction);
  });

  it('keeps slight downward thumb drift horizontal but retains a deliberate diagonal', () => {
    const slightDrift = 28 * Math.PI / 180;
    const deliberateDiagonal = 45 * Math.PI / 180;
    expect(resolveTouchDirection(
      Math.cos(slightDrift) * radius,
      Math.sin(slightDrift) * radius,
      radius,
    )).toBe('right');
    expect(resolveTouchDirection(
      Math.cos(deliberateDiagonal) * radius,
      Math.sin(deliberateDiagonal) * radius,
      radius,
    )).toBe('down-right');
  });

  it('holds the current cardinal near its new boundary to prevent flicker', () => {
    const thirtyFourDegrees = 34 * Math.PI / 180;
    const dx = Math.cos(thirtyFourDegrees) * radius;
    const dy = Math.sin(thirtyFourDegrees) * radius;
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
