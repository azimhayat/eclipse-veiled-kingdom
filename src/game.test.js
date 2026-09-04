import { describe, expect, it, vi } from 'vitest';
import { GameEngine, KEY_ACTIONS, PHYSICS } from './engine.js';
import { cloneLevel, TILE, Tile, WORLD_COLS, WORLD_ROWS, createLevels } from './levels.js';

describe('Eclipse of the Veiled Kingdom', () => {
  it('keeps the authored physics contract', () => {
    expect(PHYSICS).toMatchObject({
      RUN_SPEED: 320,
      AIR_SPEED: 290,
      WATER_SPEED: 197.2,
      GROUND_ACCEL: 3000,
      AIR_ACCEL: 1750,
      GROUND_FRICTION: 2600,
      AIR_DRAG: 480,
      JUMP_VEL: -850,
      JUMP_CUT_SPEED: -360,
      GRAVITY_UP: 1850,
      GRAVITY_DOWN: 3000,
      WATER_ACCEL: 1500,
      WATER_DRAG: 280,
      WATER_GRAVITY_UP: 1850,
      WATER_GRAVITY_DOWN: 3050,
      APEX_SPEED: 110,
      APEX_GRAVITY_SCALE: .82,
      TERMINAL: 1250,
      COYOTE: .11,
      JUMP_BUFFER: .13,
      CLIMB_SPEED: 170,
      WALL_SLIDE: 85,
      WALL_JUMP_X: 350,
      WALL_COYOTE: .08,
      WALL_REGRAB_DELAY: .12,
      WALL_JUMP_CONTROL_LOCK: .1,
      MAX_HP: 4,
    });
  });

  it('maps Space to jump, while W and Up both climb', () => {
    expect(KEY_ACTIONS.Space).toBe('jump');
    expect(KEY_ACTIONS.ArrowUp).toBe('climb');
    expect(KEY_ACTIONS.KeyW).toBe('climb');
  });

  it('keeps vertical and horizontal touch actions active together for diagonals', () => {
    const engine = {
      input: {
        left: false, right: false, climb: false, down: false,
        jump: false, attack: false, dig: false, attackIntent: null,
        pressed: new Set(), released: new Set(),
      },
    };
    GameEngine.prototype.setInput.call(engine, 'climb', true);
    GameEngine.prototype.setInput.call(engine, 'right', true);
    expect(engine.input).toMatchObject({ climb: true, right: true });
    expect(engine.input.pressed).toEqual(new Set(['climb', 'right']));

    GameEngine.prototype.setInput.call(engine, 'climb', false);
    expect(engine.input).toMatchObject({ climb: false, right: true });
    expect(engine.input.released).toEqual(new Set(['climb']));
  });

  it('does not consume game shortcuts while the player is typing a Chronicle name', () => {
    const engine = {
      mode: 'win',
      audio: { unlock: vi.fn() },
      callbacks: { pause: vi.fn() },
      input: { left: false, right: false, climb: false, down: false, jump: false, attack: false, dig: false, pressed: new Set(), released: new Set() },
    };
    const preventDefault = vi.fn();
    GameEngine.prototype.keyDown.call(engine, {
      code: 'KeyP',
      repeat: false,
      target: { tagName: 'INPUT', isContentEditable: false },
      preventDefault,
    });
    GameEngine.prototype.keyUp.call(engine, {
      code: 'Space',
      target: { tagName: 'INPUT', isContentEditable: false },
      preventDefault,
    });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(engine.audio.unlock).not.toHaveBeenCalled();
    expect(engine.callbacks.pause).not.toHaveBeenCalled();
  });

  it('clears every held action when focus is lost', () => {
    const engine = {
      input: {
        left: true, right: false, climb: true, down: true, jump: true, attack: true, dig: true,
        pressed: new Set(['left', 'attack']), released: new Set(['jump']),
      },
    };
    GameEngine.prototype.clearInputs.call(engine);
    expect(engine.input).toMatchObject({
      left: false, right: false, climb: false, down: false,
      jump: false, attack: false, dig: false,
    });
    expect(engine.input.pressed.size).toBe(0);
    expect(engine.input.released.size).toBe(0);
  });

  it('can hold and reveal a level silently without a menu sound', () => {
    const engine = {
      mode: 'play',
      audio: { play: vi.fn() },
      clearInputs: vi.fn(),
    };
    GameEngine.prototype.pause.call(engine, true, { silent: true });
    expect(engine.mode).toBe('paused');
    GameEngine.prototype.pause.call(engine, false, { silent: true });
    expect(engine.mode).toBe('play');
    expect(engine.audio.play).not.toHaveBeenCalled();
    expect(engine.clearInputs).toHaveBeenCalledTimes(2);
  });

  it('authors ten full 90 by 28 maps with three relics each', () => {
    const levels = createLevels();
    expect(levels).toHaveLength(10);
    for (const level of levels) {
      expect(level.map).toHaveLength(WORLD_ROWS);
      expect(level.map.every((row) => row.length === WORLD_COLS)).toBe(true);
      expect(level.relics).toHaveLength(3);
      expect(level.door.w).toBe(96);
      expect(level.door.h).toBe(160);
    }
  });

  it('gives the later campaign distinct mechanics and a final guardian', () => {
    const levels = createLevels();
    expect(levels[2].water.length).toBeGreaterThan(0);
    expect(levels[3].crushers.length).toBeGreaterThan(0);
    expect(levels[4].map.flat()).toContain(Tile.CRYSTAL);
    expect(levels[6].mirrors.length).toBeGreaterThan(0);
    expect(levels[7].veilPlatforms.length).toBeGreaterThan(0);
    expect(levels[9].boss).toMatchObject({ hp: 10, maxHp: 10 });
  });

  it('contains the required Outer Veil interaction chain', () => {
    const outer = createLevels()[0];
    expect(outer).toMatchObject({
      subtitle: 'Buried Dawn',
      backgroundKey: 'outerVeilBackground',
    });
    expect(outer.relics.map((relic) => relic.label)).toEqual([
      'Dawn Fragment',
      'Cartographer Seal',
      'Oath Shard',
    ]);
    expect(outer.map[26].slice(11, 14).every((tile) => tile === Tile.SPIKE)).toBe(true);
    expect(outer.map[21][16]).toBe(Tile.SAND);
    expect(outer.map[20][16]).toBe(Tile.ONEWAY);
    expect(outer.map[20][47]).toBe(Tile.GATE);
    expect(outer.map[24][54]).toBe(Tile.CRUMBLE);
    expect(outer.map[16][86]).toBe(Tile.GLOW);
  });

  it('starts pushing a block from a forgiving contact distance', () => {
    const player = { x: 956, y: 1204, w: 28, h: 44, vx: 120 };
    const block = { x: 1000, y: 1208, w: 40, h: 40 };
    const engine = {
      player,
      level: { block, plate: { x: 1200 } },
      demo: false,
      tileAt: () => Tile.AIR,
      isSolidTile: () => false,
      canMoveBlock: () => true,
    };

    GameEngine.prototype.movePlayerHorizontal.call(engine, 3);

    expect(block.x).toBe(1003);
    expect(player.x).toBe(975);
  });

  it('carries Aren with moving support and records launch velocity', () => {
    const level = cloneLevel(createLevels()[0]);
    const platform = { x: 10 * TILE, y: 5 * TILE, w: 4 * TILE, h: 18, dx: 3, dy: 2 };
    level.movers = [platform];
    const engine = Object.assign(Object.create(GameEngine.prototype), {
      level,
      demo: false,
      player: {
        x: platform.x + 20,
        y: platform.y - 44,
        w: 28,
        h: 44,
        vx: 0,
        vy: 0,
        groundPlatform: platform,
      },
    });

    const carried = GameEngine.prototype.carryPlayerWithPlatform.call(engine, 1 / 60);

    expect(engine.player).toMatchObject({
      x: platform.x + 23,
      y: platform.y - 42,
      platformVelocityX: 180,
      platformVelocityY: 120,
    });
    expect(carried).toMatchObject({ platform, velocityX: 180, velocityY: 120 });
  });

  it('eases camera lead through a rapid reversal instead of snapping on facing', () => {
    const level = cloneLevel(createLevels()[0]);
    const engine = Object.assign(Object.create(GameEngine.prototype), {
      level,
      player: {
        x: 20 * TILE,
        y: 18 * TILE,
        w: 28,
        h: 44,
        vx: -PHYSICS.RUN_SPEED,
        vy: 0,
        facing: -1,
        climbing: false,
      },
      camera: {
        x: 0,
        y: 0,
        focusX: 20 * TILE + 14,
        focusY: 18 * TILE + 22,
        lookAheadX: 105,
      },
    });

    GameEngine.prototype.updateCamera.call(engine, 1 / 60);
    expect(engine.camera.lookAheadX).toBeGreaterThan(80);
    for (let step = 0; step < 29; step += 1) GameEngine.prototype.updateCamera.call(engine, 1 / 60);
    expect(engine.camera.lookAheadX).toBeLessThan(-80);
  });

  it('rebuilds the current realm when the player respawns', () => {
    const template = createLevels()[6];
    const engine = {
      levelIndex: 6,
      level: cloneLevel(template),
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
      restartWardenDuelAttempt: GameEngine.prototype.restartWardenDuelAttempt,
      cancelLevelTransition: vi.fn(),
      loadLevel: vi.fn(),
      clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() },
      setHint: vi.fn(),
      pushHud: vi.fn(),
    };
    engine.level.relics[0].collected = true;
    engine.loadLevel.mockImplementation((index) => {
      engine.level = engine.repository.createRuntime(index);
    });

    GameEngine.prototype.respawn.call(engine);

    expect(engine.level.relics.every((relic) => !relic.collected)).toBe(true);
    expect(engine.cancelLevelTransition).toHaveBeenCalledOnce();
    expect(engine.loadLevel).toHaveBeenCalledWith(6, true);
    expect(engine.mode).toBe('play');
  });
});
