import { describe, expect, it, vi } from 'vitest';
import { createProductionPreviewRepository } from '../../campaign/productionPreview.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine } from '../../engine.js';
import { createLevels } from '../../levels.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile } from '../constants.js';
import { createSandThatRemembers } from './sandThatRemembers.js';

const identity = {
  levelKey: 'outer-veil-02-sand-that-remembers',
  campaignOrder: 2,
};

function canvasChunks() {
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({}, {
    get: (_target, property) => (
      property === 'createLinearGradient' || property === 'createRadialGradient'
        ? () => gradient
        : vi.fn()
    ),
    set: () => true,
  });
  return Array.from({ length: 5 }, () => ({ getContext: () => context }));
}

function objectiveHarness(level) {
  const engine = {
    level,
    repository: { campaignId: 'production-preview-sand-that-remembers', sessionKind: 'production-preview', length: 1 },
    levelIndex: 0,
    bank: { get: () => canvasChunks() },
    player: { x: 0, y: 0, w: 28, h: 44, facing: 1, digTimer: 0 },
    gateOpen: false,
    particles: [],
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    revealMemoryMark: GameEngine.prototype.revealMemoryMark,
    openGate: GameEngine.prototype.openGate,
    tileAt: GameEngine.prototype.tileAt,
    totalTime: 0,
    deaths: 0,
  };
  return engine;
}

function runDeterministicRoute(template, includedMarkIds = template.objective.marks.map((mark) => mark.id)) {
  const level = cloneLevel(template);
  const engine = objectiveHarness(level);
  engine.mode = 'play';
  engine.player.hp = 4;
  for (const mark of level.objective.marks) {
    if (!includedMarkIds.includes(mark.id)) continue;
    engine.player.x = mark.tx * TILE - engine.player.w - 7;
    engine.player.y = mark.ty * TILE + 4;
    engine.player.facing = 1;
    GameEngine.prototype.dig.call(engine);
  }
  engine.totalTime = 96;
  engine.player.x = level.door.x;
  engine.player.y = level.door.y;
  GameEngine.prototype.updateRelicsAndFlow.call(engine);
  return {
    time: engine.totalTime,
    deaths: engine.deaths,
    hp: engine.player.hp,
    marks: level.objective.marks.filter((mark) => mark.revealed).map((mark) => mark.id),
    complete: engine.objectiveStatus().complete,
    gateOpen: engine.gateOpen,
    mode: engine.mode,
    winCalls: engine.callbacks.win.mock.calls,
  };
}

describe('Outer Veil Level 2 production preview', () => {
  it('authors a distinct quiet chapter with all three teaching roles', () => {
    const level = assertValidAuthoredLevel(createSandThatRemembers(), identity);
    expect(level.levelKey).toBe(identity.levelKey);
    expect(level.campaignOrder).toBe(2);
    expect(level.abilityUnlock.name).toBe('Memory Carve');
    expect(level.objective.marks.map((mark) => mark.role)).toEqual([
      'safe-lesson',
      'combination-test',
      'mastery-payoff',
    ]);
    expect(level.relics).toEqual([]);
    expect(level.ships).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.targetTime).toEqual({ parSeconds: 180, masterySeconds: 120 });
  });

  it('keeps its stable identity and mutable runtime outside the preserved prototypes', async () => {
    const prototypeNames = createLevels().map((level) => level.name);
    const repository = createProductionPreviewRepository('sand-that-remembers');
    expect(repository).toMatchObject({
      campaignId: 'production-preview-sand-that-remembers',
      sessionKind: 'production-preview',
      length: 1,
    });
    await repository.loadTemplate(0);
    const runtime = repository.createRuntime(0);
    runtime.objective.marks[0].revealed = true;
    expect(repository.peekTemplate(0).objective.marks[0].revealed).toBe(false);
    expect(createLevels().map((level) => level.name)).toEqual(prototypeNames);
    expect(createLevels()[1].name).toBe('The Inner Kingdom');
  });

  it('rejects duplicate, out-of-bounds, and non-sand memory marks plus unsafe restoration', () => {
    const broken = createSandThatRemembers();
    broken.objective.marks[1].tx = broken.objective.marks[0].tx;
    broken.objective.marks[1].ty = broken.objective.marks[0].ty;
    broken.objective.marks[2].tx = 999;
    broken.map[broken.objective.marks[0].ty][broken.objective.marks[0].tx] = Tile.STONE;
    broken.objective.restorationTiles[0] = { tx: 20, ty: 20, tile: Tile.GLOW };
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate_mark_cell',
      'invalid_mark_cell',
      'mark_not_sand',
      'unsafe_restoration',
    ]));
  });

  it('advances only authored marks, restores the road, opens the gate once, and resets cleanly', () => {
    const template = assertValidAuthoredLevel(createSandThatRemembers(), identity);
    const level = cloneLevel(template);
    const engine = objectiveHarness(level);
    const [first, second, third] = level.objective.marks;

    expect(engine.revealMemoryMark(20, 20)).toBe(false);
    expect(engine.revealMemoryMark(first.tx, first.ty)).toBe(true);
    expect(engine.revealMemoryMark(first.tx, first.ty)).toBe(false);
    expect(engine.objectiveStatus()).toMatchObject({ current: 1, target: 3, complete: false });
    engine.revealMemoryMark(second.tx, second.ty);
    engine.revealMemoryMark(third.tx, third.ty);

    expect(engine.objectiveStatus()).toMatchObject({ current: 3, complete: true });
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    expect(level.objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);

    const reset = cloneLevel(template);
    expect(reset.objective.complete).toBe(false);
    expect(reset.objective.marks.every((mark) => !mark.revealed)).toBe(true);
    expect(reset.objective.restorationTiles.every(({ tx, ty }) => reset.map[ty][tx] === Tile.STONE)).toBe(true);
    expect(reset.map.some((row) => row[reset.gateColumn] === Tile.GATE)).toBe(true);
  });

  it('uses the existing dig action to reveal the safe lesson mark', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createSandThatRemembers(), identity));
    const engine = objectiveHarness(level);
    const mark = level.objective.marks[0];
    engine.player.x = mark.tx * TILE - engine.player.w - 7;
    engine.player.y = 26 * TILE - engine.player.h;
    GameEngine.prototype.dig.call(engine);
    expect(level.map[mark.ty][mark.tx]).toBe(Tile.AIR);
    expect(mark.revealed).toBe(true);
    expect(engine.objectiveStatus().current).toBe(1);
  });

  it('reforms every objective tile and mark when life is over', () => {
    const template = assertValidAuthoredLevel(createSandThatRemembers(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.marks[0].revealed = true;
    runtime.objective.complete = true;
    runtime.map[runtime.objective.marks[0].ty][runtime.objective.marks[0].tx] = Tile.AIR;
    runtime.map[20][runtime.gateColumn] = Tile.AIR;
    const engine = {
      levelIndex: 0,
      level: runtime,
      repository: { createRuntime: vi.fn(() => cloneLevel(template)) },
      cancelLevelTransition: vi.fn(),
      loadLevel: vi.fn(),
      clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() },
      setHint: vi.fn(),
      pushHud: vi.fn(),
    };
    engine.loadLevel.mockImplementation(() => {
      engine.level = engine.repository.createRuntime(0);
      engine.gateOpen = false;
    });

    GameEngine.prototype.respawn.call(engine);

    expect(engine.level.objective.complete).toBe(false);
    expect(engine.level.objective.marks.every((mark) => !mark.revealed)).toBe(true);
    expect(engine.level.map[template.objective.marks[0].ty][template.objective.marks[0].tx]).toBe(Tile.SAND);
    expect(engine.level.map.some((row) => row[engine.level.gateColumn] === Tile.GATE)).toBe(true);
    expect(engine.mode).toBe('play');
  });

  it('repeats the authored objective flow and requires the combination mark', () => {
    const template = assertValidAuthoredLevel(createSandThatRemembers(), identity);
    const first = runDeterministicRoute(template);
    const second = runDeterministicRoute(template);
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      time: 96,
      deaths: 0,
      hp: 4,
      marks: ['first-line', 'broken-arc', 'maker-seal'],
      complete: true,
      gateOpen: true,
      mode: 'win',
    });
    const missingCombination = runDeterministicRoute(template, ['first-line', 'maker-seal']);
    expect(missingCombination).toMatchObject({ complete: false, gateOpen: false, mode: 'play' });
    expect(missingCombination.winCalls).toHaveLength(0);
  });
});
