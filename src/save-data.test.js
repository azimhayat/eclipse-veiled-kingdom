import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_SAVE_KEY,
  CAMPAIGN_ID,
  INTERIM_SAVE_KEY,
  LEGACY_SAVE_KEY,
  PREVIOUS_CAMPAIGN_SAVE_KEY,
  createCampaignSave,
  getOuterVeilContinueTarget,
  loadCampaignSave,
  persistCampaignSave,
  recordLegacyPrototypeCompletion,
  recordProductionLevelCompletion,
} from './save-data.js';
import {
  INNER_KINGDOM_REALM_KEY,
  OUTER_VEIL_ABILITY_KEYS,
  OUTER_VEIL_LEVEL_KEYS,
  OUTER_VEIL_REALM_KEY,
} from './campaign/outerVeilCampaign.js';

const NOW = '2026-08-30T20:00:00.000Z';
const LEGACY = { campaignLevels: 10, bestTime: 83.25, achievedAt: '2026-08-29T10:30:00.000Z' };

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes += 1; values.set(key, value); },
    value: (key) => values.get(key),
    writes: () => writes,
  };
}

function v3Save(completedLevels = []) {
  return {
    schemaVersion: 3,
    campaignId: CAMPAIGN_ID,
    totalLevels: 100,
    progress: {
      unlockedLevel: Math.min(100, completedLevels.length + 1),
      lastPlayedLevel: Math.min(100, completedLevels.length + 1),
      completedLevels,
    },
    records: { campaignBestTimeSeconds: null, campaignCompletedAt: null, levels: {}, legacyPrototype: null },
    meta: { createdAt: NOW, updatedAt: NOW, migratedFrom: null },
  };
}

describe('campaign save data v4', () => {
  it('creates a fresh stable-key Outer Veil campaign inside the 100-level foundation', () => {
    const save = createCampaignSave({ now: () => NOW });
    expect(save).toMatchObject({
      schemaVersion: 4,
      campaignId: 'kingdom-100-v1',
      totalLevels: 100,
      progress: {
        currentLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
        completedLevelKeys: [],
        unlockedAbilityKeys: [],
        completedRealmKeys: [],
        unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY],
      },
      records: { levelsByKey: {}, realmsByKey: {}, legacyPrototype: null },
    });
    expect(getOuterVeilContinueTarget(save)).toEqual({
      kind: 'level', levelKey: OUTER_VEIL_LEVEL_KEYS[0], campaignOrder: 1,
    });
  });

  it('preserves a v1 prototype record without advancing production', () => {
    const storage = createStorage({ [LEGACY_SAVE_KEY]: JSON.stringify(LEGACY) });
    const result = loadCampaignSave({ storage, now: () => NOW });
    expect(result.source).toBe('legacy-v1');
    expect(result.save.progress.completedLevelKeys).toEqual([]);
    expect(result.save.records.legacyPrototype).toEqual({
      campaignLevels: 10,
      bestTimeSeconds: 83.25,
      completedAt: LEGACY.achievedAt,
    });
    expect(storage.value(LEGACY_SAVE_KEY)).toBe(JSON.stringify(LEGACY));
  });

  it.each([10, 100])('repairs the superseded v2 prototype projection at %i levels', (totalLevels) => {
    const interim = v3Save(Array.from({ length: 10 }, (_, index) => index + 1));
    interim.schemaVersion = 2;
    interim.campaignId = 'main';
    interim.totalLevels = totalLevels;
    interim.records.campaignBestTimeSeconds = 83.25;
    interim.records.campaignCompletedAt = LEGACY.achievedAt;
    interim.meta.migratedFrom = LEGACY_SAVE_KEY;
    const result = loadCampaignSave({ storage: createStorage({ [INTERIM_SAVE_KEY]: JSON.stringify(interim) }), now: () => NOW });
    expect(result.source).toBe('interim-v2');
    expect(result.save.progress.completedLevelKeys).toEqual([]);
    expect(result.save.records.legacyPrototype.bestTimeSeconds).toBe(83.25);
  });

  it('migrates genuine contiguous v3 progress to stable level keys and derived abilities', () => {
    const previous = v3Save([1, 2, 3]);
    previous.records.levels[2] = { completed: true, bestTimeSeconds: 42, completedAt: NOW };
    const storage = createStorage({ [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(previous) });
    const result = loadCampaignSave({ storage, now: () => NOW });
    expect(result.source).toBe('previous-v3');
    expect(result.save.progress).toMatchObject({
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[3],
      completedLevelKeys: OUTER_VEIL_LEVEL_KEYS.slice(0, 3),
      unlockedAbilityKeys: ['memory-carve', 'oathbind'],
    });
    expect(result.save.records.levelsByKey[OUTER_VEIL_LEVEL_KEYS[1]].bestTimeSeconds).toBe(42);
    expect(storage.value(PREVIOUS_CAMPAIGN_SAVE_KEY)).toBe(JSON.stringify(previous));
  });

  it('derives progression from the contiguous prefix and rejects forged unlocks', () => {
    const save = createCampaignSave({ now: () => NOW });
    save.progress = {
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[9],
      completedLevelKeys: [OUTER_VEIL_LEVEL_KEYS[0], OUTER_VEIL_LEVEL_KEYS[3], OUTER_VEIL_LEVEL_KEYS[9]],
      unlockedAbilityKeys: [...OUTER_VEIL_ABILITY_KEYS],
      completedRealmKeys: [OUTER_VEIL_REALM_KEY],
      unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY, INNER_KINGDOM_REALM_KEY],
    };
    const result = loadCampaignSave({
      storage: createStorage({ [CAMPAIGN_SAVE_KEY]: JSON.stringify(save) }),
      now: () => NOW,
    });
    expect(result.save.progress).toEqual({
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[1],
      completedLevelKeys: [OUTER_VEIL_LEVEL_KEYS[0]],
      unlockedAbilityKeys: ['memory-carve'],
      completedRealmKeys: [],
      unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY],
    });
  });

  it('records all ten chapters in order and unlocks each named mastery plus the next realm slot', () => {
    let save = createCampaignSave({ now: () => NOW });
    const expectedAbilities = [
      ['memory-carve'], ['memory-carve'], ['memory-carve', 'oathbind'],
      ['memory-carve', 'oathbind'], ['memory-carve', 'oathbind', 'pilgrims-grip'],
      ['memory-carve', 'oathbind', 'pilgrims-grip', 'sanctum-recall'],
      OUTER_VEIL_ABILITY_KEYS,
      OUTER_VEIL_ABILITY_KEYS, OUTER_VEIL_ABILITY_KEYS, OUTER_VEIL_ABILITY_KEYS,
    ];
    for (const [index, levelKey] of OUTER_VEIL_LEVEL_KEYS.entries()) {
      save = recordProductionLevelCompletion(save, {
        levelKey,
        levelTime: 30 + index,
        campaignTime: 300 + index,
        completedAt: NOW,
        now: () => NOW,
      });
      expect(save.progress.unlockedAbilityKeys).toEqual(expectedAbilities[index]);
    }
    expect(save.progress.completedLevelKeys).toEqual(OUTER_VEIL_LEVEL_KEYS);
    expect(save.progress.completedRealmKeys).toEqual([OUTER_VEIL_REALM_KEY]);
    expect(save.progress.unlockedRealmSlotKeys).toEqual([OUTER_VEIL_REALM_KEY, INNER_KINGDOM_REALM_KEY]);
    expect(getOuterVeilContinueTarget(save)).toEqual({
      kind: 'realm-slot', realmKey: INNER_KINGDOM_REALM_KEY, playable: false,
    });
  });

  it('persists Chapter 4 and continues at Chapter 5 without completing the realm', () => {
    const storage = createStorage();
    let save = createCampaignSave({ now: () => NOW });
    for (const [index, levelKey] of OUTER_VEIL_LEVEL_KEYS.slice(0, 4).entries()) {
      save = recordProductionLevelCompletion(save, {
        levelKey,
        levelTime: 40 + index,
        campaignTime: 150 + index,
        completedAt: NOW,
        now: () => NOW,
      });
    }
    expect(persistCampaignSave({ storage, save, now: () => NOW }).persisted).toBe(true);

    const reloaded = loadCampaignSave({ storage, now: () => NOW }).save;
    expect(reloaded.progress).toMatchObject({
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[4],
      completedLevelKeys: OUTER_VEIL_LEVEL_KEYS.slice(0, 4),
      unlockedAbilityKeys: ['memory-carve', 'oathbind'],
      completedRealmKeys: [],
      unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY],
    });
    expect(getOuterVeilContinueTarget(reloaded)).toEqual({
      kind: 'level', levelKey: OUTER_VEIL_LEVEL_KEYS[4], campaignOrder: 5,
    });
    expect(reloaded.records.realmsByKey).toEqual({});
  });

  it('fails closed for out-of-order completion and keeps repeated completion idempotent', () => {
    const save = createCampaignSave({ now: () => NOW });
    expect(recordProductionLevelCompletion(save, { levelKey: OUTER_VEIL_LEVEL_KEYS[4], levelTime: 2, now: () => NOW }))
      .toEqual(save);
    const first = recordProductionLevelCompletion(save, { levelKey: OUTER_VEIL_LEVEL_KEYS[0], levelTime: 50, now: () => NOW });
    const repeated = recordProductionLevelCompletion(first, { levelKey: OUTER_VEIL_LEVEL_KEYS[0], levelTime: 10, now: () => NOW });
    expect(repeated).toEqual(first);
  });

  it('records prototype history independently from production progression', () => {
    const save = createCampaignSave({ now: () => NOW });
    const first = recordLegacyPrototypeCompletion(save, { time: 60, completedAt: NOW, now: () => NOW });
    const slower = recordLegacyPrototypeCompletion(first, { time: 75, completedAt: NOW, now: () => NOW });
    const faster = recordLegacyPrototypeCompletion(slower, { time: 55, completedAt: NOW, now: () => NOW });
    expect(first.progress).toEqual(save.progress);
    expect(first.records.legacyPrototype.bestTimeSeconds).toBe(60);
    expect(slower.records.legacyPrototype.bestTimeSeconds).toBe(60);
    expect(faster.records.legacyPrototype.bestTimeSeconds).toBe(55);
  });

  it('does not rewrite a normalized v4 save on a second load', () => {
    const save = createCampaignSave({ now: () => NOW });
    const storage = createStorage({ [CAMPAIGN_SAVE_KEY]: JSON.stringify(save) });
    const result = loadCampaignSave({ storage, now: () => NOW });
    expect(result.source).toBe('v4');
    expect(result.migrationPersisted).toBeNull();
    expect(storage.writes()).toBe(0);
  });

  it('survives unavailable storage and refuses invalid writes', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadCampaignSave({ storage: broken, now: () => NOW }).source).toBe('default');
    expect(persistCampaignSave({ storage: broken, save: { schemaVersion: 999 }, now: () => NOW }))
      .toEqual({ save: null, persisted: false });
    const save = createCampaignSave({ now: () => NOW });
    expect(persistCampaignSave({ storage: broken, save, now: () => NOW }).persisted).toBe(false);
  });
});
