import { OUTER_VEIL_LEVEL_KEYS } from './campaign/outerVeilCampaign.js';

export const STAGE_ONE_RANK_POLICY = Object.freeze({
  version: 'stage-one-rank-v1',
  masterySeconds: 1355,
  parSeconds: 2160,
  ranks: Object.freeze([
    Object.freeze({ key: 'S', title: 'Dawn', maxTime: 1355, maxFalls: 0, maxAttempts: 1, maxDamage: 1, maxFightTime: 90 }),
    Object.freeze({ key: 'A', title: 'Veil', maxTime: 2160, maxFalls: 3, maxAttempts: 2, maxDamage: 4, maxFightTime: 120 }),
    Object.freeze({ key: 'B', title: 'Guardian', maxTime: 3240, maxFalls: 8, maxAttempts: 4, maxDamage: 10, maxFightTime: 180 }),
  ]),
});

function graphemeCount(value) {
  try {
    if (typeof Intl?.Segmenter === 'function') {
      return [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(value)].length;
    }
  } catch {
    // The code-point fallback remains deterministic on older browsers.
  }
  return Array.from(value).length;
}

function hasForbiddenNameCharacter(value) {
  const withoutJoiningControls = value.replace(/[\u200c\u200d]/gu, '');
  return /[\p{Cc}\p{Cs}\p{Cf}\p{Zl}\p{Zp}]/u.test(withoutJoiningControls);
}

function hasInvalidJoiningControl(value) {
  const points = Array.from(value);
  return points.some((point, index) => {
    if (point !== '\u200c' && point !== '\u200d') return false;
    const before = points[index - 1];
    const after = points[index + 1];
    return !before || !after
      || before === '\u200c' || before === '\u200d'
      || after === '\u200c' || after === '\u200d'
      || /\s/u.test(before) || /\s/u.test(after);
  });
}

export function validateLocalPlayerName(input) {
  if (typeof input !== 'string') return { valid: false, name: null, reason: 'not-string', message: 'Enter a name or nickname.' };
  if (hasForbiddenNameCharacter(input)) {
    return { valid: false, name: null, reason: 'forbidden-control', message: 'Use a single readable line without hidden control characters.' };
  }
  let name;
  try { name = input.normalize('NFKC').replace(/\p{Zs}+/gu, ' ').trim(); } catch { name = input.trim(); }
  if (hasForbiddenNameCharacter(name) || hasInvalidJoiningControl(name)) {
    return { valid: false, name: null, reason: 'forbidden-control', message: 'Use a single readable line without hidden control characters.' };
  }
  if (!name) return { valid: false, name: null, reason: 'blank', message: 'Enter a name or nickname.' };
  if (!/[\p{L}\p{N}\p{P}\p{S}]/u.test(name)) {
    return { valid: false, name: null, reason: 'invisible-only', message: 'Include at least one visible letter, number, punctuation mark, or symbol.' };
  }
  if (Array.from(name).length > 256) {
    return { valid: false, name: null, reason: 'hard-limit', message: 'Keep the remembered name to 24 characters or fewer.' };
  }
  if (graphemeCount(name) > 24) {
    return { valid: false, name: null, reason: 'too-long', message: 'Keep the remembered name to 24 characters or fewer.' };
  }
  return { valid: true, name, reason: null, message: '' };
}

function validInteger(value, minimum = 0) {
  return Number.isInteger(value) && value >= minimum;
}

function validSeconds(value, { allowZero = false } = {}) {
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
}

function rankCriteria(rank) {
  const minutes = Math.floor(rank.maxTime / 60);
  const seconds = Math.floor(rank.maxTime % 60);
  const stageTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `≤ ${stageTime} stage · ≤ ${rank.maxFalls} falls · ≤ ${rank.maxAttempts} Warden attempts · ≤ ${rank.maxDamage} Warden damage · ≤ ${rank.maxFightTime} sec total Warden combat`;
}

export function evaluateStageOneRank(metrics) {
  const unranked = (reason) => ({
    status: 'unranked',
    key: null,
    title: 'Unranked',
    policyVersion: STAGE_ONE_RANK_POLICY.version,
    criteria: 'A complete live Stage I run is required for a performance rank.',
    reason,
  });
  if (!metrics || metrics.provenance !== 'live-run-v1' || metrics.metricsComplete !== true) return unranked('historic-or-partial');
  if (metrics.levelsCompleted !== OUTER_VEIL_LEVEL_KEYS.length
    || !validSeconds(metrics.totalTimeSeconds)
    || !validInteger(metrics.retries)
    || !validInteger(metrics.wardenAttempts, 1)
    || !validInteger(metrics.damageTaken)
    || !validSeconds(metrics.wardenCombatTimeSeconds)) return unranked('invalid-metrics');

  for (const rank of STAGE_ONE_RANK_POLICY.ranks) {
    if (metrics.totalTimeSeconds <= rank.maxTime
      && metrics.retries <= rank.maxFalls
      && metrics.wardenAttempts <= rank.maxAttempts
      && metrics.damageTaken <= rank.maxDamage
      && metrics.wardenCombatTimeSeconds <= rank.maxFightTime) {
      return {
        status: 'ranked',
        key: rank.key,
        title: rank.title,
        policyVersion: STAGE_ONE_RANK_POLICY.version,
        criteria: rankCriteria(rank),
        reason: null,
      };
    }
  }
  return {
    status: 'ranked',
    key: 'C',
    title: 'Pathfinder',
    policyVersion: STAGE_ONE_RANK_POLICY.version,
    criteria: 'Complete Stage I with validated live run statistics.',
    reason: null,
  };
}

function completeMetricMap(value, keys) {
  return value && keys.every((key) => Number.isFinite(value[key]) && value[key] > 0);
}

export function buildStageOneChronicle(latestChronicle) {
  if (!latestChronicle || typeof latestChronicle !== 'object') return null;
  const timesComplete = completeMetricMap(latestChronicle.levelTimesByKey, OUTER_VEIL_LEVEL_KEYS);
  const deathsComplete = latestChronicle.levelDeathsByKey
    && OUTER_VEIL_LEVEL_KEYS.every((key) => validInteger(latestChronicle.levelDeathsByKey[key]));
  const warden = latestChronicle.warden || {};
  const metrics = {
    provenance: latestChronicle.provenance,
    metricsComplete: Boolean(latestChronicle.metricsComplete && timesComplete && deathsComplete),
    levelsCompleted: OUTER_VEIL_LEVEL_KEYS.length,
    totalTimeSeconds: timesComplete
      ? OUTER_VEIL_LEVEL_KEYS.reduce((total, key) => total + latestChronicle.levelTimesByKey[key], 0)
      : null,
    retries: deathsComplete
      ? OUTER_VEIL_LEVEL_KEYS.reduce((total, key) => total + latestChronicle.levelDeathsByKey[key], 0)
      : null,
    wardenAttempts: validInteger(warden.attempts, 1) ? warden.attempts : null,
    damageTaken: validInteger(warden.damageTaken) ? warden.damageTaken : null,
    wardenCombatTimeSeconds: validSeconds(warden.combatTimeSeconds) ? warden.combatTimeSeconds : null,
  };
  if (metrics.wardenAttempts === null || metrics.damageTaken === null || metrics.wardenCombatTimeSeconds === null) {
    metrics.metricsComplete = false;
  }
  return {
    playerName: typeof latestChronicle.playerName === 'string' ? latestChronicle.playerName : null,
    completedAt: typeof latestChronicle.completedAt === 'string' ? latestChronicle.completedAt : null,
    metrics,
    rank: evaluateStageOneRank(metrics),
  };
}
