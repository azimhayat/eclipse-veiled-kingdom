import {
  INNER_KINGDOM_REALM_KEY,
  OUTER_VEIL_ABILITY_KEYS,
  OUTER_VEIL_CAMPAIGN_CATALOG,
  OUTER_VEIL_LEVEL_KEYS,
  OUTER_VEIL_REALM_KEY,
} from './campaign/outerVeilCampaign.js';
import { buildStageOneChronicle, validateLocalPlayerName } from './chronicle.js';

export const SAVE_VERSION = 5;
export const CAMPAIGN_ID = 'kingdom-100-v1';
export const CAMPAIGN_SAVE_KEY = 'eotvk-save-v5';
export const PREVIOUS_CAMPAIGN_SAVE_KEY = 'eotvk-save-v4';
export const NUMERIC_CAMPAIGN_SAVE_KEY = 'eotvk-save-v3';
export const INTERIM_SAVE_KEY = 'eotvk-save-v2';
export const LEGACY_SAVE_KEY = 'eotvk-save-v1';
export const DEFAULT_CAMPAIGN_LEVELS = 100;

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
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
  } catch { /* An injected clock must not prevent loading. */ }
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
  } catch { return false; }
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
  if (!isRecord(value) || value.campaignLevels !== 10
    || !Number.isFinite(value.bestTimeSeconds) || value.bestTimeSeconds < 0) return null;
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
      bestTimeSeconds: Number.isFinite(record.bestTimeSeconds) && record.bestTimeSeconds >= 0 ? record.bestTimeSeconds : null,
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
      bestTimeSeconds: Number.isFinite(record.bestTimeSeconds) && record.bestTimeSeconds >= 0 ? record.bestTimeSeconds : null,
      completedAt: normaliseTimestamp(record.completedAt, null),
    },
  };
}
function normaliseMetricMap(value, { integers = false } = {}) {
  if (!isRecord(value)) return {};
  const result = {};
  for (const key of OUTER_VEIL_LEVEL_KEYS) {
    const metric = value[key];
    if (integers ? Number.isInteger(metric) && metric >= 0 : Number.isFinite(metric) && metric > 0) result[key] = metric;
  }
  return result;
}
function normaliseWardenRecord(value) {
  if (!isRecord(value)) return { attempts: null, damageTaken: null, combatTimeSeconds: null };
  return {
    attempts: Number.isInteger(value.attempts) && value.attempts >= 1 ? value.attempts : null,
    damageTaken: Number.isInteger(value.damageTaken) && value.damageTaken >= 0 ? value.damageTaken : null,
    combatTimeSeconds: Number.isFinite(value.combatTimeSeconds) && value.combatTimeSeconds > 0 ? value.combatTimeSeconds : null,
  };
}
function normaliseRememberedName(value) {
  if (value === null || value === undefined) return null;
  const result = validateLocalPlayerName(value);
  return result.valid ? result.name : null;
}
function normaliseLatestChronicle(value) {
  if (!isRecord(value)) return null;
  const allowed = ['live-run-v1', 'historic-v4', 'partial-migration-v4', 'historic-v3', 'partial-migration-v3', 'historic-v2', 'partial-migration-v2', 'partial-live', 'unknown'];
  const provenance = allowed.includes(value.provenance) ? value.provenance : 'unknown';
  const levelTimesByKey = normaliseMetricMap(value.levelTimesByKey);
  const levelDeathsByKey = normaliseMetricMap(value.levelDeathsByKey, { integers: true });
  const warden = normaliseWardenRecord(value.warden);
  const completeMaps = OUTER_VEIL_LEVEL_KEYS.every((key) => key in levelTimesByKey && key in levelDeathsByKey);
  return {
    provenance,
    playerName: normaliseRememberedName(value.playerName),
    levelTimesByKey,
    levelDeathsByKey,
    warden,
    completedAt: normaliseTimestamp(value.completedAt, null),
    metricsComplete: value.metricsComplete === true && provenance === 'live-run-v1' && completeMaps
      && warden.attempts !== null && warden.damageTaken !== null && warden.combatTimeSeconds !== null,
  };
}
function normaliseActiveRun(value, fallbackNextLevelKey, realmComplete) {
  if (!isRecord(value)) return null;
  const nextLevelKey = realmComplete && OUTER_VEIL_LEVEL_KEYS.includes(value.nextLevelKey)
    ? value.nextLevelKey
    : fallbackNextLevelKey;
  if (!OUTER_VEIL_LEVEL_KEYS.includes(nextLevelKey)) return null;
  const allowed = ['live-run-v1', 'partial-migration-v4', 'partial-migration-v3', 'partial-migration-v2', 'partial-live', 'unknown'];
  const provenance = allowed.includes(value.provenance) ? value.provenance : 'unknown';
  const levelTimesByKey = normaliseMetricMap(value.levelTimesByKey);
  const levelDeathsByKey = normaliseMetricMap(value.levelDeathsByKey, { integers: true });
  const nextIndex = OUTER_VEIL_LEVEL_KEYS.indexOf(nextLevelKey);
  for (const key of OUTER_VEIL_LEVEL_KEYS.slice(nextIndex)) {
    delete levelTimesByKey[key];
    delete levelDeathsByKey[key];
  }
  const completePrefix = OUTER_VEIL_LEVEL_KEYS.slice(0, nextIndex)
    .every((key) => key in levelTimesByKey && key in levelDeathsByKey);
  const checkpoint = isRecord(value.checkpoint)
    && value.checkpoint.levelKey === nextLevelKey ? {
      levelKey: nextLevelKey,
      timeSeconds: Number.isFinite(value.checkpoint.timeSeconds) && value.checkpoint.timeSeconds >= 0
        ? value.checkpoint.timeSeconds : 0,
      deaths: Number.isInteger(value.checkpoint.deaths) && value.checkpoint.deaths >= 0
        ? value.checkpoint.deaths : 0,
    } : { levelKey: nextLevelKey, timeSeconds: 0, deaths: 0 };
  if (isRecord(value.checkpoint?.warden)) {
    checkpoint.warden = {
      attempts: Number.isInteger(value.checkpoint.warden.attempts) && value.checkpoint.warden.attempts >= 0
        ? value.checkpoint.warden.attempts : 0,
      damageTaken: Number.isInteger(value.checkpoint.warden.damageTaken) && value.checkpoint.warden.damageTaken >= 0
        ? value.checkpoint.warden.damageTaken : 0,
      combatTimeSeconds: Number.isFinite(value.checkpoint.warden.combatTimeSeconds)
        && value.checkpoint.warden.combatTimeSeconds >= 0 ? value.checkpoint.warden.combatTimeSeconds : 0,
    };
  }
  return {
    provenance,
    nextLevelKey,
    levelTimesByKey,
    levelDeathsByKey,
    startedAt: normaliseTimestamp(value.startedAt, null),
    metricsComplete: value.metricsComplete === true && provenance === 'live-run-v1' && completePrefix,
    checkpoint,
  };
}
function freshStageOne(timestamp) {
  return {
    rememberedPlayerName: null,
    activeRun: {
      provenance: 'live-run-v1', nextLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
      levelTimesByKey: {}, levelDeathsByKey: {}, startedAt: timestamp, metricsComplete: true,
      checkpoint: { levelKey: OUTER_VEIL_LEVEL_KEYS[0], timeSeconds: 0, deaths: 0 },
    },
    latestChronicle: null,
  };
}
function normaliseStageOne(value, {
  fallbackNextLevelKey,
  realmComplete,
  completedCount,
  timestamp,
  fallbackCompletedAt,
}) {
  const source = isRecord(value) ? value : {};
  const rememberedPlayerName = normaliseRememberedName(source.rememberedPlayerName);
  let activeRun = normaliseActiveRun(source.activeRun, fallbackNextLevelKey, realmComplete);
  let latestChronicle = realmComplete ? normaliseLatestChronicle(source.latestChronicle) : null;
  if (!realmComplete && !activeRun) {
    activeRun = completedCount === 0 ? freshStageOne(timestamp).activeRun : {
      provenance: 'partial-live',
      nextLevelKey: fallbackNextLevelKey,
      levelTimesByKey: {},
      levelDeathsByKey: {},
      startedAt: timestamp,
      metricsComplete: false,
      checkpoint: { levelKey: fallbackNextLevelKey, timeSeconds: 0, deaths: 0 },
    };
  }
  if (realmComplete && !latestChronicle) {
    latestChronicle = {
      provenance: 'unknown',
      playerName: rememberedPlayerName,
      levelTimesByKey: {},
      levelDeathsByKey: {},
      warden: { attempts: null, damageTaken: null, combatTimeSeconds: null },
      completedAt: fallbackCompletedAt,
      metricsComplete: false,
    };
  }
  return {
    rememberedPlayerName,
    activeRun,
    latestChronicle,
  };
}
function historicalStageOne(save, sourceKey, timestamp) {
  const completed = save.progress.completedLevelKeys;
  const realmComplete = completed.length === OUTER_VEIL_LEVEL_KEYS.length;
  const suffix = sourceKey === PREVIOUS_CAMPAIGN_SAVE_KEY
    ? 'v4'
    : sourceKey === INTERIM_SAVE_KEY ? 'v2' : 'v3';
  if (completed.length === 0) return freshStageOne(timestamp);
  if (realmComplete) {
    return {
      rememberedPlayerName: null,
      activeRun: null,
      latestChronicle: {
        provenance: `historic-${suffix}`,
        playerName: null,
        levelTimesByKey: {},
        levelDeathsByKey: {},
        warden: { attempts: null, damageTaken: null, combatTimeSeconds: null },
        completedAt: save.records.realmsByKey[OUTER_VEIL_REALM_KEY]?.completedAt
          || save.records.levelsByKey[OUTER_VEIL_LEVEL_KEYS.at(-1)]?.completedAt || null,
        metricsComplete: false,
      },
    };
  }
  return {
    rememberedPlayerName: null,
    activeRun: {
      provenance: `partial-migration-${suffix}`,
      nextLevelKey: OUTER_VEIL_LEVEL_KEYS[completed.length],
      levelTimesByKey: {}, levelDeathsByKey: {}, startedAt: timestamp, metricsComplete: false,
      checkpoint: { levelKey: OUTER_VEIL_LEVEL_KEYS[completed.length], timeSeconds: 0, deaths: 0 },
    },
    latestChronicle: null,
  };
}

export function createCampaignSave({ totalLevels = DEFAULT_CAMPAIGN_LEVELS, now = () => new Date() } = {}) {
  const timestamp = currentTimestamp(now);
  return {
    schemaVersion: SAVE_VERSION,
    campaignId: CAMPAIGN_ID,
    totalLevels: normaliseTotalLevels(totalLevels),
    progress: {
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[0], completedLevelKeys: [], unlockedAbilityKeys: [],
      completedRealmKeys: [], unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY],
    },
    records: {
      levelsByKey: {}, realmsByKey: {}, legacyPrototype: null, unmappedV3Progress: null,
      stageOne: freshStageOne(timestamp),
    },
    meta: { createdAt: timestamp, updatedAt: timestamp, migratedFrom: null },
  };
}

export function normaliseCampaignSave(value, { totalLevels = DEFAULT_CAMPAIGN_LEVELS, now = () => new Date() } = {}) {
  if (!isRecord(value) || value.schemaVersion !== SAVE_VERSION || value.campaignId !== CAMPAIGN_ID
    || !isRecord(value.progress) || !isRecord(value.records)) return null;
  const timestamp = currentTimestamp(now);
  const base = createCampaignSave({
    totalLevels: Math.max(normaliseTotalLevels(totalLevels), normaliseTotalLevels(value.totalLevels)), now: () => timestamp,
  });
  const completedLevelKeys = knownCompletionPrefix(value.progress.completedLevelKeys);
  const realmComplete = completedLevelKeys.length === OUTER_VEIL_LEVEL_KEYS.length;
  const currentLevelKey = realmComplete ? OUTER_VEIL_LEVEL_KEYS.at(-1) : OUTER_VEIL_LEVEL_KEYS[completedLevelKeys.length];
  const meta = isRecord(value.meta) ? value.meta : {};
  const realmsByKey = normaliseRealmRecords(value.records.realmsByKey);
  if (meta.migratedFrom === PREVIOUS_CAMPAIGN_SAVE_KEY
    && value.records.stageOne?.latestChronicle?.provenance === 'historic-v4'
    && realmsByKey[OUTER_VEIL_REALM_KEY]) {
    realmsByKey[OUTER_VEIL_REALM_KEY].bestTimeSeconds = null;
  }
  return {
    ...base,
    progress: {
      currentLevelKey,
      completedLevelKeys,
      unlockedAbilityKeys: abilityKeysForProgress(completedLevelKeys.length),
      completedRealmKeys: realmComplete ? [OUTER_VEIL_REALM_KEY] : [],
      unlockedRealmSlotKeys: realmComplete ? [OUTER_VEIL_REALM_KEY, INNER_KINGDOM_REALM_KEY] : [OUTER_VEIL_REALM_KEY],
    },
    records: {
      levelsByKey: normaliseLevelRecordsByKey(value.records.levelsByKey),
      realmsByKey,
      legacyPrototype: normaliseLegacyPrototype(value.records.legacyPrototype),
      unmappedV3Progress: isRecord(value.records.unmappedV3Progress) ? { ...value.records.unmappedV3Progress } : null,
      stageOne: normaliseStageOne(value.records.stageOne, {
        fallbackNextLevelKey: currentLevelKey,
        realmComplete,
        completedCount: completedLevelKeys.length,
        timestamp,
        fallbackCompletedAt: normaliseRealmRecords(value.records.realmsByKey)[OUTER_VEIL_REALM_KEY]?.completedAt
          || normaliseLevelRecordsByKey(value.records.levelsByKey)[OUTER_VEIL_LEVEL_KEYS.at(-1)]?.completedAt
          || null,
      }),
    },
    meta: {
      createdAt: normaliseTimestamp(meta.createdAt, timestamp),
      updatedAt: normaliseTimestamp(meta.updatedAt, timestamp),
      migratedFrom: typeof meta.migratedFrom === 'string' ? meta.migratedFrom : null,
    },
  };
}

function normaliseV4Save(value, { totalLevels, now }) {
  if (!isRecord(value) || value.schemaVersion !== 4 || value.campaignId !== CAMPAIGN_ID
    || !isRecord(value.progress) || !isRecord(value.records)) return null;
  const timestamp = currentTimestamp(now);
  const save = createCampaignSave({
    totalLevels: Math.max(normaliseTotalLevels(totalLevels), normaliseTotalLevels(value.totalLevels)), now: () => timestamp,
  });
  const completedLevelKeys = knownCompletionPrefix(value.progress.completedLevelKeys);
  const realmComplete = completedLevelKeys.length === OUTER_VEIL_LEVEL_KEYS.length;
  save.progress = {
    currentLevelKey: realmComplete ? OUTER_VEIL_LEVEL_KEYS.at(-1) : OUTER_VEIL_LEVEL_KEYS[completedLevelKeys.length],
    completedLevelKeys,
    unlockedAbilityKeys: abilityKeysForProgress(completedLevelKeys.length),
    completedRealmKeys: realmComplete ? [OUTER_VEIL_REALM_KEY] : [],
    unlockedRealmSlotKeys: realmComplete ? [OUTER_VEIL_REALM_KEY, INNER_KINGDOM_REALM_KEY] : [OUTER_VEIL_REALM_KEY],
  };
  save.records.levelsByKey = normaliseLevelRecordsByKey(value.records.levelsByKey);
  save.records.realmsByKey = normaliseRealmRecords(value.records.realmsByKey);
  save.records.legacyPrototype = normaliseLegacyPrototype(value.records.legacyPrototype);
  save.records.unmappedV3Progress = isRecord(value.records.unmappedV3Progress) ? { ...value.records.unmappedV3Progress } : null;
  save.records.stageOne = historicalStageOne(save, PREVIOUS_CAMPAIGN_SAVE_KEY, timestamp);
  save.meta = {
    createdAt: normaliseTimestamp(value.meta?.createdAt, timestamp), updatedAt: timestamp,
    migratedFrom: PREVIOUS_CAMPAIGN_SAVE_KEY,
  };
  return normaliseCampaignSave(save, { totalLevels, now: () => timestamp });
}

export function migrateLegacySave(value, { totalLevels = DEFAULT_CAMPAIGN_LEVELS, now = () => new Date() } = {}) {
  if (!isRecord(value) || value.campaignLevels !== 10 || !Number.isFinite(value.bestTime) || value.bestTime < 0) return null;
  const timestamp = currentTimestamp(now);
  const save = createCampaignSave({ totalLevels, now: () => timestamp });
  save.records.legacyPrototype = {
    campaignLevels: 10, bestTimeSeconds: value.bestTime, completedAt: normaliseTimestamp(value.achievedAt, timestamp),
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
  return Array.isArray(completed) && completed.length === expected.length
    && completed.every((level, index) => level === expected[index])
    && Number.isFinite(value.records?.campaignBestTimeSeconds);
}
function migrateNumericSave(value, {
  sourceKey, legacyValue = null, totalLevels = DEFAULT_CAMPAIGN_LEVELS, now = () => new Date(),
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
        bestTimeSeconds: Number.isFinite(record.bestTimeSeconds) && record.bestTimeSeconds >= 0 ? record.bestTimeSeconds : null,
        completedAt: normaliseTimestamp(record.completedAt, null),
      };
    }
    const unmapped = numeric.filter((level) => level > OUTER_VEIL_LEVEL_KEYS.length);
    if (unmapped.length) save.records.unmappedV3Progress = { completedLevels: unmapped };
  } else if (Number.isFinite(value.records.campaignBestTimeSeconds)) {
    save.records.legacyPrototype = {
      campaignLevels: 10, bestTimeSeconds: value.records.campaignBestTimeSeconds,
      completedAt: normaliseTimestamp(value.records.campaignCompletedAt, timestamp),
    };
  }
  if (!save.records.legacyPrototype) save.records.legacyPrototype = normaliseLegacyPrototype(value.records.legacyPrototype);
  const legacy = migrateLegacySave(legacyValue, { totalLevels, now: () => timestamp });
  if (legacy?.records.legacyPrototype) {
    const current = save.records.legacyPrototype;
    if (!current || legacy.records.legacyPrototype.bestTimeSeconds < current.bestTimeSeconds) save.records.legacyPrototype = legacy.records.legacyPrototype;
  }
  let normalised = normaliseCampaignSave(save, { totalLevels, now: () => timestamp });
  normalised.records.stageOne = historicalStageOne(normalised, sourceKey, timestamp);
  normalised = normaliseCampaignSave(normalised, { totalLevels, now: () => timestamp });
  return normalised;
}
export function migrateInterimSave(value, options = {}) {
  return migrateNumericSave(value, { ...options, sourceKey: INTERIM_SAVE_KEY });
}

export function recordLegacyPrototypeCompletion(save, { time, completedAt, now = () => new Date() } = {}) {
  if (!Number.isFinite(time) || time < 0) return null;
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  if (!normalised) return null;
  const previous = normalised.records.legacyPrototype;
  if (previous && previous.bestTimeSeconds <= time) return normalised;
  normalised.records.legacyPrototype = {
    campaignLevels: 10, bestTimeSeconds: time, completedAt: normaliseTimestamp(completedAt, timestamp),
  };
  normalised.meta.updatedAt = timestamp;
  return normalised;
}
function safeRunWarden(value) {
  const result = normaliseWardenRecord(value);
  return result.attempts !== null && result.damageTaken !== null && result.combatTimeSeconds !== null
    ? result : { attempts: null, damageTaken: null, combatTimeSeconds: null };
}

export function recordProductionLevelCompletion(save, {
  levelKey, levelTime, levelDeaths, completionStats, completedAt, now = () => new Date(),
} = {}) {
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  if (!normalised || !OUTER_VEIL_LEVEL_KEYS.includes(levelKey)) return null;
  const completed = normalised.progress.completedLevelKeys;
  const progressionExpected = OUTER_VEIL_LEVEL_KEYS[completed.length];
  const activeRun = normalised.records.stageOne.activeRun;
  const advancesProgress = levelKey === progressionExpected;
  const advancesRun = levelKey === activeRun?.nextLevelKey;
  if (!advancesProgress && !advancesRun) return normalised;

  let safeLevelTime = Number.isFinite(levelTime) && levelTime > 0 ? levelTime : null;
  let safeLevelDeaths = Number.isInteger(levelDeaths) && levelDeaths >= 0 ? levelDeaths : null;
  if (advancesRun && activeRun.checkpoint?.levelKey === levelKey) {
    safeLevelTime = Math.max(safeLevelTime || 0, activeRun.checkpoint.timeSeconds || 0) || null;
    safeLevelDeaths = Math.max(safeLevelDeaths || 0, activeRun.checkpoint.deaths || 0);
  }
  const nextCompleted = advancesProgress ? [...completed, levelKey] : completed;
  const realmComplete = nextCompleted.length === OUTER_VEIL_LEVEL_KEYS.length;
  const levelsByKey = { ...normalised.records.levelsByKey };
  if (advancesProgress) {
    const previousBest = levelsByKey[levelKey]?.bestTimeSeconds;
    levelsByKey[levelKey] = {
      completed: true,
      bestTimeSeconds: Number.isFinite(previousBest) && (safeLevelTime === null || previousBest <= safeLevelTime)
        ? previousBest : safeLevelTime,
      completedAt: normaliseTimestamp(completedAt, timestamp),
    };
  }
  const realmsByKey = { ...normalised.records.realmsByKey };
  if (advancesProgress && realmComplete) {
    const previousRealm = realmsByKey[OUTER_VEIL_REALM_KEY];
    realmsByKey[OUTER_VEIL_REALM_KEY] = {
      bestTimeSeconds: Number.isFinite(previousRealm?.bestTimeSeconds) ? previousRealm.bestTimeSeconds : null,
      completedAt: normaliseTimestamp(completedAt, timestamp),
    };
  }

  let nextActiveRun = activeRun;
  let latestChronicle = normalised.records.stageOne.latestChronicle;
  if (advancesRun) {
    const levelTimesByKey = { ...activeRun.levelTimesByKey };
    const levelDeathsByKey = { ...activeRun.levelDeathsByKey };
    if (safeLevelTime !== null) levelTimesByKey[levelKey] = safeLevelTime;
    if (safeLevelDeaths !== null) levelDeathsByKey[levelKey] = safeLevelDeaths;
    const levelIndex = OUTER_VEIL_LEVEL_KEYS.indexOf(levelKey);
    if (levelIndex === OUTER_VEIL_LEVEL_KEYS.length - 1) {
      const checkpointWarden = activeRun.checkpoint?.warden;
      const warden = safeRunWarden({
        attempts: Math.max(completionStats?.attempts || 0, checkpointWarden?.attempts || 0),
        damageTaken: Math.max(completionStats?.damageTaken || 0, checkpointWarden?.damageTaken || 0),
        combatTimeSeconds: Math.max(
          completionStats?.combatTimeSeconds || 0,
          checkpointWarden?.combatTimeSeconds || 0,
        ),
      });
      latestChronicle = {
        provenance: activeRun.provenance,
        playerName: normalised.records.stageOne.rememberedPlayerName,
        levelTimesByKey,
        levelDeathsByKey,
        warden,
        completedAt: normaliseTimestamp(completedAt, timestamp),
        metricsComplete: activeRun.metricsComplete === true && activeRun.provenance === 'live-run-v1'
          && OUTER_VEIL_LEVEL_KEYS.every((key) => key in levelTimesByKey && key in levelDeathsByKey)
          && warden.attempts !== null,
      };
      if (latestChronicle.metricsComplete) {
        const verifiedStageTime = OUTER_VEIL_LEVEL_KEYS
          .reduce((total, key) => total + levelTimesByKey[key], 0);
        const previousVerifiedBest = realmsByKey[OUTER_VEIL_REALM_KEY]?.bestTimeSeconds;
        realmsByKey[OUTER_VEIL_REALM_KEY] = {
          bestTimeSeconds: Number.isFinite(previousVerifiedBest)
            ? Math.min(previousVerifiedBest, verifiedStageTime)
            : verifiedStageTime,
          completedAt: normaliseTimestamp(completedAt, timestamp),
        };
      }
      nextActiveRun = null;
    } else {
      nextActiveRun = {
        ...activeRun,
        nextLevelKey: OUTER_VEIL_LEVEL_KEYS[levelIndex + 1],
        levelTimesByKey,
        levelDeathsByKey,
        metricsComplete: activeRun.metricsComplete === true && safeLevelTime !== null && safeLevelDeaths !== null,
        checkpoint: { levelKey: OUTER_VEIL_LEVEL_KEYS[levelIndex + 1], timeSeconds: 0, deaths: 0 },
      };
    }
  }
  return normaliseCampaignSave({
    ...normalised,
    progress: { ...normalised.progress, completedLevelKeys: nextCompleted },
    records: {
      ...normalised.records,
      levelsByKey,
      realmsByKey,
      stageOne: { ...normalised.records.stageOne, activeRun: nextActiveRun, latestChronicle },
    },
    meta: { ...normalised.meta, updatedAt: timestamp },
  }, { totalLevels: normalised.totalLevels, now: () => timestamp });
}

export function beginStageOneRun(save, { now = () => new Date() } = {}) {
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  if (!normalised || !normalised.progress.completedRealmKeys.includes(OUTER_VEIL_REALM_KEY)) return null;
  normalised.records.stageOne.activeRun = {
    provenance: 'live-run-v1', nextLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
    levelTimesByKey: {}, levelDeathsByKey: {}, startedAt: timestamp, metricsComplete: true,
    checkpoint: { levelKey: OUTER_VEIL_LEVEL_KEYS[0], timeSeconds: 0, deaths: 0 },
  };
  normalised.meta.updatedAt = timestamp;
  return normalised;
}
export function recordStageOneRunCheckpoint(save, {
  levelKey,
  levelTime,
  levelDeaths,
  wardenStats,
  now = () => new Date(),
} = {}) {
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  const activeRun = normalised?.records.stageOne.activeRun;
  if (!activeRun || activeRun.nextLevelKey !== levelKey
    || !Number.isFinite(levelTime) || levelTime < 0
    || !Number.isInteger(levelDeaths) || levelDeaths < 0) return normalised;
  const previous = activeRun.checkpoint;
  activeRun.checkpoint = {
    levelKey,
    timeSeconds: Math.max(previous?.timeSeconds || 0, levelTime),
    deaths: Math.max(previous?.deaths || 0, levelDeaths),
  };
  if (isRecord(wardenStats)
    && Number.isInteger(wardenStats.attempts) && wardenStats.attempts >= 0
    && Number.isInteger(wardenStats.damageTaken) && wardenStats.damageTaken >= 0
    && Number.isFinite(wardenStats.combatTimeSeconds) && wardenStats.combatTimeSeconds >= 0) {
    activeRun.checkpoint.warden = {
      attempts: Math.max(previous?.warden?.attempts || 0, wardenStats.attempts),
      damageTaken: Math.max(previous?.warden?.damageTaken || 0, wardenStats.damageTaken),
      combatTimeSeconds: Math.max(previous?.warden?.combatTimeSeconds || 0, wardenStats.combatTimeSeconds),
    };
  } else if (previous?.warden) activeRun.checkpoint.warden = { ...previous.warden };
  normalised.meta.updatedAt = timestamp;
  return normalised;
}
export function getStageOneRunCheckpoint(save, levelKey) {
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels });
  const checkpoint = normalised?.records.stageOne.activeRun?.checkpoint;
  return checkpoint?.levelKey === levelKey ? { ...checkpoint } : null;
}
export function recordStageOnePlayerName(save, { name, now = () => new Date() } = {}) {
  const validation = validateLocalPlayerName(name);
  if (!validation.valid) return { save: null, validation };
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels, now: () => timestamp });
  if (!normalised?.records.stageOne.latestChronicle) return { save: null, validation };
  normalised.records.stageOne.rememberedPlayerName = validation.name;
  normalised.records.stageOne.latestChronicle.playerName = validation.name;
  normalised.meta.updatedAt = timestamp;
  return { save: normalised, validation };
}
export function getStageOneChronicle(save) {
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels });
  return normalised ? buildStageOneChronicle(normalised.records.stageOne.latestChronicle) : null;
}
export function getOuterVeilContinueTarget(save) {
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels });
  if (!normalised) return { kind: 'level', levelKey: OUTER_VEIL_LEVEL_KEYS[0], campaignOrder: 1 };
  const activeLevelKey = normalised.records.stageOne.activeRun?.nextLevelKey;
  if (activeLevelKey) return { kind: 'level', levelKey: activeLevelKey, campaignOrder: OUTER_VEIL_LEVEL_KEYS.indexOf(activeLevelKey) + 1 };
  if (normalised.progress.completedRealmKeys.includes(OUTER_VEIL_REALM_KEY)) {
    return { kind: 'realm-slot', realmKey: INNER_KINGDOM_REALM_KEY, playable: false };
  }
  const levelKey = normalised.progress.currentLevelKey;
  return { kind: 'level', levelKey, campaignOrder: OUTER_VEIL_LEVEL_KEYS.indexOf(levelKey) + 1 };
}

export function loadCampaignSave({ storage, totalLevels = DEFAULT_CAMPAIGN_LEVELS, now = () => new Date() } = {}) {
  const timestamp = currentTimestamp(now);
  const legacyValue = safeParse(safeRead(storage, LEGACY_SAVE_KEY));
  const current = normaliseCampaignSave(safeParse(safeRead(storage, CAMPAIGN_SAVE_KEY)), { totalLevels, now: () => timestamp });
  const legacy = migrateLegacySave(legacyValue, { totalLevels, now: () => timestamp });
  if (current) {
    const merged = legacy?.records.legacyPrototype ? recordLegacyPrototypeCompletion(current, {
      time: legacy.records.legacyPrototype.bestTimeSeconds,
      completedAt: legacy.records.legacyPrototype.completedAt,
      now: () => timestamp,
    }) : current;
    const changed = JSON.stringify(merged) !== JSON.stringify(current);
    return { save: merged, source: 'v5', migrationPersisted: changed ? safeWrite(storage, CAMPAIGN_SAVE_KEY, merged) : null };
  }
  const previous = normaliseV4Save(safeParse(safeRead(storage, PREVIOUS_CAMPAIGN_SAVE_KEY)), { totalLevels, now: () => timestamp });
  if (previous) return { save: previous, source: 'previous-v4', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, previous) };
  const numeric = migrateNumericSave(safeParse(safeRead(storage, NUMERIC_CAMPAIGN_SAVE_KEY)), {
    sourceKey: NUMERIC_CAMPAIGN_SAVE_KEY, legacyValue, totalLevels, now: () => timestamp,
  });
  if (numeric) return { save: numeric, source: 'previous-v3', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, numeric) };
  const interim = migrateInterimSave(safeParse(safeRead(storage, INTERIM_SAVE_KEY)), { legacyValue, totalLevels, now: () => timestamp });
  if (interim) return { save: interim, source: 'interim-v2', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, interim) };
  if (legacy) return { save: legacy, source: 'legacy-v1', migrationPersisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, legacy) };
  return { save: createCampaignSave({ totalLevels, now: () => timestamp }), source: 'default', migrationPersisted: null };
}
export function persistCampaignSave({ storage, save, totalLevels, now = () => new Date() } = {}) {
  const timestamp = currentTimestamp(now);
  const normalised = normaliseCampaignSave(save, { totalLevels: totalLevels ?? save?.totalLevels, now: () => timestamp });
  if (!normalised) return { save: null, persisted: false };
  normalised.meta.updatedAt = timestamp;
  return { save: normalised, persisted: safeWrite(storage, CAMPAIGN_SAVE_KEY, normalised) };
}
export function getUnlockedAbilityKeys(save) {
  const normalised = normaliseCampaignSave(save, { totalLevels: save?.totalLevels });
  return normalised ? [...normalised.progress.unlockedAbilityKeys] : [];
}
export function isKnownOuterVeilAbility(key) { return OUTER_VEIL_ABILITY_KEYS.includes(key); }
