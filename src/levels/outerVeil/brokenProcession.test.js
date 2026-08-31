import { describe, expect, it, vi } from 'vitest';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
  PRODUCTION_PREVIEW_KEYS,
} from '../../campaign/productionPreview.js';
import { assertValidAuthoredLevel, validateAuthoredLevel } from '../../campaign/levelSchema.js';
import { GameEngine } from '../../engine.js';
import { createLevels } from '../../levels.js';
import { cloneLevel } from '../cloneLevel.js';
import { TILE, Tile } from '../constants.js';
import { createBrokenProcession } from './brokenProcession.js';

const identity = {
  levelKey: 'outer-veil-03-broken-procession',
  campaignOrder: 3,
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

function engineHarness(level) {
  return {
    level,
    repository: { campaignId: 'production-preview-broken-procession', sessionKind: 'production-preview', length: 1 },
    levelIndex: 0,
    bank: { get: () => canvasChunks() },
    player: { x: 0, y: 0, w: 28, h: 44, facing: 1, digTimer: 0, hp: 4, grounded: true },
    input: { down: false, pressed: new Set() },
    gateOpen: false,
    particles: [],
    audio: { play: vi.fn() },
    callbacks: { hint: vi.fn(), hud: vi.fn(), gate: vi.fn(), win: vi.fn(), mode: vi.fn() },
    setHint: vi.fn(),
    pushHud: vi.fn(),
    burst: vi.fn(),
    relicCount: GameEngine.prototype.relicCount,
    objectiveStatus: GameEngine.prototype.objectiveStatus,
    isExitReady: GameEngine.prototype.isExitReady,
    revealMemoryMark: GameEngine.prototype.revealMemoryMark,
    updateProcessionObjective: GameEngine.prototype.updateProcessionObjective,
    openGate: GameEngine.prototype.openGate,
    tileAt: GameEngine.prototype.tileAt,
    totalTime: 0,
    deaths: 0,
    mode: 'play',
  };
}

function visitStation(engine, station) {
  const zone = station.observeZone;
  engine.player.x = ((zone.minTx + zone.maxTx) / 2) * TILE - engine.player.w / 2;
  engine.player.y = zone.feetTy * TILE - engine.player.h;
  engine.player.grounded = true;
  GameEngine.prototype.updateProcessionObjective.call(engine);
}

function carveBetrayal(engine) {
  const mark = engine.level.objective.memoryMark;
  engine.player.x = mark.tx * TILE - engine.player.w - 7;
  engine.player.y = mark.ty * TILE + 4;
  engine.player.facing = 1;
  GameEngine.prototype.dig.call(engine);
}

describe('Outer Veil Level 3 production preview', () => {
  it('authors five ordered, non-combat tableaux with one Memory Carve combination', () => {
    const level = assertValidAuthoredLevel(createBrokenProcession(), identity);
    expect(level.levelKey).toBe(identity.levelKey);
    expect(level.campaignOrder).toBe(3);
    expect(level.objective).toMatchObject({
      type: 'procession-restoration',
      requiresAbility: 'memory-carve',
      complete: false,
      restored: false,
    });
    expect(level.objective.stations).toHaveLength(5);
    expect(level.objective.stations.filter((item) => item.requiresMemoryMark)).toHaveLength(1);
    expect(level.relics).toEqual([]);
    expect(level.ships).toEqual([]);
    expect(level.gameplay.enemyRoster).toEqual([]);
    expect(level.targetTime).toEqual({ parSeconds: 210, masterySeconds: 135 });
  });

  it('keeps five fair recovery lanes and introduces no premature combat or spikes', () => {
    const level = createBrokenProcession();
    expect(level.map.flat().filter((tile) => tile === Tile.SAND)).toHaveLength(1);
    expect(level.map.flat()).not.toContain(Tile.SPIKE);
    for (const [start, end] of [[12, 23], [25, 36], [39, 53], [55, 68], [70, 82]]) {
      for (let tx = start; tx <= end; tx += 1) expect(level.map[27][tx]).toBe(Tile.STONE);
    }
    expect(level.door.y).toBe(22 * TILE);
  });

  it('gives each preview a unique route, stable identity, campaign ID, and ending copy', async () => {
    expect(PRODUCTION_PREVIEW_KEYS).toEqual([
      'sand-that-remembers',
      'broken-procession',
      'weight-of-oaths',
      'teeth-beneath-dust',
      'pilgrims-climb',
      'first-sanctum',
      'parachute-choir',
      'gate-of-the-veil',
      'warden-of-dust',
    ]);
    const level2 = createProductionPreviewRepository('sand-that-remembers');
    const level3 = createProductionPreviewRepository('broken-procession');
    await Promise.all([level2.loadTemplate(0), level3.loadTemplate(0)]);
    expect(level2.campaignId).toBe('production-preview-sand-that-remembers');
    expect(level3.campaignId).toBe('production-preview-broken-procession');
    expect(level2.keyAt(0)).toBe('outer-veil-02-sand-that-remembers');
    expect(level3.keyAt(0)).toBe('outer-veil-03-broken-procession');
    expect(getProductionPreviewDescriptor('broken-procession').completion.heading).toBe('The final witness stands');
    expect(createLevels()[2].name).toBe('The Sundered Aqueduct');
  });

  it('rejects aliased scenes, overlapping zones, unsafe carve data, and a broken monument', () => {
    const broken = createBrokenProcession();
    broken.objective.stations[1].id = broken.objective.stations[0].id;
    broken.objective.stations[1].observeZone.minTx = 22;
    broken.map[broken.objective.memoryMark.ty][broken.objective.memoryMark.tx] = Tile.AIR;
    broken.objective.finalMonument.tx = 999;
    broken.objective.restorationTiles[0] = { tx: 20, ty: 20, tile: Tile.GLOW };
    const result = validateAuthoredLevel(broken, identity);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate_station_id',
      'overlapping_observe_zone',
      'mark_not_sand',
      'invalid_final_monument',
      'unsafe_restoration',
    ]));
  });

  it('ignores future scenes and vetoes the carve until the earlier procession is read', () => {
    const level = cloneLevel(assertValidAuthoredLevel(createBrokenProcession(), identity));
    const engine = engineHarness(level);
    const [first, second] = level.objective.stations;
    const mark = level.objective.memoryMark;

    visitStation(engine, second);
    expect(engine.objectiveStatus().current).toBe(0);
    carveBetrayal(engine);
    expect(level.map[mark.ty][mark.tx]).toBe(Tile.SAND);
    expect(mark.revealed).toBe(false);

    visitStation(engine, first);
    visitStation(engine, second);
    carveBetrayal(engine);
    expect(level.map[mark.ty][mark.tx]).toBe(Tile.AIR);
    expect(mark.revealed).toBe(true);
    expect(engine.setHint).toHaveBeenLastCalledWith(
      expect.stringContaining("cross the blade's sightline to read Witness III"),
      5,
    );
    expect(engine.setHint.mock.calls.at(-1)[0]).not.toMatch(/DOWN|S$/);
    expect(engine.objectiveStatus()).toMatchObject({ current: 3, target: 6, complete: false });
  });

  it('restores the monument and gate exactly once after the complete ordered testimony', () => {
    const template = assertValidAuthoredLevel(createBrokenProcession(), identity);
    const level = cloneLevel(template);
    const engine = engineHarness(level);
    const [first, second, third, fourth, fifth] = level.objective.stations;

    visitStation(engine, first);
    visitStation(engine, second);
    carveBetrayal(engine);
    visitStation(engine, third);
    visitStation(engine, fourth);
    visitStation(engine, fifth);
    visitStation(engine, fifth);

    expect(engine.objectiveStatus()).toMatchObject({ current: 6, target: 6, complete: true });
    expect(level.objective.restored).toBe(true);
    expect(engine.gateOpen).toBe(true);
    expect(engine.callbacks.gate).toHaveBeenCalledOnce();
    expect(level.objective.restorationTiles.every(({ tx, ty }) => level.map[ty][tx] === Tile.GLOW)).toBe(true);

    engine.totalTime = 118;
    engine.player.x = level.door.x;
    engine.player.y = level.door.y;
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.mode).toBe('win');
    expect(engine.callbacks.win).toHaveBeenCalledOnce();
    expect(engine.callbacks.win).toHaveBeenCalledWith({
      time: 118,
      deaths: 0,
      campaignId: 'production-preview-broken-procession',
      sessionKind: 'production-preview',
      completedLevels: 1,
      targetTime: { parSeconds: 210, masterySeconds: 135 },
      levelKey: 'outer-veil-03-broken-procession',
      campaignOrder: 3,
      objectiveType: 'procession-restoration',
    });
  });

  it('deep-clones and fully reforms scene, carve, monument, road, and gate state after life ends', () => {
    const template = assertValidAuthoredLevel(createBrokenProcession(), identity);
    const runtime = cloneLevel(template);
    runtime.objective.stations[0].observed = true;
    runtime.objective.stations[0].observeZone.minTx = 0;
    runtime.objective.memoryMark.revealed = true;
    runtime.objective.complete = true;
    runtime.objective.restored = true;
    runtime.map[runtime.objective.memoryMark.ty][runtime.objective.memoryMark.tx] = Tile.AIR;
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

    expect(engine.level.objective.stations.every((item) => !item.observed)).toBe(true);
    expect(engine.level.objective.stations[0].observeZone.minTx).toBe(template.objective.stations[0].observeZone.minTx);
    expect(engine.level.objective.memoryMark.revealed).toBe(false);
    expect(engine.level.objective).toMatchObject({ complete: false, restored: false, completedAt: null });
    expect(engine.level.map[template.objective.memoryMark.ty][template.objective.memoryMark.tx]).toBe(Tile.SAND);
    expect(engine.level.map.some((row) => row[engine.level.gateColumn] === Tile.GATE)).toBe(true);
    expect(engine.mode).toBe('play');
  });
});
