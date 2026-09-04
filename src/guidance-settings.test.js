import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUIDANCE_SETTINGS,
  GUIDANCE_SETTINGS_KEY,
  isEssentialGuidance,
  loadGuidanceSettings,
  persistGuidanceSettings,
  sanitizeGuidanceSettings,
} from './guidance-settings.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key),
  };
}

describe('persistent guidance settings', () => {
  it('defaults to contextual auto guidance and rejects invalid modes', () => {
    expect(loadGuidanceSettings()).toEqual({ settings: DEFAULT_GUIDANCE_SETTINGS, source: 'default' });
    expect(sanitizeGuidanceSettings({ schemaVersion: 1, mode: 'always-maybe' }))
      .toEqual(DEFAULT_GUIDANCE_SETTINGS);
  });

  it.each(['auto', 'on', 'off'])('round-trips %s mode', (mode) => {
    const target = storage();
    const result = persistGuidanceSettings({ storage: target, settings: { schemaVersion: 1, mode } });
    expect(result).toEqual({ settings: { schemaVersion: 1, mode }, persisted: true });
    expect(JSON.parse(target.value(GUIDANCE_SETTINGS_KEY))).toEqual(result.settings);
    expect(loadGuidanceSettings({ storage: target })).toEqual({ settings: result.settings, source: 'stored' });
  });

  it('keeps immediate combat and state feedback visible when optional hints are off', () => {
    expect(isEssentialGuidance('PERFECT GUARD · counter now')).toBe(true);
    expect(isEssentialGuidance('WRONG AXLE · move the stone')).toBe(true);
    expect(isEssentialGuidance('MEMORY CARVE · find the seal')).toBe(false);
  });
});
