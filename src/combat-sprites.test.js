import { describe, expect, it, vi } from 'vitest';
import {
  drawSpriteFrame,
  getVeilRaiderFrame,
  getWardenFrame,
  VEIL_RAIDER_SHEET,
  WARDEN_SHEET,
} from './combat-sprites.js';

describe('production combat sprite contracts', () => {
  it('maps every Level 8 combat state to the authored 4 by 2 sheet deterministically', () => {
    expect(getVeilRaiderFrame({ mode: 'para' })).toBe(VEIL_RAIDER_SHEET.frames.descent);
    expect(getVeilRaiderFrame({ presentation: { state: 'landing' } })).toBe(VEIL_RAIDER_SHEET.frames.landing);
    expect(getVeilRaiderFrame({ presentation: { state: 'anticipation' } })).toBe(VEIL_RAIDER_SHEET.frames.anticipation);
    expect(getVeilRaiderFrame({ presentation: { state: 'contact' } })).toBe(VEIL_RAIDER_SHEET.frames.contact);
    expect(getVeilRaiderFrame({ presentation: { state: 'guard' } })).toBe(VEIL_RAIDER_SHEET.frames.anticipation);
    expect(getVeilRaiderFrame({ attackPhase: 'stun' })).toBe(VEIL_RAIDER_SHEET.frames.recovery);
    expect(getVeilRaiderFrame({ presentation: { state: 'hit' } })).toBe(VEIL_RAIDER_SHEET.frames.hit);
    expect(getVeilRaiderFrame({ hp: 0 })).toBe(VEIL_RAIDER_SHEET.frames.defeat);
    expect(getVeilRaiderFrame({ presentation: { state: 'advance' }, hp: 2 })).toBe(VEIL_RAIDER_SHEET.frames.idle);
  });

  it('draws one exact source cell and keeps the authored foot anchor stable', () => {
    const ctx = { drawImage: vi.fn() };
    const image = { width: 1536, height: 1024 };
    expect(drawSpriteFrame(ctx, image, VEIL_RAIDER_SHEET, VEIL_RAIDER_SHEET.frames.contact)).toBe(true);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      image, 0, 512, 384, 512,
      -44.25, -113.28, 88.5, 118,
    );
  });

  it('maps the Warden phases and actions without relying on wall-clock time', () => {
    expect(getWardenFrame({ boss: { action: 'guard' } })).toBe(WARDEN_SHEET.frames.guard);
    expect(getWardenFrame({ boss: { action: 'windup' } })).toBe(WARDEN_SHEET.frames.windup);
    expect(getWardenFrame({ boss: { action: 'active' } })).toBe(WARDEN_SHEET.frames.contact);
    expect(getWardenFrame({ boss: { action: 'recovery' } })).toBe(WARDEN_SHEET.frames.recovery);
    expect(getWardenFrame({ boss: { action: 'hitstun' } })).toBe(WARDEN_SHEET.frames.hit);
    expect(getWardenFrame({ boss: { action: 'intro', phase: 'eclipse' } })).toBe(WARDEN_SHEET.frames.eclipse);
    expect(getWardenFrame({ phase: 'finale', complete: false, boss: {} })).toBe(WARDEN_SHEET.frames.hit);
    expect(getWardenFrame({ phase: 'finale', complete: true, boss: {} })).toBe(WARDEN_SHEET.frames.restoration);
    expect(getWardenFrame({ boss: { action: 'neutral' } })).toBe(WARDEN_SHEET.frames.idle);
  });

  it('fails safely when the optional artwork is unavailable', () => {
    expect(drawSpriteFrame({ drawImage: vi.fn() }, null, VEIL_RAIDER_SHEET, VEIL_RAIDER_SHEET.frames.idle)).toBe(false);
  });
});
