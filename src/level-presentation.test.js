import { describe, expect, it } from 'vitest';
import {
  buildLevelPresentation,
  detectPresentationInput,
  PRESENTATION_DURATIONS,
} from './level-presentation.js';

const level = {
  level: 4,
  name: 'The Weight of Oaths',
  subtitle: 'A Promise Given Shape',
  storyLine: 'The civic road remembers what it was built to carry.',
  mechanic: 'Bind one rune block into a foothold, then restore the public seal.',
  objectiveTitle: 'Restore the civic promise',
  abilityUnlock: {
    key: 'oathbind',
    name: 'Oathbind',
    description: 'Anchor a civic rune block in memory.',
  },
};

describe('level presentation sequence', () => {
  it('keeps the prototype presentation to one preserved chapter card', () => {
    expect(buildLevelPresentation(level)).toEqual([expect.objectContaining({
      kind: 'chapter',
      kicker: 'Chapter 04 · The Weight of Oaths',
      durationMs: PRESENTATION_DURATIONS.chapter,
    })]);
  });

  it('serialises chapter, mastery, and objective for an unlocking production chapter', () => {
    const cards = buildLevelPresentation(level, { productionCampaign: true, inputMode: 'keyboard' });
    expect(cards.map(({ kind }) => kind)).toEqual(['chapter', 'mastery', 'objective']);
    expect(cards[1]).toMatchObject({
      kicker: 'Mastery remembered · 2 of 5',
      title: 'Oathbind',
      inputLabel: 'Keys',
      input: 'K or Shift beside a rune block binds it; use the same action to release it.',
    });
    expect(cards[2]).toMatchObject({
      kicker: 'Current objective',
      title: 'Restore the civic promise',
    });
  });

  it('uses touch-native labels without changing the authored mastery', () => {
    const cards = buildLevelPresentation(level, { productionCampaign: true, inputMode: 'touch' });
    expect(cards[1]).toMatchObject({
      title: 'Oathbind',
      inputLabel: 'Touch',
      input: 'DIG beside a rune block binds it; use DIG again to release it.',
    });
  });

  it('shows only chapter then objective when no mastery unlocks', () => {
    const cards = buildLevelPresentation({ ...level, level: 5, abilityUnlock: undefined }, { productionCampaign: true });
    expect(cards.map(({ kind }) => kind)).toEqual(['chapter', 'objective']);
  });

  it('labels the second V4 realm against the full twenty-level campaign', () => {
    const cards = buildLevelPresentation({ ...level, level: 11, name: 'Road of Missing Names' }, {
      productionCampaign: true,
      campaignTotal: 20,
      realmLabel: 'Chapter II · Inner Kingdom',
      unitLabel: 'Level',
    });
    expect(cards[0].kicker).toBe('Chapter II · Inner Kingdom · Level 11 of 20 · Road of Missing Names');
  });

  it('places a three-to-eight-second Liora memory echo before mastery and objective cards', () => {
    const storyMoment = {
      id: 'liora-03-law-before-crown',
      delivery: 'presentation',
      kicker: 'Recovered law · the first promise',
      title: 'The protective law bears the heir’s seal.',
      detail: 'The oath placed every citizen’s memory beyond royal possession.',
    };
    const cards = buildLevelPresentation({ ...level, storyMoment }, { productionCampaign: true });
    expect(cards.map(({ kind }) => kind)).toEqual(['chapter', 'memory', 'mastery', 'objective']);
    expect(cards[1]).toMatchObject({
      storyMomentId: storyMoment.id,
      durationMs: PRESENTATION_DURATIONS.memory,
      title: storyMoment.title,
      detail: storyMoment.detail,
    });
    expect(cards[1].durationMs).toBeGreaterThanOrEqual(3000);
    expect(cards[1].durationMs).toBeLessThanOrEqual(8000);
  });

  it('keeps chapter-ending revelations in their bridge films instead of spoiling them at level start', () => {
    const cards = buildLevelPresentation({
      ...level,
      level: 10,
      storyMoment: {
        id: 'liora-06-carried-into-the-paths',
        delivery: 'cinematic',
        title: 'This reveal belongs after the Warden is restored.',
      },
    }, { productionCampaign: true });
    expect(cards.map(({ kind }) => kind)).toEqual(['chapter', 'mastery', 'objective']);
    expect(cards.some(({ kind }) => kind === 'memory')).toBe(false);
  });

  it.each([
    [2, 'memory-carve', 'Memory Carve', 'Mastery remembered · 1 of 5'],
    [4, 'oathbind', 'Oathbind', 'Mastery remembered · 2 of 5'],
    [6, 'pilgrims-grip', "Pilgrim's Grip", 'Mastery remembered · 3 of 5'],
    [7, 'sanctum-recall', 'Sanctum Recall', 'Mastery remembered · 4 of 5'],
    [8, 'dawnstroke', 'Dawnstroke', 'Mastery remembered · 5 of 5'],
  ])('maps Chapter %i to exactly one ordered %s mastery', (chapter, key, name, kicker) => {
    const cards = buildLevelPresentation({
      ...level,
      level: chapter,
      abilityUnlock: { key, name, description: `${name} description.` },
    }, { productionCampaign: true, inputMode: 'touch' });
    expect(cards.filter(({ kind }) => kind === 'mastery')).toEqual([
      expect.objectContaining({ title: name, kicker }),
    ]);
  });

  it.each([1, 3, 5, 9, 10])('does not invent a mastery for Chapter %i', (chapter) => {
    const cards = buildLevelPresentation({ ...level, level: chapter, abilityUnlock: null }, { productionCampaign: true });
    expect(cards.some(({ kind }) => kind === 'mastery')).toBe(false);
  });

  it('fails closed for malformed engine events', () => {
    expect(buildLevelPresentation(null, { productionCampaign: true })).toEqual([]);
    expect(buildLevelPresentation({ level: 2 }, { productionCampaign: true })).toEqual([]);
  });

  it('detects coarse input and safely falls back to keyboard copy', () => {
    const matchMedia = (query) => ({ matches: query.includes('max-width: 900px') });
    expect(detectPresentationInput({ matchMedia })).toBe('touch');
    expect(detectPresentationInput({ matchMedia: () => ({ matches: false }) })).toBe('keyboard');
    expect(detectPresentationInput({ matchMedia: () => { throw new Error('blocked'); } })).toBe('keyboard');
  });
});
