const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function resetBoss(duel) {
  duel.boss.hp = duel.boss.maxHp;
  duel.boss.phase = 'guardian';
  duel.boss.action = 'idle';
  duel.boss.attackKind = 'sun-blade';
  duel.boss.actionClock = 0;
  duel.boss.sequenceIndex = 0;
  duel.boss.hitstun = 0;
  duel.boss.invulnerable = false;
  duel.boss.attackConsumed = true;
  duel.boss.openingEarned = false;
  duel.boss.recoveryHits = 0;
  duel.boss.armored = false;
  duel.boss.armorBreakReady = false;
  duel.boss.facing = -1;
  duel.boss.velocityX = 0;
  duel.boss.guarding = false;
  duel.boss.guardMeter = duel.boss.guardMax || 6;
  duel.boss.comboTaken = 0;
  duel.boss.decisionClock = 0;
  duel.boss.hitFlash = 0;
  duel.boss.nextGuard = false;
  if (duel.boss.target && Number.isFinite(duel.boss.target.spawnX)) {
    duel.boss.target.x = duel.boss.target.spawnX;
  }
}

function resetPlayer(duel) {
  duel.player.comboStep = 0;
  duel.player.comboClock = 0;
  duel.player.guarding = false;
  duel.player.parryClock = 0;
  duel.player.guardLessonComplete = false;
  duel.player.guardMeter = duel.player.guardMax || 4;
  duel.player.guardBrokenClock = 0;
  duel.player.lastAttackLabel = '';
}

function resetAttempt(duel) {
  duel.attempt.elapsed = 0;
  duel.attempt.damageTaken = 0;
}

export function resetWardenDuel(duel) {
  if (!duel?.boss || !duel?.player || !duel?.attempt || !duel?.totals || !duel?.finale) return false;
  duel.phase = 'sealed';
  duel.active = false;
  duel.complete = false;
  resetBoss(duel);
  resetPlayer(duel);
  duel.attempt.count = 0;
  resetAttempt(duel);
  duel.totals.elapsed = 0;
  duel.totals.damageTaken = 0;
  duel.finale.ready = false;
  duel.finale.struck = false;
  return true;
}

export function startWardenDuelAttempt(duel) {
  if (!duel?.boss || !duel?.player || !duel?.attempt || !duel?.totals || !duel?.finale
    || duel.complete || duel.finale.struck) return false;
  duel.active = true;
  duel.phase = 'guardian';
  resetBoss(duel);
  duel.boss.action = 'intro';
  duel.boss.actionClock = duel.timing.introSeconds;
  duel.boss.invulnerable = true;
  resetPlayer(duel);
  duel.attempt.count += 1;
  resetAttempt(duel);
  duel.finale.ready = false;
  return true;
}

export function updateWardenDuelPhase(duel) {
  if (!duel?.boss || !duel?.thresholds || duel.complete) return null;
  if (duel.boss.hp <= 0) {
    duel.boss.hp = 0;
    duel.boss.phase = 'finale';
    duel.boss.action = 'staggered';
    duel.boss.actionClock = 0;
    duel.boss.invulnerable = true;
    duel.phase = 'finale';
    duel.finale.ready = true;
    return duel.phase;
  }
  const previousPhase = duel.boss.phase;
  const phase = duel.boss.hp <= duel.thresholds.eclipseHp
    ? 'eclipse'
    : duel.boss.hp <= duel.thresholds.commandHp ? 'command' : 'guardian';
  duel.boss.phase = phase;
  duel.phase = phase;
  if (phase !== previousPhase) {
    duel.boss.action = 'intro';
    duel.boss.actionClock = duel.timing.phaseShiftSeconds;
    duel.boss.sequenceIndex = 0;
    duel.boss.hitstun = 0;
    duel.boss.invulnerable = true;
    duel.boss.attackConsumed = true;
    duel.boss.openingEarned = false;
    duel.boss.recoveryHits = 0;
    duel.boss.armored = false;
    duel.boss.armorBreakReady = false;
    duel.boss.guarding = false;
    duel.boss.guardMeter = duel.boss.guardMax || 6;
    duel.boss.comboTaken = 0;
    duel.boss.decisionClock = 0;
    duel.boss.velocityX = 0;
    duel.boss.nextGuard = false;
  }
  return phase;
}

export function advanceWardenDuel(duel, dt) {
  if (!duel?.active || duel.complete || duel.phase === 'finale'
    || !Number.isFinite(dt) || dt <= 0) return false;
  duel.attempt.elapsed += dt;
  duel.totals.elapsed += dt;
  duel.player.comboClock = Math.max(0, duel.player.comboClock - dt);
  duel.player.parryClock = Math.max(0, duel.player.parryClock - dt);
  duel.player.guardBrokenClock = Math.max(0, (duel.player.guardBrokenClock || 0) - dt);
  duel.boss.actionClock = Math.max(0, duel.boss.actionClock - dt);
  duel.boss.hitstun = Math.max(0, duel.boss.hitstun - dt);
  duel.boss.hitFlash = Math.max(0, (duel.boss.hitFlash || 0) - dt);
  if (duel.player.comboClock === 0) duel.player.comboStep = 0;
  updateWardenDuelPhase(duel);
  return true;
}

export function recordWardenDuelPlayerDamage(duel, amount = 1) {
  if (!duel?.active || duel.complete || !Number.isFinite(amount) || amount <= 0) return false;
  const damage = Math.max(1, Math.floor(amount));
  duel.attempt.damageTaken += damage;
  duel.totals.damageTaken += damage;
  return true;
}

export function damageWardenDuelBoss(duel, amount = 1) {
  if (!duel?.active || duel.complete || duel.phase === 'finale'
    || duel.boss?.invulnerable || !Number.isFinite(amount) || amount <= 0) return false;
  duel.boss.hp = clamp(duel.boss.hp - Math.max(1, Math.floor(amount)), 0, duel.boss.maxHp);
  updateWardenDuelPhase(duel);
  return true;
}

export function completeWardenDuel(duel) {
  if (!duel?.active || duel.complete || !duel.finale?.ready || duel.boss?.hp !== 0) return false;
  duel.finale.struck = true;
  duel.complete = true;
  duel.active = false;
  duel.phase = 'complete';
  return true;
}
