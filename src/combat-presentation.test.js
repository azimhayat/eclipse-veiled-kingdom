import { describe, expect, it } from 'vitest';
import {
  HERO_POSE_FRAMES,
  PLAYER_ATTACK_BUFFER_SECONDS,
  PLAYER_COMBAT_CLIPS,
  advanceCombatTimeline,
  combatTimelinePhase,
  consumeCombatTimelineContact,
  createPlayerCombatTimeline,
  getPlayerCombatImpact,
  getPlayerCombatMotion,
  getHeroPoseFrame,
  isCombatTimelineActive,
  setActorPresentation,
} from './combat-presentation.js';
import { GameEngine } from './engine.js';

describe('deterministic combat presentation', () => {
  it('uses half-open startup, contact, recovery, and completion boundaries', () => {
    const clip = PLAYER_COMBAT_CLIPS['normal-1'];
    expect(combatTimelinePhase(clip, clip.startup - Number.EPSILON).phase).toBe('startup');
    expect(combatTimelinePhase(clip, clip.startup).phase).toBe('active');
    expect(combatTimelinePhase(clip, clip.startup + clip.active - Number.EPSILON).phase).toBe('active');
    expect(combatTimelinePhase(clip, clip.startup + clip.active).phase).toBe('recovery');
    const total = clip.startup + clip.active + clip.recovery;
    expect(combatTimelinePhase(clip, total - Number.EPSILON).phase).toBe('recovery');
    expect(combatTimelinePhase(clip, total)).toEqual({ phase: 'complete', progress: 1, complete: true });
  });

  it('uses distinct readable cadences while exposing one contact entry', () => {
    const totals = Object.values(PLAYER_COMBAT_CLIPS)
      .map((clip) => clip.startup + clip.active + clip.recovery);
    expect(new Set(totals.map((total) => total.toFixed(3))).size).toBeGreaterThan(2);
    expect(totals.every((total) => total >= .3 && total <= .6)).toBe(true);
    expect(PLAYER_COMBAT_CLIPS.heavy.startup).toBeGreaterThan(PLAYER_COMBAT_CLIPS['normal-1'].startup);
    expect(PLAYER_ATTACK_BUFFER_SECONDS).toBeGreaterThanOrEqual(PLAYER_COMBAT_CLIPS.heavy.recovery);
    const timeline = createPlayerCombatTimeline({ id: 'attack-1', kind: 'normal', comboStep: 2 });
    expect(isCombatTimelineActive(timeline)).toBe(false);
    expect(advanceCombatTimeline(timeline, timeline.startupSeconds - .001)).toMatchObject({ enteredActive: false, complete: false });
    expect(advanceCombatTimeline(timeline, .001)).toMatchObject({ enteredActive: true, enteredRecovery: false });
    expect(isCombatTimelineActive(timeline)).toBe(true);
    expect(advanceCombatTimeline(timeline, timeline.activeSeconds)).toMatchObject({ enteredActive: false, enteredRecovery: true });
    expect(advanceCombatTimeline(timeline, timeline.recoverySeconds)).toMatchObject({ complete: true });
    expect(timeline.phase).toBe('complete');
  });

  it('keeps presentation clocks deterministic and resets only on a state transition', () => {
    const actor = {};
    expect(setActorPresentation(actor, 'advance', 1 / 60)).toEqual({ state: 'advance', clock: 0 });
    expect(setActorPresentation(actor, 'advance', 1 / 60).clock).toBeCloseTo(1 / 60, 8);
    expect(setActorPresentation(actor, 'guard', 1 / 60)).toEqual({ state: 'guard', clock: 0 });
    expect(setActorPresentation(actor, 'guard', 0).clock).toBe(0);
  });

  it('freezes an in-flight strike when the simulation supplies no update step', () => {
    const timeline = createPlayerCombatTimeline({ id: 'paused-strike', kind: 'heavy' });
    advanceCombatTimeline(timeline, .05);
    const beforePause = { ...timeline };
    expect(advanceCombatTimeline(timeline, 0)).toEqual({
      enteredActive: false, enteredRecovery: false, complete: false,
    });
    expect(timeline).toEqual(beforePause);
  });

  it('latches one contact when a stalled update crosses the complete active window', () => {
    const timeline = createPlayerCombatTimeline({ id: 'stalled-strike', kind: 'heavy' });
    expect(advanceCombatTimeline(timeline, timeline.totalSeconds + .1)).toEqual({
      enteredActive: true, enteredRecovery: true, complete: true,
    });
    expect(timeline).toMatchObject({ phase: 'complete', contactPending: true });
    expect(consumeCombatTimelineContact(timeline)).toBe(true);
    expect(timeline.contactPending).toBe(false);
    expect(consumeCombatTimelineContact(timeline)).toBe(false);
  });

  it('ties movement, lunge, hit-stop, and recoil to the authored action clip', () => {
    const normal = createPlayerCombatTimeline({ id: 'normal', kind: 'normal', comboStep: 1 });
    const heavy = createPlayerCombatTimeline({ id: 'heavy', kind: 'heavy' });
    expect(getPlayerCombatMotion(normal).movementScale).toBeLessThan(1);
    advanceCombatTimeline(heavy, heavy.startupSeconds);
    expect(getPlayerCombatMotion(heavy)).toMatchObject({
      movementScale: expect.any(Number),
      lungeSpeed: PLAYER_COMBAT_CLIPS.heavy.lungeSpeed,
    });
    expect(getPlayerCombatImpact('heavy').hitstop).toBeGreaterThan(getPlayerCombatImpact('normal', 1).hitstop);
    expect(getPlayerCombatImpact('heavy').recoil).toBeGreaterThan(getPlayerCombatImpact('normal', 1).recoil);
  });

  it('timestamps and expires presentation events on simulation time only', () => {
    const engine = {
      level: { objective: { type: 'parachute-choir-restoration' } },
      totalTime: 4,
      combatEvents: [],
      combatEventSequence: 0,
    };
    expect(GameEngine.prototype.emitCombatEvent.call(engine, 'hit', { actorId: 'voice-1' }, .25)).toMatchObject({
      id: 1, type: 'hit', actorId: 'voice-1', createdAt: 4, expiresAt: 4.25,
    });
    engine.totalTime = 4.249;
    GameEngine.prototype.updateCombatEvents.call(engine);
    expect(engine.combatEvents).toHaveLength(1);
    engine.totalTime = 4.25;
    GameEngine.prototype.updateCombatEvents.call(engine);
    expect(engine.combatEvents).toEqual([]);
  });

  it('defines bounded, distinct pose anchors for every current hero sheet pose', () => {
    expect(Object.keys(HERO_POSE_FRAMES)).toEqual(['idle', 'run', 'jump', 'attack', 'dig', 'climb']);
    for (const frame of Object.values(HERO_POSE_FRAMES)) {
      expect(frame.anchorX).toBeGreaterThan(0);
      expect(frame.anchorX).toBeLessThan(1);
      expect(frame.anchorY).toBeGreaterThan(0);
      expect(frame.anchorY).toBeLessThanOrEqual(1);
    }
    expect(new Set(Object.values(HERO_POSE_FRAMES).map(({ anchorX, anchorY }) => `${anchorX}:${anchorY}`)).size).toBe(6);
    expect(getHeroPoseFrame('unknown')).toBe(HERO_POSE_FRAMES.idle);
  });
});
