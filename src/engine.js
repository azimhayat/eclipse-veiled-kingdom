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
  cloneLevel,
  createLevels,
} from './levels.js';
import {
  bakeLevel,
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
  constructor(canvas, assets, initialLevels, chunkBank, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.callbacks = callbacks;
    this.audio = new AudioManager();
    this.levels = initialLevels.map(cloneLevel);
    this.bank = new Map();
    for (const level of this.levels) this.bank.set(level.id, chunkBank.get(level.id));
    this.levelIndex = 0;
    this.level = this.levels[0];
    this.mode = 'title';
    this.demo = false;
    this.running = true;
    this.totalTime = 0;
    this.deaths = 0;
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
    this.checkpoint = { ...this.level.spawn };
    this.gateOpen = false;
    this.spawnClock = 0;
    this.hudClock = 0;
    this.lastHint = '';
    this.botPulse = 0;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.animationId = 0;

    this.keyDown = this.keyDown.bind(this);
    this.keyUp = this.keyUp.bind(this);
    window.addEventListener('keydown', this.keyDown, { passive: false });
    window.addEventListener('keyup', this.keyUp, { passive: false });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    this.loop = this.loop.bind(this);
    this.animationId = requestAnimationFrame(this.loop);
    this.publishDebugApi();
    this.setHint('Move with A / D · Jump with SPACE or ↑');
  }

  makePlayer(spawn) {
    return {
      x: spawn.x, y: spawn.y, w: 28, h: 44,
      vx: 0, vy: 0, facing: 1,
      grounded: false, wallSide: 0, climbing: false,
      hp: PHYSICS.MAX_HP, invuln: 0,
      coyote: 0, jumpBuffer: 0, dropTimer: 0,
      attackTimer: 0, digTimer: 0, attackHits: new Set(), inWater: false,
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
    return {
      mode: this.mode,
      level: this.level.id,
      levelName: this.level.name,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, grounded: this.player.grounded },
      relics: this.level.relics.filter((relic) => relic.collected).map((relic) => relic.id),
      gateOpen: this.gateOpen,
      deaths: this.deaths,
      soldiers: this.soldiers.length,
      time: this.totalTime,
    };
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    if (window.__EOTVK__?.engine === this) delete window.__EOTVK__;
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

  resetCampaign() {
    const templates = createLevels();
    this.levels = templates.map(cloneLevel);
    this.bank = new Map(this.levels.map((level) => [level.id, bakeLevel(level)]));
    this.levelIndex = 0;
    this.totalTime = 0;
    this.deaths = 0;
    this.loadLevel(0, true);
  }

  start(demo = false) {
    if (this.mode === 'win' || this.mode === 'dead' || this.level.id !== 1 || this.totalTime > 0) this.resetCampaign();
    this.demo = demo;
    this.mode = 'play';
    this.clearInputs();
    this.callbacks.mode?.('play');
    this.callbacks.level?.(this.level.id, this.level.name);
    this.pushHud(true);
  }

  pause(paused) {
    if (this.mode === 'dead' || this.mode === 'win' || this.mode === 'title') return;
    this.mode = paused ? 'paused' : 'play';
    this.clearInputs();
  }

  loadLevel(index, reset = false) {
    this.levelIndex = index;
    this.level = this.levels[index];
    if (!this.bank.has(this.level.id) || reset) this.bank.set(this.level.id, bakeLevel(this.level));
    this.player = this.makePlayer(this.level.spawn);
    this.checkpoint = { ...this.level.spawn };
    this.camera.x = clamp(this.player.x - VIEW_W * .4, 0, WORLD_W - VIEW_W);
    this.camera.y = WORLD_H - VIEW_H;
    this.soldiers = [];
    this.projectiles = [];
    this.particles = [];
    this.crumble.clear();
    this.gateOpen = !this.level.map.some((row) => row[this.level.gateColumn] === Tile.GATE);
    this.spawnClock = 0;
    this.setHint(this.level.id === 1 ? 'Move with A / D · Jump with SPACE or ↑' : (this.level.mechanic || 'The inner paths demand every skill.'));
    this.callbacks.level?.(this.level.id, this.level.name);
    this.pushHud(true);
  }

  respawn() {
    const currentIndex = this.levelIndex;
    this.levels[currentIndex] = cloneLevel(createLevels()[currentIndex]);
    this.loadLevel(currentIndex, true);
    this.mode = 'play';
    this.clearInputs();
    this.callbacks.mode?.('play');
    this.setHint('The realm reforms. Begin the level anew.');
    this.pushHud(true);
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

  updateLevelMechanics() {
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

  update(dt) {
    this.totalTime += dt;
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
    p.digTimer = Math.max(0, p.digTimer - dt);
    p.jumpBuffer = this.input.pressed.has('jump') ? PHYSICS.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? PHYSICS.COYOTE : Math.max(0, p.coyote - dt);
    if (this.input.pressed.has('down')) p.dropTimer = .2;

    if (this.input.pressed.has('attack') && p.attackTimer <= 0) {
      p.attackTimer = .32;
      p.attackHits.clear();
      this.audio.play('attack');
    }
    if (this.input.pressed.has('dig') && p.digTimer <= 0) this.dig();

    p.inWater = this.level.water.some((zone) => overlaps(p, zone));
    const move = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (move) p.facing = move;
    const touchingLeft = this.solidProbe(p.x - 3, p.y + 4, 3, p.h - 7);
    const touchingRight = this.solidProbe(p.x + p.w, p.y + 4, 3, p.h - 7);
    p.wallSide = touchingRight ? 1 : touchingLeft ? -1 : 0;

    const intoWall = p.wallSide && move === p.wallSide;
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
    }

    const plate = this.level.plate;
    const onPlate = b.x + b.w > plate.x + 8 && b.x < plate.x + plate.w - 8 && Math.abs((b.y + b.h) - (plate.y + plate.h)) < 14;
    if (onPlate && !this.gateOpen) this.openGate();
  }

  openGate() {
    this.gateOpen = true;
    const column = this.level.gateColumn;
    const chunks = this.bank.get(this.level.id);
    for (let ty = 0; ty < WORLD_ROWS; ty += 1) {
      if (this.level.map[ty][column] === Tile.GATE) {
        this.level.map[ty][column] = Tile.AIR;
        restampCell(this.level, chunks, column, ty);
      }
    }
    this.burst(column * TILE + TILE / 2, 21 * TILE, '#e8c56a', 26, 150);
    this.audio.play('gate');
    this.setHint('The gate answers the plate.');
    this.callbacks.gate?.();
  }

  dig() {
    const p = this.player;
    const probeX = p.facing > 0 ? p.x + p.w + 7 : p.x - 7;
    const tx = Math.floor(probeX / TILE);
    const rows = [Math.floor((p.y + p.h * .35) / TILE), Math.floor((p.y + p.h * .75) / TILE)];
    const ty = rows.find((row) => this.tileAt(tx, row) === Tile.SAND);
    if (ty === undefined) {
      this.setHint('Face a sand wall to dig.');
      return;
    }
    this.level.map[ty][tx] = Tile.AIR;
    restampCell(this.level, this.bank.get(this.level.id), tx, ty);
    p.digTimer = .22;
    this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#d69a54', 18, 190);
    this.audio.play('dig');
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
          restampCell(this.level, this.bank.get(this.level.id), state.tx, state.ty);
          this.burst(state.tx * TILE + TILE / 2, state.ty * TILE + 10, '#c98448', 10, 120);
        }
      } else {
        state.timer -= dt;
        if (state.timer <= 0) {
          this.level.map[state.ty][state.tx] = state.tile;
          restampCell(this.level, this.bank.get(this.level.id), state.tx, state.ty);
          this.crumble.delete(key);
        }
      }
    }
  }

  checkHazards() {
    const p = this.player;
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
      p.attackHits.add(soldier.id);
      soldier.hp -= 1;
      soldier.vx = p.facing * 260;
      this.burst(soldier.x + soldier.w / 2, soldier.y + 20, '#f1bf57', 11, 180);
      this.audio.play('hit');
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

  updateSoldiers(dt) {
    const inArena = this.player.x > (this.level.arenaStart ?? 68) * TILE;
    if (inArena && this.level.ships.length) {
      this.spawnClock += dt;
      const spawnEvery = this.level.spawnEvery ?? 2.4;
      const maxEnemies = this.level.maxEnemies ?? 7;
      if (this.spawnClock >= spawnEvery && this.soldiers.length < maxEnemies) {
        this.spawnClock = 0;
        const ship = this.level.ships[Math.floor(this.totalTime / spawnEvery) % this.level.ships.length];
        const kinds = this.level.id >= 6 ? ['shield', 'spear', 'archer'] : ['grunt'];
        const kind = kinds[Math.floor(this.totalTime / spawnEvery) % kinds.length];
        this.soldiers.push({
          id: `${this.level.id}-${this.totalTime.toFixed(3)}`,
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

  updateRelicsAndFlow() {
    const p = this.player;
    for (const relic of this.level.relics) {
      if (relic.collected) continue;
      const box = { x: relic.x - 22, y: relic.y - 24, w: 44, h: 48 };
      if (overlaps(p, box)) {
        relic.collected = true;
        this.burst(relic.x, relic.y, '#ffe486', 28, 220);
        this.audio.play('relic');
        const count = this.relicCount();
        this.setHint(count === 3 ? 'The Eclipse door is awake.' : `Relic awakened · ${3 - count} remain`);
        this.pushHud(true);
      }
    }

    for (const checkpoint of this.level.checkpoints) {
      if (!checkpoint.reached && p.x >= checkpoint.x) {
        checkpoint.reached = true;
        this.checkpoint = { x: checkpoint.spawnX, y: checkpoint.spawnY };
        this.setHint(`${checkpoint.label} bound.`);
      }
    }

    if (overlaps(p, this.level.door)) {
      const bossAlive = this.level.boss && this.level.boss.hp > 0;
      if (this.relicCount() < 3 || bossAlive) {
        if (this.relicCount() < 3) this.setHint(`SEALED · need ${3 - this.relicCount()} relic${this.relicCount() === 2 ? '' : 's'}`);
        else this.setHint('SEALED · the Veiled Guardian still stands');
      } else if (this.levelIndex < this.levels.length - 1) {
        this.audio.play('gate');
        const nextIndex = this.levelIndex + 1;
        const nextLevel = this.levels[nextIndex];
        this.loadLevel(nextIndex);
        this.callbacks.transition?.(nextLevel.id, nextLevel.name);
      } else {
        this.mode = 'win';
        this.audio.play('win');
        this.callbacks.win?.({ time: this.totalTime, deaths: this.deaths });
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
    const targetX = clamp(p.x + p.w / 2 - VIEW_W / 2 + p.facing * 105, 0, WORLD_W - VIEW_W);
    let targetY = p.y + p.h / 2 - VIEW_H * .58;
    if (p.x > 80 * TILE) targetY -= 74;
    targetY = clamp(targetY, 0, WORLD_H - VIEW_H);
    const smoothing = 1 - Math.pow(.001, dt);
    this.camera.x += (targetX - this.camera.x) * smoothing;
    this.camera.y += (targetY - this.camera.y) * smoothing;
  }

  updateHints() {
    const tx = this.player.x / TILE;
    const block = this.level.block;
    const nearBlock = Math.abs((this.player.x + this.player.w / 2) - (block.x + block.w / 2)) < 4.5 * TILE;
    if (this.player.inWater) this.setHint('Tap jump to swim · hold Down to dive · currents change momentum');
    else if (this.level.veilPlatforms.length && tx > 42 && tx < 66) this.setHint('Veil bridges alternate every 2.6 seconds · move with the pulse');
    else if (this.level.id >= 3 && tx < 9) this.setHint(this.level.mechanic);
    else if (this.level.id === 1 && tx > 9 && tx < 14) this.setHint('Hold jump for height · release for a short hop');
    else if (this.level.id === 1 && tx > 14 && tx < 23) this.setHint('Hold W + toward the sand wall to climb · K / Shift digs');
    else if (nearBlock && !this.gateOpen) this.setHint('Hold RIGHT against the small rune block · push it onto the gold plate');
    else if (this.level.id <= 2 && tx > 52 && tx < 69) this.setHint('Crumble ledges fall after 0.45s · do not stop');
    else if (tx > 69 && this.soldiers.length) this.setHint('J / X strikes · soldiers take two hits');
  }

  setHint(text) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.callbacks.hint?.(text);
  }

  pushHud(force = false) {
    if (force) this.hudClock = .1;
    this.callbacks.hud?.({
      hp: this.player.hp,
      maxHp: PHYSICS.MAX_HP,
      relics: this.relicCount(),
      time: this.totalTime,
      level: this.level.id,
      levelName: this.level.name,
      demo: this.demo,
      bossHp: this.level.boss?.active ? this.level.boss.hp : null,
      bossMaxHp: this.level.boss?.maxHp || null,
    });
  }

  updateBot(dt) {
    const p = this.player;
    const relic1 = this.level.relics[0];
    const relic2 = this.level.id === 1 ? this.level.relics.find((r) => r.id === 'high-stair') : this.level.relics[1];
    const relic3 = this.level.id === 1 ? this.level.relics.find((r) => r.id === 'arena-floor') : this.level.relics[2];
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
    drawBackdrop(ctx, this.assets.background, this.camera, time, this.level);
    drawVisibleChunks(ctx, this.bank.get(this.level.id), this.camera);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    drawLevelMechanics(ctx, this.level, time, this.gateOpen);
    drawBlockAndPlate(ctx, this.level.block, this.level.plate, this.gateOpen);
    for (const relic of this.level.relics) drawRelic(ctx, relic, time);
    for (const ship of this.level.ships) drawShip(ctx, ship, time);
    for (const soldier of this.soldiers) drawSoldier(ctx, soldier, time);
    for (const projectile of this.projectiles) drawProjectile(ctx, projectile);
    drawBoss(ctx, this.level.boss, time);
    drawDoor(ctx, this.level.door, this.relicCount() === 3 && (!this.level.boss || this.level.boss.hp <= 0), time);
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
