// Health probe for uptime monitoring. Says whether the site can reach the ranking database, whether the season
// clock is running and whether any integrity alert is open. No member data, no alert details.
// 200 = healthy, 503 = needs attention. Cached at the edge for 10 s so a monitor (or a crowd) cannot load the database.
import { NextResponse } from 'next/server';
import { dataSourceName, supabaseConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
const CACHE = { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' };

export async function GET() {
  const source = dataSourceName();
  if (source === 'demo') return NextResponse.json({ healthy: true, source }, { headers: CACHE });
  const cfg = supabaseConfig();
  if (source === 'unavailable' || !cfg) return NextResponse.json({ healthy: false, source, database: 'not configured' }, { status: 503, headers: CACHE });
  const started = Date.now();
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/get_health`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }, body: '{}',
    });
    const ms = Date.now() - started;
    if (res.status === 404) return NextResponse.json({ healthy: true, source, database: 'ok', checks: 'not installed', ms }, { headers: CACHE });
    if (!res.ok) return NextResponse.json({ healthy: false, source, database: `error ${res.status}`, ms }, { status: 503, headers: CACHE });
    const h = await res.json() as { healthy: boolean; season: unknown; clock_age_seconds: number | null; checked_at: string };
    return NextResponse.json({ ...h, source, ms, region: process.env.VERCEL_REGION ?? null }, { status: h.healthy ? 200 : 503, headers: CACHE });
  } catch {
    return NextResponse.json({ healthy: false, source, database: 'unreachable', ms: Date.now() - started }, { status: 503, headers: CACHE });
  }
}
