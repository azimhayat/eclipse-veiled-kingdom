import { describe, expect, it } from 'vitest';
import { OUTER_VEIL_LEVEL_KEYS } from './campaign/outerVeilCampaign.js';
import {
  buildStageOneChronicle,
  evaluateStageOneRank,
  validateLocalPlayerName,
} from './chronicle.js';

function metrics(overrides = {}) {
  return {
    provenance: 'live-run-v1', metricsComplete: true, levelsCompleted: 10,
    totalTimeSeconds: 1000, retries: 0, wardenAttempts: 1, damageTaken: 0, wardenCombatTimeSeconds: 80,
    ...overrides,
  };
}

describe('Stage I Chronicle policy', () => {
  it.each([
    [metrics(), 'S'],
    [metrics({ totalTimeSeconds: 1356 }), 'A'],
    [metrics({ totalTimeSeconds: 2161, retries: 4, wardenAttempts: 3, damageTaken: 5, wardenCombatTimeSeconds: 121 }), 'B'],
    [metrics({ totalTimeSeconds: 3241 }), 'C'],
  ])('assigns transparent conjunctive rank gates', (value, expected) => {
    expect(evaluateStageOneRank(value)).toMatchObject({ status: 'ranked', key: expected, policyVersion: 'stage-one-rank-v1' });
  });

  it.each([
    [null, 'historic-or-partial'],
    [metrics({ provenance: 'historic-v4' }), 'historic-or-partial'],
    [metrics({ metricsComplete: false }), 'historic-or-partial'],
    [metrics({ wardenAttempts: 0 }), 'invalid-metrics'],
    [metrics({ wardenCombatTimeSeconds: 0 }), 'invalid-metrics'],
    [metrics({ retries: 1.5 }), 'invalid-metrics'],
  ])('never fabricates a rank for unknown or malformed evidence', (value, reason) => {
    expect(evaluateStageOneRank(value)).toMatchObject({ status: 'unranked', key: null, reason });
  });

  it('derives Chronicle totals only from a complete stable-key live run', () => {
    const levelTimesByKey = Object.fromEntries(OUTER_VEIL_LEVEL_KEYS.map((key) => [key, 100]));
    const levelDeathsByKey = Object.fromEntries(OUTER_VEIL_LEVEL_KEYS.map((key, index) => [key, index === 3 ? 1 : 0]));
    const chronicle = buildStageOneChronicle({
      provenance: 'live-run-v1', metricsComplete: true, playerName: 'Aren', completedAt: '2026-09-01T00:00:00.000Z',
      levelTimesByKey, levelDeathsByKey, warden: { attempts: 1, damageTaken: 1, combatTimeSeconds: 88 },
    });
    expect(chronicle.metrics).toMatchObject({
      levelsCompleted: 10, totalTimeSeconds: 1000, retries: 1, wardenAttempts: 1,
      wardenCombatTimeSeconds: 88,
    });
    expect(chronicle.rank.key).toBe('A');
  });

  it('states exact rank thresholds without rounding the promised limits', () => {
    expect(evaluateStageOneRank(metrics()).criteria).toContain('≤ 22:35 stage');
    expect(evaluateStageOneRank(metrics({ totalTimeSeconds: 1356 })).criteria).toContain('≤ 36:00 stage');
    expect(evaluateStageOneRank(metrics({ totalTimeSeconds: 2161, retries: 4 })).criteria).toContain('≤ 54:00 stage');
    expect(evaluateStageOneRank(metrics()).criteria).toContain('total Warden combat');
  });

  it('keeps partial-live and unknown evidence explicitly unranked', () => {
    expect(evaluateStageOneRank(metrics({ provenance: 'partial-live' }))).toMatchObject({
      status: 'unranked', title: 'Unranked', reason: 'historic-or-partial',
    });
    expect(evaluateStageOneRank(metrics({ provenance: 'unknown' }))).toMatchObject({ status: 'unranked' });
  });
});

describe('local Chronicle name validation', () => {
  it.each([
    ['  Aren   al Noor  ', 'Aren al Noor'],
    ['آرِن\u200cشاه', 'آرِن\u200cشاه'],
    ['A\u030A', 'Å'],
    ['🧑‍🚀', '🧑‍🚀'],
  ])('preserves readable Unicode names while normalising safely', (input, expected) => {
    expect(validateLocalPlayerName(input)).toMatchObject({ valid: true, name: expected });
  });

  it.each([
    ['', 'blank'], ['\u00a0', 'blank'], ['A\nB', 'forbidden-control'], ['A\u202eB', 'forbidden-control'],
    ['\u200d', 'forbidden-control'], ['A\u200d', 'forbidden-control'], ['\u200dA', 'forbidden-control'],
    ['A\u200d\u200cB', 'forbidden-control'], ['A \u200dB', 'forbidden-control'],
    ['\u0301', 'invisible-only'], ['\ufe0f', 'invisible-only'],
    ['1234567890123456789012345', 'too-long'], ['A'.repeat(257), 'hard-limit'], [null, 'not-string'],
  ])('rejects unsafe or unusable local names', (input, reason) => {
    expect(validateLocalPlayerName(input)).toMatchObject({ valid: false, reason });
  });

  it('counts extended emoji by grapheme while retaining a separate hard safety bound', () => {
    expect(validateLocalPlayerName('🧑‍🚀'.repeat(24))).toMatchObject({ valid: true });
    expect(validateLocalPlayerName('🧑‍🚀'.repeat(25))).toMatchObject({ valid: false, reason: 'too-long' });
  });
});
