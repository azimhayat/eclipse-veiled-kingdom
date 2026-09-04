import { TILE } from './levels/constants.js';

export const WARDEN_FIGHTER_ATTACKS = Object.freeze({
  'sun-blade': Object.freeze({
    label: 'SUN-BLADE', windup: .34, active: .16, recovery: .42,
    range: 2.35 * TILE, lunge: 105, damage: 1, guardBreak: false, low: false,
  }),
  'dust-sweep': Object.freeze({
    label: 'DUST SWEEP', windup: .48, active: .2, recovery: .5,
    range: 2.75 * TILE, lunge: 68, damage: 1, guardBreak: false, low: true,
  }),
  'crown-breaker': Object.freeze({
    label: 'CROWN BREAKER', windup: .58, active: .18, recovery: .62,
    range: 2.3 * TILE, lunge: 125, damage: 1, guardBreak: true, low: false,
  }),
  'sand-wave': Object.freeze({
    label: 'SAND WAVE', windup: .62, active: .28, recovery: .56,
    range: 5.1 * TILE, lunge: 35, damage: 1, guardBreak: false, low: true,
  }),
  'eclipse-rush': Object.freeze({
    label: 'ECLIPSE RUSH', windup: .36, active: .26, recovery: .46,
    range: 3.15 * TILE, lunge: 260, damage: 1, guardBreak: false, low: false,
  }),
});

export const WARDEN_FIGHTER_PHASES = Object.freeze({
  guardian: Object.freeze({
    label: 'ROUND I · THE GUARDIAN', moveSpeed: 150, idealRange: 2.25 * TILE,
    decisionSeconds: .72, guardSeconds: .42,
    pattern: Object.freeze(['sun-blade', 'dust-sweep', 'sun-blade', 'sand-wave']),
  }),
  command: Object.freeze({
    label: 'ROUND II · CROWN COMMAND', moveSpeed: 188, idealRange: 2 * TILE,
    decisionSeconds: .56, guardSeconds: .48,
    pattern: Object.freeze(['crown-breaker', 'sun-blade', 'sand-wave', 'dust-sweep']),
  }),
  eclipse: Object.freeze({
    label: 'FINAL ROUND · ECLIPSE', moveSpeed: 232, idealRange: 1.75 * TILE,
    decisionSeconds: .4, guardSeconds: .36,
    pattern: Object.freeze(['eclipse-rush', 'dust-sweep', 'sun-blade', 'crown-breaker', 'sand-wave']),
  }),
});

export function getWardenFighterAttack(kind) {
  return WARDEN_FIGHTER_ATTACKS[kind] || WARDEN_FIGHTER_ATTACKS['sun-blade'];
}

export function getWardenFighterPhase(phase) {
  return WARDEN_FIGHTER_PHASES[phase] || WARDEN_FIGHTER_PHASES.guardian;
}

export function chooseWardenFighterAttack(boss, distance) {
  const phase = getWardenFighterPhase(boss?.phase);
  const sequenceIndex = Math.max(0, Math.floor(boss?.sequenceIndex || 0));
  if (distance > 4.2 * TILE && boss?.phase !== 'guardian') return 'sand-wave';
  return phase.pattern[sequenceIndex % phase.pattern.length];
}

export function wardenAttackCanHit({ attackKind, distance, airborne, attackFacing = 0, targetDirection = 0 }) {
  const attack = getWardenFighterAttack(attackKind);
  if (distance > attack.range) return false;
  if (attack.low && airborne) return false;
  if (attackFacing && targetDirection && attackFacing !== targetDirection) return false;
  return true;
}
