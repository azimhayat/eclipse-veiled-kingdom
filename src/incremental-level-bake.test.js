import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from './engine.js';
import { CHUNK_COUNT, Tile, WORLD_COLS, WORLD_ROWS } from './levels.js';
import { bakeLevelIncrementally } from './render.js';
import { RenderedLevelCache } from './rendered-level-cache.js';

function emptyLevel(id) {
  return {
    id,
    map: Array.from({ length: WORLD_ROWS }, () => Array(WORLD_COLS).fill(Tile.AIR)),
  };
}

function installCanvasDocument() {
  const canvases = [];
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ imageSmoothingEnabled: true })),
      };
      canvases.push(canvas);
      return canvas;
    }),
  });
  return canvases;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('incremental level baking', () => {
  it('yields before painting every chunk', async () => {
    const canvases = installCanvasDocument();
    const yielded = [];
    const pending = bakeLevelIncrementally(emptyLevel(1), {
      yieldControl: async ({ chunkIndex }) => { yielded.push(chunkIndex); },
    });

    expect(canvases).toHaveLength(0);
    const chunks = await pending;

    expect(yielded).toEqual(Array.from({ length: CHUNK_COUNT }, (_, index) => index));
    expect(chunks).toHaveLength(CHUNK_COUNT);
    expect(canvases).toHaveLength(CHUNK_COUNT);
  });

  it('releases partial canvases when cancellation arrives between chunks', async () => {
    const canvases = installCanvasDocument();
    const controller = new AbortController();
    const chunks = await bakeLevelIncrementally(emptyLevel(2), {
      signal: controller.signal,
      yieldControl: async ({ chunkIndex }) => {
        if (chunkIndex === 1) controller.abort();
      },
    });

    expect(chunks).toBeNull();
    expect(canvases).toHaveLength(1);
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('prefetches across frames and aborts partial work without populating the bank', async () => {
    const canvases = installCanvasDocument();
    const frameCallbacks = new Map();
    let nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => frameCallbacks.delete(id)));

    let idleCallback;
    vi.stubGlobal('window', {
      requestIdleCallback: vi.fn((callback) => {
        idleCallback = callback;
        return 17;
      }),
      cancelIdleCallback: vi.fn(),
      setTimeout,
      clearTimeout,
    });

    const currentChunk = {
      width: 960,
      height: 1344,
      getContext: vi.fn(),
    };
    const levels = [emptyLevel(1), emptyLevel(2)];
    const engine = {
      running: true,
      levelIndex: 0,
      repository: {
        length: levels.length,
        retainAround: vi.fn(),
        keyAt: (index) => levels[index].id,
        windowKeys: () => levels.map((level) => level.id),
        has: () => true,
        loadTemplate: vi.fn(async (index) => levels[index]),
        createRuntime: (index) => levels[index],
      },
      bank: new RenderedLevelCache({ entries: [[1, [currentChunk]]] }),
      prefetchHandle: null,
      prefetchGeneration: 0,
      prefetchController: null,
      prefetchTargetIndex: null,
      prefetchPromise: null,
      prefetchStart: null,
      cancelLevelPrefetch: GameEngine.prototype.cancelLevelPrefetch,
      prepareAuthoredLevel: GameEngine.prototype.prepareAuthoredLevel,
    };

    GameEngine.prototype.scheduleNextLevel.call(engine);
    const pending = idleCallback();
    expect(canvases).toHaveLength(0);
    await Promise.resolve();
    await Promise.resolve();

    const firstFrame = frameCallbacks.entries().next().value;
    frameCallbacks.delete(firstFrame[0]);
    firstFrame[1]();
    await Promise.resolve();
    expect(canvases).toHaveLength(1);

    GameEngine.prototype.cancelLevelPrefetch.call(engine);
    await pending;

    expect(engine.bank.has(2)).toBe(false);
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
    expect(engine.prefetchController).toBeNull();

    GameEngine.prototype.scheduleNextLevel.call(engine);
    const completed = idleCallback();
    expect(canvases).toHaveLength(1);
    await Promise.resolve();
    await Promise.resolve();
    for (let index = 0; index < CHUNK_COUNT; index += 1) {
      const frame = frameCallbacks.entries().next().value;
      frameCallbacks.delete(frame[0]);
      frame[1]();
      await Promise.resolve();
    }
    await completed;

    expect(engine.bank.get(2)).toHaveLength(CHUNK_COUNT);
    expect(canvases).toHaveLength(CHUNK_COUNT + 1);
    expect(engine.bank.size).toBe(2);
    expect(engine.repository.retainAround).toHaveBeenLastCalledWith(1);
  });
});
