import { V4_CAMPAIGN_ID } from './campaign/v4Campaign.js';

export const GLOBAL_SESSION_KEY = 'eotvk-v4-supabase-anonymous-session-v1';

function trimSlash(value) { return value.replace(/\/+$/u, ''); }
function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
function safeStorageRead(storage, key) {
  try { return storage?.getItem?.(key) ?? null; } catch { return null; }
}
function safeStorageWrite(storage, key, value) {
  try { storage?.setItem?.(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function getGlobalLeaderboardConfig(env = import.meta.env) {
  const url = typeof env?.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const publishableKey = typeof env?.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
    ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/iu.test(url) || !publishableKey) return null;
  return { url: trimSlash(url), publishableKey };
}

export function globalLeaderboardStatus(env = import.meta.env) {
  return getGlobalLeaderboardConfig(env)
    ? { configured: true, message: 'Global Hall connected' }
    : { configured: false, message: 'Global Hall will open when Supabase is connected' };
}

function publicHeaders(config) {
  return { apikey: config.publishableKey, 'Content-Type': 'application/json' };
}

export async function fetchGlobalTopTen({ env = import.meta.env, fetchImpl = fetch } = {}) {
  const config = getGlobalLeaderboardConfig(env);
  if (!config) return { status: 'disabled', scores: [], message: globalLeaderboardStatus(env).message };
  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/get_v4_top_ten`, {
      method: 'POST', headers: publicHeaders(config), body: '{}',
    });
    const data = parseJson(await response.text());
    if (!response.ok || !Array.isArray(data)) throw new Error('Global Hall request was refused.');
    return { status: 'ready', scores: data.slice(0, 10), message: '' };
  } catch {
    return { status: 'unavailable', scores: [], message: 'Global Hall is temporarily unavailable; your on-device score is safe.' };
  }
}

async function getAnonymousSession({ config, storage, fetchImpl, nowSeconds }) {
  const stored = parseJson(safeStorageRead(storage, GLOBAL_SESSION_KEY));
  if (typeof stored?.accessToken === 'string' && Number.isFinite(stored.expiresAt)
    && stored.expiresAt > nowSeconds + 60) return stored.accessToken;
  const response = await fetchImpl(`${config.url}/auth/v1/signup`, {
    method: 'POST', headers: publicHeaders(config), body: '{}',
  });
  const data = parseJson(await response.text());
  if (!response.ok || typeof data?.access_token !== 'string') {
    throw new Error('Anonymous leaderboard session could not be created.');
  }
  safeStorageWrite(storage, GLOBAL_SESSION_KEY, {
    accessToken: data.access_token,
    expiresAt: Number.isFinite(data.expires_at) ? data.expires_at : nowSeconds + (data.expires_in || 3600),
  });
  return data.access_token;
}

export async function submitGlobalV4Score(score, {
  env = import.meta.env,
  fetchImpl = fetch,
  storage = typeof window === 'undefined' ? null : window.localStorage,
  now = () => Date.now(),
} = {}) {
  const config = getGlobalLeaderboardConfig(env);
  if (!config) return { status: 'disabled', message: globalLeaderboardStatus(env).message };
  try {
    const accessToken = await getAnonymousSession({
      config, storage, fetchImpl, nowSeconds: Math.floor(now() / 1000),
    });
    const response = await fetchImpl(`${config.url}/functions/v1/submit-v4-score`, {
      method: 'POST',
      headers: { ...publicHeaders(config), Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        campaignId: V4_CAMPAIGN_ID,
        runId: score.id,
        playerName: score.playerName,
        totalTimeSeconds: score.totalTimeSeconds,
        deaths: score.deaths,
        wardenAttempts: score.wardenAttempts,
        damageTaken: score.damageTaken,
        completedAt: score.completedAt,
      }),
    });
    const data = parseJson(await response.text());
    if (!response.ok || data?.accepted !== true) throw new Error(data?.message || 'Score was not accepted.');
    return { status: 'accepted', position: Number.isInteger(data.position) ? data.position : null, message: '' };
  } catch {
    return { status: 'unavailable', message: 'Global submission is unavailable; your on-device Top 10 entry is safe.' };
  }
}
