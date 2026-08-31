import { describe, expect, it } from 'vitest';
import { PROTOTYPE_CAMPAIGN_CATALOG } from './catalog.js';
import { attachPrototypeGameplay, getPrototypeGameplay } from './prototypeGameplay.js';

describe('prototype gameplay metadata', () => {
  it('defines explicit behavior for every prototype instead of relying on numeric IDs', () => {
    for (const entry of PROTOTYPE_CAMPAIGN_CATALOG) {
      const gameplay = getPrototypeGameplay(entry.levelKey);
      expect(gameplay?.enemyRoster?.length).toBeGreaterThan(0);
    }
  });

  it('keeps the Outer Veil tutorial and demo route authored as data', () => {
    const level = attachPrototypeGameplay({ levelKey: 'outer-veil' });
    expect(level.gameplay.openingHint).toContain('Move with A / D');
    expect(level.gameplay.tutorialCues).toHaveLength(3);
    expect(level.gameplay.demoRelicOrder).toEqual(['sand-crown', 'high-stair', 'arena-floor']);
  });
});

