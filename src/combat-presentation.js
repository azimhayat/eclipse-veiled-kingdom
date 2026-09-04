export const PLAYER_COMBAT_CLIPS = Object.freeze({
  'normal-1': Object.freeze({
    key: 'normal-1', startup: .08, active: .10, recovery: .16,
    movementScale: .54, lungeSpeed: 108, hitstop: .035, recoil: 24,
  }),
  'normal-2': Object.freeze({
    key: 'normal-2', startup: .07, active: .11, recovery: .18,
    movementScale: .48, lungeSpeed: 126, hitstop: .04, recoil: 28,
  }),
  'normal-3': Object.freeze({
    key: 'normal-3', startup: .11, active: .12, recovery: .21,
    movementScale: .34, lungeSpeed: 164, hitstop: .055, recoil: 36,
  }),
  heavy: Object.freeze({
    key: 'heavy', startup: .18, active: .12, recovery: .24,
    movementScale: .24, lungeSpeed: 138, hitstop: .065, recoil: 48,
  }),
  aerial: Object.freeze({
    key: 'aerial', startup: .10, active: .14, recovery: .22,
    movementScale: .42, lungeSpeed: 118, hitstop: .05, recoil: 32,
  }),
});

export const PLAYER_ATTACK_BUFFER_SECONDS = .28;

export const HERO_POSE_FRAMES = Object.freeze({
  idle: Object.freeze({ col: 0, row: 0, size: 116, anchorX: .54, anchorY: .94 }),
  run: Object.freeze({ col: 1, row: 0, size: 120, anchorX: .55, anchorY: .87 }),
  jump: Object.freeze({ col: 2, row: 0, size: 122, anchorX: .50, anchorY: .98 }),
  attack: Object.freeze({ col: 0, row: 1, size: 126, anchorX: .53, anchorY: .82 }),
  dig: Object.freeze({ col: 1, row: 1, size: 122, anchorX: .55, anchorY: .79 }),
  climb: Object.freeze({ col: 2, row: 1, size: 120, anchorX: .51, anchorY: .75 }),
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function getPlayerCombatClip(kind, comboStep = 1) {
  if (kind === 'heavy') return PLAYER_COMBAT_CLIPS.heavy;
  if (kind === 'aerial') return PLAYER_COMBAT_CLIPS.aerial;
  const step = Math.max(1, Math.min(3, Math.floor(comboStep || 1)));
  return PLAYER_COMBAT_CLIPS[`normal-${step}`];
}

export function combatTimelinePhase(clip, elapsed = 0) {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  if (safeElapsed < clip.startup) {
    return { phase: 'startup', progress: clamp01(safeElapsed / clip.startup), complete: false };
  }
  const activeEnd = clip.startup + clip.active;
  if (safeElapsed < activeEnd) {
    return { phase: 'active', progress: clamp01((safeElapsed - clip.startup) / clip.active), complete: false };
  }
  const total = activeEnd + clip.recovery;
  if (safeElapsed < total) {
    return { phase: 'recovery', progress: clamp01((safeElapsed - activeEnd) / clip.recovery), complete: false };
  }
  return { phase: 'complete', progress: 1, complete: true };
}

export function createPlayerCombatTimeline({ id, kind, comboStep = 1 } = {}) {
  const clip = getPlayerCombatClip(kind, comboStep);
  const totalSeconds = clip.startup + clip.active + clip.recovery;
  return {
    id,
    kind,
    comboStep,
    clipKey: clip.key,
    elapsed: 0,
    phase: 'startup',
    phaseProgress: 0,
    contactEmitted: false,
    contactPending: false,
    recoveryEmitted: false,
    startupSeconds: clip.startup,
    activeSeconds: clip.active,
    recoverySeconds: clip.recovery,
    totalSeconds,
  };
}

export function advanceCombatTimeline(timeline, dt) {
  if (!timeline || !Number.isFinite(dt) || dt <= 0 || timeline.phase === 'complete') {
    return { enteredActive: false, enteredRecovery: false, complete: timeline?.phase === 'complete' };
  }
  const clip = PLAYER_COMBAT_CLIPS[timeline.clipKey] || getPlayerCombatClip(timeline.kind, timeline.comboStep);
  const previousElapsed = timeline.elapsed;
  const activeStart = clip.startup;
  const recoveryStart = clip.startup + clip.active;
  const totalSeconds = clip.startup + clip.active + clip.recovery;
  timeline.elapsed = Math.min(totalSeconds, previousElapsed + dt);
  const next = combatTimelinePhase(clip, timeline.elapsed);
  timeline.phase = next.phase;
  timeline.phaseProgress = next.progress;
  const enteredActive = previousElapsed < activeStart && timeline.elapsed >= activeStart;
  const enteredRecovery = previousElapsed < recoveryStart && timeline.elapsed >= recoveryStart;
  if (enteredActive) {
    timeline.contactEmitted = true;
    timeline.contactPending = true;
  }
  if (enteredRecovery) timeline.recoveryEmitted = true;
  return { enteredActive, enteredRecovery, complete: next.complete };
}

export function getPlayerCombatMotion(timeline) {
  if (!timeline) return { movementScale: 1, lungeSpeed: 0 };
  const clip = PLAYER_COMBAT_CLIPS[timeline.clipKey]
    || getPlayerCombatClip(timeline.kind, timeline.comboStep);
  const phaseScale = timeline.phase === 'startup' ? clip.movementScale
    : timeline.phase === 'active' ? Math.min(.28, clip.movementScale)
      : timeline.phase === 'recovery' ? Math.min(.62, clip.movementScale + .16)
        : 1;
  return { movementScale: phaseScale, lungeSpeed: clip.lungeSpeed };
}

export function getPlayerCombatImpact(kind, comboStep = 1) {
  const clip = getPlayerCombatClip(kind, comboStep);
  return { hitstop: clip.hitstop, recoil: clip.recoil };
}

export function isCombatTimelineActive(timeline) {
  return Boolean(timeline && timeline.phase === 'active');
}

export function consumeCombatTimelineContact(timeline) {
  if (!timeline) return false;
  const canResolve = timeline.phase === 'active' || timeline.contactPending;
  timeline.contactPending = false;
  return canResolve;
}

export function setActorPresentation(actor, state, dt = 0) {
  if (!actor) return null;
  const safeState = typeof state === 'string' && state ? state : 'idle';
  if (!actor.presentation || actor.presentation.state !== safeState) {
    actor.presentation = { state: safeState, clock: 0 };
  } else if (Number.isFinite(dt) && dt > 0) actor.presentation.clock += dt;
  return actor.presentation;
}

export function getHeroPoseFrame(pose) {
  return HERO_POSE_FRAMES[pose] || HERO_POSE_FRAMES.idle;
}
