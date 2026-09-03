import { createClient } from 'npm:@supabase/supabase-js@2';

const CAMPAIGN_ID = 'veiled-kingdom-v4-20';
const NAME_MAX_GRAPHEMES = 24;
const configuredOrigins = (Deno.env.get('LEADERBOARD_ALLOWED_ORIGINS') || '')
  .split(',').map((value) => value.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const allowed = origin && (configuredOrigins.includes(origin)
    || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(origin));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function readableName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').replace(/\p{Zs}+/gu, ' ').trim();
  const withoutJoiningControls = name.replace(/[\u200c\u200d]/gu, '');
  const points = Array.from(name);
  const invalidJoin = points.some((point, index) => {
    if (point !== '\u200c' && point !== '\u200d') return false;
    const before = points[index - 1];
    const after = points[index + 1];
    return !before || !after || /[\s\u200c\u200d]/u.test(before) || /[\s\u200c\u200d]/u.test(after);
  });
  if (!name || points.length > 64 || invalidJoin
    || /[\p{Cc}\p{Cs}\p{Cf}\p{Zl}\p{Zp}]/u.test(withoutJoiningControls)) return null;
  const count = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(name)].length
    : Array.from(name).length;
  return count <= NAME_MAX_GRAPHEMES ? name : null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { accepted: false, message: 'Method not allowed.' });
  if (!origin || corsHeaders(origin)['Access-Control-Allow-Origin'] === 'null') {
    return reply(origin, 403, { accepted: false, message: 'Origin not allowed.' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !publishableKey || !serviceRoleKey || !authorization) {
    return reply(origin, 503, { accepted: false, message: 'Leaderboard service is not configured.' });
  }

  const caller = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user?.id) return reply(origin, 401, { accepted: false, message: 'Valid player session required.' });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return reply(origin, 400, { accepted: false, message: 'Invalid JSON.' }); }
  const playerName = readableName(payload.playerName);
  const totalTimeSeconds = Number(payload.totalTimeSeconds);
  const deaths = Number(payload.deaths);
  const wardenAttempts = payload.wardenAttempts === null ? null : Number(payload.wardenAttempts);
  const damageTaken = payload.damageTaken === null ? null : Number(payload.damageTaken);
  const completedAt = typeof payload.completedAt === 'string' && Number.isFinite(Date.parse(payload.completedAt))
    ? new Date(payload.completedAt).toISOString() : null;
  const runId = typeof payload.runId === 'string' ? payload.runId.trim() : '';
  const plausible = payload.campaignId === CAMPAIGN_ID
    && runId.length >= 8 && runId.length <= 160
    && playerName
    && Number.isFinite(totalTimeSeconds) && totalTimeSeconds >= 600 && totalTimeSeconds <= 28800
    && Number.isInteger(deaths) && deaths >= 0 && deaths <= 999
    && (wardenAttempts === null || (Number.isInteger(wardenAttempts) && wardenAttempts >= 1 && wardenAttempts <= 999))
    && (damageTaken === null || (Number.isInteger(damageTaken) && damageTaken >= 0 && damageTaken <= 9999))
    && completedAt;
  if (!plausible) return reply(origin, 422, { accepted: false, message: 'Run statistics failed validation.' });

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const recentCutoff = new Date(Date.now() - 30_000).toISOString();
  const { count } = await admin.from('v4_leaderboard_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userData.user.id).gte('created_at', recentCutoff);
  if ((count || 0) > 0) return reply(origin, 429, { accepted: false, message: 'Wait before submitting another run.' });

  const { error: insertError } = await admin.from('v4_leaderboard_runs').insert({
    user_id: userData.user.id,
    run_id: runId,
    player_name: playerName,
    campaign_id: CAMPAIGN_ID,
    total_time_seconds: totalTimeSeconds,
    deaths,
    warden_attempts: wardenAttempts,
    damage_taken: damageTaken,
    client_completed_at: completedAt,
    accepted: true,
  });
  if (insertError) return reply(origin, insertError.code === '23505' ? 409 : 500, { accepted: false, message: 'Score could not be stored.' });

  const { data: top } = await admin.rpc('get_v4_top_ten');
  const position = Array.isArray(top)
    ? top.find((entry) => entry.player_name === playerName
      && Number(entry.total_time_seconds) === totalTimeSeconds)?.position ?? null
    : null;
  return reply(origin, 201, { accepted: true, position });
});
