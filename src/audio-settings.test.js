import { describe, expect, it } from 'vitest';
import {
  AUDIO_SETTINGS_KEY,
  AUDIO_SETTINGS_VERSION,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  sanitizeAudioSettings,
  persistAudioSettings,
} from './audio-settings.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key),
  };
}

describe('persistent audio settings v1', () => {
  it('provides conservative first-run defaults', () => {
    expect(AUDIO_SETTINGS_KEY).toBe('eotvk-audio-v1');
    expect(AUDIO_SETTINGS_VERSION).toBe(1);
    expect(loadAudioSettings()).toEqual({
      settings: {
        schemaVersion: 1,
        muted: true,
        musicVolume: .55,
        effectsVolume: .7,
      },
      source: 'default',
    });
  });

  it('clamps finite volumes, repairs invalid values, and ignores unknown fields', () => {
    expect(sanitizeAudioSettings({
      schemaVersion: 1,
      muted: false,
      musicVolume: 1.8,
      effectsVolume: -.3,
      unknownFutureSetting: 'ignored',
    })).toEqual({
      schemaVersion: 1,
      muted: false,
      musicVolume: 1,
      effectsVolume: 0,
    });

    expect(sanitizeAudioSettings({
      schemaVersion: 1,
      muted: 'no',
      musicVolume: Number.NaN,
      effectsVolume: Number.POSITIVE_INFINITY,
    })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('round-trips only normalized settings under the dedicated key', () => {
    const storage = createStorage();
    const persisted = persistAudioSettings({
      storage,
      settings: {
        schemaVersion: 1,
        muted: false,
        musicVolume: .42,
        effectsVolume: 4,
        extra: true,
      },
    });

    expect(persisted).toEqual({
      settings: {
        schemaVersion: 1,
        muted: false,
        musicVolume: .42,
        effectsVolume: 1,
      },
      persisted: true,
    });
    expect(JSON.parse(storage.value(AUDIO_SETTINGS_KEY))).toEqual(persisted.settings);
    expect(loadAudioSettings({ storage })).toEqual({ settings: persisted.settings, source: 'stored' });
  });

  it.each([
    ['missing', null],
    ['corrupt JSON', '{not-json'],
    ['wrong schema', JSON.stringify({ schemaVersion: 99, muted: false, musicVolume: 1, effectsVolume: 1 })],
    ['non-record JSON', JSON.stringify(['unexpected'])],
  ])('falls back safely for %s storage', (_label, raw) => {
    const initial = raw === null ? {} : { [AUDIO_SETTINGS_KEY]: raw };
    expect(loadAudioSettings({ storage: createStorage(initial) })).toEqual({
      settings: DEFAULT_AUDIO_SETTINGS,
      source: 'default',
    });
  });

  it('never throws when storage is unavailable and reports persistence honestly', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('read blocked'); },
      setItem: () => { throw new Error('write blocked'); },
    };

    expect(loadAudioSettings({ storage: brokenStorage })).toEqual({
      settings: DEFAULT_AUDIO_SETTINGS,
      source: 'default',
    });
    expect(persistAudioSettings({ storage: brokenStorage, settings: DEFAULT_AUDIO_SETTINGS })).toEqual({
      settings: DEFAULT_AUDIO_SETTINGS,
      persisted: false,
    });
    expect(persistAudioSettings({ settings: DEFAULT_AUDIO_SETTINGS }).persisted).toBe(false);
  });
});
