import { describe, expect, it } from 'vitest';
import { CAMPAIGN_SAVE_KEY, createCampaignSave } from './save-data.js';
import { V4_LEVEL_KEYS } from './campaign/v4Campaign.js';
import {
  beginNewV4Run,
  createV4Save,
  getV4ContinueTarget,
  getV4LocalTopTen,
  loadV4Save,
  persistV4Save,
  recordV4LevelCompletion,
  recordV4PlayerNameAndScore,
  recordV4RunCheckpoint,
  V4_SAVE_KEY,
} from './v4-save-data.js';

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

const clock = () => new Date('2026-09-03T10:00:00.000Z');

describe('V4 save and personal Top 10', () => {
  it('starts at Chapter 1 and persists separately from earlier saves', () => {
    const storage = new MemoryStorage();
    const loaded = loadV4Save({ storage, now: clock });
    expect(loaded.save.progress.completedLevelKeys).toEqual([]);
    expect(getV4ContinueTarget(loaded.save)).toMatchObject({ campaignOrder: 1 });
    expect(storage.getItem(V4_SAVE_KEY)).toBeTruthy();
    expect(storage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();
    const persisted = persistV4Save({ storage, save: loaded.save, now: clock });
    expect(persisted.persisted).toBe(true);
  });

  it('migrates a safe Stage I prefix without overwriting the V3 save', () => {
    const previous = createCampaignSave({ now: clock });
    previous.progress.completedLevelKeys = V4_LEVEL_KEYS.slice(0, 4);
    const raw = JSON.stringify(previous);
    const storage = new MemoryStorage({ [CAMPAIGN_SAVE_KEY]: raw });
    const loaded = loadV4Save({ storage, now: clock });
    expect(loaded.save.progress.completedLevelKeys).toEqual(V4_LEVEL_KEYS.slice(0, 4));
    expect(getV4ContinueTarget(loaded.save)).toMatchObject({ campaignOrder: 5 });
    expect(storage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
  });

  it('resumes checkpoint statistics and advances exactly one expected level', () => {
    const original = createV4Save({ now: clock });
    const checkpointed = recordV4RunCheckpoint(original, {
      levelKey: V4_LEVEL_KEYS[0], levelTime: 18, levelDeaths: 2, now: clock,
    });
    const completed = recordV4LevelCompletion(checkpointed, {
      levelKey: V4_LEVEL_KEYS[0], levelTime: 12, levelDeaths: 1, completedAt: clock().toISOString(), now: clock,
    });
    expect(completed.run.levelTimesByKey[V4_LEVEL_KEYS[0]]).toBe(18);
    expect(completed.run.levelDeathsByKey[V4_LEVEL_KEYS[0]]).toBe(2);
    expect(getV4ContinueTarget(completed)).toMatchObject({ campaignOrder: 2 });
    const skipped = recordV4LevelCompletion(completed, {
      levelKey: V4_LEVEL_KEYS[2], levelTime: 10, levelDeaths: 0, now: clock,
    });
    expect(skipped.progress.completedLevelKeys).toEqual([V4_LEVEL_KEYS[0]]);
  });

  it('records, sorts, limits, and preserves a personal Top 10 after complete live runs', () => {
    let save = createV4Save({ now: clock });
    for (const levelKey of V4_LEVEL_KEYS) {
      save = recordV4LevelCompletion(save, {
        levelKey,
        levelTime: 100,
        levelDeaths: 0,
        completionStats: levelKey === V4_LEVEL_KEYS[9]
          ? { attempts: 2, damageTaken: 3, combatTimeSeconds: 100 } : undefined,
        completedAt: clock().toISOString(),
        now: clock,
      });
    }
    expect(save.pendingCompletion).toMatchObject({ totalTimeSeconds: 2000, deaths: 0, metricsComplete: true });
    const recorded = recordV4PlayerNameAndScore(save, { name: 'Aren', now: clock });
    expect(recorded.score).toMatchObject({ playerName: 'Aren', totalTimeSeconds: 2000, wardenAttempts: 2 });
    expect(getV4LocalTopTen(recorded.save)).toHaveLength(1);
    expect(beginNewV4Run(recorded.save, { now: clock }).localTopTen).toHaveLength(1);
  });

  it('does not rank partial migrated statistics or unsafe names', () => {
    const partial = createV4Save({ now: clock });
    partial.progress.completedLevelKeys = [...V4_LEVEL_KEYS];
    partial.progress.currentLevelKey = V4_LEVEL_KEYS.at(-1);
    partial.run = null;
    partial.pendingCompletion = {
      totalTimeSeconds: 2000, deaths: 0, completedAt: clock().toISOString(), metricsComplete: false,
    };
    const remembered = recordV4PlayerNameAndScore(partial, { name: 'Aren', now: clock });
    expect(remembered.save.playerName).toBe('Aren');
    expect(remembered.score).toBeNull();
    expect(recordV4PlayerNameAndScore(partial, { name: '   ', now: clock }).validation.valid).toBe(false);
  });

  it('preserves an unranked completion long enough to remember the player name', () => {
    let partial = createV4Save({ now: clock });
    partial.run.metricsComplete = false;
    for (const levelKey of V4_LEVEL_KEYS) {
      partial = recordV4LevelCompletion(partial, {
        levelKey, levelTime: 100, levelDeaths: 0,
        completedAt: clock().toISOString(), now: clock,
      });
    }
    const persistedShape = JSON.parse(JSON.stringify(partial));
    const recorded = recordV4PlayerNameAndScore(persistedShape, { name: 'Historian', now: clock });
    expect(recorded.save.playerName).toBe('Historian');
    expect(recorded.score).toBeNull();
    expect(recorded.save.localTopTen).toEqual([]);
  });
});
