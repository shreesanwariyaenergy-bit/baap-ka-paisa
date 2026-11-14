import 'server-only';
// Supabase Auth on the server: sessions live in httpOnly cookies (lib/auth-cookies.ts). Only the publishable key is used.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { dataSourceName, supabaseConfig } from './config';
import { tracedFetch } from './trace';
import { AUTH_COOKIE_OPTIONS } from './auth-cookies';

export async function supabaseAuth() {
  const cfg = dataSourceName() === 'supabase' ? supabaseConfig() : null;
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    global: { fetch: tracedFetch },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in server components; middleware refreshes */ } },
    },
  });
}

/** The signed-in account's access token and email, or null. */
export const currentAccount = cache(async function currentAccount(): Promise<{ token: string; email: string | null; pendingProfile: Record<string, unknown> | null } | null> {
  const sb = await supabaseAuth();
  if (!sb) return null;
  // getClaims() verifies the session token's signature and expiry against the project's published signing key
  // (ES256, fetched once and cached), so a signed-in page no longer waits on a round trip to the Auth server.
  // It refreshes an expired session first, exactly as getUser() did. Trade-off: a session revoked elsewhere
  // stays usable until its token expires (1 hour by default). Every database read is checked again by the
  // database itself, which rejects any token that is not validly signed.
  const { data, error } = await sb.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;   // getClaims() verified this same session's token above
  const meta = (data.claims.user_metadata ?? {}) as Record<string, unknown>;
  const pending = (meta.pending_profile ?? null) as Record<string, unknown> | null;
  return { token: session.access_token, email: (data.claims.email as string | undefined) ?? null, pendingProfile: pending };
});

export const DEMO_VIEWER_COOKIE = 'bkp_demo_viewer';
/** Demo mode: visitors are signed out unless they chose "view as the demo member". Outside a request (tests) the demo member is on. */
export async function demoViewerOn(): Promise<boolean> {
  try { return (await cookies()).get(DEMO_VIEWER_COOKIE)?.value === '1'; } catch { return true; }
}
