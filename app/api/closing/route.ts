// The Closing (practice season only). The server holds the clock: the start time lives in an httpOnly
// cookie it sets itself, and every response is computed by the season engine for the server's "now".
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CLOSING_OPENS, closingInstant, closingStateAt } from '@/lib/closing';

export const dynamic = 'force-dynamic';
const COOKIE = 'bkp_closing_start';
const json = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const started = Number((await cookies()).get(COOKIE)?.value);
  const now = Date.now();
  if (!Number.isFinite(started) || started <= 0 || started > now) return json({ ...closingStateAt(CLOSING_OPENS), phase: 'idle' });
  return json(closingStateAt(closingInstant(started, now)));
}
export async function POST() {
  const now = Date.now();
  const res = json(closingStateAt(CLOSING_OPENS));
  res.cookies.set(COOKIE, String(now), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 30 });
  return res;
}
