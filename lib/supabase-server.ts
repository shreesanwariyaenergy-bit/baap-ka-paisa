import 'server-only';
// Supabase Auth on the server: sessions live in httpOnly cookies. Only the publishable key is used.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { dataSourceName, supabaseConfig } from './config';

export async function supabaseAuth() {
  const cfg = dataSourceName() === 'supabase' ? supabaseConfig() : null;
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in server components; middleware refreshes */ } },
    },
  });
}

/** The signed-in account's access token and email, or null. */
export async function currentAccount(): Promise<{ token: string; email: string | null; pendingProfile: Record<string, unknown> | null } | null> {
  const sb = await supabaseAuth();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const pending = (user.user_metadata?.pending_profile ?? null) as Record<string, unknown> | null;
  return { token: session.access_token, email: user.email ?? null, pendingProfile: pending };
}

export const DEMO_VIEWER_COOKIE = 'bkp_demo_viewer';
/** Demo mode: visitors are signed out unless they chose "view as the demo member". Outside a request (tests) the demo member is on. */
export async function demoViewerOn(): Promise<boolean> {
  try { return (await cookies()).get(DEMO_VIEWER_COOKIE)?.value === '1'; } catch { return true; }
}
