import { describe, expect, it } from 'vitest';
import { cloneLevel } from './levels/cloneLevel.js';
import { createWardenOfDust } from './levels/outerVeil/wardenOfDust.js';
import {
  advanceWardenDuel,
  completeWardenDuel,
  damageWardenDuelBoss,
  recordWardenDuelPlayerDamage,
  resetWardenDuel,
  startWardenDuelAttempt,
} from './warden-duel-state.js';

function duelState() {
  return cloneLevel(createWardenOfDust()).objective.duel;
}

describe('Warden duel state', () => {
  it('starts and restarts isolated attempts while preserving aggregate fight cost', () => {
    const duel = duelState();
    expect(startWardenDuelAttempt(duel)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'guardian', active: true,
      boss: { hp: 48, phase: 'guardian', action: 'intro', invulnerable: true },
      attempt: { count: 1, elapsed: 0, damageTaken: 0 },
    });
    expect(advanceWardenDuel(duel, 12.5)).toBe(true);
    expect(recordWardenDuelPlayerDamage(duel, 2)).toBe(true);
    duel.player.comboStep = 3;
    duel.player.guarding = true;
    duel.boss.hp = 4;

    expect(startWardenDuelAttempt(duel)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'guardian', active: true,
      boss: { hp: 48, phase: 'guardian', action: 'intro', invulnerable: true, armored: false },
      player: { comboStep: 0, guarding: false, guardLessonComplete: false },
      attempt: { count: 2, elapsed: 0, damageTaken: 0 },
      totals: { elapsed: 12.5, damageTaken: 2 },
    });
  });

  it('advances through guardian, command, eclipse, and a non-lethal finale', () => {
    const duel = duelState();
    startWardenDuelAttempt(duel);
    duel.boss.invulnerable = false;
    expect(damageWardenDuelBoss(duel, 16)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'command',
      boss: { hp: 32, phase: 'command', action: 'intro', armored: true, invulnerable: true },
    });
    duel.boss.invulnerable = false;
    expect(damageWardenDuelBoss(duel, 16)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'eclipse',
      boss: { hp: 16, phase: 'eclipse', action: 'intro', armored: false, invulnerable: true },
    });
    duel.boss.invulnerable = false;
    expect(damageWardenDuelBoss(duel, 99)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'finale', active: true,
      boss: { hp: 0, phase: 'finale', action: 'staggered', invulnerable: true },
      finale: { ready: true, struck: false },
    });
    expect(damageWardenDuelBoss(duel, 1)).toBe(false);
    expect(completeWardenDuel(duel)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'complete', active: false, complete: true,
      finale: { ready: true, struck: true },
    });
    expect(completeWardenDuel(duel)).toBe(false);
  });

  it('expires combo, parry, action, and hitstun clocks deterministically', () => {
    const duel = duelState();
    startWardenDuelAttempt(duel);
    duel.player.comboStep = 2;
    duel.player.comboClock = .2;
    duel.player.parryClock = .12;
    duel.boss.action = 'sweep';
    duel.boss.actionClock = .1;
    duel.boss.hitstun = .15;
    expect(advanceWardenDuel(duel, .2)).toBe(true);
    expect(duel).toMatchObject({
      player: { comboStep: 0, comboClock: 0, parryClock: 0 },
      boss: { action: 'sweep', actionClock: 0, hitstun: 0 },
      attempt: { elapsed: .2 },
      totals: { elapsed: .2 },
    });
  });

  it('full reset returns a dirty duel to its authored replay state', () => {
    const duel = duelState();
    startWardenDuelAttempt(duel);
    advanceWardenDuel(duel, 20);
    recordWardenDuelPlayerDamage(duel, 3);
    damageWardenDuelBoss(duel, 8);
    duel.player.guarding = true;
    expect(resetWardenDuel(duel)).toBe(true);
    expect(duel).toMatchObject({
      phase: 'sealed', active: false, complete: false,
      boss: {
        hp: 48, phase: 'guardian', action: 'idle', invulnerable: false,
        armored: false, armorBreakReady: false, recoveryHits: 0,
      },
      player: { comboStep: 0, guarding: false, guardLessonComplete: false },
      attempt: { count: 0, elapsed: 0, damageTaken: 0 },
      totals: { elapsed: 0, damageTaken: 0 },
      finale: { ready: false, struck: false },
    });
  });
});
