import { describe, expect, it, vi } from 'vitest';
import { AUDIO_SETTINGS_KEY } from './audio-settings.js';
import { AudioManager } from './audio.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key),
  };
}

function param() {
  return {
    value: 0,
    setTargetAtTime: vi.fn(function setTarget(value) { this.value = value; }),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function audioHarness() {
  const oscillators = [];
  class FakeNode {
    constructor() { this.gain = param(); this.connect = vi.fn(); this.disconnect = vi.fn(); }
  }
  class FakeOscillator extends FakeNode {
    constructor() { super(); this.frequency = param(); this.start = vi.fn(); this.stop = vi.fn(); this.onended = null; }
  }
  class FakeContext {
    constructor() { this.state = 'suspended'; this.currentTime = 3; this.destination = new FakeNode(); this.close = vi.fn(async () => { this.state = 'closed'; }); }
    createGain() { return new FakeNode(); }
    createDynamicsCompressor() { return new FakeNode(); }
    createOscillator() { const oscillator = new FakeOscillator(); oscillators.push(oscillator); return oscillator; }
    async resume() { this.state = 'running'; }
  }
  return { FakeContext, oscillators };
}

describe('adaptive audio manager', () => {
  it('fails closed when Web Audio is unavailable', async () => {
    const manager = new AudioManager({ windowObject: {}, storage: null });
    expect(await manager.unlock()).toBe(false);
    expect(manager.play('jump')).toBe(false);
    expect(manager.toggle()).toBe(false);
    await expect(manager.destroy()).resolves.toBeUndefined();
  });

  it('builds separate buses once and applies persistent settings', async () => {
    const data = storage();
    const { FakeContext } = audioHarness();
    const manager = new AudioManager({ AudioContextClass: FakeContext, storage: data });
    expect(await manager.unlock()).toBe(true);
    const firstContext = manager.context;
    manager.setMusicVolume(.25);
    manager.setEffectsVolume(.8);
    manager.setMuted(false);
    expect(manager.context).toBe(firstContext);
    expect(manager.musicBus.gain.value).toBeCloseTo(.25 * .68);
    expect(manager.effectsBus.gain.value).toBeCloseTo(.8 * .78);
    expect(manager.master.gain.value).toBeCloseTo(.82);
    expect(JSON.parse(data.value(AUDIO_SETTINGS_KEY))).toMatchObject({ muted: false, musicVolume: .25, effectsVolume: .8 });
  });

  it('schedules bounded effects and a deterministic adaptive score only after unlock and unmute', async () => {
    const { FakeContext, oscillators } = audioHarness();
    const manager = new AudioManager({ AudioContextClass: FakeContext, storage: storage() });
    expect(manager.play('attack')).toBe(false);
    await manager.unlock();
    expect(manager.play('attack')).toBe(false);
    manager.setMuted(false);
    expect(manager.play('attack')).toBe(true);
    const afterEffect = oscillators.length;
    expect(manager.update({ mode: 'play', levelKey: 'warden-of-dust', warden: { active: true, phase: 'command' } }, .016)).toBe('warden-command');
    expect(oscillators.length).toBeGreaterThan(afterEffect);
    expect(manager.voices.music.size).toBeLessThanOrEqual(18);
    expect(manager.voices.effects.size).toBeLessThanOrEqual(28);
  });

  it('stops voices and closes the context defensively', async () => {
    const { FakeContext, oscillators } = audioHarness();
    const manager = new AudioManager({ AudioContextClass: FakeContext, storage: storage() });
    await manager.unlock();
    manager.setMuted(false);
    manager.play('gate');
    const context = manager.context;
    await manager.destroy();
    expect(oscillators.every((voice) => voice.stop.mock.calls.length >= 2)).toBe(true);
    expect(context.close).toHaveBeenCalledOnce();
    expect(manager.context).toBeNull();
  });

  it('fades and stops active music when play is paused, then restores the music bus on resume', async () => {
    const { FakeContext } = audioHarness();
    const manager = new AudioManager({ AudioContextClass: FakeContext, storage: storage() });
    await manager.unlock();
    manager.setMuted(false);
    manager.update({ mode: 'play', levelKey: 'buried-dawn' }, .016);
    const activeVoices = [...manager.voices.music];
    expect(activeVoices.length).toBeGreaterThan(0);
    expect(manager.update({ mode: 'paused', levelKey: 'buried-dawn' }, .016)).toBe('silence');
    expect(activeVoices.every((voice) => voice.stop.mock.calls.some(([time]) => time > manager.context.currentTime))).toBe(true);
    expect(manager.musicBus.gain.setTargetAtTime).toHaveBeenCalledWith(0, manager.context.currentTime, .014);
    manager.update({ mode: 'play', levelKey: 'buried-dawn' }, .016);
    expect(manager.musicBus.gain.setTargetAtTime).toHaveBeenCalledWith(.55 * .68, manager.context.currentTime + .085, .035);
  });
});
