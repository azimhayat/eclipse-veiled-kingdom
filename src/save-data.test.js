import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_SAVE_KEY,
  CAMPAIGN_ID,
  INTERIM_SAVE_KEY,
  LEGACY_SAVE_KEY,
  NUMERIC_CAMPAIGN_SAVE_KEY,
  PREVIOUS_CAMPAIGN_SAVE_KEY,
  beginStageOneRun,
  createCampaignSave,
  getOuterVeilContinueTarget,
  getStageOneRunCheckpoint,
  getStageOneChronicle,
  loadCampaignSave,
  persistCampaignSave,
  recordLegacyPrototypeCompletion,
  recordProductionLevelCompletion,
  recordStageOnePlayerName,
  recordStageOneRunCheckpoint,
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

describe('campaign save data v5', () => {
  it('creates a fresh stable-key Outer Veil campaign inside the 100-level foundation', () => {
    const save = createCampaignSave({ now: () => NOW });
    expect(save).toMatchObject({
      schemaVersion: 5,
      campaignId: 'kingdom-100-v1',
      totalLevels: 100,
      progress: {
        currentLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
        completedLevelKeys: [],
        unlockedAbilityKeys: [],
        completedRealmKeys: [],
        unlockedRealmSlotKeys: [OUTER_VEIL_REALM_KEY],
      },
      records: {
        levelsByKey: {}, realmsByKey: {}, legacyPrototype: null,
        stageOne: {
          activeRun: {
            provenance: 'live-run-v1',
            nextLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
            metricsComplete: true,
          },
          latestChronicle: null,
        },
      },
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

  it('labels genuine incomplete v2 progress with its real migration provenance', () => {
    const interim = v3Save([1, 2]);
    interim.schemaVersion = 2;
    interim.campaignId = 'main';
    const result = loadCampaignSave({
      storage: createStorage({ [INTERIM_SAVE_KEY]: JSON.stringify(interim) }),
      now: () => NOW,
    });
    expect(result.save.records.stageOne.activeRun).toMatchObject({
      provenance: 'partial-migration-v2',
      nextLevelKey: OUTER_VEIL_LEVEL_KEYS[2],
      metricsComplete: false,
    });
  });

  it('migrates genuine contiguous v3 progress to stable level keys and derived abilities', () => {
    const previous = v3Save([1, 2, 3]);
    previous.records.levels[2] = { completed: true, bestTimeSeconds: 42, completedAt: NOW };
    const storage = createStorage({ [NUMERIC_CAMPAIGN_SAVE_KEY]: JSON.stringify(previous) });
    const result = loadCampaignSave({ storage, now: () => NOW });
    expect(result.source).toBe('previous-v3');
    expect(result.save.progress).toMatchObject({
      currentLevelKey: OUTER_VEIL_LEVEL_KEYS[3],
      completedLevelKeys: OUTER_VEIL_LEVEL_KEYS.slice(0, 3),
      unlockedAbilityKeys: ['memory-carve', 'oathbind'],
    });
    expect(result.save.records.levelsByKey[OUTER_VEIL_LEVEL_KEYS[1]].bestTimeSeconds).toBe(42);
    expect(storage.value(NUMERIC_CAMPAIGN_SAVE_KEY)).toBe(JSON.stringify(previous));
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

  it('migrates completed v4 progress without inventing historic statistics', () => {
    const v4 = createCampaignSave({ now: () => NOW });
    v4.schemaVersion = 4;
    delete v4.records.stageOne;
    v4.progress.completedLevelKeys = [...OUTER_VEIL_LEVEL_KEYS];
    v4.records.realmsByKey[OUTER_VEIL_REALM_KEY] = { bestTimeSeconds: 77, completedAt: NOW };
    const storage = createStorage({ [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(v4) });
    const result = loadCampaignSave({ storage, now: () => NOW });
    expect(result.source).toBe('previous-v4');
    expect(result.save.schemaVersion).toBe(5);
    expect(result.save.records.stageOne.activeRun).toBeNull();
    expect(getStageOneChronicle(result.save)).toMatchObject({
      completedAt: NOW,
      metrics: {
        totalTimeSeconds: null,
        retries: null,
        wardenAttempts: null,
        damageTaken: null,
        wardenCombatTimeSeconds: null,
      },
      rank: { status: 'unranked', key: null },
    });
    expect(getStageOneChronicle(result.save).metrics.totalTimeSeconds).not.toBe(77);
    expect(result.save.records.realmsByKey[OUTER_VEIL_REALM_KEY].bestTimeSeconds).toBeNull();
    expect(storage.value(PREVIOUS_CAMPAIGN_SAVE_KEY)).toBe(JSON.stringify(v4));
  });

  it('migrates incomplete v4 progress as an honest partial run', () => {
    const v4 = createCampaignSave({ now: () => NOW });
    v4.schemaVersion = 4;
    delete v4.records.stageOne;
    v4.progress.completedLevelKeys = OUTER_VEIL_LEVEL_KEYS.slice(0, 3);
    const result = loadCampaignSave({
      storage: createStorage({ [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(v4) }),
      now: () => NOW,
    });
    expect(result.save.records.stageOne.activeRun).toMatchObject({
      provenance: 'partial-migration-v4',
      nextLevelKey: OUTER_VEIL_LEVEL_KEYS[3],
      metricsComplete: false,
    });
  });

  it('keeps a migrated partial run unranked through final completion and ignores duplicate final events', () => {
    const v4 = createCampaignSave({ now: () => NOW });
    v4.schemaVersion = 4;
    delete v4.records.stageOne;
    v4.progress.completedLevelKeys = OUTER_VEIL_LEVEL_KEYS.slice(0, 3);
    let save = loadCampaignSave({
      storage: createStorage({ [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(v4) }),
      now: () => NOW,
    }).save;
    for (const levelKey of OUTER_VEIL_LEVEL_KEYS.slice(3)) {
      save = recordProductionLevelCompletion(save, {
        levelKey,
        levelTime: 60,
        levelDeaths: 0,
        completionStats: levelKey === OUTER_VEIL_LEVEL_KEYS[9]
          ? { attempts: 2, damageTaken: 3, combatTimeSeconds: 90 }
          : null,
        completedAt: NOW,
        now: () => NOW,
      });
    }
    const named = recordStageOnePlayerName(save, { name: 'Partial Path', now: () => NOW }).save;
    const beforeDuplicate = JSON.parse(JSON.stringify(named));
    const duplicate = recordProductionLevelCompletion(named, {
      levelKey: OUTER_VEIL_LEVEL_KEYS[9],
      levelTime: 1,
      levelDeaths: 0,
      completionStats: { attempts: 1, damageTaken: 0, combatTimeSeconds: 1 },
      completedAt: '2027-01-01T00:00:00.000Z',
      now: () => '2027-01-01T00:00:00.000Z',
    });
    expect(getStageOneChronicle(named)).toMatchObject({
      playerName: 'Partial Path',
      completedAt: NOW,
      metrics: { provenance: 'partial-migration-v4', metricsComplete: false },
      rank: { status: 'unranked' },
    });
    expect(duplicate).toEqual(beforeDuplicate);
  });

  it('treats a zero-progress v4 save as a fresh rank-eligible Stage I run', () => {
    const v4 = createCampaignSave({ now: () => NOW });
    v4.schemaVersion = 4;
    delete v4.records.stageOne;
    const result = loadCampaignSave({
      storage: createStorage({ [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(v4) }),
      now: () => NOW,
    });
    expect(result.save.records.stageOne.activeRun).toMatchObject({
      provenance: 'live-run-v1',
      nextLevelKey: OUTER_VEIL_LEVEL_KEYS[0],
      metricsComplete: true,
    });
  });

  it('binds v5 run and Chronicle state to real campaign progression', () => {
    const forged = createCampaignSave({ now: () => NOW });
    forged.records.stageOne.activeRun.nextLevelKey = OUTER_VEIL_LEVEL_KEYS[9];
    forged.records.stageOne.activeRun.levelTimesByKey = Object.fromEntries(
      OUTER_VEIL_LEVEL_KEYS.slice(0, 9).map((key) => [key, 0]),
    );
    forged.records.stageOne.latestChronicle = {
      provenance: 'live-run-v1',
      playerName: 'Forged',
      levelTimesByKey: Object.fromEntries(OUTER_VEIL_LEVEL_KEYS.map((key) => [key, 0])),
      levelDeathsByKey: Object.fromEntries(OUTER_VEIL_LEVEL_KEYS.map((key) => [key, 0])),
      warden: { attempts: 1, damageTaken: 0, combatTimeSeconds: 1 },
      completedAt: NOW,
      metricsComplete: true,
    };
    const result = loadCampaignSave({
      storage: createStorage({ [CAMPAIGN_SAVE_KEY]: JSON.stringify(forged) }),
      now: () => NOW,
    });
    expect(result.save.records.stageOne.activeRun).toMatchObject({
      nextLevelKey: OUTER_VEIL_LEVEL_KEYS[0], metricsComplete: true,
    });
    expect(result.save.records.stageOne.activeRun.levelTimesByKey).toEqual({});
    expect(result.save.records.stageOne.latestChronicle).toBeNull();
    expect(getStageOneChronicle(result.save)).toBeNull();
  });

  it('repairs missing v5 Stage I state without stranding progress or the Chronicle', () => {
    const incomplete = createCampaignSave({ now: () => NOW });
    delete incomplete.records.stageOne;
    incomplete.progress.completedLevelKeys = OUTER_VEIL_LEVEL_KEYS.slice(0, 2);
    const repairedRun = loadCampaignSave({
      storage: createStorage({ [CAMPAIGN_SAVE_KEY]: JSON.stringify(incomplete) }),
      now: () => NOW,
    }).save;
    expect(repairedRun.records.stageOne.activeRun).toMatchObject({
      provenance: 'partial-live',
      nextLevelKey: OUTER_VEIL_LEVEL_KEYS[2],
      metricsComplete: false,
    });

    const completed = createCampaignSave({ now: () => NOW });
    delete completed.records.stageOne;
    completed.progress.completedLevelKeys = [...OUTER_VEIL_LEVEL_KEYS];
    completed.records.realmsByKey[OUTER_VEIL_REALM_KEY] = { bestTimeSeconds: 20, completedAt: NOW };
    const repairedChronicle = loadCampaignSave({
      storage: createStorage({ [CAMPAIGN_SAVE_KEY]: JSON.stringify(completed) }),
      now: () => NOW,
    }).save;
    expect(getStageOneChronicle(repairedChronicle)).toMatchObject({
      completedAt: NOW,
      metrics: { provenance: 'unknown', metricsComplete: false, totalTimeSeconds: null },
      rank: { status: 'unranked' },
    });
    expect(recordStageOnePlayerName(repairedChronicle, { name: 'Recovered', now: () => NOW }).save)
      .not.toBeNull();
  });

  it('finalises and reloads a verified Chronicle, then starts an independent replay run', () => {
    const storage = createStorage();
    let save = createCampaignSave({ now: () => NOW });
    for (const [index, levelKey] of OUTER_VEIL_LEVEL_KEYS.entries()) {
      save = recordProductionLevelCompletion(save, {
        levelKey,
        levelTime: 100 + index,
        levelDeaths: index === 3 ? 1 : 0,
        campaignTime: 1000,
        completionStats: index === 9 ? { attempts: 2, damageTaken: 3, combatTimeSeconds: 111 } : null,
        completedAt: NOW,
        now: () => NOW,
      });
    }
    const chronicle = getStageOneChronicle(save);
    expect(chronicle).toMatchObject({
      metrics: {
        provenance: 'live-run-v1',
        metricsComplete: true,
        levelsCompleted: 10,
        totalTimeSeconds: 1045,
        retries: 1,
        wardenAttempts: 2,
        damageTaken: 3,
        wardenCombatTimeSeconds: 111,
      },
      rank: { status: 'ranked', key: 'A', title: 'Veil' },
    });
    expect(save.records.realmsByKey[OUTER_VEIL_REALM_KEY].bestTimeSeconds).toBe(1045);
    const named = recordStageOnePlayerName(save, { name: '  أميرة  النور ', now: () => NOW });
    expect(named.validation.valid).toBe(true);
    save = named.save;
    expect(persistCampaignSave({ storage, save, now: () => NOW }).persisted).toBe(true);
    const reloaded = loadCampaignSave({ storage, now: () => NOW }).save;
    expect(getStageOneChronicle(reloaded).playerName).toBe('أميرة النور');
    const replay = beginStageOneRun(reloaded, { now: () => NOW });
    expect(replay.progress.completedLevelKeys).toEqual(OUTER_VEIL_LEVEL_KEYS);
    expect(getOuterVeilContinueTarget(replay)).toEqual({
      kind: 'level', levelKey: OUTER_VEIL_LEVEL_KEYS[0], campaignOrder: 1,
    });
    const afterReplayLevel = recordProductionLevelCompletion(replay, {
      levelKey: OUTER_VEIL_LEVEL_KEYS[0], levelTime: 90, levelDeaths: 0, now: () => NOW,
    });
    expect(afterReplayLevel.progress.completedLevelKeys).toEqual(OUTER_VEIL_LEVEL_KEYS);
    expect(afterReplayLevel.records.stageOne.activeRun.nextLevelKey).toBe(OUTER_VEIL_LEVEL_KEYS[1]);
    expect(getStageOneChronicle(afterReplayLevel).playerName).toBe('أميرة النور');
  });

  it('persists monotonic in-progress chapter time and deaths across reload', () => {
    const storage = createStorage();
    let save = createCampaignSave({ now: () => NOW });
    const levelKey = OUTER_VEIL_LEVEL_KEYS[0];
    save = recordStageOneRunCheckpoint(save, {
      levelKey, levelTime: 42.5, levelDeaths: 2, now: () => NOW,
    });
    save = recordStageOneRunCheckpoint(save, {
      levelKey, levelTime: 12, levelDeaths: 1, now: () => NOW,
    });
    expect(getStageOneRunCheckpoint(save, levelKey)).toEqual({
      levelKey, timeSeconds: 42.5, deaths: 2,
    });
    persistCampaignSave({ storage, save, now: () => NOW });
    const reloaded = loadCampaignSave({ storage, now: () => NOW }).save;
    expect(getStageOneRunCheckpoint(reloaded, levelKey)).toEqual({
      levelKey, timeSeconds: 42.5, deaths: 2,
    });
    const completed = recordProductionLevelCompletion(reloaded, {
      levelKey, levelTime: 48, levelDeaths: 2, now: () => NOW,
    });
    expect(completed.records.stageOne.activeRun.checkpoint).toEqual({
      levelKey: OUTER_VEIL_LEVEL_KEYS[1], timeSeconds: 0, deaths: 0,
    });
    expect(completed.records.stageOne.activeRun.levelTimesByKey[levelKey]).toBe(48);
  });

  it('persists cumulative Warden counters during an unfinished final chapter', () => {
    const storage = createStorage();
    let save = createCampaignSave({ now: () => NOW });
    for (const levelKey of OUTER_VEIL_LEVEL_KEYS.slice(0, 9)) {
      save = recordProductionLevelCompletion(save, {
        levelKey, levelTime: 60, levelDeaths: 0, now: () => NOW,
      });
    }
    const levelKey = OUTER_VEIL_LEVEL_KEYS[9];
    save = recordStageOneRunCheckpoint(save, {
      levelKey,
      levelTime: 90,
      levelDeaths: 1,
      wardenStats: { attempts: 3, damageTaken: 5, combatTimeSeconds: 74.5 },
      now: () => NOW,
    });
    persistCampaignSave({ storage, save, now: () => NOW });
    const reloaded = loadCampaignSave({ storage, now: () => NOW }).save;
    expect(getStageOneRunCheckpoint(reloaded, levelKey)).toEqual({
      levelKey,
      timeSeconds: 90,
      deaths: 1,
      warden: { attempts: 3, damageTaken: 5, combatTimeSeconds: 74.5 },
    });
    const completed = recordProductionLevelCompletion(reloaded, {
      levelKey,
      levelTime: 100,
      levelDeaths: 1,
      completionStats: { attempts: 1, damageTaken: 1, combatTimeSeconds: 20 },
      completedAt: NOW,
      now: () => NOW,
    });
    expect(getStageOneChronicle(completed).metrics).toMatchObject({
      wardenAttempts: 3,
      damageTaken: 5,
      wardenCombatTimeSeconds: 74.5,
    });
  });

  it('rejects unsafe Chronicle names without changing the save', () => {
    const save = createCampaignSave({ now: () => NOW });
    expect(recordStageOnePlayerName(save, { name: '\u202eHidden', now: () => NOW })).toMatchObject({
      save: null,
      validation: { valid: false, reason: 'forbidden-control' },
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

  it('does not rewrite a normalized v5 save on a second load', () => {
    const save = createCampaignSave({ now: () => NOW });
    const storage = createStorage({ [CAMPAIGN_SAVE_KEY]: JSON.stringify(save) });
    const result = loadCampaignSave({ storage, now: () => NOW });
    expect(result.source).toBe('v5');
    expect(result.migrationPersisted).toBeNull();
    expect(storage.writes()).toBe(0);
  });

  it('prefers valid v5 and falls back to v4 when the v5 payload is corrupt', () => {
    const current = createCampaignSave({ now: () => NOW });
    const staleV4 = createCampaignSave({ now: () => NOW });
    staleV4.schemaVersion = 4;
    delete staleV4.records.stageOne;
    staleV4.progress.completedLevelKeys = OUTER_VEIL_LEVEL_KEYS.slice(0, 4);
    const preferred = loadCampaignSave({
      storage: createStorage({
        [CAMPAIGN_SAVE_KEY]: JSON.stringify(current),
        [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(staleV4),
      }),
      now: () => NOW,
    });
    expect(preferred.source).toBe('v5');
    expect(preferred.save.progress.completedLevelKeys).toEqual([]);

    const fallbackStorage = createStorage({
      [CAMPAIGN_SAVE_KEY]: '{not-json',
      [PREVIOUS_CAMPAIGN_SAVE_KEY]: JSON.stringify(staleV4),
    });
    const fallback = loadCampaignSave({ storage: fallbackStorage, now: () => NOW });
    expect(fallback.source).toBe('previous-v4');
    expect(fallback.save.progress.completedLevelKeys).toEqual(OUTER_VEIL_LEVEL_KEYS.slice(0, 4));
    expect(fallback.migrationPersisted).toBe(true);
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
