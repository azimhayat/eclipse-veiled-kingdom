import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from './engine.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function transitionHarness(prepareAuthoredLevel) {
  const callbacks = { mode: vi.fn(), transition: vi.fn() };
  const engine = {
    running: true,
    repository: {
      length: 10,
      keyAt: (index) => `level-${index + 1}`,
      entryAt: (index) => ({ title: `Level ${index + 1}` }),
    },
    levelIndex: 0,
    level: { id: 1, name: 'Level 1' },
    mode: 'play',
    callbacks,
    transitionGeneration: 0,
    transitionController: null,
    transitioning: false,
    transitionTargetIndex: null,
    transitionRetryBlocked: false,
    prefetchGeneration: 0,
    prefetchController: null,
    prefetchHandle: null,
    prefetchTargetIndex: null,
    prefetchPromise: null,
    prefetchStart: null,
    prepareAuthoredLevel,
    clearInputs: vi.fn(),
    setHint: vi.fn(),
    loadLevel: vi.fn((index) => {
      engine.levelIndex = index;
      engine.level = { id: index + 1, name: `Level ${index + 1}` };
    }),
    cancelLevelPrefetch: GameEngine.prototype.cancelLevelPrefetch,
    cancelLevelTransition: GameEngine.prototype.cancelLevelTransition,
    transitionToLevel: GameEngine.prototype.transitionToLevel,
  };
  return engine;
}

describe('lazy runtime transitions', () => {
  it('retains a non-adjacent demo destination before its lazy module resolves', async () => {
    let retained = new Set(['level-1', 'level-2']);
    const templates = new Map([['level-1', { id: 1 }]]);
    const repository = {
      keyAt: (index) => `level-${index + 1}`,
      retainAround: vi.fn((index) => {
        retained = new Set(['level-1', `level-${index + 1}`, `level-${index + 2}`]);
      }),
      loadTemplate: vi.fn(async (index) => {
        const key = `level-${index + 1}`;
        if (retained.has(key)) templates.set(key, { id: index + 1 });
      }),
      createRuntime: vi.fn((index) => {
        const template = templates.get(`level-${index + 1}`);
        if (!template) throw new Error('destination was discarded');
        return { ...template, levelKey: `level-${index + 1}` };
      }),
      windowKeys: () => ['level-1', 'level-3', 'level-4'],
    };
    const engine = {
      running: true,
      levelIndex: 0,
      repository,
      bank: { has: () => true },
    };

    await expect(GameEngine.prototype.prepareAuthoredLevel.call(engine, 2)).resolves.toMatchObject({ id: 3 });
    expect(repository.retainAround).toHaveBeenCalledWith(2);
    expect(repository.createRuntime).toHaveBeenCalledWith(2);
  });

  it('holds the current realm while a missing module loads and activates it once', async () => {
    const wait = deferred();
    const prepare = vi.fn(() => wait.promise);
    const engine = transitionHarness(prepare);

    const transition = engine.transitionToLevel(1);
    const duplicate = await engine.transitionToLevel(1);

    expect(duplicate).toBe(false);
    expect(engine.mode).toBe('loading');
    expect(engine.levelIndex).toBe(0);
    expect(prepare).toHaveBeenCalledOnce();
    expect(engine.loadLevel).not.toHaveBeenCalled();

    wait.resolve({ id: 2, name: 'Level 2' });
    await expect(transition).resolves.toBe(true);
    expect(engine.levelIndex).toBe(1);
    expect(engine.loadLevel).toHaveBeenCalledOnce();
    expect(engine.callbacks.transition).toHaveBeenCalledOnce();
    expect(engine.callbacks.mode).toHaveBeenLastCalledWith('play');
  });

  it('fails closed without retry storms and requires an honest page reload', async () => {
    const prepare = vi.fn().mockRejectedValue(new Error('missing chunk'));
    const engine = transitionHarness(prepare);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(engine.transitionToLevel(1)).resolves.toBe(false);
    expect(engine.mode).toBe('load-error');
    expect(engine.levelIndex).toBe(0);
    expect(engine.transitionRetryBlocked).toBe(true);
    expect(prepare).toHaveBeenCalledOnce();
    expect(engine.callbacks.transition).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('uses repository campaign length instead of loaded-window length', () => {
    const callbacks = { transition: vi.fn(), win: vi.fn() };
    const engine = {
      player: { x: 0, y: 0, w: 20, h: 20 },
      level: { door: { x: 0, y: 0, w: 20, h: 20 }, boss: null, relics: [], checkpoints: [] },
      levelIndex: 1,
      repository: { length: 10 },
      transitionRetryBlocked: false,
      transitioning: false,
      relicCount: () => 3,
      audio: { play: vi.fn() },
      transitionToLevel: vi.fn(),
      objectiveStatus: GameEngine.prototype.objectiveStatus,
      isExitReady: GameEngine.prototype.isExitReady,
      callbacks,
    };

    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(engine.transitionToLevel).toHaveBeenCalledWith(2);
    expect(callbacks.win).not.toHaveBeenCalled();
  });

  it('emits stable completion exactly once before opening the next lazy level', () => {
    const order = [];
    const callbacks = {
      levelComplete: vi.fn(() => order.push('complete')),
      win: vi.fn(),
    };
    const engine = {
      player: { x: 0, y: 0, w: 20, h: 20 },
      level: {
        id: 2,
        levelKey: 'outer-veil-02-sand-that-remembers',
        campaignOrder: 2,
        door: { x: 0, y: 0, w: 20, h: 20 },
        boss: null,
        relics: [{ collected: true }, { collected: true }, { collected: true }], checkpoints: [],
        abilityUnlock: { key: 'memory-carve' },
      },
      levelIndex: 1,
      repository: {
        length: 10,
        campaignId: 'outer-veil-production-v1',
        sessionKind: 'production-campaign',
        keyAt: (index) => `outer-${index + 1}`,
        entryAt: () => ({ realmKey: 'outer-veil' }),
      },
      transitionRetryBlocked: false,
      transitioning: false,
      levelCompletionEmitted: false,
      levelTime: 12,
      totalTime: 31,
      deaths: 1,
      relicCount: () => 3,
      objectiveStatus: GameEngine.prototype.objectiveStatus,
      isExitReady: GameEngine.prototype.isExitReady,
      audio: { play: vi.fn() },
      transitionToLevel: vi.fn(() => order.push('transition')),
      callbacks,
    };

    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(callbacks.levelComplete).toHaveBeenCalledOnce();
    expect(callbacks.levelComplete).toHaveBeenCalledWith({
      campaignId: 'outer-veil-production-v1',
      sessionKind: 'production-campaign',
      levelKey: 'outer-veil-02-sand-that-remembers',
      campaignOrder: 2,
      nextLevelKey: 'outer-3',
      abilityUnlockKey: 'memory-carve',
      levelTime: 12,
      campaignTime: 31,
      deaths: 1,
      realmKey: 'outer-veil',
      realmComplete: false,
    });
    expect(order.slice(0, 2)).toEqual(['complete', 'transition']);
  });

  it('resumes a non-adjacent level without starting or announcing Level 1', async () => {
    const engine = {
      repository: { length: 10 },
      mode: 'title',
      levelIndex: 0,
      totalTime: 0,
      demo: false,
      start: vi.fn(),
      resetCampaign: vi.fn(),
      clearInputs: vi.fn(),
      transitionToLevel: vi.fn().mockResolvedValue(true),
    };
    const opened = await GameEngine.prototype.startAt.call(engine, 6, { demo: false });
    expect(opened).toBe(true);
    expect(engine.start).not.toHaveBeenCalled();
    expect(engine.resetCampaign).not.toHaveBeenCalled();
    expect(engine.transitionToLevel).toHaveBeenCalledWith(6);
  });

  it('emits an explicit campaign identity only at the true final realm', () => {
    const events = [];
    const callbacks = {
      levelComplete: vi.fn(() => events.push('complete')),
      win: vi.fn(() => events.push('win')),
    };
    const engine = {
      player: { x: 0, y: 0, w: 20, h: 20 },
      level: { door: { x: 0, y: 0, w: 20, h: 20 }, boss: null, relics: [], checkpoints: [] },
      levelIndex: 9,
      repository: {
        length: 10,
        campaignId: 'legacy-prototype-10',
        sessionKind: 'prototype-campaign',
        keyAt: () => 'throne-of-eclipse',
        entryAt: () => ({ realmKey: null }),
      },
      relicCount: () => 3,
      objectiveStatus: GameEngine.prototype.objectiveStatus,
      isExitReady: GameEngine.prototype.isExitReady,
      audio: { play: vi.fn() },
      callbacks,
      totalTime: 91,
      deaths: 4,
      levelTime: 14,
      levelCompletionEmitted: false,
    };

    GameEngine.prototype.updateRelicsAndFlow.call(engine);
    expect(callbacks.win).toHaveBeenCalledWith({
      time: 91,
      deaths: 4,
      campaignId: 'legacy-prototype-10',
      sessionKind: 'prototype-campaign',
      completedLevels: 10,
      targetTime: null,
      levelKey: null,
      campaignOrder: undefined,
      objectiveType: 'relics',
    });
    expect(callbacks.levelComplete).toHaveBeenCalledOnce();
    expect(events).toEqual(['complete', 'win']);
  });

  it('reforms Level 1 before returning to the title screen', () => {
    const engine = {
      resetCampaign: vi.fn(),
      clearInputs: vi.fn(),
      callbacks: { mode: vi.fn() },
      mode: 'load-error',
    };

    GameEngine.prototype.returnToTitle.call(engine);
    expect(engine.resetCampaign).toHaveBeenCalledOnce();
    expect(engine.mode).toBe('title');
    expect(engine.clearInputs).toHaveBeenCalledOnce();
    expect(engine.callbacks.mode).toHaveBeenCalledWith('title');
  });
});
