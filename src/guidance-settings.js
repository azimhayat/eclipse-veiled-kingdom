export const GUIDANCE_SETTINGS_VERSION = 1;
export const GUIDANCE_SETTINGS_KEY = 'eotvk-guidance-v1';
export const GUIDANCE_MODES = Object.freeze(['auto', 'on', 'off']);

export const DEFAULT_GUIDANCE_SETTINGS = Object.freeze({
  schemaVersion: GUIDANCE_SETTINGS_VERSION,
  mode: 'auto',
});

function safeParse(raw) {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function sanitizeGuidanceSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    && value.schemaVersion === GUIDANCE_SETTINGS_VERSION
    ? value
    : {};
  return {
    schemaVersion: GUIDANCE_SETTINGS_VERSION,
    mode: GUIDANCE_MODES.includes(source.mode) ? source.mode : DEFAULT_GUIDANCE_SETTINGS.mode,
  };
}

export function loadGuidanceSettings({ storage } = {}) {
  let parsed = null;
  try {
    parsed = safeParse(storage?.getItem?.(GUIDANCE_SETTINGS_KEY) ?? null);
  } catch {
    parsed = null;
  }
  const stored = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    && parsed.schemaVersion === GUIDANCE_SETTINGS_VERSION
    && GUIDANCE_MODES.includes(parsed.mode);
  return {
    settings: sanitizeGuidanceSettings(parsed),
    source: stored ? 'stored' : 'default',
  };
}

export function persistGuidanceSettings({ storage, settings } = {}) {
  const normalised = sanitizeGuidanceSettings(settings);
  let persisted = false;
  try {
    if (typeof storage?.setItem === 'function') {
      storage.setItem(GUIDANCE_SETTINGS_KEY, JSON.stringify(normalised));
      persisted = true;
    }
  } catch {
    persisted = false;
  }
  return { settings: normalised, persisted };
}

const ESSENTIAL_HINT_PREFIX = /^(BLOCK|PERFECT GUARD|GUARD BROKEN|AREN'S GUARD BREAKS|AREN’S GUARD BREAKS|SHIELD HOLDS|TOO EARLY|FORMATION BROKEN|THE WARDEN RISES AGAIN|THE KEEPER YIELDS|THE LAST BINDING BREAKS|OATHBOUND|OATH RELEASED|WRONG AXLE|SEALED|THE PATH FAILED|THE REALM REFORMS)/i;

export function isEssentialGuidance(text) {
  return typeof text === 'string' && ESSENTIAL_HINT_PREFIX.test(text.trim());
}
