import {
  INNER_KINGDOM_REALM_KEY,
  OUTER_VEIL_ABILITY_KEYS,
  OUTER_VEIL_CAMPAIGN_CATALOG,
  OUTER_VEIL_LEVEL_KEYS,
  OUTER_VEIL_REALM_KEY,
} from './campaign/outerVeilCampaign.js';

export const SAVE_VERSION = 4;
export const CAMPAIGN_ID = 'kingdom-100-v1';
export const CAMPAIGN_SAVE_KEY = 'eotvk-save-v4';
export const PREVIOUS_CAMPAIGN_SAVE_KEY = 'eotvk-save-v3';
export const INTERIM_SAVE_KEY = 'eotvk-save-v2';
export const LEGACY_SAVE_KEY = 'eotvk-save-v1';
export const DEFAULT_CAMPAIGN_LEVELS = 100;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normaliseTotalLevels(value) {
  const candidate = Number.isInteger(value) && value > 0 ? value : DEFAULT_CAMPAIGN_LEVELS;
  return Math.min(candidate, 10000);
}

function normaliseTimestamp(value, fallback) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function currentTimestamp(now) {
  try {
    const value = typeof now === 'function' ? now() : new Date();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  } catch {
    // A broken injected clock must not prevent the game from loading.
  }
  return new Date(0).toISOString();
}

function safeParse(raw) {
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function safeRead(storage, key) {
  try { return storage?.getItem?.(key) ?? null; } catch { return null; }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
    return typeof storage?.setItem === 'function';
  } catch {
    return false;
  }
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === 'string' && item.trim() !== ''))];
}

function knownCompletionPrefix(value) {
  const completed = new Set(uniqueStrings(value));
  const prefix = [];
  for (const key of OUTER_VEIL_LEVEL_KEYS) {
    if (!completed.has(key)) break;
    prefix.push(key);
  }
  return prefix;
}

function abilityKeysForProgress(completedCount) {
  const activeOrder = Math.min(OUTER_VEIL_CAMPAIGN_CATALOG.length, completedCount + 1);
  return OUTER_VEIL_CAMPAIGN_CATALOG
    .filter((entry) => entry.campaignOrder <= activeOrder && entry.unlocksAbility)
    .map((entry) => entry.unlocksAbility);
}

function normaliseLegacyPrototype(value) {
  if (!isRecord(value)
    || value.campaignLevels !== 10
    || !Number.isFinite(value.bestTimeSeconds)
    || value.bestTimeSeconds < 0) return null;
  return {
    campaignLevels: 10,
    bestTimeSeconds: value.bestTimeSeconds,
    completedAt: normaliseTimestamp(value.completedAt, null),
  };
}

function normaliseLevelRecordsByKey(value) {
  if (!isRecord(value)) return {};
  const records = {};
  for (const key of OUTER_VEIL_LEVEL_KEYS) {
    const record = value[key];
    if (!isRecord(record)) continue;
    records[key] = {
      completed: record.completed === true,
      bestTimeSeconds: Number.isFinite(record.bestTimeSeconds) && record.bestTimeSeconds >= 0
        ? record.bestTimeSeconds
        : null,
      completedAt: normaliseTimestamp(record.completedAt, null),
    };
  }
  return records;
}

function normaliseRealmRecords(value) {
  if (!isRecord(value) || !isRecord(value[OUTER_VEIL_REALM_KEY])) return {};
  const record = value[OUTER_VEIL_REALM_KEY];
  return {
    [OUTER_VEIL_REALM_KEY]: {
      bestTimeSeconds: Number.isFinite(record.bestTimeSeconds) && record.bestTimeSeconds >= 0
        ? record.bestTimeSeconds
        : null,
      completedAt: normaliseTimestamp(record.completedAt, null),
    },
  };
}

export function createCampaignSave({ totalLevels = DEFAULT_CAMPAIGN_LEVELS, now = () => new Date() } = {}) {
  const timestamp = currentTimestamp(now);
  return {
    schemaVersion: SAVE_VERSION,
    campaignId: CAMPAIGN_ID,
    totalLevels: normaliseTotalLevels(totalLevels),
    progress: {
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
      completedLevelKeys: [],
      unlockedAbilityKeys: [],
      completedRealmKeys: [],
      unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY],
    },
    records: {
      levelsByKey: {},
      realmsByKey: {},
      legacyPrototype: null,
      unmappedV3Progress: null,
    },
    meta: { createdAt: timestamp, updatedAt: timestamp, migratedFrom: null },
  };
}

export function normaliseCampaignSave(value, {
  totalLevels = DEFAULT_CAMPAIGN_LEVELS,
  now = () => new Date(),
} = {}) {
  if (!isRecord(value)
    || value.schemaVersion !== SAVE_VERSION
    || value.campaignId !== CAMPAIGN_ID
    || !isRecord(value.progress)
    || !isRecord(value.records)) return null;

  const timestamp = currentTimestamp(now);
  const base = createCampaignSave({
    totalLevels: Math.max(normaliseTotalLevels(totalLevels), normaliseTotalLevels(value.totalLevels)),
    now: () => timestamp,
  });
  const completedLevelKeys = knownCompletionPrefix(value.progress.completedLevelKeys);
  const realmComplete = completedLevelKeys.length === OUTER_VEIL_LEVEL_KEYS.length;
  const currentLevelKey = realmComplete
    ? OUTER_VEIL_LEVEL_KEYS.at(-1)
    : OUTER_VEIL_LEVEL_KEYS[completedLevelKeys.length];
  const meta = isRecord(value.meta) ? value.meta : {};

  return {
    ...base,
    progress: {
      currentLevelKey,
      completedLevelKeys,
      unlockedAbilityKeys: abilityKeysForProgress(completedLevelKeys.length),
      completedRealmKeys: realmComplete ? [OUTER_VEIL_REALM_KEY] : [],
      unlockedRealmSlotKeys: realmComplete
        ? [OUTER_VEIL_REALM_KEY, INNER_KINGDOM_REALM_KEY]
        : [OUTER_VEIL_REALM_KEY],
    },
    records: {
      levelsByKey: normaliseLevelRecordsByKey(value.records.levelsByKey),
      realmsByKey: normaliseRealmRecords(value.records.realmsByKey),
      legacyPrototype: normaliseLegacyPrototype(value.records.legacyPrototype),
      unmappedV3Progress: isRecord(value.records.unmappedV3Progress)
        ? { ...value.records.unmappedV3Progress }
        : null,
    },
    meta: {
      createdAt: normaliseTimestamp(meta.createdAt, timestamp),
      updatedAt: normaliseTimestamp(meta.updatedAt, timestamp),
      migratedFrom: typeof meta.migratedFrom === 'string' ? meta.migratedFrom : null,
    },
  };
}

export function migrateLegacySave(value, {
  totalLevels = DEFAULT_CAMPAIGN_LEVELS,
  now = () => new Date(),
} = {}) {
  if (!isRecord(value)
    || value.campaignLevels !== 10
    || !Number.isFinite(value.bestTime)
    || value.bestTime < 0) return null;

  const timestamp = currentTimestamp(now);
  const save = createCampaignSave({ totalLevels, now: () => timestamp });
  save.records.legacyPrototype = {
    campaignLevels: 10,
    bestTimeSeconds: value.bestTime,
    completedAt: normaliseTimestamp(value.achievedAt, timestamp),
  };
  save.meta.migratedFrom = LEGACY_SAVE_KEY;
  return save;
}

function numericPrefix(value, totalLevels) {
  if (!Array.isArray(value)) return [];
  const completed = new Set(value.filter((level) => Number.isInteger(level) && level >= 1 && level <= totalLevels));
  const prefix = [];
  for (let level = 1; completed.has(level); level += 1) prefix.push(level);
  return prefix;
}

function isSupersededLegacyProjection(value) {
  if (!isRecord(value) || value.schemaVersion !== 2 || value.meta?.migratedFrom !== LEGACY_SAVE_KEY) return false;
  const expected = Array.from({ length: 10 }, (_, index) => index + 1);
  const completed = value.progress?.completedLevels;
  return Array.isArray(completed)
    && completed.length === expected.length
    && completed.every((level, index) => level === expected[index])
    && Number.isFinite(value.records?.campaignBestTimeSeconds);
}

function migrateNumericSave(value, {
  sourceKey,
  legacyValue = null,
  totalLevels = DEFAULT_CAMPAIGN_LEVELS,
  now = () => new Date(),
} = {}) {
  if (!isRecord(value) || !isRecord(value.progress) || !isRecord(value.records)) return null;
  if (value.schemaVersion === 3 && value.campaignId !== CAMPAIGN_ID) return null;
  if (value.schemaVersion !== 2 && value.schemaVersion !== 3) return null;
  const timestamp = currentTimestamp(now);
  const save = createCampaignSave({ totalLevels, now: () => timestamp });
  save.meta.migratedFrom = sourceKey;

  if (!isSupersededLegacyProjection(value)) {
    const numeric = numericPrefix(value.progress.completedLevels, normaliseTotalLevels(value.totalLevels));
    const productionCount = Math.min(numeric.length, OUTER_VEIL_LEVEL_KEYS.length);
    save.progress.completedLevelKeys = OUTER_VEIL_LEVEL_KEYS.slice(0, productionCount);
    const oldRecords = isRecord(value.records.levels) ? value.records.levels : {};
    for (let index = 0; index < productionCount; index += 1) {
      const record = oldRecords[index + 1];
      if (!isRecord(record)) continue;
      save.records.levelsByKey[OUTER_VEIL_LEVEL_KEYS[index]] = {
        completed: record.completed === true,
        bestTimeSeconds: Number.isFinite(record.bestTimeSeconds) && record.bestTimeSeconds >= 0
          ? record.bestTimeSeconds
          : null,
        completedAt: normaliseTimestamp(record.completedAt, null),
      };
    }
    const unmapped = numeric.filter((level) => level > OUTER_VEIL_LEVEL_KEYS.length);
    if (unmapped.length) save.records.unmappedV3Progress = { completedLevels: unmapped };
  } else if (Number.isFinite(value.records.campaignBestTimeSeconds)) {
    save.records.legacyPrototype = {
      campaignLevels: 10,
      bestTimeSeconds: value.records.campaignBestTimeSeconds,
      completedAt: normaliseTimestamp(value.records.campaignCompletedAt, timestamp),
    };
  }

  if (!save.records.legacyPrototype) {
    save.records.legacyPrototype = normaliseLegacyPrototype(value.records.legacyPrototype);
  }
  const legacy = migrateLegacySave(legacyValue, { totalLevels, now: () => timestamp });
  if (legacy?.records.legacyPrototype) {
    const current = save.records.legacyPrototype;
    if (!current || legacy.records.legacyPrototype.bestTimeSeconds < current.bestTimeSeconds) {
      save.records.legacyPrototype = legacy.records.legacyPrototype;
    }
  }
  return normaliseCampaignSave(save, { totalLevels, now: () => timestamp });
}

export function migrateInterimSave(value, options = {}) {
  return migrateNumericSave(value, { ...options, sourceKey: INTERIM_SAVE_KEY });
}

export function recordLegacyPrototypeCompletion(save, {
  time,
  completedAt,
  now = () => new Date(),
} = {}) {
  if (!Number.isFinite(time) || time < 0) return null;
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  if (!normalised) return null;
  const previous = normalised.records.legacyPrototype;
  if (previous && previous.bestTimeSeconds <= time) return normalised;
  return {
    ...normalised,
    records: {
      ...normalised.records,
      legacyPrototype: {
        campaignLevels: 10,
        bestTimeSeconds: time,
        completedAt: normaliseTimestamp(completedAt, timestamp),
      },
    },
    meta: { ...normalised.meta, updatedAt: timestamp },
  };
}

export function recordProductionLevelCompletion(save, {
  levelKey,
  levelTime,
  campaignTime,
  completedAt,
  now = () => new Date(),
} = {}) {
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  if (!normalised || !OUTER_VEIL_LEVEL_KEYS.includes(levelKey)) return null;
  const completed = normalised.progress.completedLevelKeys;
  const expectedKey = OUTER_VEIL_LEVEL_KEYS[completed.length];
  if (levelKey !== expectedKey) return normalised;

  const nextCompleted = [...completed, levelKey];
  const realmComplete = nextCompleted.length === OUTER_VEIL_LEVEL_KEYS.length;
  const previousLevelRecord = normalised.records.levelsByKey[levelKey];
  const safeLevelTime = Number.isFinite(levelTime) && levelTime >= 0 ? levelTime : null;
  const bestLevelTime = previousLevelRecord?.bestTimeSeconds !== null
    && Number.isFinite(previousLevelRecord?.bestTimeSeconds)
    && (safeLevelTime === null || previousLevelRecord.bestTimeSeconds <= safeLevelTime)
    ? previousLevelRecord.bestTimeSeconds
    : safeLevelTime;
  const levelsByKey = {
    ...normalised.records.levelsByKey,
    [levelKey]: {
      completed: true,
      bestTimeSeconds: bestLevelTime,
      completedAt: normaliseTimestamp(completedAt, timestamp),
    },
  };
  const realmsByKey = { ...normalised.records.realmsByKey };
  if (realmComplete) {
    const previousRealm = realmsByKey[OUTER_VEIL_REALM_KEY];
    const safeCampaignTime = Number.isFinite(campaignTime) && campaignTime >= 0 ? campaignTime : null;
    realmsByKey[OUTER_VEIL_REALM_KEY] = {
      bestTimeSeconds: previousRealm?.bestTimeSeconds !== null
        && Number.isFinite(previousRealm?.bestTimeSeconds)
        && (safeCampaignTime === null || previousRealm.bestTimeSeconds <= safeCampaignTime)
        ? previousRealm.bestTimeSeconds
        : safeCampaignTime,
      completedAt: normaliseTimestamp(completedAt, timestamp),
    };
  }

  return normaliseCampaignSave({
    ...normalised,
    progress: { ...normalised.progress, completedLevelKeys: nextCompleted },
    records: { ...normalised.records, levelsByKey, realmsByKey },
    meta: { ...normalised.meta, updatedAt: timestamp },
  }, { totalLevels: normalised.totalLevels, now: () => timestamp });
}

export function getOuterVeilContinueTarget(save) {
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels });
  if (!normalised) return { kind: 'level', levelKey: OUTER_VEIL_LEVEL_KEYS[0], campaignOrder: 1 };
  if (normalised.progress.completedRealmKeys.includes(OUTER_VEIL_REALM_KEY)) {
    return { kind: 'realm-slot', realmKey: INNER_KINGDOM_REALM_KEY, playable: false };
  }
  const levelKey = normalised.progress.currentLevelKey;
  return {
    kind: 'level',
    levelKey,
    campaignOrder: OUTER_VEIL_LEVEL_KEYS.indexOf(levelKey) + 1,
  };
}

export function loadCampaignSave({
  storage,
  totalLevels = DEFAULT_CAMPAIGN_LEVELS,
  now = () => new Date(),
} = {}) {
  const timestamp = currentTimestamp(now);
  const legacyValue = safeParse(safeRead(storage, LEGACY_SAVE_KEY));
  const current = normaliseCampaignSave(safeParse(safeRead(storage, CAMPAIGN_SAVE_KEY)), {
    totalLevels,
    now: () => timestamp,
  });
  const legacy = migrateLegacySave(legacyValue, { totalLevels, now: () => timestamp });

  if (current) {
    const merged = legacy?.records.legacyPrototype
      ? recordLegacyPrototypeCompletion(current, {
        time: legacy.records.legacyPrototype.bestTimeSeconds,
        completedAt: legacy.records.legacyPrototype.completedAt,
        now: () => timestamp,
      })
      : current;
    const changed = JSON.stringify(merged) !== JSON.stringify(current);
    return { save: merged, source: 'v4', migrationPersisted: changed ? safeWrite(storage, CAMPAIGN_SAVE_KEY, merged) : null };
  }

  const previous = migrateNumericSave(safeParse(safeRead(storage, PREVIOUS_CAMPAIGN_SAVE_KEY)), {
    sourceKey: PREVIOUS_CAMPAIGN_SAVE_KEY,
    legacyValue,
    totalLevels,
    now: () => timestamp,
  });
  if (previous) {
    return { save: previous, source: 'previous-v3', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, previous) };
  }
  const interim = migrateInterimSave(safeParse(safeRead(storage, INTERIM_SAVE_KEY)), {
    legacyValue,
    totalLevels,
    now: () => timestamp,
  });
  if (interim) {
    return { save: interim, source: 'interim-v2', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, interim) };
  }
  if (legacy) {
    return { save: legacy, source: 'legacy-v1', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, legacy) };
  }
  return { save: createCampaignSave({ totalLevels, now: () => timestamp }), source: 'default', migrationPersisted: null };
}

export function persistCampaignSave({ storage, save, totalLevels, now = () => new Date() } = {}) {
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, {
    totalLevels: totalLevels ?? save?.totalLevels,
    now: () => timestamp,
  });
  if (!normalised) return { save: null, persisted: false };
  normalised.meta.updatedAt = timestamp;
  return { save: normalised, persisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, normalised) };
}

export function getUnlockedAbilityKeys(save) {
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels });
  return normalised ? [...normalised.progress.unlockedAbilityKeys] : [];
}

export function isKnownOuterVeilAbility(key) {
  return OUTER_VEIL_ABILITY_KEYS.includes(key);
}
