import { describe, expect, it, vi } from 'vitest';
import { AuthoredLevelRepository } from './AuthoredLevelRepository.js';

const catalog = [
  { levelKey: 'first' },
  { levelKey: 'second' },
  { levelKey: 'third' },
  { levelKey: 'fourth' },
];

const makeLevel = (key) => ({
  levelKey: key,
  map: [[0]],
  relics: [], block: {}, plate: {}, door: {}, ships: [], checkpoints: [],
});

describe('AuthoredLevelRepository', () => {
  it('loads only requested modules and deduplicates concurrent requests', async () => {
    const loadLevel = vi.fn(async (key) => makeLevel(key));
    const repository = new AuthoredLevelRepository({ catalog, loadLevel, decorate: (level) => level });
    const [first, duplicate] = await Promise.all([repository.loadTemplate(1), repository.loadTemplate(1)]);
    expect(first).toBe(duplicate);
    expect(loadLevel).toHaveBeenCalledTimes(1);
    expect(loadLevel).toHaveBeenCalledWith('second');
    expect(repository.has(0)).toBe(false);
  });

  it('does not cache failed imports and permits an explicit retry', async () => {
    const loadLevel = vi.fn()
      .mockRejectedValueOnce(new Error('missing chunk'))
      .mockResolvedValueOnce(makeLevel('first'));
    const repository = new AuthoredLevelRepository({ catalog, loadLevel, decorate: (level) => level });
    await expect(repository.loadTemplate(0)).rejects.toThrow('missing chunk');
    await expect(repository.loadTemplate(0)).resolves.toMatchObject({ levelKey: 'first' });
    expect(loadLevel).toHaveBeenCalledTimes(2);
  });

  it('creates fresh mutable runtimes while keeping templates pristine', async () => {
    const repository = new AuthoredLevelRepository({
      catalog,
      loadLevel: async (key) => makeLevel(key),
      decorate: (level) => level,
    });
    await repository.loadTemplate(0);
    const first = repository.createRuntime(0);
    const second = repository.createRuntime(0);
    first.map[0][0] = 7;
    expect(second.map[0][0]).toBe(0);
    expect(repository.peekTemplate(0).map[0][0]).toBe(0);
  });

  it('retains the first, current, and next templates only', async () => {
    const repository = new AuthoredLevelRepository({
      catalog,
      loadLevel: async (key) => makeLevel(key),
      decorate: (level) => level,
    });
    await Promise.all(catalog.map((_, index) => repository.loadTemplate(index)));
    repository.retainAround(2);
    expect([...repository.templates.keys()]).toEqual(['first', 'third', 'fourth']);
    expect(repository.windowKeys(2)).toEqual(['second', 'third', 'fourth']);
  });

  it('keeps the playable template while an adjacent destination is prepared', async () => {
    const repository = new AuthoredLevelRepository({
      catalog,
      loadLevel: async (key) => makeLevel(key),
      decorate: (level) => level,
    });
    await Promise.all(catalog.slice(0, 3).map((_, index) => repository.loadTemplate(index)));
    repository.retainForTransition(1, 2);
    expect([...repository.templates.keys()]).toEqual(['first', 'second', 'third']);
  });

  it('does not let a stale in-flight import repopulate an evicted window', async () => {
    let resolveFourth;
    const repository = new AuthoredLevelRepository({
      catalog,
      loadLevel: (key) => key === 'fourth'
        ? new Promise((resolve) => { resolveFourth = resolve; })
        : Promise.resolve(makeLevel(key)),
      decorate: (level) => level,
    });
    repository.retainAround(2);
    const pending = repository.loadTemplate(3);
    repository.retainAround(1);
    resolveFourth(makeLevel('fourth'));

    await expect(pending).resolves.toMatchObject({ levelKey: 'fourth' });
    expect(repository.templates.has('fourth')).toBe(false);
    expect([...repository.templates.keys()]).toEqual([]);
  });
});
