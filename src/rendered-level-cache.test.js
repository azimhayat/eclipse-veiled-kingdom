import { describe, expect, it, vi } from 'vitest';
import {
  RenderedLevelCache,
  ensureRenderedLevelWindow,
  getLevelWindow,
  releaseRenderedLevel,
} from './rendered-level-cache.js';

function canvasChunk(name) {
  return {
    name,
    width: 960,
    height: 1344,
    getContext: vi.fn(),
  };
}

describe('RenderedLevelCache', () => {
  it('keeps at most three levels and evicts the least recently used one', () => {
    const chunks = [1, 2, 3, 4].map((id) => canvasChunk(`level-${id}`));
    const cache = new RenderedLevelCache();
    cache.set(1, [chunks[0]]);
    cache.set(2, [chunks[1]]);
    cache.set(3, [chunks[2]]);

    cache.get(1);
    cache.set(4, [chunks[3]]);

    expect([...cache.keys()]).toEqual([1, 3, 4]);
    expect(cache.size).toBe(3);
    expect(chunks[1]).toMatchObject({ width: 0, height: 0 });
    expect(chunks[0]).toMatchObject({ width: 960, height: 1344 });
  });

  it('retains an explicit campaign window and releases levels outside it', () => {
    const chunks = [1, 2, 3].map((id) => canvasChunk(`level-${id}`));
    const cache = new RenderedLevelCache({
      entries: chunks.map((chunk, index) => [index + 1, [chunk]]),
    });

    cache.retain([2, 3]);

    expect([...cache.keys()]).toEqual([2, 3]);
    expect(chunks[0]).toMatchObject({ width: 0, height: 0 });
    expect(chunks[1]).toMatchObject({ width: 960, height: 1344 });
    expect(() => cache.retain([1, 2, 3, 4])).toThrow(RangeError);
  });

  it('releases replaced and cleared resources exactly once', () => {
    const release = vi.fn();
    const cache = new RenderedLevelCache({ release });
    const first = [canvasChunk('first')];
    const replacement = [canvasChunk('replacement')];
    const second = [canvasChunk('second')];

    cache.set(1, first);
    cache.set(1, first);
    cache.set(1, replacement);
    cache.set(2, second);
    cache.clear();

    expect(release.mock.calls).toEqual([[first], [replacement], [second]]);
    expect(cache.size).toBe(0);
  });

  it('closes closeable resources and clears canvas backing buffers', () => {
    const canvas = canvasChunk('canvas');
    const bitmap = { close: vi.fn() };

    releaseRenderedLevel([canvas, bitmap, canvas]);

    expect(canvas).toMatchObject({ width: 0, height: 0 });
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});

describe('rendered level window', () => {
  const levels = [1, 2, 3, 4, 5].map((id) => ({ id }));

  it('selects previous, current, and next levels at campaign boundaries', () => {
    expect(getLevelWindow(levels, 0).map((level) => level.id)).toEqual([1, 2]);
    expect(getLevelWindow(levels, 2).map((level) => level.id)).toEqual([2, 3, 4]);
    expect(getLevelWindow(levels, 4).map((level) => level.id)).toEqual([4, 5]);
    expect(() => getLevelWindow(levels, 5)).toThrow(RangeError);
  });

  it('bakes only missing window entries and releases the level left behind', () => {
    const rendered = new Map();
    const renderLevel = vi.fn((level) => {
      const chunks = [canvasChunk(`level-${level.id}`)];
      rendered.set(level.id, chunks);
      return chunks;
    });
    const cache = new RenderedLevelCache();

    ensureRenderedLevelWindow(cache, levels, 0, renderLevel);
    ensureRenderedLevelWindow(cache, levels, 1, renderLevel);
    ensureRenderedLevelWindow(cache, levels, 2, renderLevel);

    expect(renderLevel.mock.calls.map(([level]) => level.id)).toEqual([1, 2, 3, 4]);
    expect([...cache.keys()]).toEqual([2, 3, 4]);
    expect(rendered.get(1)[0]).toMatchObject({ width: 0, height: 0 });
    expect(rendered.get(2)[0]).toMatchObject({ width: 960, height: 1344 });
  });
});
