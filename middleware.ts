// Keeps the Supabase Auth session cookie fresh. Does nothing unless the live data source is configured.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { tracedFetch } from './lib/trace';
import { AUTH_COOKIE_OPTIONS } from './lib/auth-cookies';

export async function middleware(request: NextRequest) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (process.env.BKP_DATA_SOURCE !== 'supabase' || !url || !key) return NextResponse.next();
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return NextResponse.next();
  let response = NextResponse.next({ request });
  const sb = createServerClient(url, key, {
    global: { fetch: tracedFetch },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes an expired session and verifies the token locally against the project's signing key (see lib/supabase-server.ts).
  await sb.auth.getClaims();
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/seal-card).*)'] };
