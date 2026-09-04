import { describe, expect, it, vi } from 'vitest';
import { createOuterVeil } from '../levels/prototypes/outerVeil.js';
import { Tile } from '../levels/constants.js';
import { loadPrototypeLevel } from './catalog.js';
import {
  createV4CampaignRepository,
  loadV4Level,
  V4_CAMPAIGN_CATALOG,
  V4_CAMPAIGN_ID,
  V4_LEVEL_KEYS,
  V4_SESSION_KIND,
  V5_LAUNCH_PRESENTATION,
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

  it('locks the exact V5 Chapter II completion and Chapter III coming-soon presentation', () => {
    expect(V5_LAUNCH_PRESENTATION).toEqual(expect.objectContaining({
      completionEyebrow: 'CHAPTER II COMPLETE',
      completionHeading: 'THE SECOND CROWN PATH IS OPEN',
      nextChapter: 'CHAPTER III — THE SUNDERED AQUEDUCT',
      nextStatus: 'COMING SOON',
      chronicleLabel: 'FOUNDERS’ CHRONICLE',
    }));
  });

  it('retains every V3 Stage I identity while adding only story presentation data', async () => {
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
    expect(restored.name).toBe('Road of Missing Names');
    expect(restored.map).not.toEqual(prototype.map);
    expect(restored.map[26]).toContain(Tile.GLOW);
    expect(restored.gameplay.enemyRoster).toEqual(['shield', 'spear', 'archer']);
  });

  it('reframes Chapter II as ten Inner Kingdom districts without consuming later realm names', () => {
    expect(V4_CAMPAIGN_CATALOG.slice(10).map(({ title }) => title)).toEqual([
      'Road of Missing Names',
      'Houses Without Doors',
      'The Civic Lift',
      'Measure of a Citizen',
      'Lantern Court',
      'The Unwritten Market',
      'Magistrate’s Teeth',
      'Archive of Sentences',
      'The Royal Road',
      'The Nameless Magistrate',
    ]);
    const futureRealmNames = [
      'The Sundered Aqueduct', 'The Buried Foundry', 'The Gardens of Glass',
      'The Hollow Barracks', 'Observatory of Mirrors', 'The Shifting Sepulchre',
      'The Crown Under Siege', 'Throne of the Eclipse',
    ];
    expect(V4_CAMPAIGN_CATALOG.slice(10).some(({ title }) => futureRealmNames.includes(title))).toBe(false);
  });

  it('removes reserved future-realm names from every Chapter II player-facing route label', async () => {
    const reserved = [
      'Sundered Aqueduct', 'Buried Foundry', 'Gardens of Glass', 'Hollow Barracks',
      'Observatory of Mirrors', 'Shifting Sepulchre', 'Crown Under Siege', 'Throne of the Eclipse',
    ];
    for (const entry of V4_CAMPAIGN_CATALOG.slice(10)) {
      const level = await loadV4Level(entry.levelKey);
      const playerFacing = [
        level.name,
        level.subtitle,
        level.storyLine,
        level.mechanic,
        level.gameplay.openingHint,
        ...level.gameplay.tutorialCues.map(({ text }) => text),
        ...level.checkpoints.map(({ label }) => label),
        ...level.relics.map(({ label }) => label),
        level.boss?.displayName,
        level.boss?.hudLabel,
      ].filter(Boolean).join('\n');
      for (const futureName of reserved) expect(playerFacing).not.toContain(futureName);
    }
  });

  it('integrates twelve stable Liora moments with one two-level opening seed', async () => {
    const appearances = V4_CAMPAIGN_CATALOG.filter(({ storyMoment }) => storyMoment);
    expect(appearances.map(({ campaignOrder }) => campaignOrder)).toEqual([
      1, 2, 3, 4, 7, 9, 10, 13, 15, 17, 18, 19, 20,
    ]);
    expect(new Set(appearances.map(({ storyMoment }) => storyMoment.id)).size).toBe(12);
    expect(appearances.find(({ campaignOrder }) => campaignOrder === 17).storyMoment.title).not.toContain('Liora');
    expect(appearances.find(({ campaignOrder }) => campaignOrder === 18).storyMoment.title).toContain('Liora');
    expect(appearances.find(({ campaignOrder }) => campaignOrder === 13).storyMoment).toMatchObject({
      portraitPath: 'assets/liora-memory-fragment-v1.png',
      portraitAlt: expect.stringContaining('still-unnamed heir'),
    });
    for (const entry of appearances) {
      const level = await loadV4Level(entry.levelKey);
      expect(level.storyMoment).toEqual(entry.storyMoment);
      expect(level.storyMoment).not.toBe(entry.storyMoment);
    }
    expect(appearances.find(({ campaignOrder }) => campaignOrder === 10).storyMoment.delivery).toBe('cinematic');
    expect(appearances.find(({ campaignOrder }) => campaignOrder === 20).storyMoment.delivery).toBe('cinematic');
  });

  it('earns early Liora clues through the authored objective interactions', async () => {
    const sand = await loadV4Level(V4_LEVEL_KEYS[1]);
    const procession = await loadV4Level(V4_LEVEL_KEYS[2]);
    const oath = await loadV4Level(V4_LEVEL_KEYS[3]);
    const sanctum = await loadV4Level(V4_LEVEL_KEYS[6]);
    const gate = await loadV4Level(V4_LEVEL_KEYS[8]);
    expect(sand.objective.marks.find(({ id }) => id === 'maker-seal').revealText).toContain('Two cartographer marks');
    expect(procession.objective.stations.find(({ id }) => id === 'inverted-crown').text).toContain('unnamed heir');
    expect(oath.objective.memoryMark.revealText).toContain('HEIR’S SEAL');
    expect(sanctum.objective.completionHint).toContain('lost heir');
    expect(gate.objective.memoryMark.revealText).toContain('lost heir’s seal');
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

  it('presents the Nameless Magistrate without changing the stable Level 20 geometry or combat data', async () => {
    const prototype = await loadPrototypeLevel('throne-of-eclipse');
    const level = await loadV4Level(V4_LEVEL_KEYS[19]);
    expect(level).toMatchObject({
      levelKey: 'inner-kingdom-10-throne-of-eclipse',
      campaignOrder: 20,
      name: 'The Nameless Magistrate',
      boss: {
        hp: prototype.boss.hp,
        maxHp: prototype.boss.maxHp,
        displayName: 'The Nameless Magistrate',
        hudLabel: 'NAMELESS MAGISTRATE',
        visualStyle: 'nameless-magistrate',
      },
    });
    expect(level.map).toEqual(prototype.map);
    expect(level.spawn).toEqual(prototype.spawn);
    expect(level.door).toEqual(prototype.door);
    expect(level.relics).toEqual(prototype.relics);
    expect(level.movers).toEqual(prototype.movers);
    expect(level.veilPlatforms).toEqual(prototype.veilPlatforms);
    expect(level.boss).toMatchObject(prototype.boss);
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
