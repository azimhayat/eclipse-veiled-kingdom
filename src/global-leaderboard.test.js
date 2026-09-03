import { describe, expect, it, vi } from 'vitest';
import {
  fetchGlobalTopTen,
  getGlobalLeaderboardConfig,
  submitGlobalV4Score,
} from './global-leaderboard.js';

const env = {
  VITE_SUPABASE_URL: 'https://example-project.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
};

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

const response = (data, ok = true) => ({ ok, text: async () => JSON.stringify(data) });

describe('optional Supabase global leaderboard client', () => {
  it('fails closed when public configuration is absent or malformed', async () => {
    expect(getGlobalLeaderboardConfig({})).toBeNull();
    expect(getGlobalLeaderboardConfig({ VITE_SUPABASE_URL: 'javascript:alert(1)', VITE_SUPABASE_PUBLISHABLE_KEY: 'x' })).toBeNull();
    await expect(fetchGlobalTopTen({ env: {}, fetchImpl: vi.fn() })).resolves.toMatchObject({ status: 'disabled', scores: [] });
  });

  it('reads only the bounded public Top 10 RPC', async () => {
    const scores = Array.from({ length: 12 }, (_, index) => ({ player_name: `P${index}` }));
    const fetchImpl = vi.fn().mockResolvedValue(response(scores));
    const result = await fetchGlobalTopTen({ env, fetchImpl });
    expect(result.status).toBe('ready');
    expect(result.scores).toHaveLength(10);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://example-project.supabase.co/rest/v1/rpc/get_v4_top_ten');
  });

  it('uses an anonymous user JWT for the Edge Function and never a secret key', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ access_token: 'user-jwt', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ accepted: true, position: 4 }));
    const result = await submitGlobalV4Score({
      id: 'run-1', playerName: 'Aren', totalTimeSeconds: 2000, deaths: 2,
      wardenAttempts: 1, damageTaken: 3, completedAt: '2026-09-03T10:00:00.000Z',
    }, { env, fetchImpl, storage: new MemoryStorage(), now: () => 0 });
    expect(result).toEqual({ status: 'accepted', position: 4, message: '' });
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({
      apikey: 'sb_publishable_example', Authorization: 'Bearer user-jwt',
    });
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('service_role');
  });

  it('keeps local success intact when the network fails', async () => {
    const result = await submitGlobalV4Score({ id: 'run-1' }, {
      env, fetchImpl: vi.fn().mockRejectedValue(new Error('offline')), storage: new MemoryStorage(),
    });
    expect(result.status).toBe('unavailable');
    expect(result.message).toContain('on-device Top 10 entry is safe');
  });
});
