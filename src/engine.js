import { AudioManager } from './audio.js';
import {
  TILE,
  Tile,
  VIEW_H,
  VIEW_W,
  WORLD_COLS,
  WORLD_H,
  WORLD_ROWS,
  WORLD_W,
} from './levels/constants.js';
import { cloneLevel } from './levels/cloneLevel.js';
import {
  bakeLevel,
  bakeLevelIncrementally,
  drawBackdrop,
  drawBlockAndPlate,
  drawBoss,
  drawDoor,
  drawHero,
  drawLevelMechanics,
  drawParticles,
  drawProjectile,
  drawRelic,
  drawShip,
  drawSoldier,
  drawVisibleChunks,
  restampCell,
} from './render.js';
import { releaseRenderedLevel, RenderedLevelCache } from './rendered-level-cache.js';
import { getTimedTeethState } from './teeth-timing.js';

export const PHYSICS = Object.freeze({
  RUN_SPEED: 290,
  GROUND_ACCEL: 2400,
  AIR_ACCEL: 1500,
  GROUND_FRICTION: 2100,
  AIR_DRAG: 280,
  JUMP_VEL: -860,
  GRAVITY_UP: 1850,
  GRAVITY_DOWN: 3050,
  TERMINAL: 1250,
  COYOTE: .1,
  JUMP_BUFFER: .12,
  CLIMB_SPEED: 170,
  WALL_SLIDE: 85,
  WALL_JUMP_X: 340,
  MAX_HP: 4,
});

const FIXED_DT = 1 / 60;
const SUBSTEPS = 3;
const EPS = .01;

const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const levelCacheKey = (level) => level.levelKey || level.id;

class ArrayLevelRepository {
  constructor(levels) {
    this.templates = levels.map(cloneLevel);
    this.campaignId = levels.length === 10 ? 'legacy-prototype-10' : 'static-level-set';
    this.sessionKind = levels.length === 10 ? 'prototype-campaign' : 'static-level-set';
  }

  get length() { return this.templates.length; }
  keyAt(index) { return levelCacheKey(this.templates[index]); }
  windowKeys(index) {
    return this.templates
      .slice(Math.max(0, index - 1), index + 2)
      .map(levelCacheKey);
  }
  has(index) { return Boolean(this.templates[index]); }
  async loadTemplate(index) { return this.templates[index]; }
  createRuntime(index) { return cloneLevel(this.templates[index]); }
  retainAround() { return this; }
}

export const KEY_ACTIONS = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'climb',
  KeyS: 'down', ArrowDown: 'down',
  Space: 'jump', ArrowUp: 'jump',
  KeyJ: 'attack', KeyX: 'attack',
  KeyK: 'dig', ShiftLeft: 'dig', ShiftRight: 'dig',
};

export class GameEngine {
  constructor(canvas, assets, initialLevels, chunkBank, callbacks = {}, levelRepository = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.callbacks = callbacks;
    this.audio = new AudioManager();
    this.repository = levelRepository || new ArrayLevelRepository(initialLevels);
    if (!this.repository.has(0)) throw new Error('The first authored level must be loaded before the engine starts.');
    this.bank = chunkBank instanceof RenderedLevelCache
      ? chunkBank
      : new RenderedLevelCache({ entries: chunkBank || [] });
    this.levelIndex = 0;
    this.level = this.repository.createRuntime(0);
    this.mode = 'title';
    this.demo = false;
    this.running = true;
    this.totalTime = 0;
    this.levelTime = 0;
    this.deaths = 0;
    this.levelCompletionEmitted = false;
    this.camera = { x: 0, y: WORLD_H - VIEW_H };
    this.input = {
      left: false, right: false, climb: false, down: false,
      jump: false, attack: false, dig: false,
      pressed: new Set(), released: new Set(),
    };
    this.particles = [];
    this.soldiers = [];
    this.projectiles = [];
    this.crumble = new Map();
    this.player = this.makePlayer(this.level.spawn);
    this.checkpoint = { kind: 'spawn', id: null, ...this.level.spawn, facing: 1 };
    this.gateOpen = false;
    this.spawnClock = 0;
    this.hudClock = 0;
    this.lastHint = '';
    this.hintHoldUntil = 0;
    this.botPulse = 0;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.animationId = 0;
    this.prefetchHandle = null;
    this.prefetchGeneration = 0;
    this.prefetchController = null;
    this.prefetchTargetIndex = null;
    this.prefetchPromise = null;
    this.transitionGeneration = 0;
    this.transitionController = null;
    this.transitioning = false;
    this.transitionTargetIndex = null;
    this.transitionRetryBlocked = false;

    this.keyDown = this.keyDown.bind(this);
    this.keyUp = this.keyUp.bind(this);
    window.addEventListener('keydown', this.keyDown, { passive: false });
    window.addEventListener('keyup', this.keyUp, { passive: false });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    this.loop = this.loop.bind(this);
    this.animationId = requestAnimationFrame(this.loop);
    this.publishDebugApi();
    this.setHint('Move with A / D · Jump with SPACE or ↑');
    this.scheduleNextLevel();
  }

  makePlayer(spawn) {
    return {
      x: spawn.x, y: spawn.y, w: 28, h: 44,
      vx: 0, vy: 0, facing: 1,
      grounded: false, wallSide: 0, climbing: false,
      hp: PHYSICS.MAX_HP, invuln: 0,
      coyote: 0, jumpBuffer: 0, dropTimer: 0,
      attackTimer: 0, attackBuffer: 0, digTimer: 0, attackHits: new Set(), inWater: false,
    };
  }

  publishDebugApi() {
    window.__EOTVK__ = {
      snapshot: () => this.snapshot(),
      setInput: (action, active) => this.setInput(action, active),
      startDemo: () => this.start(true),
      engine: this,
    };
  }

  snapshot() {
    const objective = this.objectiveStatus();
    const timedTeeth = this.level.objective?.type === 'timed-teeth-restoration'
      ? {
        clock: this.level.objective.hazardClock,
        clockStarted: this.level.objective.clockStarted,
        hazards: this.level.objective.hazards.map((hazard) => ({
          id: hazard.id,
          state: getTimedTeethState(this.level.objective.timing, hazard, this.level.objective.hazardClock).state,
          bound: hazard.bound,
          restored: hazard.restored,
        })),
        shelterBound: Boolean(this.level.objective.oathShelter?.boundOnce),
      }
      : null;
    const bellTower = this.level.objective?.type === 'bell-tower-restoration'
      ? {
        phase: this.level.objective.phase,
        gripSeconds: this.level.objective.gripSeconds,
        wallJumps: [...this.level.objective.wallJumps],
        lessonComplete: this.level.objective.lessonComplete,
        alternatingComplete: this.level.objective.alternatingComplete,
        braceCarved: Boolean(this.level.objective.memoryBrace?.revealed),
        masteryReached: this.level.objective.masteryReached,
        bellAwakened: Boolean(this.level.objective.bell?.awakened),
        collapseSections: (this.level.objective.collapse?.sections || []).map((section) => ({
          id: section.id,
          state: section.state,
          timer: section.timer,
        })),
      }
      : null;
    const sanctum = this.level.objective?.type === 'sanctum-lamp-restoration'
      ? {
        phase: this.level.objective.phase,
        lampBound: Boolean(this.level.objective.lamp?.bound),
        archOpen: Boolean(this.level.objective.arch?.open),
        gripJumpRecorded: Boolean(this.level.objective.arch?.gripJumpRecorded),
        witnessReached: Boolean(this.level.objective.witness?.reached),
        returnProven: Boolean(this.level.objective.returnProven),
        returnCount: this.level.objective.returnCount || 0,
        lastReturnId: this.level.objective.lastReturnId || null,
        canopyRestored: Boolean(this.level.objective.canopy?.restored),
      }
      : null;
    const raid = this.level.objective?.type === 'parachute-choir-restoration'
      ? {
        phase: this.level.objective.phase,
        spawnedCount: this.level.objective.spawnedCount || 0,
        defeatedCount: this.level.objective.defeatedCount || 0,
        queuedIds: this.level.objective.roster.filter((entry) => entry.status === 'queued').map((entry) => entry.id),
        activeIds: this.level.objective.roster.filter((entry) => entry.status === 'active').map((entry) => entry.id),
        defeatedIds: this.level.objective.roster.filter((entry) => entry.status === 'defeated').map((entry) => entry.id),
        gripJumpRecorded: Boolean(this.level.objective.skycut?.gripJumpRecorded),
        tetherCut: Boolean(this.level.objective.skycut?.tether?.cut),
        skyRestored: Boolean(this.level.objective.skyRestored),
        soldierStates: this.soldiers.map((soldier) => ({
          id: soldier.id,
          mode: soldier.mode,
          attackPhase: soldier.attackPhase || null,
          attackClock: Math.max(0, soldier.attackClock || 0),
        })),
      }
      : null;
    const veilGate = this.level.objective?.type === 'veil-gate-restoration'
      ? {
        phase: this.level.objective.phase,
        memoryRevealed: Boolean(this.level.objective.memoryMark?.revealed),
        counterweightBound: Boolean(this.level.objective.counterweight?.bound),
        counterweightLocked: Boolean(this.level.objective.counterweight?.locked),
        gripJumpRecorded: Boolean(this.level.objective.upperLatch?.gripJumpRecorded),
        upperLatchReached: Boolean(this.level.objective.upperLatch?.reached),
        spawnedCount: this.level.objective.encounter?.spawnedCount || 0,
        defeatedCount: this.level.objective.encounter?.defeatedCount || 0,
        queuedIds: (this.level.objective.encounter?.roster || [])
          .filter((entry) => entry.status === 'queued').map((entry) => entry.id),
        activeIds: (this.level.objective.encounter?.roster || [])
          .filter((entry) => entry.status === 'active').map((entry) => entry.id),
        defeatedIds: (this.level.objective.encounter?.roster || [])
          .filter((entry) => entry.status === 'defeated').map((entry) => entry.id),
        cartographersTurn: Boolean(this.level.objective.cartographersTurn?.restored),
        gateRestored: Boolean(this.level.objective.gateRestored),
      }
      : null;
    const warden = this.level.objective?.type === 'warden-restoration'
      ? {
        phase: this.level.objective.phase,
        breathClock: this.level.objective.breath?.clock || 0,
        firstBreathComplete: Boolean(this.level.objective.breath?.firstBreathComplete),
        breathStrikes: this.level.objective.breath?.strikeCount || 0,
        memoryRevealed: Boolean(this.level.objective.memorySeam?.revealed),
        heartstoneBound: Boolean(this.level.objective.heartstone?.bound),
        heartstoneLocked: Boolean(this.level.objective.heartstone?.locked),
        handRaised: Boolean(this.level.objective.rememberedHand?.raised),
        gripJumpRecorded: Boolean(this.level.objective.rememberedHand?.gripJumpRecorded),
        handReached: Boolean(this.level.objective.rememberedHand?.reached),
        bridleExposed: Boolean(this.level.objective.bridle?.exposed),
        bridleStruck: Boolean(this.level.objective.bridle?.struck),
        wardenState: this.level.objective.warden?.state || null,
        wardenKneeling: Boolean(this.level.objective.warden?.kneeling),
        crownPathRestored: Boolean(this.level.objective.crownPath?.restored),
      }
      : null;
    return {
      mode: this.mode,
      level: this.level.id,
      levelName: this.level.name,
      sessionKind: this.repository.sessionKind,
      campaignId: this.repository.campaignId,
      levelKey: this.level.levelKey || null,
      campaignOrder: this.level.campaignOrder || null,
      repositoryIndex: this.levelIndex,
      legacyId: this.level.id,
      player: {
        x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp,
        vx: Math.round(this.player.vx), vy: Math.round(this.player.vy), facing: this.player.facing,
        grounded: this.player.grounded, wallSide: this.player.wallSide, climbing: this.player.climbing,
      },
      relics: this.level.relics.filter((relic) => relic.collected).map((relic) => relic.id),
      objective,
      gateOpen: this.gateOpen,
      deaths: this.deaths,
      soldiers: this.soldiers.length,
      time: this.totalTime,
      timedTeeth,
      bellTower,
      sanctum,
      raid,
      veilGate,
      warden,
      checkpoint: this.checkpoint ? {
        kind: this.checkpoint.kind || 'legacy',
        id: this.checkpoint.id || null,
        x: Math.round(this.checkpoint.x),
        y: Math.round(this.checkpoint.y),
        facing: this.checkpoint.facing || 1,
      } : null,
    };
  }

  destroy() {
    this.running = false;
    this.cancelLevelTransition();
    this.cancelLevelPrefetch();
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    if (window.__EOTVK__?.engine === this) delete window.__EOTVK__;
    this.bank.dispose();
  }

  keyDown(event) {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat && (this.mode === 'play' || this.mode === 'paused')) this.callbacks.pause?.();
      return;
    }
    const action = KEY_ACTIONS[event.code];
    if (!action || this.mode !== 'play') return;
    event.preventDefault();
    if (!this.input[action]) this.input.pressed.add(action);
    this.input[action] = true;
  }

  keyUp(event) {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    if (this.input[action]) this.input.released.add(action);
    this.input[action] = false;
  }

  setInput(action, active) {
    if (!(action in this.input) || typeof this.input[action] !== 'boolean') return;
    if (active && !this.input[action]) this.input.pressed.add(action);
    if (!active && this.input[action]) this.input.released.add(action);
    this.input[action] = active;
  }

  clearInputs() {
    for (const key of ['left', 'right', 'climb', 'down', 'jump', 'attack', 'dig']) this.input[key] = false;
    this.input.pressed.clear();
    this.input.released.clear();
  }

  cancelLevelPrefetch() {
    this.prefetchGeneration += 1;
    this.prefetchController?.abort();
    this.prefetchController = null;
    if (this.prefetchHandle) {
      if (this.prefetchHandle.kind === 'idle') {
        window.cancelIdleCallback?.(this.prefetchHandle.id);
      } else {
        window.clearTimeout(this.prefetchHandle.id);
      }
      this.prefetchHandle = null;
    }
    this.prefetchTargetIndex = null;
    this.prefetchPromise = null;
    this.prefetchStart = null;
  }

  cancelLevelTransition({ clearTarget = true } = {}) {
    this.transitionGeneration += 1;
    this.transitionController?.abort();
    this.transitionController = null;
    this.transitioning = false;
    if (clearTarget) this.transitionTargetIndex = null;
  }

  async prepareAuthoredLevel(index, { signal, shouldCancel = () => false } = {}) {
    const cancelled = () => Boolean(signal?.aborted || shouldCancel() || !this.running);
    const previousIndex = this.levelIndex;
    // A direct demo/deep-link may jump beyond the adjacent prefetch window.
    // Retain the destination before importing it so the repository does not
    // correctly discard that in-flight module as stale.
    this.repository.retainForTransition?.(previousIndex, index)
      || this.repository.retainAround(index);
    try {
      await this.repository.loadTemplate(index);
    } catch (error) {
      // A stale preparation must never overwrite retention chosen by a newer
      // transition. The active owner restores its own window synchronously.
      if (!cancelled()) this.repository.retainAround(previousIndex);
      throw error;
    }
    if (cancelled()) {
      return null;
    }

    const level = this.repository.createRuntime(index);
    const key = levelCacheKey(level);
    if (this.bank.has(key)) return level;
    const chunks = await bakeLevelIncrementally(level, { signal, shouldCancel: cancelled });
    if (!chunks) {
      return null;
    }
    if (cancelled()) {
      releaseRenderedLevel(chunks);
      return null;
    }
    this.bank.set(key, chunks);
    this.bank.retain(this.repository.windowKeys(index));
    this.repository.retainForTransition?.(previousIndex, index)
      || this.repository.retainAround(index);
    return level;
  }

  scheduleNextLevel() {
    const scheduledIndex = this.levelIndex;
    const nextIndex = scheduledIndex + 1;
    if (nextIndex >= this.repository.length) return;
    if (this.prefetchTargetIndex === nextIndex && (this.prefetchHandle || this.prefetchPromise)) return;
    this.cancelLevelPrefetch();
    const generation = this.prefetchGeneration;
    this.repository.retainAround(scheduledIndex);
    const nextKey = this.repository.keyAt(nextIndex);
    if (this.repository.has(nextIndex) && this.bank.has(nextKey)) return;
    const controller = new AbortController();
    this.prefetchController = controller;
    this.prefetchTargetIndex = nextIndex;
    let scheduledHandle;

    const isStale = () => !this.running
      || controller.signal.aborted
      || this.prefetchGeneration !== generation
      || this.levelIndex !== scheduledIndex;

    const prepare = () => {
      if (this.prefetchHandle === scheduledHandle) this.prefetchHandle = null;
      if (this.prefetchPromise) return this.prefetchPromise;
      if (isStale()) return Promise.resolve(null);
      const pending = this.prepareAuthoredLevel(nextIndex, {
          signal: controller.signal,
          shouldCancel: isStale,
        });
      this.prefetchPromise = pending;
      pending.catch((error) => {
        if (!controller.signal.aborted && this.prefetchGeneration === generation) {
          console.error(`Could not prepare level ${nextKey}`, error);
        }
      }).finally(() => {
        if (this.prefetchController === controller) this.prefetchController = null;
        if (this.prefetchPromise === pending) this.prefetchPromise = null;
      });
      return pending;
    };
    this.prefetchStart = prepare;

    if (typeof window.requestIdleCallback === 'function') {
      scheduledHandle = {
        kind: 'idle',
        id: window.requestIdleCallback(prepare, { timeout: 1200 }),
      };
    } else {
      scheduledHandle = { kind: 'timeout', id: window.setTimeout(prepare, 32) };
    }
    this.prefetchHandle = scheduledHandle;
  }

  resetCampaign() {
    this.cancelLevelTransition();
    this.cancelLevelPrefetch();
    this.repository.retainAround(0);
    if (!this.repository.has(0)) throw new Error('Level 1 is not available for campaign reset.');
    this.bank.clear();
    this.levelIndex = 0;
    this.totalTime = 0;
    this.levelTime = 0;
    this.deaths = 0;
    this.loadLevel(0, true);
  }

  announceCurrentLevel(reason) {
    const objective = this.objectiveStatus();
    this.callbacks.level?.({
      reason,
      level: this.level.campaignOrder || this.level.id,
      levelKey: this.level.levelKey || null,
      name: this.level.name,
      subtitle: this.level.subtitle,
      storyLine: this.level.storyLine,
      mechanic: this.level.mechanic,
      objectiveTitle: objective.title,
      abilityUnlock: this.level.abilityUnlock ? { ...this.level.abilityUnlock } : null,
    });
  }

  start(demo = false) {
    if (this.mode === 'win' || this.mode === 'dead' || this.levelIndex !== 0 || this.totalTime > 0) this.resetCampaign();
    this.demo = demo;
    this.mode = 'play';
    this.clearInputs();
    this.callbacks.mode?.('play');
    this.announceCurrentLevel('start');
    this.setHint(this.level.gameplay?.openingHint || this.level.mechanic || 'The inner paths demand every skill.');
    this.pushHud(true);
    this.scheduleNextLevel();
  }

  async startAt(index, { demo = false } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= this.repository.length) {
      throw new RangeError('Level index is outside the campaign.');
    }
    if (index === 0) {
      this.start(demo);
      return true;
    }
    if (this.mode === 'win' || this.mode === 'dead' || this.levelIndex !== 0 || this.totalTime > 0) {
      this.resetCampaign();
    }
    this.demo = demo;
    this.clearInputs();
    return this.transitionToLevel(index);
  }

  pause(paused) {
    if (this.mode !== 'play' && this.mode !== 'paused') return;
    this.mode = paused ? 'paused' : 'play';
    this.clearInputs();
  }

  loadLevel(index, reset = false) {
    this.cancelLevelPrefetch();
    if (!this.repository.has(index)) throw new Error(`Level ${this.repository.keyAt(index)} is not loaded.`);
    this.repository.retainAround(index);
    const nextLevel = this.repository.createRuntime(index);
    const key = levelCacheKey(nextLevel);
    this.bank.retain(this.repository.windowKeys(index));
    if (!this.bank.has(key) || reset) this.bank.set(key, bakeLevel(nextLevel));
    this.levelIndex = index;
    this.level = nextLevel;
    this.levelTime = 0;
    this.levelCompletionEmitted = false;
    this.player = this.makePlayer(this.level.spawn);
    this.checkpoint = { kind: 'spawn', id: null, ...this.level.spawn, facing: 1 };
    this.camera.x = clamp(this.player.x - VIEW_W * .4, 0, WORLD_W - VIEW_W);
    this.camera.y = WORLD_H - VIEW_H;
    this.soldiers = [];
    this.projectiles = [];
    this.particles = [];
    this.crumble.clear();
    this.gateOpen = !this.level.map.some((row) => row[this.level.gateColumn] === Tile.GATE);
    this.spawnClock = 0;
    this.transitionRetryBlocked = false;
    this.hintHoldUntil = 0;
    this.setHint(this.level.gameplay?.openingHint || this.level.mechanic || 'The inner paths demand every skill.');
    this.pushHud(true);
    this.scheduleNextLevel();
  }

  respawn() {
    const currentIndex = this.levelIndex;
    const elapsedLevelTime = this.levelTime;
    this.cancelLevelTransition();
    this.loadLevel(currentIndex, true);
    this.levelTime = elapsedLevelTime;
    this.mode = 'play';
    this.clearInputs();
    this.callbacks.mode?.('play');
    this.setHint('The realm reforms. Begin the level anew.');
    this.pushHud(true);
  }

  async transitionToLevel(index = this.levelIndex + 1) {
    if (this.transitioning || index < 0 || index >= this.repository.length) return false;
    const previousIndex = this.levelIndex;
    this.cancelLevelTransition({ clearTarget: false });
    const generation = this.transitionGeneration;
    this.transitioning = true;
    this.transitionTargetIndex = index;
    this.transitionRetryBlocked = false;
    this.mode = 'loading';
    this.clearInputs();
    this.setHint(`Opening ${this.repository.entryAt?.(index)?.title || 'the next path'}…`);
    this.callbacks.mode?.('loading');

    let controller;
    let pending;
    const adoptingPrefetch = this.prefetchTargetIndex === index && this.prefetchStart;
    if (adoptingPrefetch) {
      if (this.prefetchHandle) {
        if (this.prefetchHandle.kind === 'idle') window.cancelIdleCallback?.(this.prefetchHandle.id);
        else window.clearTimeout(this.prefetchHandle.id);
        this.prefetchHandle = null;
      }
      controller = this.prefetchController;
      pending = this.prefetchStart();
    } else {
      this.cancelLevelPrefetch();
      controller = new AbortController();
      pending = this.prepareAuthoredLevel(index, {
        signal: controller.signal,
        shouldCancel: () => this.transitionGeneration !== generation || this.levelIndex !== previousIndex,
      });
    }
    this.transitionController = controller;

    try {
      const prepared = await pending;
      if (!prepared || !this.running || controller?.signal.aborted
        || this.transitionGeneration !== generation || this.levelIndex !== previousIndex) return false;
      this.transitioning = false;
      this.loadLevel(index);
      this.mode = 'play';
      this.callbacks.mode?.('play');
      this.announceCurrentLevel('transition');
      this.callbacks.transition?.(this.level.id, this.level.name);
      this.transitionTargetIndex = null;
      return true;
    } catch (error) {
      if (!controller?.signal.aborted && this.transitionGeneration === generation) {
        console.error(`Could not open level ${this.repository.keyAt(index)}`, error);
        this.transitioning = false;
        this.transitionRetryBlocked = true;
        this.mode = 'load-error';
        this.setHint('The path failed to form. Retry when ready.');
        this.callbacks.mode?.('load-error');
      }
      return false;
    } finally {
      if (this.transitionController === controller) this.transitionController = null;
    }
  }

  returnToTitle() {
    this.resetCampaign();
    this.mode = 'title';
    this.clearInputs();
    this.callbacks.mode?.('title');
  }

  toggleMute() {
    return this.audio.toggle();
  }

  loop(now) {
    const frame = Math.min(.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.accumulator += frame;
    while (this.accumulator >= FIXED_DT) {
      if (this.mode === 'play') this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    this.render(now / 1000);
    this.animationId = requestAnimationFrame(this.loop);
  }

  updateLevelMechanics(dt) {
    if (this.level.objective?.type === 'warden-restoration') this.updateWardenObjective(dt);
    const timedTeeth = this.level.objective?.type === 'timed-teeth-restoration'
      ? this.level.objective
      : null;
    if (timedTeeth && !timedTeeth.complete) {
      const centerTx = (this.player.x + this.player.w / 2) / TILE;
      if (!timedTeeth.clockStarted && centerTx >= timedTeeth.activationTx) timedTeeth.clockStarted = true;
      if (timedTeeth.clockStarted) timedTeeth.hazardClock += dt;
    }
    const bellTower = this.level.objective?.type === 'bell-tower-restoration'
      ? this.level.objective
      : null;
    if (bellTower && !bellTower.complete) this.updateBellTowerCollapse(dt);
    for (const mover of this.level.movers) {
      const oldX = mover.x;
      const oldY = mover.y;
      const wave = Math.sin(this.totalTime * mover.speed + mover.phase) * mover.range;
      mover.x = mover.baseX + (mover.axis === 'x' ? wave : 0);
      mover.y = mover.baseY + (mover.axis === 'y' ? wave : 0);
      mover.dx = mover.x - oldX;
      mover.dy = mover.y - oldY;
    }

    const veilPhase = Math.floor(this.totalTime / 2.6) % 2;
    for (const platform of this.level.veilPlatforms) platform.active = platform.phase === veilPhase;

    for (const crusher of this.level.crushers) {
      const wave = (Math.sin(this.totalTime * crusher.speed + crusher.phase) + 1) * .5 * crusher.range;
      crusher.x = crusher.baseX + (crusher.axis === 'x' ? wave : 0);
      crusher.y = crusher.baseY + (crusher.axis === 'y' ? wave : 0);
      if (overlaps(this.player, crusher)) this.damagePlayer(1, -470);
    }
  }

  updateBellTowerCollapse(dt) {
    const objective = this.level.objective;
    if (objective?.type !== 'bell-tower-restoration' || objective.complete) return;
    for (const section of objective.collapse?.sections || []) {
      if (section.state === 'warning') {
        section.timer += dt;
        if (section.timer >= objective.collapse.warningSeconds) {
          section.state = 'gone';
          section.timer = 0;
          this.burst(section.x + section.w / 2, section.y + 4, '#d49a58', 14, 130);
          this.setHint('THE REST FALLS · the permanent walls and recovery balcony still hold.', 2.6);
        }
      } else if (section.state === 'gone') {
        section.timer += dt;
        if (section.timer >= objective.collapse.goneSeconds) {
          section.state = 'spent';
          section.timer = 0;
        }
      }
    }
  }

  armBellTowerCollapseLedge() {
    const objective = this.level.objective;
    if (objective?.type !== 'bell-tower-restoration' || objective.phase !== 'collapse' || !this.player.grounded) return;
    const feet = this.player.y + this.player.h;
    for (const section of objective.collapse?.sections || []) {
      if (section.state !== 'stable') continue;
      const horizontal = this.player.x + this.player.w > section.x + 2
        && this.player.x < section.x + section.w - 2;
      if (!horizontal || Math.abs(feet - section.y) > 2) continue;
      section.state = 'warning';
      section.timer = 0;
      section.triggeredAt = this.totalTime;
      this.setHint('GOLD CRACKS SPREAD · move before this optional rest falls.', 2.2);
      break;
    }
  }

  recordPilgrimGrip(dt, wallSide) {
    const objective = this.level.objective;
    if (objective?.type !== 'bell-tower-restoration' || objective.phase !== 'learn') return;
    if (wallSide === objective.lesson.wallSide) objective.gripSeconds += dt;
  }

  recordPilgrimWallJump(wallSide) {
    const objective = this.level.objective;
    if (objective?.type === 'warden-restoration') {
      if (objective.phase === 'ascend' && objective.heartstone?.locked
        && wallSide === objective.rememberedHand?.requiredWallSide) {
        objective.rememberedHand.gripJumpRecorded = true;
      }
      return;
    }
    if (objective?.type === 'veil-gate-restoration') {
      if (objective.phase === 'ascent' && objective.counterweight?.bound
        && wallSide === objective.upperLatch?.requiredWallSide) {
        objective.upperLatch.gripJumpRecorded = true;
      }
      return;
    }
    if (objective?.type === 'parachute-choir-restoration') {
      if (objective.phase === 'flank' && wallSide === objective.skycut?.requiredWallSide) {
        objective.skycut.gripJumpRecorded = true;
      }
      return;
    }
    if (objective?.type === 'sanctum-lamp-restoration') {
      if (objective.phase === 'outward' && objective.lamp?.bound
        && wallSide === objective.arch?.requiredWallSide) {
        objective.arch.gripJumpRecorded = true;
      }
      return;
    }
    if (objective?.type !== 'bell-tower-restoration') return;
    if (objective.phase === 'learn') {
      if (objective.gripSeconds >= objective.lesson.minGripSeconds && wallSide === objective.lesson.wallSide) {
        objective.lesson.jumpRecorded = true;
      }
      return;
    }
    if (objective.phase !== 'alternate') return;
    const required = objective.alternating.requiredJumpSides;
    const completed = objective.wallJumps;
    const expected = required[completed.length];
    if (wallSide === expected) completed.push(wallSide);
    else if (wallSide === required[0]) objective.wallJumps = [wallSide];
    else objective.wallJumps = [];
  }

  update(dt) {
    this.totalTime += dt;
    this.levelTime += dt;
    if (this.demo) this.updateBot(dt);
    this.updateLevelMechanics(dt);
    this.updatePlayer(dt);
    this.updateBlock(dt);
    this.updateCrumble(dt);
    this.updateSoldiers(dt);
    this.updateBoss(dt);
    this.updateParticles(dt);
    this.updateRelicsAndFlow();
    this.updateCamera(dt);
    this.updateHints();
    this.hudClock -= dt;
    if (this.hudClock <= 0) {
      this.hudClock = .1;
      this.pushHud();
    }
    this.input.pressed.clear();
    this.input.released.clear();
  }

  updatePlayer(dt) {
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dropTimer = Math.max(0, p.dropTimer - dt);
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.attackBuffer = Math.max(0, (p.attackBuffer || 0) - dt);
    p.digTimer = Math.max(0, p.digTimer - dt);
    p.jumpBuffer = this.input.pressed.has('jump') ? PHYSICS.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? PHYSICS.COYOTE : Math.max(0, p.coyote - dt);
    if (this.input.pressed.has('down')) p.dropTimer = .2;

    const readableCombat = ['parachute-choir-restoration', 'veil-gate-restoration', 'warden-restoration']
      .includes(this.level.objective?.type);
    if (readableCombat && this.input.pressed.has('attack')) p.attackBuffer = .16;
    if ((this.input.pressed.has('attack') || (readableCombat && p.attackBuffer > 0)) && p.attackTimer <= 0) {
      p.attackTimer = .32;
      p.attackBuffer = 0;
      p.attackHits.clear();
      this.audio.play('attack');
      this.strikePilgrimBell();
      this.strikeParachuteTether?.();
      this.strikeVeilSunstone?.();
      this.strikeWardenBridle?.();
    }
    if (this.input.pressed.has('dig') && p.digTimer <= 0) this.dig();

    p.inWater = this.level.water.some((zone) => overlaps(p, zone));
    const move = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (move) p.facing = move;
    const touchingLeft = this.solidProbe(p.x - 3, p.y + 4, 3, p.h - 7);
    const touchingRight = this.solidProbe(p.x + p.w, p.y + 4, 3, p.h - 7);
    p.wallSide = touchingRight ? 1 : touchingLeft ? -1 : 0;

    const intoWall = p.wallSide && move === p.wallSide;
    if (!p.grounded && intoWall) this.recordPilgrimGrip(dt, p.wallSide);
    p.climbing = !p.grounded && this.input.climb && intoWall;
    if (p.climbing) {
      p.vy = this.input.down ? PHYSICS.CLIMB_SPEED : -PHYSICS.CLIMB_SPEED;
      p.vx = approach(p.vx, 0, PHYSICS.AIR_ACCEL * dt);
    } else {
      const accel = p.grounded ? PHYSICS.GROUND_ACCEL : PHYSICS.AIR_ACCEL;
      const runSpeed = p.inWater ? PHYSICS.RUN_SPEED * .68 : PHYSICS.RUN_SPEED;
      if (move) p.vx = approach(p.vx, move * runSpeed, accel * dt);
      else p.vx = approach(p.vx, 0, (p.grounded ? PHYSICS.GROUND_FRICTION : PHYSICS.AIR_DRAG) * dt);
      const gravity = (p.vy < 0 ? PHYSICS.GRAVITY_UP : PHYSICS.GRAVITY_DOWN) * (p.inWater ? .2 : 1);
      p.vy = Math.min(PHYSICS.TERMINAL, p.vy + gravity * dt);
      if (p.inWater) {
        const zone = this.level.water.find((item) => overlaps(p, item));
        p.vx += (zone?.currentX || 0) * dt;
        if (this.input.down) p.vy += 520 * dt;
        p.vy = Math.min(260, p.vy);
      }
      if (!p.grounded && p.wallSide && intoWall && p.vy > PHYSICS.WALL_SLIDE) p.vy = PHYSICS.WALL_SLIDE;
    }

    if (p.jumpBuffer > 0) {
      if (p.climbing || (!p.grounded && p.wallSide && intoWall)) {
        this.recordPilgrimWallJump(p.wallSide);
        p.vx = -p.wallSide * PHYSICS.WALL_JUMP_X;
        p.vy = PHYSICS.JUMP_VEL * .88;
        p.facing = -p.wallSide;
        p.jumpBuffer = 0;
        p.climbing = false;
        this.audio.play('jump');
      } else if (p.inWater) {
        p.vy = -430;
        p.jumpBuffer = 0;
        this.audio.play('jump');
      } else if (p.grounded || p.coyote > 0) {
        p.vy = PHYSICS.JUMP_VEL;
        p.grounded = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        this.audio.play('jump');
      }
    }

    if (this.input.released.has('jump') && p.vy < -360) p.vy = -360;

    const wasGrounded = p.grounded;
    p.grounded = false;
    let groundCell = null;
    for (let i = 0; i < SUBSTEPS; i += 1) {
      this.movePlayerHorizontal(p.vx * dt / SUBSTEPS);
      const hitGround = this.movePlayerVertical(p.vy * dt / SUBSTEPS);
      if (hitGround) groundCell = hitGround;
    }
    if (!wasGrounded && p.grounded && Math.abs(p.vy) < 1) this.audio.play('land');
    if (groundCell?.tile === Tile.CRUMBLE || groundCell?.tile === Tile.CRYSTAL) this.armCrumble(groundCell.tx, groundCell.ty, groundCell.tile);
    this.armBellTowerCollapseLedge();

    this.checkHazards();
    this.resolveAttackHits();
    if (p.y > WORLD_H + 80) this.damagePlayer(4, -500);
  }

  isSolidTile(tile) {
    return tile === Tile.STONE || tile === Tile.SAND || tile === Tile.GLOW || tile === Tile.GATE || tile === Tile.CRUMBLE || tile === Tile.CRYSTAL;
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= WORLD_COLS || ty < 0 || ty >= WORLD_ROWS) return Tile.STONE;
    return this.level.map[ty][tx];
  }

  solidProbe(x, y, w, h) {
    const left = Math.floor(x / TILE);
    const right = Math.floor((x + w - EPS) / TILE);
    const top = Math.floor(y / TILE);
    const bottom = Math.floor((y + h - EPS) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) if (this.isSolidTile(this.tileAt(tx, ty))) return true;
    }
    return false;
  }

  movePlayerHorizontal(dx) {
    if (!dx) return;
    const p = this.player;
    p.x += dx;
    const left = Math.floor(p.x / TILE);
    const right = Math.floor((p.x + p.w - EPS) / TILE);
    const top = Math.floor((p.y + 2) / TILE);
    const bottom = Math.floor((p.y + p.h - 3) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (!this.isSolidTile(this.tileAt(tx, ty))) continue;
        if (dx > 0) p.x = tx * TILE - p.w;
        else p.x = (tx + 1) * TILE;
        p.vx = 0;
      }
    }

    const block = this.level.block;
    if (!block || block.disabled) {
      p.x = clamp(p.x, 2 * TILE, WORLD_W - TILE - p.w);
      return;
    }
    const direction = dx > 0 ? 1 : -1;
    const verticallyAligned = p.y + p.h > block.y + 5 && p.y < block.y + block.h - 5;
    const withinPushReach = direction > 0
      ? p.x + p.w >= block.x - 16 && p.x < block.x
      : p.x <= block.x + block.w + 16 && p.x + p.w > block.x + block.w;
    if (verticallyAligned && (overlaps(p, block) || withinPushReach)) {
      const proposed = dx;
      const demoBacktracking = this.demo && !this.gateOpen && direction < 0 && block.x + block.w / 2 < this.level.plate.x + 8;
      const canPush = !demoBacktracking && this.canMoveBlock(proposed);
      if (canPush) block.x += proposed;
      if (direction > 0) p.x = block.x - p.w;
      else p.x = block.x + block.w;
      if (!canPush) p.vx = 0;
    }
    p.x = clamp(p.x, 2 * TILE, WORLD_W - TILE - p.w);
  }

  movePlayerVertical(dy) {
    const p = this.player;
    const oldBottom = p.y + p.h;
    p.y += dy;
    const left = Math.floor((p.x + 2) / TILE);
    const right = Math.floor((p.x + p.w - 3) / TILE);
    const top = Math.floor(p.y / TILE);
    const bottom = Math.floor((p.y + p.h - EPS) / TILE);
    let groundCell = null;
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        const tile = this.tileAt(tx, ty);
        const oneWay = tile === Tile.ONEWAY && dy >= 0 && p.dropTimer <= 0 && oldBottom <= ty * TILE + 6;
        if (!this.isSolidTile(tile) && !oneWay) continue;
        if (dy > 0) {
          p.y = ty * TILE - p.h;
          p.vy = 0;
          p.grounded = true;
          groundCell = { tx, ty, tile };
        } else if (dy < 0 && tile !== Tile.ONEWAY) {
          p.y = (ty + 1) * TILE;
          p.vy = Math.max(0, p.vy);
        }
      }
    }
    if (dy >= 0 && !p.grounded) {
      const platforms = [
        ...(this.level.movers || []),
        ...(this.level.veilPlatforms || []).filter((platform) => platform.active),
        ...(this.level.objective?.type === 'bell-tower-restoration'
          ? (this.level.objective.collapse?.sections || []).filter((section) => section.state !== 'gone')
          : []),
        ...(['oathbind-restoration', 'timed-teeth-restoration', 'veil-gate-restoration', 'warden-restoration']
          .includes(this.level.objective?.type) && this.level.block?.bound
          ? [this.level.block]
          : []),
      ];
      for (const platform of platforms) {
        const horizontal = p.x + p.w > platform.x + 2 && p.x < platform.x + platform.w - 2;
        const crossedTop = oldBottom <= platform.y + 9 && p.y + p.h >= platform.y;
        if (horizontal && crossedTop) {
          p.y = platform.y - p.h;
          p.x += platform.dx || 0;
          p.vy = 0;
          p.grounded = true;
          groundCell = { tx: -1, ty: -1, tile: Tile.ONEWAY };
          break;
        }
      }
    }
    return groundCell;
  }

  canMoveBlock(dx) {
    const b = this.level.block;
    if (b.bound || b.translationLocked) return false;
    const probe = { x: b.x + dx, y: b.y + 3, w: b.w, h: b.h - 4 };
    const left = Math.floor(probe.x / TILE);
    const right = Math.floor((probe.x + probe.w - EPS) / TILE);
    const top = Math.floor(probe.y / TILE);
    const bottom = Math.floor((probe.y + probe.h - EPS) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) if (this.isSolidTile(this.tileAt(tx, ty))) return false;
    }
    return true;
  }

  updateBlock(dt) {
    const b = this.level.block;
    if (!b || b.disabled) return;
    if (['oathbind-restoration', 'timed-teeth-restoration', 'veil-gate-restoration', 'warden-restoration']
      .includes(this.level.objective?.type) && b.bound) {
      b.vy = 0;
      if (this.level.objective.type === 'oathbind-restoration') this.updateOathbindObjective();
      if (this.level.objective.type === 'veil-gate-restoration') this.updateVeilGateObjective();
      if (this.level.objective.type === 'warden-restoration') this.updateWardenObjective();
      return;
    }
    b.vy = Math.min(900, (b.vy || 0) + PHYSICS.GRAVITY_DOWN * dt);
    const nextY = b.y + b.vy * dt;
    const bottom = nextY + b.h;
    const ty = Math.floor(bottom / TILE);
    const left = Math.floor((b.x + 3) / TILE);
    const right = Math.floor((b.x + b.w - 3) / TILE);
    let landed = false;
    for (let tx = left; tx <= right; tx += 1) {
      if (this.isSolidTile(this.tileAt(tx, ty)) && b.y + b.h <= ty * TILE + 12) {
        b.y = ty * TILE - b.h;
        b.vy = 0;
        landed = true;
      }
    }
    if (!landed) b.y = nextY;
    if (b.y > WORLD_H) {
      b.x = b.homeX;
      b.y = b.homeY;
      b.vy = 0;
      b.bound = false;
    }

    if (this.level.objective?.type === 'oathbind-restoration') {
      this.updateOathbindObjective();
      return;
    }
    if (this.level.objective?.type === 'veil-gate-restoration') {
      this.updateVeilGateObjective();
      return;
    }
    if (this.level.objective?.type === 'warden-restoration') {
      this.updateWardenObjective();
      return;
    }

    const plate = this.level.plate;
    if (!plate || plate.disabled) return;
    const onPlate = b.x + b.w > plate.x + 8 && b.x < plate.x + plate.w - 8 && Math.abs((b.y + b.h) - (plate.y + plate.h)) < 14;
    if (onPlate && !this.gateOpen) this.openGate();
  }

  openGate({ hint = 'The gate answers the plate.', holdSeconds = 0 } = {}) {
    if (this.gateOpen) return;
    this.gateOpen = true;
    const column = this.level.gateColumn;
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (let ty = 0; ty < WORLD_ROWS; ty += 1) {
      if (this.level.map[ty][column] === Tile.GATE) {
        this.level.map[ty][column] = Tile.AIR;
        restampCell(this.level, chunks, column, ty);
      }
    }
    this.burst(column * TILE + TILE / 2, 21 * TILE, '#e8c56a', 26, 150);
    this.audio.play('gate');
    this.setHint(hint, holdSeconds);
    this.callbacks.gate?.();
  }

  dig() {
    const p = this.player;
    if (this.activateSanctumLamp?.()) return;
    const probeX = p.facing > 0 ? p.x + p.w + 7 : p.x - 7;
    const tx = Math.floor(probeX / TILE);
    const rows = [Math.floor((p.y + p.h * .35) / TILE), Math.floor((p.y + p.h * .75) / TILE)];
    const ty = rows.find((row) => this.tileAt(tx, row) === Tile.SAND);
    if (ty === undefined) {
      if (this.toggleOathbind()) return;
      this.setHint('Face a sand wall to dig.');
      return;
    }
    const procession = this.level.objective?.type === 'procession-restoration'
      ? this.level.objective
      : null;
    const isProcessionMark = procession?.memoryMark?.tx === tx && procession.memoryMark.ty === ty;
    const oathbind = this.level.objective?.type === 'oathbind-restoration'
      ? this.level.objective
      : null;
    const isOathbindMark = oathbind?.memoryMark?.tx === tx && oathbind.memoryMark.ty === ty;
    const bellTower = this.level.objective?.type === 'bell-tower-restoration'
      ? this.level.objective
      : null;
    const isBellBrace = bellTower?.memoryBrace?.tx === tx && bellTower.memoryBrace.ty === ty;
    const veilGate = this.level.objective?.type === 'veil-gate-restoration'
      ? this.level.objective
      : null;
    const isVeilGateMark = veilGate?.memoryMark?.tx === tx && veilGate.memoryMark.ty === ty;
    const warden = this.level.objective?.type === 'warden-restoration'
      ? this.level.objective
      : null;
    const isWardenSeam = warden?.memorySeam?.tx === tx && warden.memorySeam.ty === ty;
    const gatedStationIndex = procession?.stations?.findIndex((item) => item.requiresMemoryMark) ?? -1;
    const prerequisiteStations = gatedStationIndex > 0
      ? procession.stations.slice(0, gatedStationIndex)
      : [];
    if (isProcessionMark && prerequisiteStations.some((item) => !item.observed)) {
      this.setHint('READ THE EARLIER PROCESSION FIRST · the buried seal will not answer yet.', 3.5);
      return;
    }
    if (isOathbindMark && !oathbind.lessonComplete) {
      this.setHint('OATHBIND FIRST · the archive answers only from a freely anchored promise.', 3.5);
      return;
    }
    if (isBellBrace && !bellTower.alternatingComplete) {
      this.setHint('CHANGE WALLS FIRST · the bell brace answers only after the controlled ascent.', 3.5);
      return;
    }
    if (isVeilGateMark && veilGate.memoryMark.revealed) {
      this.setHint('THE BURIED MERIDIAN IS ALREADY OPEN · take the counterweight east.', 2.8);
      return;
    }
    if (isWardenSeam && warden.phase !== 'carve') {
      this.setHint('READ THE FIRST BREATH · its cyan contour will settle around the buried vow.', 3.4);
      return;
    }
    const wardenRib = warden?.rememberedHand?.rib;
    if (wardenRib && warden.rememberedHand.raised && tx === wardenRib.tx
      && ty > wardenRib.topTy && ty <= wardenRib.bottomTy) {
      this.setHint('THE REMEMBERED HAND HOLDS · climb this living sand; do not cut the oath that shaped it.', 2.8);
      return;
    }
    this.level.map[ty][tx] = Tile.AIR;
    restampCell(this.level, this.bank.get(levelCacheKey(this.level)), tx, ty);
    p.digTimer = .22;
    this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#d69a54', 18, 190);
    this.audio.play('dig');
    this.revealMemoryMark(tx, ty);
  }

  objectiveStatus() {
    if (this.level.objective?.type === 'memory-carve') {
      const marks = this.level.objective.marks || [];
      const current = marks.filter((mark) => mark.revealed).length;
      return {
        type: 'memory-carve',
        label: this.level.objective.hudLabel || 'MAP',
        title: this.level.objective.title || 'Restore the memory path',
        current,
        target: marks.length,
        complete: Boolean(this.level.objective.complete) || (marks.length > 0 && current === marks.length),
      };
    }
    if (this.level.objective?.type === 'procession-restoration') {
      const stations = this.level.objective.stations || [];
      const observed = stations.filter((item) => item.observed).length;
      const mark = this.level.objective.memoryMark?.revealed ? 1 : 0;
      return {
        type: 'procession-restoration',
        label: this.level.objective.hudLabel || 'PROCESSION',
        title: this.level.objective.title || 'Restore the procession',
        current: observed + mark,
        target: stations.length + 1,
        complete: Boolean(this.level.objective.complete),
      };
    }
    if (this.level.objective?.type === 'oathbind-restoration') {
      const objective = this.level.objective;
      const current = Number(Boolean(objective.lessonComplete))
        + Number(Boolean(objective.memoryMark?.revealed))
        + Number(Boolean(objective.complete));
      const phaseText = {
        learn: 'LEARN TO BIND',
        cross: 'CROSS ON YOUR OATH',
        carve: 'MEMORY CARVE THE RECORD',
        seal: 'RESTORE THE CIVIC SEAL',
        complete: 'OATH RESTORED',
      };
      return {
        type: 'oathbind-restoration',
        label: objective.hudLabel || 'OATHBIND',
        title: objective.title || 'Restore the civic promise',
        current,
        target: 3,
        progressText: phaseText[objective.phase] || phaseText.learn,
        complete: Boolean(objective.complete),
      };
    }
    if (this.level.objective?.type === 'timed-teeth-restoration') {
      const objective = this.level.objective;
      const phaseText = {
        observe: 'READ THE RHYTHM',
        controlled: 'CROSS THE TEETH',
        bind: 'OATHBIND SHELTER',
        mastery: 'FOLLOW THE BREATH',
        complete: 'WARNING PATH RESTORED',
      };
      return {
        type: 'timed-teeth-restoration',
        label: objective.hudLabel || 'DUSTSTEP',
        title: objective.title || 'Cross the buried jaw',
        current: objective.complete ? 1 : 0,
        target: 1,
        progressText: phaseText[objective.phase] || phaseText.observe,
        complete: Boolean(objective.complete),
      };
    }
    if (this.level.objective?.type === 'bell-tower-restoration') {
      const objective = this.level.objective;
      const phaseText = {
        learn: 'LEARN THE GRIP',
        alternate: 'CHANGE WALLS',
        carve: 'FREE THE BELL ROPE',
        collapse: 'OUTCLIMB THE FALL',
        ring: 'RING THE PILGRIM BELL',
        complete: 'THE TOWER FINDS ITS VOICE',
      };
      return {
        type: 'bell-tower-restoration',
        label: objective.hudLabel || 'ASCENT',
        title: objective.title || 'Wake the pilgrim bell',
        current: objective.complete ? 1 : 0,
        target: 1,
        progressText: phaseText[objective.phase] || phaseText.learn,
        complete: Boolean(objective.complete),
      };
    }
    if (this.level.objective?.type === 'sanctum-lamp-restoration') {
      const objective = this.level.objective;
      const phaseText = {
        find: 'BIND THE LAST LAMP',
        outward: 'REACH THE FAR WITNESS',
        return: 'CARRY THE TRUTH HOME',
        sanctum: 'RETURN BENEATH THE CANOPY',
        complete: 'THE SANCTUM REMEMBERS',
      };
      return {
        type: 'sanctum-lamp-restoration',
        label: objective.hudLabel || 'SANCTUM',
        title: objective.title || "Restore Mira's first lamp",
        current: objective.complete ? 1 : 0,
        target: 1,
        progressText: phaseText[objective.phase] || phaseText.find,
        complete: Boolean(objective.complete),
      };
    }
    if (this.level.objective?.type === 'parachute-choir-restoration') {
      const objective = this.level.objective;
      const phaseText = {
        lesson: 'READ THE FIRST VOICE',
        flank: 'CUT THE COMMAND TETHER',
        chorus: 'BREAK THE MOVING PAIR',
        finale: 'SILENCE THE FALLING CADENCE',
        complete: 'THE SKY SINGS FOR THE LIVING',
      };
      return {
        type: 'parachute-choir-restoration',
        label: objective.hudLabel || 'CHOIR',
        title: objective.title || 'Break the measured descent',
        current: objective.defeatedCount || 0,
        target: objective.roster?.length || 0,
        progressText: phaseText[objective.phase] || phaseText.lesson,
        complete: Boolean(objective.complete),
      };
    }
    if (this.level.objective?.type === 'veil-gate-restoration') {
      const objective = this.level.objective;
      const phaseText = {
        carve: 'READ THE BURIED MERIDIAN',
        counterweight: 'BIND THE COUNTERWEIGHT',
        ascent: 'CLIMB THE WESTERN RIB',
        relay: 'BREAK THE CROWN RELAY',
        keystone: "MAKE THE CARTOGRAPHER'S TURN",
        complete: 'THE VEIL GATE OPENS',
      };
      return {
        type: 'veil-gate-restoration',
        label: objective.hudLabel || 'VEIL GATE',
        title: objective.title || 'Open the lock built inward',
        current: objective.complete ? 1 : 0,
        target: 1,
        progressText: phaseText[objective.phase] || phaseText.carve,
        complete: Boolean(objective.complete),
      };
    }
    if (this.level.objective?.type === 'warden-restoration') {
      const objective = this.level.objective;
      const phaseText = {
        listen: 'READ THE WARDEN’S BREATH',
        carve: 'FREE THE BURIED VOW',
        anchor: 'ANCHOR THE WARDEN’S MEMORY',
        ascend: 'CLIMB THE REMEMBERED HAND',
        unbind: 'BREAK THE INVERTED COMMAND',
        'first-path': 'CROSS THE FIRST CROWN PATH',
      };
      return {
        type: 'warden-restoration',
        label: objective.hudLabel || 'WARDEN',
        title: objective.title || 'Free the guardian beneath the seal',
        current: objective.complete ? 1 : 0,
        target: 1,
        progressText: phaseText[objective.phase] || phaseText.listen,
        complete: Boolean(objective.complete),
      };
    }
    const current = this.relicCount();
    return { type: 'relics', label: 'RELICS', title: 'Recover three relics', current, target: 3, complete: current >= 3 };
  }

  isExitReady() {
    const bossAlive = this.level.boss && this.level.boss.hp > 0;
    return this.objectiveStatus().complete && !bossAlive;
  }

  revealMemoryMark(tx, ty) {
    const objective = this.level.objective;
    if (objective?.type === 'warden-restoration') {
      const seam = objective.memorySeam;
      if (!seam || seam.tx !== tx || seam.ty !== ty || seam.revealed || objective.phase !== 'carve') return false;
      seam.revealed = true;
      objective.phase = 'anchor';
      objective.warden.state = 'remembering';
      objective.breath.clock = 0;
      this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#80e7ff', 34, 195);
      this.audio.play('relic');
      this.setHint(`${seam.revealText} · AREN · And we made it remember them alone.`, 7.2);
      this.pushHud(true);
      return true;
    }
    if (objective?.type === 'veil-gate-restoration') {
      const mark = objective.memoryMark;
      if (!mark || mark.tx !== tx || mark.ty !== ty || mark.revealed) return false;
      mark.revealed = true;
      objective.phase = 'counterweight';
      this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#80e7ff', 28, 175);
      this.audio.play('relic');
      this.setHint(`${mark.revealText} · push the rune stone into the exposed axle and OATHBIND it.`, 6);
      this.pushHud(true);
      return true;
    }
    if (objective?.type === 'bell-tower-restoration') {
      const brace = objective.memoryBrace;
      if (!brace || brace.tx !== tx || brace.ty !== ty || brace.revealed || !objective.alternatingComplete) return false;
      brace.revealed = true;
      objective.phase = 'collapse';
      this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#80e7ff', 24, 170);
      this.audio.play('relic');
      this.setHint(`${brace.revealText} · descend the broken spiral to the final climb`, 5.5);
      this.pushHud(true);
      return true;
    }
    if (objective?.type === 'oathbind-restoration') {
      const mark = objective.memoryMark;
      if (!mark || mark.tx !== tx || mark.ty !== ty || mark.revealed || !objective.lessonComplete) return false;
      mark.revealed = true;
      objective.phase = 'seal';
      this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#80e7ff', 24, 170);
      this.audio.play('relic');
      this.setHint(`${mark.revealText} · release the block and bind it on the public scale`, 5.5);
      this.pushHud(true);
      return true;
    }
    if (objective?.type === 'procession-restoration') {
      const mark = objective.memoryMark;
      if (!mark || mark.tx !== tx || mark.ty !== ty || mark.revealed) return false;
      mark.revealed = true;
      this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#80e7ff', 24, 170);
      this.audio.play('relic');
      this.setHint(`${mark.revealText} · continue east through the blade's sightline`, 5);
      this.pushHud(true);
      return true;
    }
    if (objective?.type !== 'memory-carve') return false;
    const mark = objective.marks.find((item) => item.tx === tx && item.ty === ty);
    if (!mark || mark.revealed) return false;
    mark.revealed = true;
    const status = this.objectiveStatus();
    this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#80e7ff', 24, 170);
    if (!status.complete) {
      this.setHint(`${mark.revealText} · ${status.target - status.current} memory-line${status.target - status.current === 1 ? '' : 's'} remain`, 4.5);
      this.pushHud(true);
      return true;
    }

    objective.complete = true;
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (const restoration of objective.restorationTiles || []) {
      this.level.map[restoration.ty][restoration.tx] = restoration.tile;
      restampCell(this.level, chunks, restoration.tx, restoration.ty);
    }
    this.openGate({ hint: objective.completionHint, holdSeconds: 5 });
    this.pushHud(true);
    return true;
  }

  armCrumble(tx, ty, tile) {
    const key = `${tx},${ty}`;
    const state = this.crumble.get(key) || { phase: 'arming', timer: 0, tx, ty, tile };
    this.crumble.set(key, state);
  }

  updateCrumble(dt) {
    for (const [key, state] of this.crumble) {
      if (state.phase === 'arming') {
        state.timer += dt;
        const breakDelay = state.tile === Tile.CRYSTAL ? .28 : .45;
        if (state.timer >= breakDelay) {
          state.phase = 'gone';
          state.timer = state.tile === Tile.CRYSTAL ? 5 : 3.6;
          this.level.map[state.ty][state.tx] = Tile.AIR;
          restampCell(this.level, this.bank.get(levelCacheKey(this.level)), state.tx, state.ty);
          this.burst(state.tx * TILE + TILE / 2, state.ty * TILE + 10, '#c98448', 10, 120);
        }
      } else {
        state.timer -= dt;
        if (state.timer <= 0) {
          this.level.map[state.ty][state.tx] = state.tile;
          restampCell(this.level, this.bank.get(levelCacheKey(this.level)), state.tx, state.ty);
          this.crumble.delete(key);
        }
      }
    }
  }

  checkHazards() {
    const p = this.player;
    if (this.checkSanctumReturnFields?.()) return;
    const left = Math.floor(p.x / TILE);
    const right = Math.floor((p.x + p.w - EPS) / TILE);
    const top = Math.floor(p.y / TILE);
    const bottom = Math.floor((p.y + p.h - EPS) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (this.tileAt(tx, ty) === Tile.SPIKE) {
          p.y = ty * TILE - p.h;
          this.damagePlayer(1, -520);
          return;
        }
      }
    }

    const objective = this.level.objective;
    if (objective?.type === 'warden-restoration' && objective.phase === 'anchor'
      && !objective.complete && p.invuln <= 0) {
      const breath = objective.breath;
      const cycleClock = breath.clock % breath.cycleSeconds;
      const active = cycleClock >= breath.warningSeconds
        && cycleClock < breath.warningSeconds + breath.activeSeconds;
      const playerCenter = p.x + p.w / 2;
      const nearFloor = p.y + p.h > 25 * TILE + 8;
      const inCurrent = playerCenter >= 20 * TILE && playerCenter <= 63 * TILE;
      const sheltering = this.level.block?.bound
        && playerCenter >= this.level.block.x - 2.25 * TILE
        && playerCenter <= this.level.block.x + this.level.block.w;
      if (active && nearFloor && inCurrent && !sheltering) {
        breath.strikeCount += 1;
        p.facing = playerCenter < objective.warden.x ? 1 : -1;
        this.damagePlayer(1, -500);
        this.setHint('THE WARNED BREATH STRUCK · jump the vermilion edge or shelter west of the bound heartstone.', 3.2);
        return;
      }
    }
    if (objective?.type !== 'timed-teeth-restoration' || objective.complete || p.invuln > 0) return;
    const playerFeet = { x: p.x + 4, y: p.y + p.h - 14, w: p.w - 8, h: 14 };
    for (const hazard of objective.hazards || []) {
      const state = getTimedTeethState(objective.timing, hazard, objective.hazardClock);
      if (!hazard.damaging || !state.active) continue;
      const teeth = {
        x: hazard.startTx * TILE + 8,
        y: (hazard.baseTy - 1) * TILE + 3,
        w: (hazard.endTx - hazard.startTx + 1) * TILE - 16,
        h: TILE - 3,
      };
      if (!overlaps(playerFeet, teeth)) continue;
      p.facing = p.x + p.w / 2 < teeth.x + teeth.w / 2 ? 1 : -1;
      this.damagePlayer(1, -520);
      this.setHint('THE TEETH ROSE · recover on the nearest stone and read both dust pulses.', 2.8);
      return;
    }
  }

  damagePlayer(amount, bounce = -360) {
    const p = this.player;
    if (p.invuln > 0 || this.mode !== 'play') return;
    p.hp = Math.max(0, p.hp - amount);
    if (this.demo && amount < PHYSICS.MAX_HP && p.hp <= 0) p.hp = PHYSICS.MAX_HP;
    p.invuln = .9;
    p.vy = bounce;
    p.vx = -p.facing * 190;
    this.burst(p.x + p.w / 2, p.y + p.h / 2, '#e27663', 14, 180);
    this.audio.play(p.hp <= 0 ? 'death' : 'hurt');
    this.pushHud(true);
    if (p.hp <= 0) {
      this.deaths += 1;
      this.mode = 'dead';
      this.callbacks.death?.({ deaths: this.deaths, demo: this.demo });
    }
  }

  resolveAttackHits() {
    const p = this.player;
    if (p.attackTimer <= .05) return;
    const hitbox = {
      x: p.facing > 0 ? p.x + p.w - 2 : p.x - 48,
      y: p.y + 3,
      w: 50,
      h: 42,
    };
    for (const soldier of this.soldiers) {
      if (p.attackHits.has(soldier.id) || !overlaps(hitbox, soldier)) continue;
      if (soldier.gateMember && soldier.kind === 'shield'
        && !['recovery', 'stun'].includes(soldier.attackPhase)) {
        p.attackHits.add(soldier.id);
        this.burst(soldier.x + soldier.w / 2, soldier.y + 22, '#718499', 7, 90);
        this.audio.play('dig');
        this.setHint('THE KEEPER BRACES · evade the amber sweep, then answer during blue recovery.', 2.4);
        continue;
      }
      p.attackHits.add(soldier.id);
      soldier.hp -= 1;
      soldier.vx = p.facing * 260;
      if (soldier.raidMember || soldier.readableMelee) {
        soldier.attackPhase = 'stun';
        soldier.attackClock = .24;
        soldier.attackConsumed = true;
      }
      this.burst(soldier.x + soldier.w / 2, soldier.y + 20, '#f1bf57', 11, 180);
      this.audio.play('hit');
      if (soldier.hp <= 0) {
        this.recordParachuteDefeat?.(soldier);
        this.recordVeilGateDefeat?.(soldier);
      }
    }
    this.soldiers = this.soldiers.filter((soldier) => soldier.hp > 0);

    const boss = this.level.boss;
    if (boss?.active && boss.hp > 0 && !p.attackHits.has('boss') && overlaps(hitbox, boss)) {
      p.attackHits.add('boss');
      boss.hp = Math.max(0, boss.hp - 1);
      boss.vx = p.facing * 170;
      this.burst(boss.x + boss.w / 2, boss.y + boss.h * .45, '#ffe08a', 18, 220);
      this.audio.play('hit');
      if (boss.hp <= 0) {
        this.burst(boss.x + boss.w / 2, boss.y + boss.h / 2, '#e8c56a', 50, 280);
        this.audio.play('gate');
        this.setHint('The Veiled Guardian falls. The final door is awake.');
      }
      this.pushHud(true);
    }
  }

  activateParachuteStage(stage) {
    const objective = this.level.objective;
    if (objective?.type !== 'parachute-choir-restoration' || !stage || stage.active || stage.complete) return false;
    stage.active = true;
    stage.startedAt = objective.encounterClock;
    this.audio.play('gate');
    this.setHint(`LANDING SIGNAL · ${stage.label} is descending. Read the gold circle before contact.`, 3.4);
    this.pushHud(true);
    return true;
  }

  spawnParachuteRaider(entry) {
    const objective = this.level.objective;
    if (objective?.type !== 'parachute-choir-restoration' || !entry || entry.status !== 'queued') return false;
    const ship = this.level.ships.find((item) => item.id === entry.shipId);
    if (!ship) return false;
    const boundsByStage = {
      lesson: [10, 27],
      chorus: [43, 65],
      finale: [62, 83],
    };
    const [minTx, maxTx] = boundsByStage[entry.stageId] || [2, 88];
    entry.status = 'active';
    entry.spawnedAt = objective.encounterClock;
    objective.spawnedCount += 1;
    this.soldiers.push({
      id: entry.id,
      rosterId: entry.id,
      raidMember: true,
      x: entry.dropTx * TILE - 12,
      y: ship.y + 24,
      w: 24,
      h: 44,
      vx: 0,
      vy: 48,
      hp: entry.hp,
      maxHp: entry.hp,
      mode: 'para',
      facing: -1,
      kind: entry.kind,
      attackPhase: 'descent',
      attackClock: 0,
      attackConsumed: true,
      telegraphSeconds: entry.telegraphSeconds,
      recoverySeconds: entry.recoverySeconds,
      activeSeconds: entry.kind === 'shield' ? .2 : entry.kind === 'spear' ? .18 : .16,
      minX: minTx * TILE,
      maxX: maxTx * TILE,
    });
    this.pushHud(true);
    return true;
  }

  strikeParachuteTether() {
    const objective = this.level.objective;
    const skycut = objective?.type === 'parachute-choir-restoration' ? objective.skycut : null;
    const tether = skycut?.tether;
    if (objective?.phase !== 'flank' || !skycut?.landed || !tether || tether.cut) return false;
    const playerX = this.player.x + this.player.w / 2;
    const playerY = this.player.y + this.player.h / 2;
    const tetherX = tether.tx * TILE;
    const tetherY = tether.baseTy * TILE - 78;
    if (Math.hypot(playerX - tetherX, playerY - tetherY) > tether.strikeRadius) {
      this.setHint('SKYCUT · land beside the glowing command tether, then STRIKE.', 2.5);
      return false;
    }
    tether.cut = true;
    skycut.completed = true;
    objective.phase = 'chorus';
    this.burst(tetherX, tetherY, '#ffe28a', 30, 220);
    this.audio.play('gate');
    this.setHint('SKYCUT LEARNED · hold RIGHT + UP and JUMP over the pillar; the moving pair has lost its count.', 4.8);
    this.pushHud(true);
    return true;
  }

  recordParachuteDefeat(soldier) {
    const objective = this.level.objective;
    if (objective?.type !== 'parachute-choir-restoration' || !soldier?.raidMember) return false;
    const entry = objective.roster.find((item) => item.id === soldier.rosterId);
    if (!entry || entry.status !== 'active') return false;
    entry.status = 'defeated';
    entry.defeatedAt = objective.encounterClock;
    objective.defeatedCount += 1;
    const sail = objective.windSails.find((item) => item.rosterId === entry.id);
    if (sail) sail.unfurled = true;
    const stage = objective.stages.find((item) => item.id === entry.stageId);
    if (stage && stage.rosterIds.every((id) => objective.roster.find((item) => item.id === id)?.status === 'defeated')) {
      stage.complete = true;
      stage.completedAt = objective.encounterClock;
      if (stage.id === 'lesson') {
        objective.phase = 'flank';
        this.setHint("MIRA · Do not trade wounds. Now take the high line and cut their count. · PILGRIM'S GRIP east.", 6);
      } else if (stage.id === 'chorus') {
        objective.phase = 'finale';
        this.setHint('MIRA · Their descent follows a Crown survey cadence. · AREN · Mine. I taught them where a city could not hide.', 6.5);
      } else if (stage.id === 'finale') {
        this.completeParachuteChoir();
      }
    }
    this.pushHud(true);
    return true;
  }

  completeParachuteChoir() {
    const objective = this.level.objective;
    if (objective?.type !== 'parachute-choir-restoration' || objective.complete
      || objective.defeatedCount !== objective.roster.length || !objective.skycut?.completed) return false;
    objective.complete = true;
    objective.restored = true;
    objective.skyRestored = true;
    objective.phase = 'complete';
    objective.completedAt = this.totalTime;
    for (const sail of objective.windSails) sail.unfurled = true;
    this.projectiles = [];
    this.openGate({ hint: objective.completionHint, holdSeconds: 6 });
    this.pushHud(true);
    return true;
  }

  updateVeilGateObjective(dt = 0) {
    const objective = this.level.objective;
    if (objective?.type !== 'veil-gate-restoration' || objective.complete) return;
    const encounter = objective.encounter;
    if (encounter) encounter.clock += dt;

    const counterweightHeld = this.level.block?.bound
      && this.blockOnOathZone(objective.counterweight?.zone);
    if (objective.phase === 'counterweight') {
      if (!counterweightHeld) return;
      objective.counterweight.bound = true;
      objective.phase = 'ascent';
      this.burst(
        objective.counterweight.zone.x + objective.counterweight.zone.w / 2,
        objective.counterweight.zone.y,
        '#80e7ff',
        26,
        155,
      );
      this.audio.play('gate');
      this.setHint('COUNTERWEIGHT HELD · the western rib is steady enough for Pilgrim’s Grip.', 4.8);
      this.pushHud(true);
      return;
    }

    if (objective.phase !== 'ascent') return;
    if (!counterweightHeld && !objective.counterweight.locked) {
      objective.counterweight.bound = false;
      objective.upperLatch.gripJumpRecorded = false;
      objective.upperLatch.reached = false;
      objective.phase = 'counterweight';
      this.setHint('THE WEIGHT SLIPPED · rebind the rune stone in the cyan axle.', 3.4);
      this.pushHud(true);
      return;
    }

    const landing = objective.upperLatch?.landing;
    const centerTx = (this.player.x + this.player.w / 2) / TILE;
    const feetTy = (this.player.y + this.player.h) / TILE;
    const onUpperLanding = landing && this.player.grounded
      && centerTx >= landing.minTx && centerTx <= landing.maxTx
      && Math.abs(feetTy - landing.feetTy) <= .08;
    if (onUpperLanding && !objective.upperLatch.gripJumpRecorded
      && !objective.upperLatch.retryHintShown) {
      objective.upperLatch.retryHintShown = true;
      this.setHint('THE HIGH LATCH NEEDS A SPRING · hold DOWN to drop through, grip the right wall, then JUMP away.', 5.4);
      this.pushHud(true);
      return;
    }
    if (!landing || !objective.upperLatch.gripJumpRecorded || !this.player.grounded
      || centerTx < landing.minTx || centerTx > landing.maxTx
      || Math.abs(feetTy - landing.feetTy) > .08) return;

    objective.upperLatch.reached = true;
    objective.counterweight.locked = true;
    objective.phase = 'relay';
    this.spawnVeilGateMember(objective.encounter?.roster?.[0]?.id);
    this.setHint('THE LOCK FACES ORUN · this gate was built to hold something beyond it. The Keeper wakes.', 6.2);
    this.pushHud(true);
  }

  spawnVeilGateMember(id) {
    const objective = this.level.objective;
    const encounter = objective?.type === 'veil-gate-restoration' ? objective.encounter : null;
    const entry = encounter?.roster?.find((item) => item.id === id);
    if (!entry || entry.status !== 'queued' || this.soldiers.some((soldier) => soldier.rosterId === id)) return false;
    const stage = encounter.stages.find((item) => item.rosterIds.includes(id));
    if (stage && !stage.active) {
      stage.active = true;
      stage.startedAt = encounter.clock;
    }
    entry.status = 'active';
    entry.spawnedAt = encounter.clock;
    encounter.spawnedCount += 1;
    this.soldiers.push({
      id: entry.id,
      rosterId: entry.id,
      gateMember: true,
      readableMelee: true,
      x: entry.spawnTx * TILE - 12,
      y: entry.feetTy * TILE - 44,
      w: 24,
      h: 44,
      vx: 0,
      vy: 0,
      hp: entry.hp,
      maxHp: entry.hp,
      mode: 'walk',
      facing: -1,
      kind: entry.kind,
      attackPhase: 'recovery',
      attackClock: entry.wakeRecoverySeconds || 1.2,
      attackConsumed: true,
      telegraphSeconds: entry.telegraphSeconds,
      recoverySeconds: entry.recoverySeconds,
      activeSeconds: entry.activeSeconds || (entry.kind === 'shield' ? .2 : entry.kind === 'spear' ? .18 : .16),
      minX: entry.minTx * TILE,
      maxX: entry.maxTx * TILE,
    });
    this.burst(entry.spawnTx * TILE, entry.feetTy * TILE - 22, '#d86f58', 18, 125);
    this.pushHud(true);
    return true;
  }

  recordVeilGateDefeat(soldier) {
    const objective = this.level.objective;
    const encounter = objective?.type === 'veil-gate-restoration' ? objective.encounter : null;
    if (!encounter || !soldier?.gateMember) return false;
    const entry = encounter.roster.find((item) => item.id === soldier.rosterId);
    if (!entry || entry.status !== 'active') return false;
    entry.status = 'defeated';
    entry.defeatedAt = encounter.clock;
    encounter.defeatedCount += 1;
    const banner = objective.relayBanners?.find((item) => item.rosterId === entry.id);
    if (banner) banner.restored = true;
    const stage = encounter.stages.find((item) => item.rosterIds.includes(entry.id));
    if (stage) {
      stage.complete = true;
      stage.completedAt = encounter.clock;
    }
    objective.sunstone.exposed = true;
    objective.phase = 'keystone';
    this.audio.play('gate');
    this.setHint('THE KEEPER YIELDS · DAWNSTROKE the exposed black sunstone and turn the meridian inward.', 5.5);
    this.pushHud(true);
    return true;
  }

  strikeVeilSunstone() {
    const objective = this.level.objective;
    const sunstone = objective?.type === 'veil-gate-restoration' ? objective.sunstone : null;
    if (!sunstone || objective.phase !== 'keystone' || !sunstone.exposed || sunstone.struck) return false;
    if (!objective.memoryMark?.revealed || !objective.counterweight?.bound
      || !objective.counterweight?.locked || !objective.upperLatch?.reached
      || objective.encounter?.defeatedCount !== objective.encounter?.roster?.length) return false;
    const targetX = sunstone.tx * TILE;
    const targetY = sunstone.baseTy * TILE - 72;
    const playerX = this.player.x + this.player.w / 2;
    const playerY = this.player.y + this.player.h / 2;
    if (Math.hypot(playerX - targetX, playerY - targetY) > sunstone.strikeRadius) {
      this.setHint('STAND BENEATH THE BLACK SUNSTONE · then press STRIKE.', 2.8);
      return false;
    }
    sunstone.struck = true;
    this.burst(targetX, targetY, '#ffe18a', 42, 245);
    this.audio.play('gate');
    return this.completeVeilGate();
  }

  completeVeilGate() {
    const objective = this.level.objective;
    if (objective?.type !== 'veil-gate-restoration' || objective.complete
      || !objective.sunstone?.struck || !objective.memoryMark?.revealed
      || !objective.counterweight?.bound || !objective.counterweight?.locked
      || !objective.upperLatch?.reached
      || objective.encounter?.defeatedCount !== objective.encounter?.roster?.length) return false;
    objective.complete = true;
    objective.restored = true;
    objective.phase = 'complete';
    objective.completedAt = this.totalTime;
    objective.gateRestored = true;
    objective.cartographersTurn.restored = true;
    objective.cartographersTurn.turnedAt = this.totalTime;
    for (const banner of objective.relayBanners || []) banner.restored = true;
    this.projectiles = [];
    this.openGate({ hint: objective.completionHint, holdSeconds: 6.5 });
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (const restoration of objective.restorationTiles || []) {
      this.level.map[restoration.ty][restoration.tx] = restoration.tile;
      restampCell(this.level, chunks, restoration.tx, restoration.ty);
    }
    this.pushHud(true);
    return true;
  }

  updateVeilGate(dt) {
    this.updateVeilGateObjective(dt);
    this.projectiles = [];
    for (const soldier of this.soldiers) {
      this.updateRaidSoldier(soldier, dt);
      soldier.x = clamp(soldier.x + soldier.vx * dt, soldier.minX, soldier.maxX - soldier.w);
      const nextY = soldier.y + soldier.vy * dt;
      const footY = nextY + soldier.h;
      const tx = Math.floor((soldier.x + soldier.w / 2) / TILE);
      const ty = Math.floor(footY / TILE);
      const tile = this.tileAt(tx, ty);
      if ((this.isSolidTile(tile) || tile === Tile.ONEWAY)
        && soldier.y + soldier.h <= ty * TILE + 12 && soldier.vy >= 0) {
        soldier.y = ty * TILE - soldier.h;
        soldier.vy = 0;
      } else soldier.y = nextY;
    }
    this.soldiers = this.soldiers.filter((soldier) => soldier.hp > 0);
  }

  applyWardenHand(tile) {
    const objective = this.level.objective;
    const hand = objective?.type === 'warden-restoration' ? objective.rememberedHand : null;
    const rib = hand?.rib;
    if (!rib) return false;
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (let ty = rib.topTy + 1; ty <= rib.bottomTy; ty += 1) {
      this.level.map[ty][rib.tx] = tile;
      restampCell(this.level, chunks, rib.tx, ty);
    }
    return true;
  }

  updateWardenObjective(dt = 0) {
    const objective = this.level.objective;
    if (objective?.type !== 'warden-restoration' || objective.complete) return;
    const breath = objective.breath;

    if (objective.phase === 'listen') {
      breath.clock += dt;
      if (breath.clock < breath.warningSeconds + breath.activeSeconds) return;
      breath.firstBreathComplete = true;
      breath.clock = 0;
      objective.phase = 'carve';
      objective.warden.state = 'listening';
      this.audio.play('gate');
      this.setHint('MIRA · I told you the gate contained a danger. · AREN · You did not say it would recognize me.', 6.5);
      this.pushHud(true);
      return;
    }

    if (objective.phase === 'anchor') {
      breath.clock = (breath.clock + dt) % breath.cycleSeconds;
      const heartstoneHeld = this.level.block?.bound
        && this.blockOnOathZone(objective.heartstone?.zone);
      if (!heartstoneHeld) {
        objective.heartstone.bound = false;
        return;
      }
      objective.heartstone.bound = true;
      objective.heartstone.locked = true;
      objective.rememberedHand.raised = true;
      objective.warden.state = 'remembering';
      objective.phase = 'ascend';
      this.applyWardenHand(Tile.SAND);
      this.burst(
        objective.rememberedHand.rib.tx * TILE + TILE / 2,
        objective.rememberedHand.rib.bottomTy * TILE,
        '#f0c978',
        40,
        190,
      );
      this.audio.play('gate');
      this.setHint('THE BREATH DIVIDES · the Warden reforms one hand from the oath. Climb only after the sand holds gold.', 5.8);
      this.pushHud(true);
      return;
    }

    if (objective.phase === 'ascend') {
      const landing = objective.rememberedHand?.landing;
      const centerTx = (this.player.x + this.player.w / 2) / TILE;
      const feetTy = (this.player.y + this.player.h) / TILE;
      const onLanding = landing && this.player.grounded
        && centerTx >= landing.minTx && centerTx <= landing.maxTx
        && Math.abs(feetTy - landing.feetTy) <= .08;
      if (onLanding && !objective.rememberedHand.gripJumpRecorded
        && !objective.rememberedHand.retryHintShown) {
        objective.rememberedHand.retryHintShown = true;
        this.setHint('THE HAND NEEDS YOUR GRIP · hold DOWN to drop, pass beneath it, then hold UP on its west face and JUMP away.', 5.6);
        this.pushHud(true);
        return;
      }
      if (!onLanding || !objective.rememberedHand.gripJumpRecorded) return;
      objective.rememberedHand.reached = true;
      objective.bridle.exposed = true;
      objective.bridle.clock = 0;
      objective.phase = 'unbind';
      objective.warden.state = 'bridled';
      this.audio.play('gate');
      this.setHint('THE CROWN’S BRIDLE · amber means guard. Hold your strike until the command opens cyan.', 5.4);
      this.pushHud(true);
      return;
    }

    if (objective.phase === 'unbind') objective.bridle.clock += dt;
  }

  strikeWardenBridle() {
    const objective = this.level.objective;
    const bridle = objective?.type === 'warden-restoration' ? objective.bridle : null;
    if (!bridle || objective.phase !== 'unbind' || !bridle.exposed || bridle.struck) return false;
    if (!objective.memorySeam?.revealed || !objective.heartstone?.bound
      || !objective.heartstone?.locked || !objective.rememberedHand?.reached) return false;
    const targetX = bridle.tx * TILE;
    const targetY = bridle.baseTy * TILE - 72;
    const playerX = this.player.x + this.player.w / 2;
    const playerY = this.player.y + this.player.h / 2;
    if (Math.hypot(playerX - targetX, playerY - targetY) > bridle.strikeRadius) {
      this.setHint('STAND ON THE WARDEN’S BROAD HAND · the black bridle is just east of the raised rib.', 2.8);
      return false;
    }
    const cycle = bridle.guardSeconds + bridle.recoverySeconds;
    const cycleClock = bridle.clock % cycle;
    if (cycleClock < bridle.guardSeconds) {
      this.setHint('AMBER GUARD · wait for the bridle to open cyan, then answer once.', 2.6);
      return false;
    }
    bridle.struck = true;
    this.burst(targetX, targetY, '#8deaf1', 52, 270);
    this.audio.play('gate');
    return this.completeWarden();
  }

  completeWarden() {
    const objective = this.level.objective;
    if (objective?.type !== 'warden-restoration' || objective.complete
      || !objective.breath?.firstBreathComplete || !objective.memorySeam?.revealed
      || !objective.heartstone?.bound || !objective.heartstone?.locked
      || !objective.rememberedHand?.raised || !objective.rememberedHand?.reached
      || !objective.bridle?.struck) return false;
    objective.complete = true;
    objective.restored = true;
    objective.phase = 'first-path';
    objective.completedAt = this.totalTime;
    objective.rememberedHand.restored = true;
    objective.warden.state = 'kneeling';
    objective.warden.kneeling = true;
    objective.warden.commandBroken = true;
    objective.crownPath.restored = true;
    this.applyWardenHand(Tile.GLOW);
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (const restoration of objective.restorationTiles || []) {
      this.level.map[restoration.ty][restoration.tx] = restoration.tile;
      restampCell(this.level, chunks, restoration.tx, restoration.ty);
    }
    this.projectiles = [];
    this.openGate({ hint: objective.completionHint, holdSeconds: 7.2 });
    this.pushHud(true);
    return true;
  }

  updateParachuteChoirObjective(dt = 0) {
    const objective = this.level.objective;
    if (objective?.type !== 'parachute-choir-restoration') return;
    objective.encounterClock += dt;

    const targets = objective.formations[objective.phase] || objective.formations.lesson;
    for (const ship of this.level.ships) {
      const target = targets.find((item) => item.shipId === ship.id);
      if (!target) continue;
      ship.x = approach(ship.x, target.tx * TILE, (objective.complete ? 520 : 150) * dt);
      ship.y = approach(ship.y, target.ty * TILE, (objective.complete ? 320 : 95) * dt);
    }

    if (objective.phase === 'flank') {
      const zone = objective.skycut.landing;
      const centerTx = (this.player.x + this.player.w / 2) / TILE;
      const feetTy = (this.player.y + this.player.h) / TILE;
      if (objective.skycut.gripJumpRecorded && this.player.grounded
        && centerTx >= zone.minTx && centerTx <= zone.maxTx
        && Math.abs(feetTy - zone.feetTy) <= .08 && !objective.skycut.landed) {
        objective.skycut.landed = true;
        this.setHint('HIGH LINE HELD · STRIKE the glowing command tether before descending east.', 4);
        this.pushHud(true);
      }
      return;
    }

    const stage = objective.stages.find((item) => item.id === objective.phase);
    if (!stage || stage.complete) return;
    const centerTx = (this.player.x + this.player.w / 2) / TILE;
    if (!stage.active && centerTx >= stage.triggerTx) this.activateParachuteStage(stage);
    if (!stage.active) return;
    const elapsed = objective.encounterClock - stage.startedAt;
    for (const rosterId of stage.rosterIds) {
      const entry = objective.roster.find((item) => item.id === rosterId);
      if (entry?.status === 'queued' && elapsed >= entry.delay) this.spawnParachuteRaider(entry);
    }
  }

  raidAttackBox(soldier) {
    const reach = soldier.kind === 'spear' ? 82 : soldier.kind === 'shield' ? 60 : 50;
    const height = soldier.kind === 'spear' ? 22 : 34;
    return {
      x: soldier.facing > 0 ? soldier.x + soldier.w - 2 : soldier.x - reach + 2,
      y: soldier.y + soldier.h - height,
      w: reach,
      h: height,
    };
  }

  updateRaidSoldier(soldier, dt) {
    if (soldier.mode === 'para') {
      soldier.vy = Math.min(260, soldier.vy + 260 * dt);
      soldier.vx = 0;
      return;
    }

    soldier.attackClock = Math.max(0, (soldier.attackClock || 0) - dt);
    if (soldier.attackPhase === 'stun') {
      soldier.vx = approach(soldier.vx, 0, 820 * dt);
      if (soldier.attackClock <= 0) {
        soldier.attackPhase = 'recovery';
        soldier.attackClock = Math.max(.55, soldier.recoverySeconds * .72);
      }
      return;
    }
    if (soldier.attackPhase === 'landing' || soldier.attackPhase === 'recovery') {
      soldier.vx = approach(soldier.vx, 0, 760 * dt);
      if (soldier.attackClock <= 0) soldier.attackPhase = 'pursue';
      return;
    }
    if (soldier.attackPhase === 'windup') {
      soldier.vx = approach(soldier.vx, 0, 900 * dt);
      if (soldier.attackClock <= 0) {
        soldier.attackPhase = 'active';
        soldier.attackClock = soldier.activeSeconds;
        soldier.attackConsumed = false;
        soldier.vx = soldier.facing * (soldier.kind === 'spear' ? 135 : 95);
      }
      return;
    }
    if (soldier.attackPhase === 'active') {
      if (!soldier.attackConsumed && overlaps(this.player, this.raidAttackBox(soldier))) {
        soldier.attackConsumed = true;
        this.damagePlayer(1, -430);
      }
      if (soldier.attackClock <= 0) {
        soldier.attackPhase = 'recovery';
        soldier.attackClock = soldier.recoverySeconds;
        soldier.vx = 0;
      }
      return;
    }

    const distance = Math.abs((this.player.x + this.player.w / 2) - (soldier.x + soldier.w / 2));
    soldier.facing = this.player.x + this.player.w / 2 >= soldier.x + soldier.w / 2 ? 1 : -1;
    const attackRange = soldier.kind === 'spear' ? 92 : soldier.kind === 'shield' ? 68 : 62;
    if (distance <= attackRange) {
      soldier.attackPhase = 'windup';
      soldier.attackClock = soldier.telegraphSeconds;
      soldier.attackConsumed = true;
      soldier.vx = 0;
      return;
    }
    const speed = soldier.kind === 'spear' ? 88 : soldier.kind === 'shield' ? 46 : 64;
    soldier.vx = approach(soldier.vx, soldier.facing * speed, 420 * dt);
  }

  updateParachuteChoir(dt) {
    this.updateParachuteChoirObjective(dt);
    this.projectiles = [];

    for (const soldier of this.soldiers) {
      this.updateRaidSoldier(soldier, dt);
      soldier.x = clamp(soldier.x + soldier.vx * dt, soldier.minX, soldier.maxX - soldier.w);
      const nextY = soldier.y + soldier.vy * dt;
      const footY = nextY + soldier.h;
      const tx = Math.floor((soldier.x + soldier.w / 2) / TILE);
      const ty = Math.floor(footY / TILE);
      const tile = this.tileAt(tx, ty);
      if ((this.isSolidTile(tile) || tile === Tile.ONEWAY)
        && soldier.y + soldier.h <= ty * TILE + 12 && soldier.vy >= 0) {
        soldier.y = ty * TILE - soldier.h;
        soldier.vy = 0;
        if (soldier.mode === 'para') {
          soldier.mode = 'walk';
          soldier.attackPhase = 'landing';
          soldier.attackClock = .72;
          soldier.attackConsumed = true;
          this.burst(soldier.x + soldier.w / 2, soldier.y + soldier.h, '#8fe4ef', 13, 95);
        }
      } else soldier.y = nextY;
    }
    this.soldiers = this.soldiers.filter((soldier) => soldier.hp > 0);
  }

  updateSoldiers(dt) {
    if (this.level.objective?.type === 'veil-gate-restoration') {
      this.updateVeilGate(dt);
      return;
    }
    if (this.level.objective?.type === 'parachute-choir-restoration') {
      this.updateParachuteChoir(dt);
      return;
    }
    const inArena = this.player.x > (this.level.arenaStart ?? 68) * TILE;
    if (inArena && this.level.ships.length) {
      this.spawnClock += dt;
      const spawnEvery = this.level.spawnEvery ?? 2.4;
      const maxEnemies = this.level.maxEnemies ?? 7;
      if (this.spawnClock >= spawnEvery && this.soldiers.length < maxEnemies) {
        this.spawnClock = 0;
        const ship = this.level.ships[Math.floor(this.totalTime / spawnEvery) % this.level.ships.length];
        const kinds = this.level.gameplay?.enemyRoster || ['grunt'];
        const kind = kinds[Math.floor(this.totalTime / spawnEvery) % kinds.length];
        this.soldiers.push({
          id: `${this.level.levelKey || this.level.id}-${this.totalTime.toFixed(3)}`,
          x: ship.x - 12, y: ship.y + 30, w: 24, h: 44,
          vx: 0, vy: 48, hp: kind === 'shield' ? 3 : 2, mode: 'para', facing: -1, kind, shotClock: 1.2,
        });
      }
    }

    for (const soldier of this.soldiers) {
      if (soldier.mode === 'para') {
        soldier.vy = Math.min(260, soldier.vy + 260 * dt);
      } else {
        soldier.facing = this.player.x >= soldier.x ? 1 : -1;
        const distance = Math.abs(this.player.x - soldier.x);
        const speed = soldier.kind === 'spear' ? 92 : soldier.kind === 'shield' ? 48 : 66;
        const desired = soldier.kind === 'archer' && distance < 340 ? 0 : soldier.facing * speed;
        soldier.vx = approach(soldier.vx, desired, 420 * dt);
        soldier.vy = Math.min(900, soldier.vy + PHYSICS.GRAVITY_DOWN * dt);
        if (soldier.kind === 'archer') {
          soldier.shotClock -= dt;
          if (soldier.shotClock <= 0 && distance < 430) {
            soldier.shotClock = 1.8;
            this.projectiles.push({ x: soldier.x + soldier.w / 2, y: soldier.y + 15, vx: soldier.facing * 285, w: 18, h: 5 });
          }
        }
      }
      soldier.x += soldier.vx * dt;
      const nextY = soldier.y + soldier.vy * dt;
      const footY = nextY + soldier.h;
      const tx = Math.floor((soldier.x + soldier.w / 2) / TILE);
      const ty = Math.floor(footY / TILE);
      const tile = this.tileAt(tx, ty);
      if ((this.isSolidTile(tile) || tile === Tile.ONEWAY) && soldier.y + soldier.h <= ty * TILE + 12 && soldier.vy >= 0) {
        soldier.y = ty * TILE - soldier.h;
        soldier.vy = 0;
        soldier.mode = 'walk';
      } else soldier.y = nextY;

      if (overlaps(this.player, soldier)) this.damagePlayer(1, -430);
    }
    this.soldiers = this.soldiers.filter((soldier) => soldier.y < WORLD_H + 100 && soldier.x > 0 && soldier.x < WORLD_W);
    for (const projectile of this.projectiles) {
      projectile.x += projectile.vx * dt;
      const box = { x: projectile.x - 9, y: projectile.y - 3, w: projectile.w, h: projectile.h };
      if (!projectile.dead && overlaps(this.player, box)) {
        projectile.dead = true;
        this.damagePlayer(1, -340);
      }
      if (this.isSolidTile(this.tileAt(Math.floor(projectile.x / TILE), Math.floor(projectile.y / TILE)))) projectile.dead = true;
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead && projectile.x > 0 && projectile.x < WORLD_W);
  }

  updateBoss(dt) {
    const boss = this.level.boss;
    if (!boss || boss.hp <= 0) return;
    if (!boss.active && this.player.x > 68 * TILE) {
      boss.active = true;
      this.setHint('VEILED GUARDIAN · break its guard with ten strikes');
    }
    if (!boss.active) return;
    const direction = this.player.x >= boss.x ? 1 : -1;
    boss.vx = approach(boss.vx || 0, direction * 72, 260 * dt);
    boss.x = clamp(boss.x + boss.vx * dt, 60 * TILE, 66 * TILE);
    if (overlaps(this.player, boss)) this.damagePlayer(1, -520);
  }

  blockOnOathZone(zone) {
    const block = this.level.block;
    if (!block || !zone || Math.abs(block.vy || 0) > 1) return false;
    const overlapWidth = Math.max(0, Math.min(block.x + block.w, zone.x + zone.w) - Math.max(block.x, zone.x));
    const restingBottom = block.y + block.h + (block.bound ? block.oathLift || 0 : 0);
    const aligned = Math.abs(restingBottom - (zone.y + zone.h)) < 14;
    return aligned && overlapWidth >= Math.min(block.w, zone.w) * .5;
  }

  toggleOathbind() {
    const objective = this.level.objective;
    const block = this.level.block;
    const timedShelter = objective?.type === 'timed-teeth-restoration';
    const veilGate = objective?.type === 'veil-gate-restoration';
    const wardenRestoration = objective?.type === 'warden-restoration';
    if (!['oathbind-restoration', 'timed-teeth-restoration', 'veil-gate-restoration', 'warden-restoration']
      .includes(objective?.type) || !block || block.disabled) return false;
    const player = this.player;
    const vertical = player.y + player.h > block.y - 8 && player.y < block.y + block.h + 8;
    const horizontalGap = Math.max(
      0,
      block.x - (player.x + player.w),
      player.x - (block.x + block.w),
    );
    if (!vertical || horizontalGap > 24) return false;
    if (objective.complete) {
      this.setHint('THE OATH IS SEALED · this promise will not be uprooted.', 2.8);
      return true;
    }
    if (veilGate && !objective.memoryMark?.revealed) {
      this.setHint('READ THE BURIED MERIDIAN FIRST · the counterweight has no visible axle yet.', 3.4);
      return true;
    }
    if (veilGate && objective.counterweight?.locked && block.bound) {
      this.setHint('THE COUNTERWEIGHT HOLDS THE CROWN · finish the Cartographer’s Turn.', 3.2);
      return true;
    }
    if (wardenRestoration && !objective.memorySeam?.revealed) {
      this.setHint('FREE THE ORIGINAL VOW FIRST · the heartstone cannot hold an inverted command.', 3.5);
      return true;
    }
    if (wardenRestoration && objective.heartstone?.locked && block.bound) {
      this.setHint('THE HEARTSTONE DIVIDES THE CURRENT · climb the remembered hand.', 3.2);
      return true;
    }
    if (timedShelter && !objective.controlledComplete) {
      this.setHint('READ THE EARLIER TEETH FIRST · the answering stone will not hold a blind oath.', 3.2);
      return true;
    }
    if (timedShelter && block.bound) {
      this.setHint('THE ANSWERING STONE HOLDS · climb, then follow the warning wave.', 3.2);
      return true;
    }
    if (Math.abs(block.vy || 0) > 1) {
      this.setHint('OATHBIND NEEDS SOLID GROUND · let the rune block settle.', 2.4);
      return true;
    }

    const standingOnBlock = block.bound
      && player.x + player.w > block.x + 2
      && player.x < block.x + block.w - 2
      && Math.abs((player.y + player.h) - block.y) <= 10;
    if (standingOnBlock) {
      this.setHint('STEP BESIDE THE STONE TO RELEASE IT · an oath cannot vanish beneath your feet.', 3.2);
      return true;
    }

    const lift = block.oathLift || 0;
    if (block.bound) {
      block.bound = false;
      block.y += lift;
    } else {
      block.bound = true;
      block.y -= lift;
    }
    player.digTimer = .22;
    this.burst(block.x + block.w / 2, block.y + block.h / 2, block.bound ? '#80e7ff' : '#d69a54', 20, 150);
    this.audio.play(block.bound ? 'relic' : 'dig');
    if (block.bound) {
      this.setHint('OATHBOUND · the rune block is now an immovable foothold.', 3.5);
    } else {
      this.setHint('OATH RELEASED · the rune block can move again.', 2.8);
    }
    if (veilGate) {
      this.updateVeilGateObjective();
      if (block.bound && !this.blockOnOathZone(objective.counterweight?.zone)) {
        this.setHint('WRONG AXLE · release the stone and push it into the cyan counterweight socket.', 3.8);
      } else if (block.bound) {
        this.setHint('COUNTERWEIGHT HELD · take Pilgrim’s Grip up the western rib.', 4.2);
      }
    } else if (wardenRestoration) {
      this.updateWardenObjective();
      if (block.bound && !this.blockOnOathZone(objective.heartstone?.zone)) {
        this.setHint('THE CURRENT MISSES THE STONE · release it and push it into the broad cyan divide.', 3.8);
      } else if (block.bound) {
        this.setHint('THE BREATH DIVIDES · the Warden remembers its hand. Climb the golden rib.', 5);
      }
    } else if (timedShelter && block.bound) {
      const target = objective.hazards.find((hazard) => hazard.id === objective.oathShelter.targetHazardId);
      objective.oathShelter.boundOnce = true;
      if (target) target.bound = true;
      objective.phase = 'mastery';
      this.setHint('MIRA · These teeth faced the petitioners’ road. · AREN · Then timing was another tax.', 5.5);
    } else if (!timedShelter) this.updateOathbindObjective();
    this.pushHud(true);
    return true;
  }

  updateOathbindObjective() {
    const objective = this.level.objective;
    const block = this.level.block;
    if (objective?.type !== 'oathbind-restoration' || !block || objective.complete) return;

    if (!objective.lessonComplete && block.bound && this.blockOnOathZone(objective.lessonZone)) {
      objective.lessonComplete = true;
      objective.phase = 'cross';
      this.burst(objective.lessonZone.x + objective.lessonZone.w / 2, objective.lessonZone.y, '#80e7ff', 24, 145);
      this.audio.play('gate');
      this.setHint('MIRA · A freely held oath becomes a foothold, not a chain. Climb.', 5);
      this.pushHud(true);
    }

    if (objective.lessonComplete && !objective.memoryMark?.revealed
      && (this.player.x + this.player.w / 2) / TILE >= 23.5) {
      objective.phase = 'carve';
    }

    if (!this.blockOnOathZone(objective.finalSeal)) return;
    if (!objective.memoryMark?.revealed) {
      this.setHint('THE PUBLIC SCALE WAITS · release the block and return west beneath the archive.', 3.8);
      return;
    }

    const seatOnCivicPromise = () => {
      const previousX = block.x;
      const playerWasBeside = this.player.y + this.player.h > block.y - 8
        && this.player.y < block.y + block.h + 8
        && Math.max(
          0,
          block.x - (this.player.x + this.player.w),
          this.player.x - (block.x + block.w),
        ) <= 24;
      block.x = clamp(
        block.x,
        objective.finalSeal.x,
        objective.finalSeal.x + objective.finalSeal.w - block.w,
      );
      block.y = objective.finalSeal.y + objective.finalSeal.h
        - block.h - (block.bound ? block.oathLift || 0 : 0);
      block.vx = 0;
      block.vy = 0;
      block.translationLocked = true;
      if (playerWasBeside) this.player.x += block.x - previousX;
    };
    if (!block.bound) {
      // Once the prepared oath reaches the scale, hold its readable placement
      // until DIG. Continued movement cannot turn this instruction stale.
      seatOnCivicPromise();
      this.setHint('THE SCALE IS BALANCED BUT UNBOUND · press DIG beside the rune block.', 3.2);
      return;
    }

    // The final oath is a deliberate placement, not a precision tax. Once a
    // valid bound block overlaps the Civic Promise, seat it squarely on the
    // scale so the visual balance and restoration happen as one clear action.
    seatOnCivicPromise();
    objective.complete = true;
    objective.restored = true;
    objective.phase = 'complete';
    objective.completedAt = this.totalTime;
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (const restoration of objective.restorationTiles || []) {
      this.level.map[restoration.ty][restoration.tx] = restoration.tile;
      restampCell(this.level, chunks, restoration.tx, restoration.ty);
    }
    this.openGate({ hint: objective.completionHint, holdSeconds: 6 });
    this.pushHud(true);
  }

  updateTimedTeethObjective() {
    const objective = this.level.objective;
    if (objective?.type !== 'timed-teeth-restoration' || objective.complete) return;
    const centerTx = (this.player.x + this.player.w / 2) / TILE;

    if (!objective.lessonComplete && centerTx >= objective.thresholds.lessonClearTx) {
      objective.lessonComplete = true;
      objective.phase = 'controlled';
      this.audio.play('relic');
      this.setHint('DUSTSTEP LEARNED · the warning never lies; one safe island follows each jaw.', 4.2);
      this.pushHud(true);
    }
    if (objective.lessonComplete && !objective.controlledComplete
      && centerTx >= objective.thresholds.controlledClearTx) {
      objective.controlledComplete = true;
      objective.phase = 'bind';
      this.setHint('OATHBIND SHELTER · cross the first jaw and bind the fixed answering stone.', 4.2);
      this.pushHud(true);
    }

    const landing = objective.thresholds.masteryLanding;
    const mastered = objective.oathShelter?.boundOnce
      && centerTx >= landing.minTx;
    if (!mastered) return;

    objective.masteryComplete = true;
    objective.complete = true;
    objective.restored = true;
    objective.phase = 'complete';
    objective.completedAt = this.totalTime;
    for (const hazard of objective.hazards) hazard.restored = true;
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (const restoration of objective.restorationTiles || []) {
      this.level.map[restoration.ty][restoration.tx] = restoration.tile;
      restampCell(this.level, chunks, restoration.tx, restoration.ty);
    }
    this.openGate({ hint: objective.completionHint, holdSeconds: 6 });
    this.pushHud(true);
  }

  activateSanctumLamp() {
    const objective = this.level.objective;
    if (objective?.type !== 'sanctum-lamp-restoration' || objective.complete) return false;
    const lamp = objective.lamp;
    const player = this.player;
    const lampX = lamp.tx * TILE;
    const lampY = lamp.baseTy * TILE;
    const playerX = player.x + player.w / 2;
    const playerFeet = player.y + player.h;
    if (Math.hypot(playerX - lampX, playerFeet - lampY) > lamp.interactRadius) return false;
    if (!player.grounded) {
      this.setHint('OATHBIND NEEDS STILL GROUND · land beside Mira’s lamp.', 2.8);
      return true;
    }
    if (lamp.bound) {
      this.setHint('THE LAMP HOLDS YOUR RETURN · carry its light to the far witness.', 3.2);
      return true;
    }

    lamp.bound = true;
    lamp.boundAt = this.totalTime;
    objective.phase = 'outward';
    this.checkpoint = {
      kind: 'sanctum-lamp',
      id: lamp.checkpoint.id,
      x: lamp.checkpoint.x,
      y: lamp.checkpoint.y,
      facing: lamp.checkpoint.facing,
    };
    player.digTimer = .22;
    this.burst(lampX, lampY - 62, '#85e8ef', 32, 190);
    this.audio.play('relic');
    this.setHint('MIRA · I can return your living light. Death still reforms the realm. · AREN · Then remember my way back.', 6.2);
    this.pushHud(true);
    return true;
  }

  openSanctumArch() {
    const objective = this.level.objective;
    if (objective?.type !== 'sanctum-lamp-restoration' || objective.arch?.open) return false;
    objective.arch.open = true;
    const chunks = this.bank.get(levelCacheKey(this.level));
    for (const cell of objective.arch.openCells || []) {
      this.level.map[cell.ty][cell.tx] = cell.tile;
      restampCell(this.level, chunks, cell.tx, cell.ty);
    }
    this.burst(43 * TILE, 24 * TILE, '#efd276', 28, 170);
    this.audio.play('gate');
    this.setHint('THE LIT HANDPRINTS ANSWER · the low arch opens toward the witness.', 4.2);
    this.pushHud(true);
    return true;
  }

  returnToSanctum(field) {
    const objective = this.level.objective;
    if (objective?.type !== 'sanctum-lamp-restoration') return false;
    const bound = Boolean(objective.lamp?.bound);
    const anchor = bound ? objective.lamp.checkpoint : { ...this.level.spawn, facing: 1 };
    const hp = this.player.hp;
    this.player = this.makePlayer(anchor);
    this.player.hp = hp;
    this.player.facing = anchor.facing || 1;
    this.player.invuln = .6;
    this.clearInputs();
    this.particles = [];
    this.projectiles = [];
    this.crumble.clear();
    this.camera.x = clamp(this.player.x - VIEW_W * .4, 0, WORLD_W - VIEW_W);
    this.camera.y = WORLD_H - VIEW_H;

    if (!bound) {
      this.setHint('THE COLD LAMP COULD NOT HOLD YOU · bind it before crossing the mist.', 4);
      this.pushHud(true);
      return true;
    }

    objective.returnCount += 1;
    objective.lastReturnId = field.id;
    if (objective.witness?.reached && !objective.returnProven) {
      objective.returnProven = true;
      objective.returnProvenAt = this.totalTime;
      objective.phase = 'sanctum';
      objective.canopy.restored = true;
      for (const column of objective.lightColumns || []) column.lit = true;
      this.audio.play('gate');
      this.setHint('MIRA · You mapped the road Serath used. I kept your lamp because I knew you would return. · Follow the canopy west.', 6.5);
    } else {
      this.audio.play('relic');
      this.setHint('SANCTUM RECALL · the lamp kept this life and every truth already carried.', 4.2);
    }
    this.pushHud(true);
    return true;
  }

  checkSanctumReturnFields() {
    const objective = this.level.objective;
    if (objective?.type !== 'sanctum-lamp-restoration' || objective.complete) return false;
    const field = (objective.returnFields || []).find((item) => overlaps(this.player, item));
    return field ? this.returnToSanctum(field) : false;
  }

  updateSanctumObjective() {
    const objective = this.level.objective;
    if (objective?.type !== 'sanctum-lamp-restoration' || objective.complete) return;
    const centerTx = (this.player.x + this.player.w / 2) / TILE;
    const feetTy = (this.player.y + this.player.h) / TILE;
    const withinGroundedZone = (zone) => this.player.grounded
      && centerTx >= zone.minTx && centerTx <= zone.maxTx
      && Math.abs(feetTy - zone.feetTy) <= .08;

    if (objective.phase === 'outward' && objective.arch.gripJumpRecorded
      && withinGroundedZone(objective.arch.landing)) {
      this.openSanctumArch();
    }

    if (objective.phase === 'outward' && objective.arch.open
      && withinGroundedZone(objective.witness.zone)) {
      objective.witness.reached = true;
      objective.witness.reachedAt = this.totalTime;
      objective.phase = 'return';
      this.burst(objective.witness.tx * TILE, objective.witness.baseTy * TILE - 58, '#edcf78', 30, 160);
      this.audio.play('relic');
      this.setHint('AREN · This is my line into the Crown. · MIRA · Then carry the truth home through the tall veil.', 6);
      this.pushHud(true);
    }

    if (objective.phase !== 'sanctum' || !withinGroundedZone(objective.finalZone)) return;
    objective.complete = true;
    objective.restored = true;
    objective.phase = 'complete';
    objective.completedAt = this.totalTime;
    objective.canopy.restored = true;
    for (const column of objective.lightColumns || []) column.lit = true;
    this.openGate({ hint: objective.completionHint, holdSeconds: 6 });
    this.pushHud(true);
  }

  updateBellTowerObjective() {
    const objective = this.level.objective;
    if (objective?.type !== 'bell-tower-restoration' || objective.complete) return;
    const centerTx = (this.player.x + this.player.w / 2) / TILE;
    const feetTy = (this.player.y + this.player.h) / TILE;
    const withinLanding = (landing) => this.player.grounded
      && centerTx >= landing.minTx && centerTx <= landing.maxTx
      && Math.abs(feetTy - landing.feetTy) <= .08;

    if (objective.phase === 'learn'
      && objective.lesson.jumpRecorded
      && objective.gripSeconds >= objective.lesson.minGripSeconds
      && withinLanding(objective.lesson.landing)) {
      objective.lessonComplete = true;
      objective.phase = 'alternate';
      this.audio.play('relic');
      this.setHint("PILGRIM'S GRIP LEARNED · change walls when the stone ends.", 4.2);
      this.pushHud(true);
    }

    const required = objective.alternating.requiredJumpSides;
    if (objective.phase === 'alternate'
      && objective.wallJumps.length === required.length
      && required.every((side, index) => objective.wallJumps[index] === side)
      && withinLanding(objective.alternating.landing)) {
      objective.alternatingComplete = true;
      objective.phase = 'carve';
      this.setHint('MIRA · Pilgrims rang this bell when the road became unsafe. Find the cut rope.', 5);
      this.pushHud(true);
    } else if (objective.phase === 'alternate'
      && withinLanding(objective.alternating.landing)
      && !objective.alternating.retryHintShown) {
      objective.alternating.retryHintShown = true;
      this.setHint('THE STONE HEARD NO WALL CHANGE · press DOWN to return to the catches, then spring from both sides.', 4.5);
    }

    const exit = objective.masteryExit;
    if (objective.phase === 'collapse'
      && objective.memoryBrace?.revealed
      && centerTx >= exit.minCenterTx
      && feetTy <= exit.maxFeetTy) {
      objective.masteryReached = true;
      objective.phase = 'ring';
      this.setHint('AREN · The rope was cut from inside. Let it remember why it rang. · Press STRIKE.', 5.5);
      this.pushHud(true);
    }
  }

  strikePilgrimBell() {
    const objective = this.level.objective;
    if (objective?.type !== 'bell-tower-restoration' || objective.complete || objective.phase !== 'ring') return false;
    const bellX = objective.bell.tx * TILE;
    const bellY = objective.bell.baseTy * TILE;
    const playerX = this.player.x + this.player.w / 2;
    const playerY = this.player.y + this.player.h / 2;
    if (Math.hypot(playerX - bellX, playerY - bellY) > objective.bell.strikeRadius) {
      this.setHint('STAND BENEATH THE PILGRIM BELL · then press STRIKE.', 2.8);
      return true;
    }

    objective.complete = true;
    objective.restored = true;
    objective.phase = 'complete';
    objective.completedAt = this.totalTime;
    objective.bell.awakened = true;
    objective.bell.restored = true;
    objective.bell.ringStartedAt = this.totalTime;
    for (const section of objective.collapse?.sections || []) {
      section.state = 'restored';
      section.timer = 0;
    }
    for (const window of objective.lightWindows || []) window.lit = true;
    this.burst(bellX, bellY, '#8ce8ff', 42, 240);
    this.audio.play('gate');
    this.openGate({ hint: objective.completionHint, holdSeconds: 6 });
    this.pushHud(true);
    return true;
  }

  updateProcessionObjective() {
    const objective = this.level.objective;
    if (objective?.type !== 'procession-restoration' || objective.complete) return;
    const stations = objective.stations || [];
    const current = stations.find((item) => !item.observed);
    if (!current) return;
    const centerTx = (this.player.x + this.player.w / 2) / TILE;
    const feetTy = Math.round((this.player.y + this.player.h) / TILE);
    const zone = current.observeZone;
    const inZone = this.player.grounded && centerTx >= zone.minTx && centerTx <= zone.maxTx && feetTy === zone.feetTy;
    if (!inZone) return;
    if (current.requiresMemoryMark && !objective.memoryMark?.revealed) {
      this.setHint('THE BETRAYAL POSE IS BURIED · face the cyan seal on the recovery road and carve it.', 3.2);
      return;
    }

    current.observed = true;
    current.observedAt = this.totalTime;
    this.burst(current.tx * TILE, current.baseTy * TILE - 58, '#f3ce72', 22, 135);
    this.audio.play('relic');
    if (stations.every((item) => item.observed) && objective.memoryMark?.revealed) {
      objective.complete = true;
      objective.restored = true;
      objective.completedAt = this.totalTime;
      const chunks = this.bank.get(levelCacheKey(this.level));
      for (const restoration of objective.restorationTiles || []) {
        this.level.map[restoration.ty][restoration.tx] = restoration.tile;
        restampCell(this.level, chunks, restoration.tx, restoration.ty);
      }
      this.openGate({ hint: objective.completionHint, holdSeconds: 6 });
    } else {
      this.setHint(current.text, 5.2);
    }
    this.pushHud(true);
  }

  updateRelicsAndFlow() {
    const p = this.player;
    if (this.level.objective?.type === 'procession-restoration') this.updateProcessionObjective();
    if (this.level.objective?.type === 'timed-teeth-restoration') this.updateTimedTeethObjective();
    if (this.level.objective?.type === 'bell-tower-restoration') this.updateBellTowerObjective();
    if (this.level.objective?.type === 'sanctum-lamp-restoration') this.updateSanctumObjective();
    for (const relic of this.level.relics) {
      if (relic.collected) continue;
      const box = { x: relic.x - 22, y: relic.y - 24, w: 44, h: 48 };
      if (overlaps(p, box)) {
        relic.collected = true;
        this.burst(relic.x, relic.y, '#ffe486', 28, 220);
        this.audio.play('relic');
        const count = this.relicCount();
        this.setHint(count === 3
          ? `${relic.label || 'Final relic'} recovered · the Eclipse door is awake.`
          : `${relic.label || 'Relic'} recovered · ${3 - count} remain`);
        this.pushHud(true);
      }
    }

    for (const checkpoint of this.level.checkpoints) {
      if (!checkpoint.reached && p.x >= checkpoint.x) {
        checkpoint.reached = true;
        this.checkpoint = {
          kind: 'legacy',
          id: checkpoint.id || null,
          x: checkpoint.spawnX,
          y: checkpoint.spawnY,
          facing: checkpoint.facing || 1,
        };
        this.setHint(`${checkpoint.label} bound.`);
      }
    }

    if (overlaps(p, this.level.door)) {
      const status = this.objectiveStatus();
      const bossAlive = this.level.boss && this.level.boss.hp > 0;
      if (!this.isExitReady()) {
        if (!status.complete) {
          if (status.type === 'memory-carve') {
            this.setHint(`SEALED · restore ${status.target - status.current} memory-line${status.target - status.current === 1 ? '' : 's'}`);
          } else if (status.type === 'procession-restoration') {
            this.setHint('SEALED · the procession’s final testimony is still broken.');
          } else if (status.type === 'oathbind-restoration') {
            this.setHint(`SEALED · ${status.progressText.toLowerCase()}.`);
          } else if (status.type === 'timed-teeth-restoration') {
            this.setHint(`SEALED · ${status.progressText.toLowerCase()}.`);
          } else if (status.type === 'bell-tower-restoration') {
            this.setHint(`SEALED · ${status.progressText.toLowerCase()}.`);
          } else if (status.type === 'sanctum-lamp-restoration') {
            this.setHint(`SEALED · ${status.progressText.toLowerCase()}.`);
          } else if (status.type === 'parachute-choir-restoration') {
            this.setHint(`SEALED · ${status.target - status.current} authored voice${status.target - status.current === 1 ? '' : 's'} remain.`);
          } else if (status.type === 'veil-gate-restoration') {
            this.setHint(`SEALED · ${status.progressText.toLowerCase()}.`);
          } else if (status.type === 'warden-restoration') {
            this.setHint(`SEALED · ${status.progressText.toLowerCase()}.`);
          } else {
            this.setHint(`SEALED · need ${status.target - status.current} relic${status.current === 2 ? '' : 's'}`);
          }
        } else if (bossAlive) this.setHint('SEALED · the Veiled Guardian still stands');
      } else if (this.levelIndex < this.repository.length - 1) {
        if (this.transitionRetryBlocked || this.transitioning) return;
        const nextIndex = this.levelIndex + 1;
        if (!this.levelCompletionEmitted) {
          this.levelCompletionEmitted = true;
          this.callbacks.levelComplete?.({
            campaignId: this.repository.campaignId,
            sessionKind: this.repository.sessionKind,
            levelKey: this.level.levelKey || null,
            campaignOrder: this.level.campaignOrder || this.level.id,
            nextLevelKey: this.repository.keyAt?.(nextIndex) || null,
            abilityUnlockKey: this.level.abilityUnlock?.key || null,
            levelTime: this.levelTime,
            campaignTime: this.totalTime,
            deaths: this.deaths,
            realmKey: this.repository.entryAt?.(this.levelIndex)?.realmKey || null,
            realmComplete: false,
          });
        }
        this.audio.play('gate');
        void this.transitionToLevel(nextIndex);
      } else {
        if (!this.levelCompletionEmitted) {
          this.levelCompletionEmitted = true;
          this.callbacks.levelComplete?.({
            campaignId: this.repository.campaignId,
            sessionKind: this.repository.sessionKind,
            levelKey: this.level.levelKey || null,
            campaignOrder: this.level.campaignOrder || this.level.id,
            nextLevelKey: null,
            abilityUnlockKey: this.level.abilityUnlock?.key || null,
            levelTime: this.levelTime,
            campaignTime: this.totalTime,
            deaths: this.deaths,
            realmKey: this.repository.entryAt?.(this.levelIndex)?.realmKey || null,
            realmComplete: true,
          });
        }
        this.mode = 'win';
        this.audio.play('win');
        this.callbacks.win?.({
          time: this.totalTime,
          deaths: this.deaths,
          campaignId: this.repository.campaignId,
          sessionKind: this.repository.sessionKind,
          completedLevels: this.repository.length,
          targetTime: this.level.targetTime || null,
          levelKey: this.level.levelKey || null,
          campaignOrder: this.level.campaignOrder || this.level.id,
          objectiveType: this.level.objective?.type || 'relics',
        });
      }
    }
  }

  relicCount() {
    return this.level.relics.filter((relic) => relic.collected).length;
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  burst(x, y, color, count = 12, speed = 150) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * .3;
      const force = speed * (.35 + Math.random() * .75);
      const life = .35 + Math.random() * .55;
      this.particles.push({ x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force - 40, life, maxLife: life, size: 1.4 + Math.random() * 3.2, color });
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const horizontalLead = this.level.gameplay?.cameraHorizontalLead ?? 105;
    const targetX = clamp(p.x + p.w / 2 - VIEW_W / 2 + p.facing * horizontalLead, 0, WORLD_W - VIEW_W);
    let targetY = p.y + p.h / 2 - VIEW_H * .58;
    if (p.x > 80 * TILE) targetY -= 74;
    targetY = clamp(targetY, 0, WORLD_H - VIEW_H);
    const smoothing = 1 - Math.pow(.001, dt);
    this.camera.x += (targetX - this.camera.x) * smoothing;
    this.camera.y += (targetY - this.camera.y) * smoothing;
  }

  updateHints() {
    if (this.totalTime < this.hintHoldUntil) return;
    const tx = this.player.x / TILE;
    const block = this.level.block;
    const nearBlock = block && !block.disabled
      && Math.abs((this.player.x + this.player.w / 2) - (block.x + block.w / 2)) < 4.5 * TILE;
    const oathbind = this.level.objective?.type === 'oathbind-restoration'
      ? this.level.objective
      : null;
    const timedTeeth = this.level.objective?.type === 'timed-teeth-restoration'
      ? this.level.objective
      : null;
    const bellTower = this.level.objective?.type === 'bell-tower-restoration'
      ? this.level.objective
      : null;
    const sanctum = this.level.objective?.type === 'sanctum-lamp-restoration'
      ? this.level.objective
      : null;
    const parachuteChoir = this.level.objective?.type === 'parachute-choir-restoration'
      ? this.level.objective
      : null;
    const veilGate = this.level.objective?.type === 'veil-gate-restoration'
      ? this.level.objective
      : null;
    const warden = this.level.objective?.type === 'warden-restoration'
      ? this.level.objective
      : null;
    if (timedTeeth) {
      if (nearBlock && !block.bound) this.setHint(timedTeeth.phaseHints?.bind || this.level.mechanic);
      else this.setHint(timedTeeth.phaseHints?.[timedTeeth.phase] || this.level.mechanic);
    }
    else if (bellTower) this.setHint(bellTower.phaseHints?.[bellTower.phase] || this.level.mechanic);
    else if (sanctum) this.setHint(sanctum.phaseHints?.[sanctum.phase] || this.level.mechanic);
    else if (parachuteChoir) this.setHint(parachuteChoir.phaseHints?.[parachuteChoir.phase] || this.level.mechanic);
    else if (veilGate) this.setHint(veilGate.phaseHints?.[veilGate.phase] || this.level.mechanic);
    else if (warden) this.setHint(warden.phaseHints?.[warden.phase] || this.level.mechanic);
    else if (oathbind) {
      const phaseHint = oathbind.phaseHints?.[oathbind.phase] || this.level.mechanic;
      if (nearBlock && block.bound && oathbind.phase === 'learn') {
        this.setHint('WRONG SIGIL · stand beside the block and press DIG to release it');
      } else this.setHint(phaseHint);
    }
    else if (this.player.inWater) this.setHint('Tap jump to swim · hold Down to dive · currents change momentum');
    else if (this.level.veilPlatforms.length && tx > 42 && tx < 66) this.setHint('Veil bridges alternate every 2.6 seconds · move with the pulse');
    else if (this.level.gameplay?.introduceMechanic && tx < 9) this.setHint(this.level.mechanic);
    else if (this.level.gameplay?.tutorialCues?.some((cue) => tx > cue.minX && tx < cue.maxX)) {
      const cue = this.level.gameplay.tutorialCues.find((item) => tx > item.minX && tx < item.maxX);
      this.setHint(cue.text);
    }
    else if (nearBlock && !this.gateOpen) {
      const leftOfBlock = this.player.x + this.player.w / 2 < block.x + block.w / 2;
      this.setHint(leftOfBlock
        ? 'Hold RIGHT against the small rune block · push it onto the gold plate'
        : 'Move to the left side of the rune block, then hold RIGHT toward the gold plate');
    }
    else if (tx > 69 && this.soldiers.length) this.setHint('J / X strikes · soldiers take two hits');
  }

  setHint(text, holdSeconds = 0) {
    if (holdSeconds > 0) this.hintHoldUntil = Math.max(this.hintHoldUntil, this.totalTime + holdSeconds);
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.callbacks.hint?.(text);
  }

  pushHud(force = false) {
    if (force) this.hudClock = .1;
    const objective = this.objectiveStatus();
    this.callbacks.hud?.({
      hp: this.player.hp,
      maxHp: PHYSICS.MAX_HP,
      relics: this.relicCount(),
      time: this.totalTime,
      level: this.level.campaignOrder || this.level.id,
      levelName: this.level.name,
      objectiveLabel: objective.label,
      objectiveTitle: objective.title,
      objectiveCurrent: objective.current,
      objectiveTarget: objective.target,
      objectiveProgressText: objective.progressText || null,
      demo: this.demo,
      bossHp: this.level.boss?.active ? this.level.boss.hp : null,
      bossMaxHp: this.level.boss?.maxHp || null,
    });
  }

  updateBot(dt) {
    if (this.level.objective?.type === 'memory-carve' || this.level.relics.length === 0) return;
    const p = this.player;
    const relic1 = this.level.relics[0];
    const route = this.level.gameplay?.demoRelicOrder;
    const relic2 = route ? this.level.relics.find((relic) => relic.id === route[1]) : this.level.relics[1];
    const relic3 = route ? this.level.relics.find((relic) => relic.id === route[2]) : this.level.relics[2];
    let target;
    let repositionBlock = false;
    if (!relic1.collected) target = relic1;
    else if (!this.gateOpen) {
      const block = this.level.block;
      const stillLeftOfPlate = block.x + block.w / 2 < this.level.plate.x + 8;
      if (stillLeftOfPlate && p.x > block.x - p.w - 12) {
        target = { x: block.x - 72, y: block.y };
        repositionBlock = true;
      } else target = { x: this.level.plate.x + TILE, y: 25 * TILE };
    }
    else if (!relic3?.collected) target = relic3;
    else if (!relic2?.collected) target = relic2;
    else if (this.level.boss?.active && this.level.boss.hp > 0) target = this.level.boss;
    else target = this.level.door;

    for (const action of ['left', 'right', 'climb', 'down', 'jump', 'attack', 'dig']) this.input[action] = false;
    const dx = target.x - p.x;
    this.input.right = dx > 4;
    this.input.left = dx < -4;
    if (p.inWater && target.y > p.y + 12) this.input.down = true;

    const toward = dx >= 0 ? 1 : -1;
    const aheadX = Math.floor((p.x + p.w / 2 + toward * 34) / TILE);
    const feetY = Math.floor((p.y + p.h + 6) / TILE);
    const obstacle = this.isSolidTile(this.tileAt(aheadX, Math.floor((p.y + p.h / 2) / TILE)));
    const hazard = this.tileAt(aheadX, feetY) === Tile.SPIKE || this.tileAt(aheadX, feetY) === Tile.AIR;
    const targetAbove = target.y < p.y - 35;
    const atSandWall = this.tileAt(aheadX, Math.floor((p.y + 15) / TILE)) === Tile.SAND;
    this.input.climb = targetAbove && (atSandWall || p.wallSide !== 0);

    this.botPulse -= dt;
    const wantsDive = p.inWater && target.y > p.y + 12;
    const mustClearBlock = repositionBlock && Math.abs(p.x - this.level.block.x) < 115;
    if ((hazard || obstacle || mustClearBlock || (targetAbove && p.grounded)) && !wantsDive && this.botPulse <= 0) {
      this.input.jump = true;
      this.input.pressed.add('jump');
      this.botPulse = .48;
    } else if (this.botPulse < .32) this.input.jump = false;
    if (atSandWall && !targetAbove) {
      this.input.dig = true;
      if (p.digTimer <= 0) this.input.pressed.add('dig');
    }
    if (this.soldiers.some((soldier) => Math.abs(soldier.x - p.x) < 70 && Math.abs(soldier.y - p.y) < 65)) {
      this.input.attack = true;
      if (p.attackTimer <= 0) this.input.pressed.add('attack');
    }
    if (this.level.boss?.active && this.level.boss.hp > 0 && Math.abs(this.level.boss.x - p.x) < 86) {
      this.input.attack = true;
      if (p.attackTimer <= 0) this.input.pressed.add('attack');
    }
  }

  render(time) {
    const ctx = this.ctx;
    const backdrop = this.assets[this.level.backgroundKey] || this.assets.background;
    drawBackdrop(ctx, backdrop, this.camera, time, this.level);
    drawVisibleChunks(ctx, this.bank.get(levelCacheKey(this.level)), this.camera);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    // Objective restoration timestamps use simulation time, so mechanics must
    // render on the same clock. Backdrop, relic, and hero ambience remain on
    // the RAF clock below.
    drawLevelMechanics(ctx, this.level, this.totalTime, this.gateOpen);
    if (!this.level.block?.disabled) {
      drawBlockAndPlate(ctx, this.level.block, this.level.plate, this.gateOpen);
    }
    for (const relic of this.level.relics) drawRelic(ctx, relic, time);
    for (const ship of this.level.ships) drawShip(ctx, ship, time);
    for (const soldier of this.soldiers) drawSoldier(ctx, soldier, time);
    for (const projectile of this.projectiles) drawProjectile(ctx, projectile);
    drawBoss(ctx, this.level.boss, time);
    drawDoor(ctx, this.level.door, this.isExitReady(), time);
    drawParticles(ctx, this.particles);
    drawHero(ctx, this.player, time, this.assets.hero);
    ctx.restore();

    const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * .2, VIEW_W / 2, VIEW_H / 2, VIEW_W * .72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,2,10,.54)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
