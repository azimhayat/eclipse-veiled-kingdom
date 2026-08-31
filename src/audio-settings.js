export const AUDIO_SETTINGS_VERSION = 1;
export const AUDIO_SETTINGS_KEY = 'eotvk-audio-v1';

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  schemaVersion: AUDIO_SETTINGS_VERSION,
  muted: true,
  musicVolume: .55,
  effectsVolume: .7,
});

function clampVolume(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function safeParse(raw) {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeRead(storage) {
  try {
    return storage?.getItem?.(AUDIO_SETTINGS_KEY) ?? null;
  } catch {
    return null;
  }
}

function safeWrite(storage, settings) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function sanitizeAudioSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    && value.schemaVersion === AUDIO_SETTINGS_VERSION
    ? value
    : {};

  return {
    schemaVersion: AUDIO_SETTINGS_VERSION,
    muted: typeof source.muted === 'boolean' ? source.muted : DEFAULT_AUDIO_SETTINGS.muted,
    musicVolume: clampVolume(source.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    effectsVolume: clampVolume(source.effectsVolume, DEFAULT_AUDIO_SETTINGS.effectsVolume),
  };
}

export function loadAudioSettings({ storage } = {}) {
  const parsed = safeParse(safeRead(storage));
  const stored = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    && parsed.schemaVersion === AUDIO_SETTINGS_VERSION;
  return {
    settings: sanitizeAudioSettings(parsed),
    source: stored ? 'stored' : 'default',
  };
}

export function persistAudioSettings({ storage, settings } = {}) {
  const normalised = sanitizeAudioSettings(settings);
  return {
    settings: normalised,
    persisted: safeWrite(storage, normalised),
  };
}
