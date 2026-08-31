import { describe, expect, it } from 'vitest';
import { createLevels, Tile, WORLD_COLS } from '../levels.js';
import {
  assertValidAuthoredLevel,
  OPTIONAL_LEVEL_ARRAYS,
  validateAuthoredLevel,
} from './levelSchema.js';
import {
  CampaignCatalogError,
  getCampaignEntry,
  loadPrototypeLevel,
  PROTOTYPE_CAMPAIGN_CATALOG,
  validateCampaignCatalog,
} from './catalog.js';

describe('authored campaign foundation', () => {
  it('keeps stable string identity separate from legacy order and IDs', () => {
    expect(PROTOTYPE_CAMPAIGN_CATALOG).toHaveLength(10);
    expect(PROTOTYPE_CAMPAIGN_CATALOG[0]).toMatchObject({
      levelKey: 'outer-veil',
      campaignOrder: 1,
      prototypeId: 1,
    });
    expect(getCampaignEntry('outer-veil').levelKey).toBe('outer-veil');
    expect(Object.isFrozen(PROTOTYPE_CAMPAIGN_CATALOG)).toBe(true);
    expect(Object.isFrozen(PROTOTYPE_CAMPAIGN_CATALOG[0])).toBe(true);
  });

  it('validates and normalizes all ten existing prototypes without changing createLevels', async () => {
    const originals = createLevels();
    expect(originals).toHaveLength(10);

    for (const entry of PROTOTYPE_CAMPAIGN_CATALOG) {
      const normalized = await loadPrototypeLevel(entry.levelKey, () => originals);
      expect(normalized.levelKey).toBe(entry.levelKey);
      expect(normalized.campaignOrder).toBe(entry.campaignOrder);
      expect(normalized.id).toBe(entry.prototypeId);
      expect(normalized.map).not.toBe(originals[entry.prototypeId - 1].map);
      expect(normalized.map[0]).not.toBe(originals[entry.prototypeId - 1].map[0]);
    }

    expect(createLevels().map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('loads an authored prototype through its literal dynamic module route', async () => {
    const level = await loadPrototypeLevel('observatory-of-mirrors');
    expect(level).toMatchObject({
      levelKey: 'observatory-of-mirrors',
      campaignOrder: 7,
      id: 7,
      name: 'Observatory of Mirrors',
    });
  });

  it('normalizes omitted optional arrays without mutating the source', () => {
    const source = createLevels()[0];
    for (const field of OPTIONAL_LEVEL_ARRAYS) delete source[field];

    const normalized = assertValidAuthoredLevel(source, {
      levelKey: 'outer-veil',
      campaignOrder: 1,
    });

    for (const field of OPTIONAL_LEVEL_ARRAYS) {
      expect(normalized[field]).toEqual([]);
      expect(source[field]).toBeUndefined();
    }
  });

  it('reports dimensions, tile, geometry, relic, and gate defects together', () => {
    const broken = createLevels()[0];
    broken.map = broken.map.slice(0, -1);
    broken.map[0] = broken.map[0].slice(0, WORLD_COLS - 1);
    broken.map[1][1] = Math.max(...Object.values(Tile)) + 1;
    broken.spawn.x = -1;
    broken.door.x = Number.POSITIVE_INFINITY;
    broken.checkpoints[0].spawnY = -10;
    broken.relics[1].id = broken.relics[0].id;
    broken.gateColumn = WORLD_COLS;

    const result = validateAuthoredLevel(broken, {
      levelKey: 'outer-veil',
      campaignOrder: 1,
    });
    const codes = result.issues.map((issue) => issue.code);

    expect(result.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      'invalid_row_count',
      'invalid_column_count',
      'invalid_tile',
      'out_of_bounds',
      'invalid_number',
      'duplicate_relic_id',
      'invalid_gate_column',
    ]));
  });

  it('rejects a gate tile outside the declared gate column', () => {
    const broken = createLevels()[0];
    broken.map[20][broken.gateColumn + 1] = Tile.GATE;
    const result = validateAuthoredLevel(broken, {
      levelKey: 'outer-veil',
      campaignOrder: 1,
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'gate_column_mismatch' }));
  });

  it('rejects duplicate catalog identity and ordering', () => {
    const duplicateKey = [
      { levelKey: 'same-key', campaignOrder: 1, prototypeId: 1, title: 'One' },
      { levelKey: 'same-key', campaignOrder: 2, prototypeId: 2, title: 'Two' },
    ];
    const duplicateOrder = [
      { levelKey: 'one', campaignOrder: 1, prototypeId: 1, title: 'One' },
      { levelKey: 'two', campaignOrder: 1, prototypeId: 2, title: 'Two' },
    ];

    expect(() => validateCampaignCatalog(duplicateKey)).toThrow(CampaignCatalogError);
    expect(() => validateCampaignCatalog(duplicateOrder)).toThrow(CampaignCatalogError);
  });
});
