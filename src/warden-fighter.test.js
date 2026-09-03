import { describe, expect, it } from 'vitest';
import {
  chooseWardenFighterAttack,
  getWardenFighterAttack,
  getWardenFighterPhase,
  wardenAttackCanHit,
} from './warden-fighter.js';

describe('Warden arcade-fighter contract', () => {
  it('escalates movement and decision speed through three named rounds', () => {
    const guardian = getWardenFighterPhase('guardian');
    const command = getWardenFighterPhase('command');
    const eclipse = getWardenFighterPhase('eclipse');
    expect(command.moveSpeed).toBeGreaterThan(guardian.moveSpeed);
    expect(eclipse.moveSpeed).toBeGreaterThan(command.moveSpeed);
    expect(command.decisionSeconds).toBeLessThan(guardian.decisionSeconds);
    expect(eclipse.decisionSeconds).toBeLessThan(command.decisionSeconds);
    expect(eclipse.label).toContain('FINAL ROUND');
  });

  it('uses deterministic phase patterns and a ranged answer to retreating players', () => {
    const boss = { phase: 'guardian', sequenceIndex: 0 };
    expect(chooseWardenFighterAttack(boss, 80)).toBe('sun-blade');
    boss.sequenceIndex = 1;
    expect(chooseWardenFighterAttack(boss, 80)).toBe('dust-sweep');
    expect(chooseWardenFighterAttack({ phase: 'command', sequenceIndex: 1 }, 999)).toBe('sand-wave');
  });

  it('gives every move a close combat profile and lets jumps clear low attacks', () => {
    expect(getWardenFighterAttack('crown-breaker')).toMatchObject({ guardBreak: true, damage: 1 });
    expect(getWardenFighterAttack('eclipse-rush').lunge).toBeGreaterThan(200);
    expect(wardenAttackCanHit({ attackKind: 'dust-sweep', distance: 40, airborne: true })).toBe(false);
    expect(wardenAttackCanHit({ attackKind: 'dust-sweep', distance: 40, airborne: false })).toBe(true);
    expect(wardenAttackCanHit({ attackKind: 'sun-blade', distance: 999, airborne: false })).toBe(false);
  });
});
