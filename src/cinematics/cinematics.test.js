import { describe, expect, it, vi } from 'vitest';
import {
  CINEMATIC_CATALOG_VERSION,
  getCinematic,
  getCinematicSequence,
  validateCinematicCatalog,
} from './catalog.js';
import {
  cinematicAudioSettings,
  createCinematicSequenceController,
  formatCinematicTime,
  isolateGameForCinematic,
  reducedMotionRequested,
} from './runtime.js';

describe('V5 cinematic catalog', () => {
  it('uses stable versioned media paths and one default WebVTT caption per film', () => {
    expect(CINEMATIC_CATALOG_VERSION).toBe('v5-launch-cinematics-v3');
    expect(validateCinematicCatalog()).toBe(true);
    const sequence = getCinematicSequence('chapter-one-opening', { baseUrl: '/eclipse-veiled-kingdom/' });
    expect(sequence.map((item) => item.src)).toEqual([
      '/eclipse-veiled-kingdom/assets/cinematics/opening-prologue-v2.mp4',
      '/eclipse-veiled-kingdom/assets/cinematics/chapter-one-introduction-v2.mp4',
    ]);
    for (const item of sequence) {
      expect(item.captions).toHaveLength(1);
      expect(item.captions[0]).toMatchObject({ kind: 'captions', srcLang: 'en', default: true });
      expect(item.captions[0].src).toMatch(/\.en\.vtt$/);
    }
    expect(getCinematicSequence('chapter-one-to-two-bridge', { baseUrl: '/eclipse-veiled-kingdom/' })[0].src)
      .toBe('/eclipse-veiled-kingdom/assets/cinematics/chapter-one-to-two-bridge-v2.mp4');
    expect(getCinematicSequence('chapter-two-to-three-bridge', { baseUrl: '/eclipse-veiled-kingdom/' })[0].src)
      .toBe('/eclipse-veiled-kingdom/assets/cinematics/chapter-two-to-three-bridge-v2.mp4');
    expect(getCinematicSequence('story-one-films')).toHaveLength(4);
    expect(getCinematic('missing')).toBeNull();
    expect(getCinematicSequence('missing')).toBeNull();
  });
});

describe('cinematic sequence completion', () => {
  it('advances once when ended and skip race, then completes the run exactly once', () => {
    const complete = vi.fn();
    const controller = createCinematicSequenceController(['opening', 'chapter'], complete);
    expect(controller.settleCurrent('ended', 0)).toEqual({ accepted: true, done: false, index: 1 });
    expect(controller.settleCurrent('late-skip', 0)).toEqual({ accepted: false, done: false, index: 1 });
    expect(controller.settleCurrent('skip', 1)).toEqual({ accepted: true, done: true, index: 1 });
    expect(controller.settleCurrent('duplicate-ended', 1)).toEqual({ accepted: false, done: true, index: 1 });
    expect(controller.skipRemaining()).toEqual({ accepted: false, done: true, index: 1 });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({ reason: 'skip', completedCount: 2, total: 2 });
  });

  it('skips the entire sequence through the same one-shot completion gate', () => {
    const complete = vi.fn();
    const controller = createCinematicSequenceController(['opening', 'chapter'], complete);
    expect(controller.skipRemaining()).toEqual({ accepted: true, done: true, index: 1 });
    expect(controller.skipRemaining()).toEqual({ accepted: false, done: true, index: 1 });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe('cinematic runtime isolation', () => {
  it('pauses gameplay and game audio, then restores both exactly once without changing mute settings', async () => {
    const context = { state: 'running', suspend: vi.fn(), resume: vi.fn() };
    const settings = { muted: true, musicVolume: .4, effectsVolume: .7 };
    const engine = {
      mode: 'play',
      audio: { context, settings },
      pause: vi.fn((paused) => { engine.mode = paused ? 'paused' : 'play'; }),
    };
    const isolation = isolateGameForCinematic(engine);
    expect(engine.pause).toHaveBeenCalledWith(true);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(engine.audio.settings).toEqual(settings);
    expect(isolation.restore()).toBe(true);
    expect(isolation.restore()).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(engine.pause).toHaveBeenLastCalledWith(false);
    expect(engine.audio.settings).toEqual(settings);
  });

  it('does not start, pause, or mutate an idle title engine', () => {
    const engine = { mode: 'title', pause: vi.fn(), audio: { context: null } };
    const isolation = isolateGameForCinematic(engine);
    expect(engine.pause).not.toHaveBeenCalled();
    expect(isolation.restore()).toBe(true);
    expect(engine.pause).not.toHaveBeenCalled();
  });

  it('captures an audio context unlocked after the cinematic overlay opens', async () => {
    const context = { state: 'running', suspend: vi.fn(), resume: vi.fn() };
    const engine = { mode: 'title', pause: vi.fn(), audio: { context: null } };
    const isolation = isolateGameForCinematic(engine);
    engine.audio.context = context;
    expect(isolation.refresh()).toBe(true);
    expect(isolation.refresh()).toBe(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(isolation.restore()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(engine.pause).not.toHaveBeenCalled();
  });

  it('derives muted media audio and detects reduced-motion without side effects', () => {
    expect(cinematicAudioSettings({ muted: true, musicVolume: .8, effectsVolume: 1 })).toEqual({ muted: true, volume: 0 });
    expect(cinematicAudioSettings({ muted: false, musicVolume: .35, effectsVolume: .65 })).toEqual({ muted: false, volume: .35 });
    expect(cinematicAudioSettings({ muted: false, musicVolume: 0, effectsVolume: 1 })).toEqual({ muted: false, volume: 0 });
    expect(reducedMotionRequested(() => ({ matches: true }))).toBe(true);
    expect(reducedMotionRequested(() => { throw new Error('blocked'); })).toBe(false);
    expect(formatCinematicTime(125.9)).toBe('02:05');
  });
});
