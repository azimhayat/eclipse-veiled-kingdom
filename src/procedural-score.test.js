import { describe, expect, it } from 'vitest';
import { createScoreStep, scoreSeed, selectScoreProfile } from './procedural-score.js';

describe('original procedural score', () => {
  it('selects readable states without numeric level assumptions', () => {
    expect(selectScoreProfile({ mode: 'title' }).id).toBe('title');
    expect(selectScoreProfile({ mode: 'paused' }).id).toBe('silence');
    expect(selectScoreProfile({ mode: 'play', objectiveType: 'oathbind-restoration' }).id).toBe('puzzle');
    expect(selectScoreProfile({ mode: 'play', healthRatio: .25 }).id).toBe('danger');
    expect(selectScoreProfile({ mode: 'play', warden: { active: true, phase: 'command' } }).id).toBe('warden-command');
    expect(selectScoreProfile({ mode: 'win' }).id).toBe('restoration');
  });

  it('derives deterministic, bounded original notes from stable level identity', () => {
    const profile = selectScoreProfile({ mode: 'play', warden: { active: true, phase: 'eclipse' } });
    const seed = scoreSeed('warden-of-dust', profile.id);
    const first = createScoreStep(profile, 9, seed);
    expect(first).toEqual(createScoreStep(profile, 9, seed));
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(3);
    expect(first.every((note) => note.freq >= 35 && note.freq <= 1800 && note.gain <= .1)).toBe(true);
    expect(scoreSeed('warden-of-dust', profile.id)).not.toBe(scoreSeed('buried-dawn', profile.id));
  });

  it('schedules no voices for silent states', () => {
    expect(createScoreStep(selectScoreProfile({ mode: 'loading' }), 0, 1)).toEqual([]);
  });
});
