import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Supabase leaderboard security boundary', () => {
  it('keeps elevated keys out of browser source and public environment examples', () => {
    const browserClient = read('./global-leaderboard.js');
    const app = read('./App.jsx');
    const environmentExample = read('../.env.example');
    expect(`${browserClient}\n${app}\n${environmentExample}`).not.toMatch(/SERVICE_ROLE|SECRET_KEY/iu);
    expect(environmentExample).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
  });

  it('revokes browser table access and exposes only a bounded read function', () => {
    const migration = read('../supabase/migrations/202609030001_v4_leaderboard.sql');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.v4_leaderboard_runs from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.get_v4_top_ten() to anon, authenticated');
    expect(migration).toMatch(/limit 10/iu);
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/iu);
  });

  it('requires a player JWT before the server-only insertion boundary', () => {
    const config = read('../supabase/config.toml');
    const edgeFunction = read('../supabase/functions/submit-v4-score/index.ts');
    expect(config).toContain('verify_jwt = true');
    expect(edgeFunction).toContain("caller.auth.getUser()");
    expect(edgeFunction).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(edgeFunction).toContain("Deno.env.get('LEADERBOARD_ALLOWED_ORIGINS')");
  });
});
