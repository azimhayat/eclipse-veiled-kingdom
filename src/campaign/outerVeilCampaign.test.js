import { describe, expect, it, vi } from 'vitest';
import { createOuterVeil } from '../levels/prototypes/outerVeil.js';
import {
  createOuterVeilCampaignRepository,
  getOuterVeilCampaignEntry,
  loadOuterVeilLevel,
  OUTER_VEIL_ABILITY_KEYS,
  OUTER_VEIL_CAMPAIGN_CATALOG,
  OUTER_VEIL_LEVEL_KEYS,
} from './outerVeilCampaign.js';
import { PROTOTYPE_CAMPAIGN_CATALOG } from './catalog.js';

describe('integrated Outer Veil campaign', () => {
  it('defines ten ordered stable production identities and no placeholder Level 11', () => {
    expect(OUTER_VEIL_CAMPAIGN_CATALOG).toHaveLength(10);
    expect(OUTER_VEIL_CAMPAIGN_CATALOG.map((entry) => entry.campaignOrder))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(OUTER_VEIL_LEVEL_KEYS[0]).toBe('outer-veil-01-buried-dawn');
    expect(OUTER_VEIL_LEVEL_KEYS.at(-1)).toBe('outer-veil-10-warden-of-dust');
    expect(getOuterVeilCampaignEntry('outer-veil-11-road-of-missing-names')).toBeNull();
    expect(OUTER_VEIL_ABILITY_KEYS).toEqual([
      'memory-carve', 'oathbind', 'pilgrims-grip', 'sanctum-recall', 'dawnstroke',
    ]);
    expect(PROTOTYPE_CAMPAIGN_CATALOG[0].levelKey).toBe('outer-veil');
  });

  it('wraps Buried Dawn with production identity while preserving exact geometry and interactions', async () => {
    const prototype = createOuterVeil();
    const production = await loadOuterVeilLevel(OUTER_VEIL_LEVEL_KEYS[0]);
    expect(production).toMatchObject({
      levelKey: OUTER_VEIL_LEVEL_KEYS[0],
      campaignOrder: 1,
      id: 1,
      name: 'Buried Dawn',
    });
    expect(production.map).toEqual(prototype.map);
    expect(production.spawn).toEqual(prototype.spawn);
    expect(production.checkpoints).toEqual(prototype.checkpoints);
    expect(production.relics).toEqual(prototype.relics);
    expect(production.block).toEqual(prototype.block);
    expect(production.plate).toEqual(prototype.plate);
    expect(production.door).toEqual(prototype.door);
  });

  it('loads all ten authored modules under the catalog identity', async () => {
    for (const entry of OUTER_VEIL_CAMPAIGN_CATALOG) {
      const level = await loadOuterVeilLevel(entry.levelKey);
      expect(level).toMatchObject({
        levelKey: entry.levelKey,
        campaignOrder: entry.campaignOrder,
        id: entry.legacyId,
      });
      expect(level.name).toBe(entry.title);
    }
  });

  it('keeps direct resume lazy and bounded to Level 1, current, and next', async () => {
    const repository = createOuterVeilCampaignRepository();
    const load = vi.spyOn(repository, 'loadLevel');
    await repository.loadTemplate(0);
    repository.retainAround(6);
    await repository.loadTemplate(6);
    await repository.loadTemplate(7);
    repository.retainAround(6);
    expect(load.mock.calls.map(([key]) => key)).toEqual([
      OUTER_VEIL_LEVEL_KEYS[0], OUTER_VEIL_LEVEL_KEYS[6], OUTER_VEIL_LEVEL_KEYS[7],
    ]);
    expect([...repository.templates.keys()]).toEqual([
      OUTER_VEIL_LEVEL_KEYS[0], OUTER_VEIL_LEVEL_KEYS[6], OUTER_VEIL_LEVEL_KEYS[7],
    ]);
  });
});
