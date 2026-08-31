import { describe, expect, it, vi } from 'vitest';
import { GameEngine, KEY_ACTIONS, PHYSICS } from './engine.js';
import { cloneLevel, Tile, WORLD_COLS, WORLD_ROWS, createLevels } from './levels.js';

describe('Eclipse of the Veiled Kingdom', () => {
  it('keeps the authored physics contract', () => {
    expect(PHYSICS).toMatchObject({
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
  });

  it('maps Space to jump, while W and Up both climb', () => {
    expect(KEY_ACTIONS.Space).toBe('jump');
    expect(KEY_ACTIONS.ArrowUp).toBe('climb');
    expect(KEY_ACTIONS.KeyW).toBe('climb');
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

  it('rebuilds the current realm when the player respawns', () => {
    const template = createLevels()[6];
    const engine = {
      levelIndex: 6,
      level: cloneLevel(template),
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
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
