import { validateLocalPlayerName } from './chronicle.js';
import { CAMPAIGN_SAVE_KEY, loadCampaignSave } from './save-data.js';
import { V4_CAMPAIGN_ID, V4_LEVEL_KEYS } from './campaign/v4Campaign.js';

export const V4_SAVE_VERSION = 1;
export const V4_SAVE_KEY = 'eotvk-v4-campaign-save-v1';
export const V4_LEADERBOARD_LIMIT = 10;

export const V4_RANK_POLICY = Object.freeze({
  version: 'v4-rank-v1',
  ranks: Object.freeze([
    Object.freeze({ key: 'S', title: 'Dawnkeeper', maxTimeSeconds: 3300, maxDeaths: 3 }),
    Object.freeze({ key: 'A', title: 'Veilbreaker', maxTimeSeconds: 4500, maxDeaths: 8 }),
    Object.freeze({ key: 'B', title: 'Pathfinder', maxTimeSeconds: 6000, maxDeaths: 16 }),
  ]),
});

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nowIso(now) {
  try {
    const value = typeof now === 'function' ? now() : new Date();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  } catch { /* A test clock or blocked system clock must not corrupt the save. */ }
  return new Date(0).toISOString();
}
function safeTimestamp(value, fallback) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString() : fallback;
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
function safeParse(raw) {
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function nonNegativeInteger(value) { return Number.isInteger(value) && value >= 0 ? value : null; }
function positiveSeconds(value) { return Number.isFinite(value) && value > 0 ? value : null; }
function metricMap(value, validator) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(V4_LEVEL_KEYS.flatMap((key) => {
    const metric = validator(value[key]);
    return metric === null ? [] : [[key, metric]];
  }));
}
function knownPrefix(value) {
  const completed = new Set(Array.isArray(value) ? value : []);
  const prefix = [];
  for (const key of V4_LEVEL_KEYS) {
    if (!completed.has(key)) break;
    prefix.push(key);
  }
  return prefix;
}
function normaliseWarden(value) {
  if (!isRecord(value)) return null;
  const attempts = nonNegativeInteger(value.attempts);
  const damageTaken = nonNegativeInteger(value.damageTaken);
  const combatTimeSeconds = Number.isFinite(value.combatTimeSeconds) && value.combatTimeSeconds >= 0
    ? value.combatTimeSeconds : null;
  return attempts === null || damageTaken === null || combatTimeSeconds === null
    ? null : { attempts, damageTaken, combatTimeSeconds };
}

export function evaluateV4Rank({ totalTimeSeconds, deaths } = {}) {
  if (!positiveSeconds(totalTimeSeconds) || nonNegativeInteger(deaths) === null) return {
    status: 'unranked', key: null, title: 'Unranked',
    criteria: 'A complete live 20-level run with recorded time and deaths is required.',
    policyVersion: V4_RANK_POLICY.version,
  };
  const rank = V4_RANK_POLICY.ranks.find((entry) => (
    totalTimeSeconds <= entry.maxTimeSeconds && deaths <= entry.maxDeaths
  ));
  return rank ? {
    status: 'ranked', key: rank.key, title: rank.title,
    criteria: `At most ${Math.floor(rank.maxTimeSeconds / 60)} minutes and ${rank.maxDeaths} deaths.`,
    policyVersion: V4_RANK_POLICY.version,
  } : {
    status: 'ranked', key: 'C', title: 'Kingdom Walker',
    criteria: 'Complete all 20 verified local chapters.',
    policyVersion: V4_RANK_POLICY.version,
  };
}

function normaliseScore(value, fallbackTime) {
  if (!isRecord(value)) return null;
  const validation = validateLocalPlayerName(value.playerName);
  const totalTimeSeconds = positiveSeconds(value.totalTimeSeconds);
  const deaths = nonNegativeInteger(value.deaths);
  if (!validation.valid || totalTimeSeconds === null || deaths === null) return null;
  const completedAt = safeTimestamp(value.completedAt, fallbackTime);
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `${completedAt}:${validation.name}`,
    playerName: validation.name,
    totalTimeSeconds,
    deaths,
    wardenAttempts: nonNegativeInteger(value.wardenAttempts),
    damageTaken: nonNegativeInteger(value.damageTaken),
    completedAt,
    rank: evaluateV4Rank({ totalTimeSeconds, deaths }),
    campaignId: V4_CAMPAIGN_ID,
  };
}

export function compareV4Scores(left, right) {
  return left.totalTimeSeconds - right.totalTimeSeconds
    || left.deaths - right.deaths
    || (left.damageTaken ?? Number.MAX_SAFE_INTEGER) - (right.damageTaken ?? Number.MAX_SAFE_INTEGER)
    || left.completedAt.localeCompare(right.completedAt)
    || left.id.localeCompare(right.id);
}

function normaliseLeaderboard(value, fallbackTime) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const candidate of value) {
    const score = normaliseScore(candidate, fallbackTime);
    if (score && !unique.has(score.id)) unique.set(score.id, score);
  }
  return [...unique.values()].sort(compareV4Scores).slice(0, V4_LEADERBOARD_LIMIT);
}

function defaultRun(timestamp, nextLevelKey = V4_LEVEL_KEYS[0], metricsComplete = true) {
  return {
    provenance: metricsComplete ? 'live-v4-run-v1' : `migration-from-${CAMPAIGN_SAVE_KEY}`,
    startedAt: timestamp,
    nextLevelKey,
    levelTimesByKey: {},
    levelDeathsByKey: {},
    warden: null,
    metricsComplete,
    checkpoint: nextLevelKey ? { levelKey: nextLevelKey, timeSeconds: 0, deaths: 0 } : null,
  };
}

export function createV4Save({ now = () => new Date() } = {}) {
  const timestamp = nowIso(now);
  return {
    schemaVersion: V4_SAVE_VERSION,
    campaignId: V4_CAMPAIGN_ID,
    totalLevels: V4_LEVEL_KEYS.length,
    meta: { createdAt: timestamp, updatedAt: timestamp, migratedFrom: null },
    progress: { completedLevelKeys: [], currentLevelKey: V4_LEVEL_KEYS[0] },
    playerName: null,
    run: defaultRun(timestamp),
    pendingCompletion: null,
    localTopTen: [],
  };
}

export function normaliseV4Save(value, { now = () => new Date() } = {}) {
  if (!isRecord(value) || value.schemaVersion !== V4_SAVE_VERSION || value.campaignId !== V4_CAMPAIGN_ID) return null;
  const timestamp = nowIso(now);
  const completedLevelKeys = knownPrefix(value.progress?.completedLevelKeys);
  const complete = completedLevelKeys.length === V4_LEVEL_KEYS.length;
  const nextLevelKey = complete ? null : V4_LEVEL_KEYS[completedLevelKeys.length];
  const times = metricMap(value.run?.levelTimesByKey, positiveSeconds);
  const deaths = metricMap(value.run?.levelDeathsByKey, nonNegativeInteger);
  for (const key of V4_LEVEL_KEYS.slice(completedLevelKeys.length)) {
    delete times[key];
    delete deaths[key];
  }
  const checkpoint = !complete && value.run?.checkpoint?.levelKey === nextLevelKey ? {
    levelKey: nextLevelKey,
    timeSeconds: Math.max(0, Number.isFinite(value.run.checkpoint.timeSeconds) ? value.run.checkpoint.timeSeconds : 0),
    deaths: Math.max(0, nonNegativeInteger(value.run.checkpoint.deaths) ?? 0),
    ...(normaliseWarden(value.run.checkpoint.warden) ? { warden: normaliseWarden(value.run.checkpoint.warden) } : {}),
  } : !complete ? { levelKey: nextLevelKey, timeSeconds: 0, deaths: 0 } : null;
  const run = complete ? null : {
    provenance: typeof value.run?.provenance === 'string' ? value.run.provenance : 'partial-v4-run',
    startedAt: safeTimestamp(value.run?.startedAt, timestamp),
    nextLevelKey,
    levelTimesByKey: times,
    levelDeathsByKey: deaths,
    warden: normaliseWarden(value.run?.warden),
    metricsComplete: value.run?.metricsComplete === true
      && completedLevelKeys.every((key) => key in times && key in deaths),
    checkpoint,
  };
  const nameValidation = validateLocalPlayerName(value.playerName);
  const pendingTimestamp = isRecord(value.pendingCompletion)
    ? safeTimestamp(value.pendingCompletion.completedAt, null) : null;
  const pendingTime = positiveSeconds(value.pendingCompletion?.totalTimeSeconds);
  const pendingDeaths = nonNegativeInteger(value.pendingCompletion?.deaths);
  const pending = pendingTimestamp ? {
      totalTimeSeconds: pendingTime,
      deaths: pendingDeaths,
      wardenAttempts: nonNegativeInteger(value.pendingCompletion.wardenAttempts),
      damageTaken: nonNegativeInteger(value.pendingCompletion.damageTaken),
      completedAt: pendingTimestamp,
      metricsComplete: value.pendingCompletion.metricsComplete === true
        && pendingTime !== null && pendingDeaths !== null,
    } : null;
  return {
    schemaVersion: V4_SAVE_VERSION,
    campaignId: V4_CAMPAIGN_ID,
    totalLevels: V4_LEVEL_KEYS.length,
    meta: {
      createdAt: safeTimestamp(value.meta?.createdAt, timestamp),
      updatedAt: safeTimestamp(value.meta?.updatedAt, timestamp),
      migratedFrom: typeof value.meta?.migratedFrom === 'string' ? value.meta.migratedFrom : null,
    },
    progress: { completedLevelKeys, currentLevelKey: nextLevelKey || V4_LEVEL_KEYS.at(-1) },
    playerName: nameValidation.valid ? nameValidation.name : null,
    run,
    pendingCompletion: complete ? pending : null,
    localTopTen: normaliseLeaderboard(value.localTopTen, timestamp),
  };
}

export function migrateStageOneSaveToV4(stageOneSave, { now = () => new Date() } = {}) {
  const timestamp = nowIso(now);
  const save = createV4Save({ now: () => timestamp });
  const completedLevelKeys = knownPrefix(stageOneSave?.progress?.completedLevelKeys);
  const chronicle = stageOneSave?.records?.stageOne?.latestChronicle;
  const active = stageOneSave?.records?.stageOne?.activeRun;
  const sourceTimes = chronicle?.levelTimesByKey || active?.levelTimesByKey || {};
  const sourceDeaths = chronicle?.levelDeathsByKey || active?.levelDeathsByKey || {};
  save.progress.completedLevelKeys = completedLevelKeys;
  save.progress.currentLevelKey = V4_LEVEL_KEYS[completedLevelKeys.length] || V4_LEVEL_KEYS.at(-1);
  save.playerName = validateLocalPlayerName(chronicle?.playerName || stageOneSave?.records?.stageOne?.rememberedPlayerName).name;
  save.meta.migratedFrom = CAMPAIGN_SAVE_KEY;
  save.run = completedLevelKeys.length === V4_LEVEL_KEYS.length ? null : {
    ...defaultRun(timestamp, V4_LEVEL_KEYS[completedLevelKeys.length], false),
    levelTimesByKey: metricMap(sourceTimes, positiveSeconds),
    levelDeathsByKey: metricMap(sourceDeaths, nonNegativeInteger),
    warden: normaliseWarden(chronicle?.warden),
  };
  if (save.run) {
    save.run.metricsComplete = completedLevelKeys.every((key) => (
      key in save.run.levelTimesByKey && key in save.run.levelDeathsByKey
    ));
  }
  return normaliseV4Save(save, { now: () => timestamp });
}

export function loadV4Save({ storage, now = () => new Date() } = {}) {
  const timestamp = nowIso(now);
  const current = normaliseV4Save(safeParse(safeRead(storage, V4_SAVE_KEY)), { now: () => timestamp });
  if (current) return { save: current, source: 'v4', migrationPersisted: null };
  const legacy = loadCampaignSave({ storage, now: () => timestamp }).save;
  const migrated = migrateStageOneSaveToV4(legacy, { now: () => timestamp });
  return {
    save: migrated,
    source: legacy?.progress?.completedLevelKeys?.length ? CAMPAIGN_SAVE_KEY : 'default',
    migrationPersisted: safeWrite(storage, V4_SAVE_KEY, migrated),
  };
}

export function persistV4Save({ storage, save, now = () => new Date() } = {}) {
  const timestamp = nowIso(now);
  const normalised = normaliseV4Save(save, { now: () => timestamp });
  if (!normalised) return { save: null, persisted: false };
  normalised.meta.updatedAt = timestamp;
  return { save: normalised, persisted: safeWrite(storage, V4_SAVE_KEY, normalised) };
}

export function recordV4RunCheckpoint(save, {
  levelKey, levelTime, levelDeaths, wardenStats, now = () => new Date(),
} = {}) {
  const timestamp = nowIso(now);
  const normalised = normaliseV4Save(save, { now: () => timestamp });
  if (!normalised?.run || normalised.run.nextLevelKey !== levelKey
    || !Number.isFinite(levelTime) || levelTime < 0
    || nonNegativeInteger(levelDeaths) === null) return normalised;
  const previous = normalised.run.checkpoint;
  normalised.run.checkpoint = {
    levelKey,
    timeSeconds: Math.max(previous?.timeSeconds || 0, levelTime),
    deaths: Math.max(previous?.deaths || 0, levelDeaths),
  };
  const warden = normaliseWarden(wardenStats) || normaliseWarden(previous?.warden);
  if (warden) normalised.run.checkpoint.warden = warden;
  normalised.meta.updatedAt = timestamp;
  return normalised;
}

export function getV4RunCheckpoint(save, levelKey) {
  const normalised = normaliseV4Save(save);
  const checkpoint = normalised?.run?.checkpoint;
  return checkpoint?.levelKey === levelKey ? { ...checkpoint } : null;
}

export function recordV4LevelCompletion(save, {
  levelKey, levelTime, levelDeaths, completionStats, completedAt, now = () => new Date(),
} = {}) {
  const timestamp = nowIso(now);
  const normalised = normaliseV4Save(save, { now: () => timestamp });
  const expected = V4_LEVEL_KEYS[normalised?.progress.completedLevelKeys.length];
  if (!normalised?.run || levelKey !== expected || normalised.run.nextLevelKey !== levelKey) return normalised;
  const checkpoint = normalised.run.checkpoint;
  const safeTime = Math.max(positiveSeconds(levelTime) || 0, checkpoint?.timeSeconds || 0) || null;
  const safeDeaths = Math.max(nonNegativeInteger(levelDeaths) ?? 0, checkpoint?.deaths || 0);
  const times = { ...normalised.run.levelTimesByKey };
  const deaths = { ...normalised.run.levelDeathsByKey };
  if (safeTime !== null) times[levelKey] = safeTime;
  deaths[levelKey] = safeDeaths;
  const completedLevelKeys = [...normalised.progress.completedLevelKeys, levelKey];
  const final = completedLevelKeys.length === V4_LEVEL_KEYS.length;
  const warden = levelKey === V4_LEVEL_KEYS[9]
    ? normaliseWarden(completionStats) || normaliseWarden(checkpoint?.warden) || normalised.run.warden
    : normalised.run.warden;
  const metricsComplete = normalised.run.metricsComplete === true && safeTime !== null;
  normalised.progress = {
    completedLevelKeys,
    currentLevelKey: final ? V4_LEVEL_KEYS.at(-1) : V4_LEVEL_KEYS[completedLevelKeys.length],
  };
  if (final) {
    const allMetrics = metricsComplete && V4_LEVEL_KEYS.every((key) => key in times && key in deaths);
    normalised.pendingCompletion = {
      totalTimeSeconds: allMetrics ? V4_LEVEL_KEYS.reduce((total, key) => total + times[key], 0) : null,
      deaths: allMetrics ? V4_LEVEL_KEYS.reduce((total, key) => total + deaths[key], 0) : null,
      wardenAttempts: warden?.attempts ?? null,
      damageTaken: warden?.damageTaken ?? null,
      completedAt: safeTimestamp(completedAt, timestamp),
      metricsComplete: allMetrics,
    };
    normalised.run = null;
  } else {
    const nextLevelKey = V4_LEVEL_KEYS[completedLevelKeys.length];
    normalised.run = {
      ...normalised.run,
      nextLevelKey,
      levelTimesByKey: times,
      levelDeathsByKey: deaths,
      warden,
      metricsComplete,
      checkpoint: { levelKey: nextLevelKey, timeSeconds: 0, deaths: 0 },
    };
  }
  normalised.meta.updatedAt = timestamp;
  return normalised;
}

export function getV4ContinueTarget(save) {
  const normalised = normaliseV4Save(save);
  if (!normalised || normalised.progress.completedLevelKeys.length === V4_LEVEL_KEYS.length) {
    return { kind: 'complete', campaignOrder: 20, levelKey: V4_LEVEL_KEYS.at(-1) };
  }
  const levelKey = normalised.run?.nextLevelKey || normalised.progress.currentLevelKey;
  return { kind: 'level', levelKey, campaignOrder: V4_LEVEL_KEYS.indexOf(levelKey) + 1 };
}

export function getV4ChapterTarget(save, chapter) {
  const normalised = normaliseV4Save(save);
  const completedCount = normalised?.progress.completedLevelKeys.length || 0;
  if (chapter === 1) {
    const campaignOrder = 1;
    return { unlocked: true, campaignOrder, levelKey: V4_LEVEL_KEYS[campaignOrder - 1] };
  }
  if (chapter === 2) {
    const unlocked = completedCount >= 10;
    const campaignOrder = 11;
    return { unlocked, campaignOrder, levelKey: V4_LEVEL_KEYS[campaignOrder - 1] };
  }
  return null;
}

export function beginNewV4Run(save, { now = () => new Date() } = {}) {
  const timestamp = nowIso(now);
  const normalised = normaliseV4Save(save, { now: () => timestamp });
  if (!normalised) return null;
  normalised.progress = { completedLevelKeys: [], currentLevelKey: V4_LEVEL_KEYS[0] };
  normalised.run = defaultRun(timestamp);
  normalised.pendingCompletion = null;
  normalised.meta.updatedAt = timestamp;
  return normalised;
}

export function recordV4PlayerNameAndScore(save, { name, now = () => new Date() } = {}) {
  const validation = validateLocalPlayerName(name);
  if (!validation.valid) return { save: null, validation, score: null };
  const timestamp = nowIso(now);
  const normalised = normaliseV4Save(save, { now: () => timestamp });
  if (!normalised?.pendingCompletion) return { save: null, validation, score: null };
  const pending = normalised.pendingCompletion;
  const score = pending.metricsComplete ? normaliseScore({
    id: `${pending.completedAt}:${validation.name}:${pending.totalTimeSeconds.toFixed(3)}`,
    playerName: validation.name,
    ...pending,
  }, timestamp) : null;
  normalised.playerName = validation.name;
  if (score) normalised.localTopTen = normaliseLeaderboard([...normalised.localTopTen, score], timestamp);
  normalised.pendingCompletion = null;
  normalised.meta.updatedAt = timestamp;
  return { save: normalised, validation, score };
}

export function getV4LocalTopTen(save) {
  return normaliseV4Save(save)?.localTopTen || [];
}
