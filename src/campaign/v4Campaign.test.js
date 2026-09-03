import { describe, expect, it, vi } from 'vitest';
import { createOuterVeil } from '../levels/prototypes/outerVeil.js';
import { Tile } from '../levels/constants.js';
import {
  createV4CampaignRepository,
  loadV4Level,
  V4_CAMPAIGN_CATALOG,
  V4_CAMPAIGN_ID,
  V4_LEVEL_KEYS,
  V4_SESSION_KIND,
} from './v4Campaign.js';

describe('V4 twenty-level campaign', () => {
  it('contains twenty real ordered levels with stable unique identities', () => {
    expect(V4_CAMPAIGN_CATALOG).toHaveLength(20);
    expect(V4_CAMPAIGN_CATALOG.map((entry) => entry.campaignOrder))
      .toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(new Set(V4_LEVEL_KEYS).size).toBe(20);
    expect(V4_LEVEL_KEYS[0]).toBe('outer-veil-01-buried-dawn');
    expect(V4_LEVEL_KEYS[9]).toBe('outer-veil-10-warden-of-dust');
    expect(V4_LEVEL_KEYS[10]).toBe('inner-kingdom-01-outer-veil-restored');
    expect(V4_LEVEL_KEYS[19]).toBe('inner-kingdom-10-throne-of-eclipse');
  });

  it('retains every V3 Stage I level unchanged', async () => {
    for (const entry of V4_CAMPAIGN_CATALOG.slice(0, 10)) {
      const level = await loadV4Level(entry.levelKey);
      expect(level).toMatchObject({
        levelKey: entry.levelKey,
        campaignOrder: entry.campaignOrder,
        name: entry.title,
      });
    }
  });

  it('makes Chapter 11 an explicit restored revisit with visible change and harder roster', async () => {
    const prototype = createOuterVeil();
    const restored = await loadV4Level(V4_LEVEL_KEYS[10]);
    expect(restored.name).toBe('Outer Veil Restored');
    expect(restored.map).not.toEqual(prototype.map);
    expect(restored.map[26]).toContain(Tile.GLOW);
    expect(restored.gameplay.enemyRoster).toEqual(['shield', 'spear', 'archer']);
  });

  it('loads all retained V2 mechanisms as authored Stage II levels', async () => {
    const levels = await Promise.all(V4_LEVEL_KEYS.slice(11).map(loadV4Level));
    expect(levels).toHaveLength(9);
    expect(levels[1].water.length).toBeGreaterThan(0);
    expect(levels[2].crushers.length).toBeGreaterThan(0);
    expect(levels[4].gameplay.enemyRoster).toContain('shield');
    expect(levels[6].veilPlatforms.length).toBeGreaterThan(0);
    expect(levels[8].boss).toMatchObject({ hp: 10, maxHp: 10 });
  });

  it('gives every Stage II level the same finite, touch-safe combat contract', async () => {
    const levels = await Promise.all(V4_LEVEL_KEYS.slice(10).map(loadV4Level));
    for (const level of levels) {
      expect(level.gameplay.combat).toMatchObject({ style: 'unified', maxActive: 3 });
      expect(level.gameplay.combat.maxSpawns).toBeGreaterThanOrEqual(6);
      expect(level.gameplay.combat.controls).toContain('DOWN + STRIKE');
      expect(level.gameplay.combat.controls).toContain('JUMP + STRIKE');
    }
  });

  it('keeps direct resume lazy and bounded at the Stage I/II boundary', async () => {
    const repository = createV4CampaignRepository();
    expect(repository.campaignId).toBe(V4_CAMPAIGN_ID);
    expect(repository.sessionKind).toBe(V4_SESSION_KIND);
    const load = vi.spyOn(repository, 'loadLevel');
    await repository.loadTemplate(0);
    repository.retainAround(10);
    await repository.loadTemplate(9);
    await repository.loadTemplate(10);
    await repository.loadTemplate(11);
    repository.retainAround(10);
    expect(load.mock.calls.map(([key]) => key)).toEqual([
      V4_LEVEL_KEYS[0], V4_LEVEL_KEYS[9], V4_LEVEL_KEYS[10], V4_LEVEL_KEYS[11],
    ]);
    expect([...repository.templates.keys()]).toEqual([
      V4_LEVEL_KEYS[0], V4_LEVEL_KEYS[10], V4_LEVEL_KEYS[11],
    ]);
  });
});
