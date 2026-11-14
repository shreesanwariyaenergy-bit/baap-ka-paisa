# Appendix: performance-related code diffs, from Git
Generated with `git show <commit> -- <files>` (hunk headers give old and new line numbers: `@@ -old,count +new,count @@`). Test-only scripts (`tests/perf/*`, `scripts/load-test.sh`) and SQL migrations are listed in the ledger, not reproduced here.

## 8a56e11027b9e13c9809f9ef7dd6c1a1b89c2b07 2026-11-11 09:21:25 +0000 Serve fonts from the project instead of a font CDN

### `app/layout.tsx`

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index fb1dae4..a44aacf 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -1,6 +1,6 @@
 import type { Metadata, Viewport } from 'next';
-import { Barlow_Condensed, JetBrains_Mono, Karla } from 'next/font/google';
 import Link from 'next/link';
+import './fonts.css';
 import './globals.css';
 import { getDataSource, rankingsOpen } from '@/lib/data';
 import { timeLeft } from '@/lib/season';
@@ -10,11 +10,6 @@ import { currentAccount } from '@/lib/supabase-server';
 import { MainNav } from '@/components/MainNav';
 import { ProfileDialogProvider } from '@/components/ProfileDialog';
 
-const barlow = Barlow_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800', '900'], variable: '--font-barlow', display: 'swap' });
-// Sub-headings: Barlow Condensed ExtraBold only, so every weight request resolves to the heavy cut.
-const changa = Barlow_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['800'], variable: '--font-changa', display: 'swap' });
-const karla = Karla({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], style: ['normal', 'italic'], variable: '--font-karla', display: 'swap' });
-const dmMono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '700', '800'], variable: '--font-dmmono', display: 'swap' });
 
 export const metadata: Metadata = {
   title: { default: 'BAAP KA PAISA — The Public Status Register', template: '%s · BAAP KA PAISA' },
@@ -35,7 +30,7 @@ export default async function RootLayout({ children }: { children: React.ReactNo
   const account = viewer ? null : await currentAccount();
   const viewerLabel = viewer ? (viewer.member.masked ? viewer.member.publicLabel : viewer.member.displayName ?? viewer.member.username) : null;
   return (
-    <html lang="en-IN" className={`${barlow.variable} ${changa.variable} ${karla.variable} ${dmMono.variable}`}>
+    <html lang="en-IN">
       <body>
         <a className="skip-link" href="#main">Skip to content</a>
         <div className="topline">
```

### `app/fonts.css`

```diff
diff --git a/app/fonts.css b/app/fonts.css
new file mode 100644
index 0000000..0e1121c
--- /dev/null
+++ b/app/fonts.css
@@ -0,0 +1,18 @@
+/* Self-hosted fonts (SIL Open Font License). Served from /public/fonts so builds never depend on a font CDN. */
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/barlow-condensed-latin-ext-600-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/barlow-condensed-latin-600-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/barlow-condensed-latin-ext-700-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/barlow-condensed-latin-700-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 800; font-display: swap; src: url('/fonts/barlow-condensed-latin-ext-800-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 800; font-display: swap; src: url('/fonts/barlow-condensed-latin-800-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 900; font-display: swap; src: url('/fonts/barlow-condensed-latin-ext-900-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Barlow'; font-style: normal; font-weight: 900; font-display: swap; src: url('/fonts/barlow-condensed-latin-900-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Heavy'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/barlow-condensed-latin-ext-800-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Heavy'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/barlow-condensed-latin-800-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Karla'; font-style: normal; font-weight: 200 800; font-display: swap; src: url('/fonts/karla-latin-ext-wght-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Karla'; font-style: normal; font-weight: 200 800; font-display: swap; src: url('/fonts/karla-latin-wght-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Karla'; font-style: italic; font-weight: 200 800; font-display: swap; src: url('/fonts/karla-latin-ext-wght-italic.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Karla'; font-style: italic; font-weight: 200 800; font-display: swap; src: url('/fonts/karla-latin-wght-italic.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+@font-face { font-family: 'BKP Mono'; font-style: normal; font-weight: 100 800; font-display: swap; src: url('/fonts/jetbrains-mono-latin-ext-wght-normal.woff2') format('woff2'); unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
+@font-face { font-family: 'BKP Mono'; font-style: normal; font-weight: 100 800; font-display: swap; src: url('/fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2'); unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
+:root { --font-barlow: 'BKP Barlow'; --font-changa: 'BKP Heavy'; --font-karla: 'BKP Karla'; --font-dmmono: 'BKP Mono'; }
```

## 3a06ba0d17c4b3f8c57ace0c4273d2d5396bbc52 2026-11-14 11:26:57 +0000 Performance milestone on staging: fewer and parallel reads, local session verification, httpOnly session cookies

### `lib/trace.ts`

```diff
diff --git a/lib/trace.ts b/lib/trace.ts
new file mode 100644
index 0000000..8e7868a
--- /dev/null
+++ b/lib/trace.ts
@@ -0,0 +1,13 @@
+// Optional request tracing for performance work. Off unless BKP_TRACE=1. Logs one line per outbound call:
+//   [bkp-trace] <ms> <label>
+// Never logs headers, tokens or bodies.
+export const traceOn = () => process.env.BKP_TRACE === '1';
+export const tracedFetch: typeof fetch = async (input, init) => {
+  if (!traceOn()) return fetch(input, init);
+  const t0 = performance.now();
+  try { return await fetch(input, init); }
+  finally {
+    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
+    console.log(`[bkp-trace] ${Math.round(performance.now() - t0)} ${u.pathname.replace(/^\/rest\/v1\/rpc\//, 'rpc:').replace(/^\/auth\/v1\//, 'auth:')} @${Math.round(t0)}`);
+  }
+};
```

### `lib/auth-cookies.ts`

```diff
diff --git a/lib/auth-cookies.ts b/lib/auth-cookies.ts
new file mode 100644
index 0000000..40529f6
--- /dev/null
+++ b/lib/auth-cookies.ts
@@ -0,0 +1,10 @@
+// Options for the Supabase session cookies. The site never reads the session in the browser (there is no
+// browser Supabase client), so the cookies are hidden from page scripts (httpOnly): a script-injection bug
+// can no longer read a member's session. `secure` keeps them off plain HTTP outside local development.
+export const AUTH_COOKIE_OPTIONS = {
+  path: '/',
+  sameSite: 'lax' as const,
+  httpOnly: true,
+  secure: process.env.NODE_ENV === 'production' && !process.env.BKP_INSECURE_LOCAL_COOKIES,
+  maxAge: 400 * 24 * 60 * 60,   // same lifetime as the library default; the session itself still expires and refreshes
+};
```

### `middleware.ts`

```diff
diff --git a/middleware.ts b/middleware.ts
index a1b7eba..8e73528 100644
--- a/middleware.ts
+++ b/middleware.ts
@@ -1,6 +1,8 @@
 // Keeps the Supabase Auth session cookie fresh. Does nothing unless the live data source is configured.
 import { createServerClient } from '@supabase/ssr';
 import { NextResponse, type NextRequest } from 'next/server';
+import { tracedFetch } from './lib/trace';
+import { AUTH_COOKIE_OPTIONS } from './lib/auth-cookies';
 
 export async function middleware(request: NextRequest) {
   const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
@@ -8,6 +10,8 @@ export async function middleware(request: NextRequest) {
   if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return NextResponse.next();
   let response = NextResponse.next({ request });
   const sb = createServerClient(url, key, {
+    global: { fetch: tracedFetch },
+    cookieOptions: AUTH_COOKIE_OPTIONS,
     cookies: {
       getAll: () => request.cookies.getAll(),
       setAll: (list) => {
@@ -17,7 +21,8 @@ export async function middleware(request: NextRequest) {
       },
     },
   });
-  await sb.auth.getUser();
+  // Refreshes an expired session and verifies the token locally against the project's signing key (see lib/supabase-server.ts).
+  await sb.auth.getClaims();
   return response;
 }
 
```

### `lib/supabase-server.ts`

```diff
diff --git a/lib/supabase-server.ts b/lib/supabase-server.ts
index 5b48b0e..e4d61ff 100644
--- a/lib/supabase-server.ts
+++ b/lib/supabase-server.ts
@@ -1,14 +1,19 @@
 import 'server-only';
-// Supabase Auth on the server: sessions live in httpOnly cookies. Only the publishable key is used.
+// Supabase Auth on the server: sessions live in httpOnly cookies (lib/auth-cookies.ts). Only the publishable key is used.
 import { createServerClient } from '@supabase/ssr';
 import { cookies } from 'next/headers';
+import { cache } from 'react';
 import { dataSourceName, supabaseConfig } from './config';
+import { tracedFetch } from './trace';
+import { AUTH_COOKIE_OPTIONS } from './auth-cookies';
 
 export async function supabaseAuth() {
   const cfg = dataSourceName() === 'supabase' ? supabaseConfig() : null;
   if (!cfg) return null;
   const store = await cookies();
   return createServerClient(cfg.url, cfg.key, {
+    global: { fetch: tracedFetch },
+    cookieOptions: AUTH_COOKIE_OPTIONS,
     cookies: {
       getAll: () => store.getAll(),
       setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in server components; middleware refreshes */ } },
@@ -17,16 +22,22 @@ export async function supabaseAuth() {
 }
 
 /** The signed-in account's access token and email, or null. */
-export async function currentAccount(): Promise<{ token: string; email: string | null; pendingProfile: Record<string, unknown> | null } | null> {
+export const currentAccount = cache(async function currentAccount(): Promise<{ token: string; email: string | null; pendingProfile: Record<string, unknown> | null } | null> {
   const sb = await supabaseAuth();
   if (!sb) return null;
-  const { data: { user } } = await sb.auth.getUser();
-  if (!user) return null;
+  // getClaims() verifies the session token's signature and expiry against the project's published signing key
+  // (ES256, fetched once and cached), so a signed-in page no longer waits on a round trip to the Auth server.
+  // It refreshes an expired session first, exactly as getUser() did. Trade-off: a session revoked elsewhere
+  // stays usable until its token expires (1 hour by default). Every database read is checked again by the
+  // database itself, which rejects any token that is not validly signed.
+  const { data, error } = await sb.auth.getClaims();
+  if (error || !data?.claims?.sub) return null;
   const { data: { session } } = await sb.auth.getSession();
-  if (!session) return null;
-  const pending = (user.user_metadata?.pending_profile ?? null) as Record<string, unknown> | null;
-  return { token: session.access_token, email: user.email ?? null, pendingProfile: pending };
-}
+  if (!session) return null;   // getClaims() verified this same session's token above
+  const meta = (data.claims.user_metadata ?? {}) as Record<string, unknown>;
+  const pending = (meta.pending_profile ?? null) as Record<string, unknown> | null;
+  return { token: session.access_token, email: (data.claims.email as string | undefined) ?? null, pendingProfile: pending };
+});
 
 export const DEMO_VIEWER_COOKIE = 'bkp_demo_viewer';
 /** Demo mode: visitors are signed out unless they chose "view as the demo member". Outside a request (tests) the demo member is on. */
```

### `lib/data/index.ts`

```diff
diff --git a/lib/data/index.ts b/lib/data/index.ts
index 979f566..2704817 100644
--- a/lib/data/index.ts
+++ b/lib/data/index.ts
@@ -3,7 +3,7 @@ import { cache } from 'react';
 import { dataSourceName, seasonOneMonth, supabaseConfig } from '../config';
 import { demoSource } from './demo';
 import { unavailableSource } from './unavailable';
-import { loadSeason, supabaseSource } from './supabase';
+import { loadSeason, prefetchViewer, supabaseSource } from './supabase';
 import type { DataSource } from './types';
 import { currentAccount } from '../supabase-server';
 
@@ -13,7 +13,14 @@ export const getDataSource = cache(async (): Promise<DataSource> => {
   if (name === 'demo') return demoSource;
   if (name === 'supabase') {
     const cfg = supabaseConfig();
-    if (cfg) { const acct = await currentAccount(); return supabaseSource(cfg, await loadSeason(cfg), acct?.token ?? null); }
+    if (cfg) {
+      // The season row and the signed-in member's own profile are both needed by almost every page and neither
+      // depends on the other: read them at the same time.
+      const seasonP = loadSeason(cfg);
+      const acct = await currentAccount();               // local check, no network call
+      if (acct) prefetchViewer(cfg, acct.token);
+      return supabaseSource(cfg, await seasonP, acct?.token ?? null);
+    }
   }
   return unavailableSource(seasonOneMonth());
 });
```

### `lib/data/supabase.ts`

```diff
diff --git a/lib/data/supabase.ts b/lib/data/supabase.ts
index cee1a2d..7e9bb3d 100644
--- a/lib/data/supabase.ts
+++ b/lib/data/supabase.ts
@@ -6,18 +6,27 @@ import { seasonFor, type SeasonInfo } from '../season';
 import { monthName, monthShort } from '../format';
 import { lifetimeTier, movement } from './ranking';
 import { humanizeDetail } from '../achievements';
+import { tracedFetch } from '../trace';
 import { LINES, toOvertake } from '../engine/callout';
 import type { SocialHandles, BackingView, DeclarationView, AchievementView, ArchiveSeason, Board, BoardEvent, BoardRow, CitySummary, CrownMomentView, DataSource, PublicMember, ReignView, SocialSummary, Standing, ViewerSeal } from './types';
 
 interface Cfg { url: string; key: string; }
 
-async function rpcRaw<T>(cfg: Cfg, fn: string, args: Record<string, unknown> = {}, token?: string | null): Promise<T> {
-  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
-    method: 'POST',
-    headers: { apikey: cfg.key, Authorization: `Bearer ${token ?? cfg.key}`, 'Content-Type': 'application/json' },
-    body: JSON.stringify(args),
-    cache: 'no-store',
-  });
+async function rpcRaw<T>(cfg: Cfg, fn: string, args: Record<string, unknown> = {}, token?: string | null, retry = true): Promise<T> {
+  // These are read-only functions, so a connection dropped in transit is retried once instead of failing the page.
+  let res: Response;
+  try {
+    res = await tracedFetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
+      method: 'POST',
+      headers: { apikey: cfg.key, Authorization: `Bearer ${token ?? cfg.key}`, 'Content-Type': 'application/json' },
+      body: JSON.stringify(args),
+      cache: 'no-store',
+    });
+  } catch (e) {
+    if (retry) return rpcRaw<T>(cfg, fn, args, token, false);
+    throw e;
+  }
+  if (res.status === 401 && token) return rpcRaw<T>(cfg, fn, args, null);   // token no longer valid: read as a visitor
   if (!res.ok) throw new Error(`Ranking service error (${fn}): ${res.status}`);
   return res.json() as Promise<T>;
 }
@@ -44,10 +53,46 @@ function lite(name: string, display: string | null, masked: boolean, cityId: str
     locality, memberNo: null, seasonScore: 0, lifetimeTier: null };
 }
 
+// The signed-in member's own profile, started before the season row has arrived. Keyed by token and kept only
+// until the data source for the same request picks it up.
+const early = new Map<string, Promise<unknown>>();
+export function prefetchViewer(cfg: Cfg, token: string) {
+  const key = token + 'get_me{}';
+  if (!early.has(key)) { early.set(key, rpcRaw(cfg, 'get_me', {}, token).catch(() => [])); setTimeout(() => early.delete(key), 10_000); }
+}
+
 export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string | null = null): DataSource {
   // Reads carry the member's own token when signed in, so the database can mark "your row".
   const cfg = base;
-  const rpc = <T,>(c: Cfg, fn: string, args: Record<string, unknown> = {}) => rpcRaw<T>(c, fn, args, token);
+  // One data source exists per request (lib/data/index.ts), so identical reads within a request are made once
+  // and shared. Nothing is kept between requests, so this can never serve an out-of-date rank.
+  const memo = new Map<string, Promise<unknown>>();
+  const rpc = <T,>(c: Cfg, fn: string, args: Record<string, unknown> = {}): Promise<T> => {
+    const key = fn + JSON.stringify(args);
+    let p = memo.get(key) as Promise<T> | undefined;
+    if (!p && token && early.has(token + key)) { p = early.get(token + key) as Promise<T>; early.delete(token + key); memo.set(key, p); }
+    if (!p) { p = rpcRaw<T>(c, fn, args, token); memo.set(key, p); p.catch(() => memo.delete(key)); }
+    return p;
+  };
+  let viewerP: ReturnType<DataSource['viewer']> | null = null;
+  async function loadViewer(): ReturnType<DataSource['viewer']> {
+    if (!token) return null;
+    const recordP = rpc<{ season_id: number; starts_at: string; level: string; scope_key: string; final_rank: number }[]>(cfg, 'get_my_season_record').catch(() => []);   // started now, used below
+      const me = (await rpc<{ username: string; display_name: string; masked: boolean; anon_label: string | null; title: string | null; flex_line: string | null; city_id: string; state_code: string; locality: string; member_no: number; joined_at: string; lifetime_paise: number; season_score_paise: number }[]>(cfg, 'get_me'))[0];
+      if (!me) return null; // account exists but has no member profile yet
+      const publicName = me.masked && me.anon_label ? me.anon_label : me.username;
+      const lifetime = Math.round(Number(me.lifetime_paise) / 100);
+      // Your own view shows your real name and number even in Mystery mode; `masked` tells the UI what others see.
+      const member: PublicMember = { username: publicName, displayName: me.display_name, masked: me.masked, publicLabel: publicName, title: me.title, flexLine: me.flex_line,
+        cityId: me.city_id, state: me.state_code as StateCode, locality: me.locality, memberNo: me.member_no, seasonScore: Math.round(Number(me.season_score_paise) / 100), lifetimeTier: lifetimeTier(lifetime) };
+      const [standings, archive] = await Promise.all([src.standings(publicName), recordP]);
+      const joined = seasonFor(new Date(me.joined_at), null);
+      const bySeason = new Map<number, { starts: string; city: number | null; loc: number | null }>();
+      for (const r of archive) { const e = bySeason.get(r.season_id) ?? { starts: r.starts_at, city: null, loc: null }; if (r.level === 'city') e.city = r.final_rank; if (r.level === 'locality') e.loc = r.final_rank; bySeason.set(r.season_id, e); }
+      const record = [...bySeason.entries()].sort((a, b) => b[0] - a[0]).map(([id, e]) => { const s = seasonFor(new Date(e.starts), null); return { seasonLabel: `Season ${id}`, monthLabel: `${monthShort(s.month)} ${s.year}`, cityRank: e.city, localityRank: e.loc, note: null }; });
+      return { member, lifetimeScore: lifetime, memberSince: `${monthShort(joined.month)} ${joined.year}`, standings, record, insignia: [], cityMovement: null } satisfies ViewerSeal;
+    }
+
   const boardArgs = (s: Scope) => ({ p_level: s.level, p_city: s.level === 'india' ? null : s.cityId, p_locality: s.level === 'locality' ? s.locality : null });
 
   const src: DataSource = {
@@ -84,27 +129,15 @@ export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string
       return rows[0] ? toMember(rows[0]) : null;
     },
     async standings(name) {
-      const m = await src.member(name);
+      const [m, rows] = await Promise.all([src.member(name), rpc<{ level: Level; rank: number | null; total: number }[]>(cfg, 'get_standings', { p_name: name })]);
       if (!m) return [];
-      const rows = await rpc<{ level: Level; rank: number | null; total: number }[]>(cfg, 'get_standings', { p_name: name });
       return rows.map((r): Standing => ({ level: r.level, scope: { level: r.level, cityId: m.cityId, locality: m.locality }, rank: r.rank, of: r.total }));
     },
-    async viewer() {
-      if (!token) return null;
-      const me = (await rpc<{ username: string; display_name: string; masked: boolean; anon_label: string | null; title: string | null; flex_line: string | null; city_id: string; state_code: string; locality: string; member_no: number; joined_at: string; lifetime_paise: number; season_score_paise: number }[]>(cfg, 'get_me'))[0];
-      if (!me) return null; // account exists but has no member profile yet
-      const publicName = me.masked && me.anon_label ? me.anon_label : me.username;
-      const lifetime = Math.round(Number(me.lifetime_paise) / 100);
-      // Your own view shows your real name and number even in Mystery mode; `masked` tells the UI what others see.
-      const member: PublicMember = { username: publicName, displayName: me.display_name, masked: me.masked, publicLabel: publicName, title: me.title, flexLine: me.flex_line,
-        cityId: me.city_id, state: me.state_code as StateCode, locality: me.locality, memberNo: me.member_no, seasonScore: Math.round(Number(me.season_score_paise) / 100), lifetimeTier: lifetimeTier(lifetime) };
-      const [standings, archive] = await Promise.all([src.standings(publicName), rpc<{ season_id: number; starts_at: string; level: string; scope_key: string; final_rank: number }[]>(cfg, 'get_my_season_record').catch(() => [])]);
-      const joined = seasonFor(new Date(me.joined_at), null);
-      const bySeason = new Map<number, { starts: string; city: number | null; loc: number | null }>();
-      for (const r of archive) { const e = bySeason.get(r.season_id) ?? { starts: r.starts_at, city: null, loc: null }; if (r.level === 'city') e.city = r.final_rank; if (r.level === 'locality') e.loc = r.final_rank; bySeason.set(r.season_id, e); }
-      const record = [...bySeason.entries()].sort((a, b) => b[0] - a[0]).map(([id, e]) => { const s = seasonFor(new Date(e.starts), null); return { seasonLabel: `Season ${id}`, monthLabel: `${monthShort(s.month)} ${s.year}`, cityRank: e.city, localityRank: e.loc, note: null }; });
-      return { member, lifetimeScore: lifetime, memberSince: `${monthShort(joined.month)} ${joined.year}`, standings, record, insignia: [], cityMovement: null } satisfies ViewerSeal;
+    viewer() {
+      if (!viewerP) viewerP = loadViewer();
+      return viewerP;
     },
+
     async cities() {
       const rows = await rpc<{ city_id: string; members: number; season_total_paise: number; leader_name: string | null; leader_masked: boolean | null; rank: number | null; prev_rank: number | null }[]>(cfg, 'get_city_summaries');
       return rows.filter((r) => r.rank !== null).map((r): CitySummary => ({
@@ -140,6 +173,8 @@ export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string
       const rows = await rpc<{ followers: number; following: number; respect_this_season: number; rival_names: string[] }[]>(cfg, 'get_social', { p_name: name });
       const r = rows[0];
       if (!r) return null;
+      // The member's own rivals are shown with their city rank (home, /me): start those reads now, together with the profiles.
+      if (token && viewerP && (await viewerP)?.member.username === name) r.rival_names.forEach((n) => { void src.standings(n); });
       const rivals = (await Promise.all(r.rival_names.map((n) => src.member(n)))).filter((m): m is PublicMember => !!m).map((m): BoardRow => ({ rank: 0, member: m, movement: null }));
       return { followers: r.followers, following: r.following, respectThisSeason: r.respect_this_season, rivals } satisfies SocialSummary;
     },
```

### `app/page.tsx`

```diff
diff --git a/app/page.tsx b/app/page.tsx
index bd405dc..a968c20 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -32,27 +32,32 @@ export default async function ScenePage({ searchParams }: { searchParams: Promis
   const city = cityById(sp.city) ?? cityById(viewer?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
   const locality = viewer && viewer.member.cityId === city.id ? viewer.member.locality : city.localities[0];
   const scopes = Object.fromEntries(LEVELS.map((l) => [l, { level: l, cityId: city.id, locality } satisfies Scope])) as Record<Level, Scope>;
-  const boards = Object.fromEntries(await Promise.all(LEVELS.map(async (l) => [l, await ds.board(scopes[l], { limit: 10 })] as const))) as Record<Level, Board>;
+  // Every read below depends only on the city, so they run together: the page waits for the slowest, not the sum.
+  const since = new Date(ds.now().getTime() - 86_400_000);
+  const [boardList, events, moments, summaries, reigns, archive, respect, declared, mySocial] = await Promise.all([
+    Promise.all(LEVELS.map((l) => ds.board(scopes[l], { limit: 10 }))), ds.events(scopes.city, 3), ds.crownMoments(scopes.city, since),
+    ds.cities(), ds.throneHistory({ scope: scopes.city, limit: 40 }), ds.archive(), ds.respectBoard(scopes.city, { limit: 1 }),
+    ds.declarations({ cityId: city.id }), viewer ? ds.social(viewer.member.username) : null,
+  ]);
+  const boards = Object.fromEntries(LEVELS.map((l, n) => [l, boardList[n]])) as Record<Level, Board>;
   const names = Object.fromEntries(LEVELS.map((l) => [l, scopeName(scopes[l])])) as Record<Level, string>;
   const cityBoard = boards.city;
   const leader = cityBoard.rows[0];
-  const events = await ds.events(scopes.city, 3);
   // Crown Moment: the newest #01 change on this city board in the last 24 hours.
-  const latestMoment = (await ds.crownMoments(scopes.city, new Date(ds.now().getTime() - 86_400_000)))[0];
+  const latestMoment = moments[0];
   const nm = (m: PublicMember) => (m.masked ? m.publicLabel : m.displayName ?? m.username);
   const hoursAgo = latestMoment ? Math.max(0, Math.round((ds.now().getTime() - latestMoment.at.getTime()) / 3_600_000)) : 0;
   const isDemo = ds.availability === 'demo';
   const open = rankingsOpen(ds);
-  const [summaries, reign, archive] = await Promise.all([ds.cities(), ds.throneHistory({ scope: scopes.city, limit: 1 }), ds.archive()]);
+  const reign = reigns.slice(0, 1);
   const second = cityBoard.rows[1];
   const ranked = new Set(boards.city.rows.map((r) => r.member.locality));
 
-  const edition = buildEdition({ city, season, now: ds.now(), open, board: cityBoard, reigns: await ds.throneHistory({ scope: scopes.city, limit: 40 }), moments: latestMoment ? [latestMoment] : [], events, cities: summaries, respect: await ds.respectBoard(scopes.city, { limit: 1 }) });
-  const declared = await ds.declarations({ cityId: city.id });
+  const edition = buildEdition({ city, season, now: ds.now(), open, board: cityBoard, reigns, moments: latestMoment ? [latestMoment] : [], events, cities: summaries, respect });
   const myCity = viewer?.standings.find((s) => s.level === 'city');
   // Rival strip: each rival's current city rank next to yours.
-  const rivalNames = viewer ? (await readDemoSocial({ follows: [], rivals: (await ds.social(viewer.member.username))?.rivals.map((r) => r.member.username) ?? [], respected: {} })).rivals : [];
-  const rivals = (await Promise.all(rivalNames.map(async (u) => ({ m: await ds.member(u), s: (await ds.standings(u)).find((x) => x.level === 'city') })))).filter((r) => r.m);
+  const rivalNames = viewer ? (await readDemoSocial({ follows: [], rivals: mySocial?.rivals.map((r) => r.member.username) ?? [], respected: {} })).rivals : [];
+  const rivals = (await Promise.all(rivalNames.map(async (u) => { const [m, st] = await Promise.all([ds.member(u), ds.standings(u)]); return { m, s: st.find((x) => x.level === 'city') }; }))).filter((r) => r.m);
 
   return (
     <>
```

### `app/board/page.tsx`

```diff
diff --git a/app/board/page.tsx b/app/board/page.tsx
index 316d420..1268841 100644
--- a/app/board/page.tsx
+++ b/app/board/page.tsx
@@ -18,10 +18,14 @@ export default async function BoardPage({ searchParams }: { searchParams: Promis
   const scope = parseScope(sp, viewer?.member.cityId, viewer?.member.locality);
   const view = parseView(sp.view);
   const query = view === 'season' ? (sp.q ?? '').slice(0, 60) : '';
-  const seasonBoard = await ds.board(scope, { limit: 100, query });
-  const board = view === 'hall' ? await ds.hallOfFame(scope, { limit: 100 }) : view === 'respect' ? await ds.respectBoard(scope, { limit: 100 }) : view === 'movers' ? movers(seasonBoard) : seasonBoard;
-  // Backer counts on the season view of city and locality boards (display only; never an input to rank).
-  const backers = view === 'season' && (scope.level === 'city' || scope.level === 'locality') ? Object.fromEntries((await ds.mostBacked(scope.cityId, 100)).map((b) => [b.member.username, b.backers])) : undefined;
+  // Backer counts on the season view of city and locality boards (display only; never an input to rank). Read alongside the board.
+  const [seasonBoard, other, backed] = await Promise.all([
+    ds.board(scope, { limit: 100, query }),
+    view === 'hall' ? ds.hallOfFame(scope, { limit: 100 }) : view === 'respect' ? ds.respectBoard(scope, { limit: 100 }) : null,
+    view === 'season' && (scope.level === 'city' || scope.level === 'locality') ? ds.mostBacked(scope.cityId, 100) : null,
+  ]);
+  const board = other ?? (view === 'movers' ? movers(seasonBoard) : seasonBoard);
+  const backers = backed ? Object.fromEntries(backed.map((b) => [b.member.username, b.backers])) : undefined;
   const city = cityById(scope.cityId)!;
   const name = scopeName(scope);
   const season = ds.season();
```

### `app/me/page.tsx`

```diff
diff --git a/app/me/page.tsx b/app/me/page.tsx
index 9b00a5b..d35f919 100644
--- a/app/me/page.tsx
+++ b/app/me/page.tsx
@@ -25,10 +25,9 @@ export default async function MePage() {
   }
   const m = viewer.member;
   const city = cityById(m.cityId)!;
-  const social = await ds.social(m.username);
-  const [handles, blocks] = await Promise.all([ds.socials(m.username), ds.availability === 'live' ? myBlocks() : []]);
+  const [social, handles, blocks] = await Promise.all([ds.social(m.username), ds.socials(m.username), ds.availability === 'live' ? myBlocks() : []]);
   const st = await readDemoSocial({ follows: [], rivals: social?.rivals.map((r) => r.member.username) ?? [], respected: {} });
-  const rivals = await Promise.all(st.rivals.map(async (u) => ({ m: await ds.member(u), s: (await ds.standings(u)).find((x) => x.level === 'city') })));
+  const rivals = await Promise.all(st.rivals.map(async (u) => { const [m, st] = await Promise.all([ds.member(u), ds.standings(u)]); return { m, s: st.find((x) => x.level === 'city') }; }));
   const lockDate = placeLockedUntil(new Date('2026-08-09T00:00:00+05:30')); // demo member joined 9 Aug 2026
   const lockedUntil = lockDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
   return (
```

### `app/seal/page.tsx`

```diff
diff --git a/app/seal/page.tsx b/app/seal/page.tsx
index cef4008..9324cd4 100644
--- a/app/seal/page.tsx
+++ b/app/seal/page.tsx
@@ -40,11 +40,13 @@ export default async function SealPage() {
   const cityStanding = viewer.standings.find((s) => s.level === 'city');
   const name = m.masked ? m.publicLabel : m.displayName ?? m.username;
   const mv = movementLabel(viewer.cityMovement);
-  const [qr, achievements, reigns] = await Promise.all([profileQr(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 20 })]);
+  // One parallel batch. The "most backed" list is only shown when the member has not backed anyone, but reading it
+  // alongside costs nothing extra in time.
+  const [qr, achievements, allReigns, backing, mostBacked] = await Promise.all([profileQr(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 100 }), ds.backing(m.username), ds.mostBacked(m.cityId, 3)]);
+  const reigns = allReigns.slice(0, 20);
   const grouped = groupAchievements(achievements);
-  const claim = strongestClaim({ standings: viewer.standings, achievements, reigns: await ds.throneHistory({ username: m.username, limit: 100 }) });
-  const backing = await ds.backing(m.username);
-  const contenders = backing && !backing.pick ? await ds.mostBacked(m.cityId, 3) : [];
+  const claim = strongestClaim({ standings: viewer.standings, achievements, reigns: allReigns });
+  const contenders = backing && !backing.pick ? mostBacked : [];
   const nm2 = (x: { masked: boolean; publicLabel: string; displayName: string | null; username: string }) => (x.masked ? x.publicLabel : x.displayName ?? x.username);
   const finishes = [cityStanding?.rank ?? null, ...viewer.record.map((r) => r.cityRank)].filter((n): n is number => !!n);
   const best = finishes.length ? Math.min(...finishes) : null;
```

### `app/u/[username]/page.tsx`

```diff
diff --git a/app/u/[username]/page.tsx b/app/u/[username]/page.tsx
index c9fe2e1..7503a47 100644
--- a/app/u/[username]/page.tsx
+++ b/app/u/[username]/page.tsx
@@ -26,21 +26,25 @@ export default async function MemberPage({ params }: { params: Promise<{ usernam
   const ds = await getDataSource();
   const m = await ds.member(decodeURIComponent(username));
   if (!m) notFound();
-  const [standings, achievements, reigns, social] = await Promise.all([ds.standings(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 10 }), ds.social(m.username)]);
-  const grouped = groupAchievements(achievements);
+  // Everything below depends only on the member and the viewer, so it is read in one parallel batch.
   const viewer = await ds.viewer();
   const isSelf = viewer?.member.username === m.username;
   const demo = ds.availability === 'demo';
-  const demoState = viewer && demo ? await readDemoSocial({ follows: [], rivals: (await ds.social(viewer.member.username))?.rivals.map((r) => r.member.username) ?? [], respected: {} }) : null;
-  const liveState = viewer && !demo && !isSelf ? await socialState(m.username) : null;
-  const [backing, myBacking] = await Promise.all([ds.backing(m.username), viewer && !isSelf ? ds.backing(viewer.member.username) : null]);
-  const claim = strongestClaim({ standings, achievements, reigns: await ds.throneHistory({ username: m.username, limit: 100 }) });
+  const [standings, achievements, allReigns, social, backing, myBacking, recentMoments, handles, feudAll, liveState, viewerSocial] = await Promise.all([
+    ds.standings(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 100 }), ds.social(m.username),
+    ds.backing(m.username), viewer && !isSelf ? ds.backing(viewer.member.username) : null,
+    ds.crownMoments({ level: 'city', cityId: m.cityId, locality: m.locality }, new Date(ds.now().getTime() - 86_400_000)),
+    m.masked ? null : ds.socials(m.username), ds.declarations({ username: m.username }),
+    viewer && !demo && !isSelf ? socialState(m.username) : null, viewer && demo ? ds.social(viewer.member.username) : null,
+  ]);
+  const reigns = allReigns.slice(0, 10);
+  const grouped = groupAchievements(achievements);
+  const demoState = viewer && demo ? await readDemoSocial({ follows: [], rivals: viewerSocial?.rivals.map((r) => r.member.username) ?? [], respected: {} }) : null;
+  const claim = strongestClaim({ standings, achievements, reigns: allReigns });
   // The band a member wears for 24 hours after losing a #01.
-  const allReigns = await ds.throneHistory({ username: m.username, limit: 100 });
-  const band = dethronedBand(allReigns, await ds.crownMoments({ level: 'city', cityId: m.cityId, locality: m.locality }, new Date(ds.now().getTime() - 86_400_000)), ds.now());
-  const handles = m.masked ? null : await ds.socials(m.username);
+  const band = dethronedBand(allReigns, recentMoments, ds.now());
   const holdsCity = standings.find((x) => x.level === 'city')?.rank === 1;
-  const feud = (await ds.declarations({ username: m.username })).slice(0, 4);
+  const feud = feudAll.slice(0, 4);
   const canDeclareHere = holdsCity && viewer && !isSelf && viewer.member.cityId === m.cityId && !feud.some((d) => d.status === 'standing' && d.challenger.username === viewer.member.username);
   const today = istDay(ds.now().getTime());
   const city = cityById(m.cityId)!;
```

### `app/auth-actions.ts`

```diff
diff --git a/app/auth-actions.ts b/app/auth-actions.ts
index 644217d..3255a44 100644
--- a/app/auth-actions.ts
+++ b/app/auth-actions.ts
@@ -30,21 +30,22 @@ function checkAccount(i: RegInput): RegErrors {
   if (!e.password && i.confirm !== p) e.confirm = 'Passwords do not match.';
   return e;
 }
+// "Today" for the age check: the demo's fixed clock, otherwise real time. Only the demo needs the data source,
+// so live registration no longer waits on a season read just to validate a form.
+const today = async () => (dataSourceName() === 'demo' ? (await getDataSource()).now() : new Date());
 async function checkProfile(i: RegInput): Promise<RegErrors> {
-  const ds = await getDataSource();
-  const all = validateProfile(i, 'join', ds.availability === 'demo' ? ds.now() : new Date());
+  const all = validateProfile(i, 'join', await today());
   const e: RegErrors = { username: all.username, displayName: all.displayName, cityId: all.cityId, locality: all.locality, flexLine: all.flexLine, title: all.title };
   if (!e.username && i.username) {
     const taken = dataSourceName() === 'supabase'
       ? !(await (await supabaseAuth())!.rpc('username_available', { p_username: i.username })).data
-      : !!(await ds.member(i.username));
+      : !!(await (await getDataSource()).member(i.username));
     if (taken) e.username = 'That username is taken.';
   }
   return e;
 }
 async function checkEligibility(i: RegInput): Promise<RegErrors> {
-  const ds = await getDataSource();
-  const e: RegErrors = { dateOfBirth: validateProfile(i, 'join', ds.availability === 'demo' ? ds.now() : new Date()).dateOfBirth };
+  const e: RegErrors = { dateOfBirth: validateProfile(i, 'join', await today()).dateOfBirth };
   if (!i.adult) e.adult = 'Confirm that you are 18 or older.';
   if (!i.terms) e.terms = 'Accept the Terms and Privacy Notice to continue.';
   return e;
@@ -81,7 +82,8 @@ export async function enterTesterCode(_prev: { message: string } | null, fd: For
 
 export async function register(i: RegInput): Promise<RegResult> {
   if (!(await canRegister())) return { ok: false, errors: {}, message: CLOSED };
-  const errors = clean({ ...checkAccount(i), ...(await checkProfile(i)), ...(await checkEligibility(i)) });
+  const [prof, elig] = await Promise.all([checkProfile(i), checkEligibility(i)]);
+  const errors = clean({ ...checkAccount(i), ...prof, ...elig });
   if (Object.keys(errors).length) return { ok: false, errors, message: 'Some details need fixing.' };
   const profile: ProfileInput = { username: i.username, displayName: i.displayName?.trim(), dateOfBirth: i.dateOfBirth, cityId: i.cityId, locality: i.locality, title: i.title, flexLine: i.flexLine?.trim(), mystery: !!i.mystery };
 
```

## f1d6566f34ce866d1f0b9426e26ed8567d1857d0 2026-11-14 11:42:31 +0000 Navigation feedback: loading states for every section without not-found or redirects, progress bar for all in-site navigation; India page in one batch

### `components/NavProgress.tsx`

```diff
diff --git a/components/NavProgress.tsx b/components/NavProgress.tsx
new file mode 100644
index 0000000..f82f7d8
--- /dev/null
+++ b/components/NavProgress.tsx
@@ -0,0 +1,32 @@
+'use client';
+// Immediate feedback for every in-site navigation, including ones that stay on the same page with new filters
+// (where Next.js keeps the old page until the new one arrives): a thin bar appears on click and goes as soon as
+// the new address is in place. Pure feedback: it changes no data and no routing.
+import { useEffect, useState } from 'react';
+import { usePathname, useSearchParams } from 'next/navigation';
+
+export const NAV_START = 'bkp:navstart';
+export const startNav = () => window.dispatchEvent(new Event(NAV_START));
+
+export function NavProgress() {
+  const path = usePathname(); const search = useSearchParams();
+  const [busy, setBusy] = useState(false);
+  useEffect(() => { setBusy(false); }, [path, search]);
+  useEffect(() => {
+    const onClick = (e: MouseEvent) => {
+      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
+      const a = (e.target as Element | null)?.closest?.('a');
+      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
+      const url = new URL(a.href, location.href);
+      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
+      if (url.pathname === location.pathname && url.search === location.search) return;
+      setBusy(true);
+    };
+    const onStart = () => setBusy(true);
+    document.addEventListener('click', onClick, true);
+    window.addEventListener(NAV_START, onStart);
+    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener(NAV_START, onStart); };
+  }, []);
+  useEffect(() => { if (!busy) return; const t = setTimeout(() => setBusy(false), 15000); return () => clearTimeout(t); }, [busy]);
+  return busy ? <div className="nav-progress" role="progressbar" aria-label="Loading page" data-loading="" /> : null;
+}
```

### `components/PageSkeleton.tsx`

```diff
diff --git a/components/PageSkeleton.tsx b/components/PageSkeleton.tsx
new file mode 100644
index 0000000..d424f4f
--- /dev/null
+++ b/components/PageSkeleton.tsx
@@ -0,0 +1,17 @@
+// Shown the moment a link is clicked, while the server prepares the next page (used by each section's loading.tsx).
+// Not used on pages that can answer "not found" or redirect: under a loading state those answers would be sent as
+// a normal page instead of a 404 or a redirect. Those pages get the navigation bar (components/NavProgress.tsx) instead.
+// The header and navigation stay
+// in place; only the page area is replaced. Next.js also prefetches this shell for every link in view, so it
+// appears without waiting on the network.
+export function PageSkeleton() {
+  return (
+    <div aria-busy="true" aria-live="polite" data-loading="">
+      <section className="page-intro"><div><div className="eyebrow skeleton" style={{ width: 160, height: 14 }} /><div className="skeleton" style={{ width: 'min(520px, 80%)', height: 'clamp(56px, 9vw, 120px)', marginTop: 14 }} /></div><p className="sr-only">Loading…</p></section>
+      <div className="board-layout" style={{ marginTop: 23 }}>
+        <div className="board-panel">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 66, borderBottom: '1px solid var(--line-soft)' }} />)}</div>
+        <div className="skeleton" style={{ height: 320 }} />
+      </div>
+    </div>
+  );
+}
```

### `app/(home)/loading.tsx`

```diff
diff --git a/app/(home)/loading.tsx b/app/(home)/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/(home)/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/board/loading.tsx`

```diff
diff --git a/app/board/loading.tsx b/app/board/loading.tsx
index 5597d5f..156b051 100644
--- a/app/board/loading.tsx
+++ b/app/board/loading.tsx
@@ -1,6 +1,6 @@
 export default function Loading() {
   return (
-    <div aria-busy="true" aria-live="polite">
+    <div aria-busy="true" aria-live="polite" data-loading="">
       <section className="page-intro"><div><div className="eyebrow">The public record / 01</div><h1>The board.</h1></div><p>Loading the board…</p></section>
       <div className="board-layout" style={{ marginTop: 23 }}>
         <div className="board-panel">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 66, borderBottom: '1px solid var(--line-soft)' }} />)}</div>
```

### `app/cities/loading.tsx`

```diff
diff --git a/app/cities/loading.tsx b/app/cities/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/cities/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/gazette/loading.tsx`

```diff
diff --git a/app/gazette/loading.tsx b/app/gazette/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/gazette/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/india/loading.tsx`

```diff
diff --git a/app/india/loading.tsx b/app/india/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/india/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/seal/loading.tsx`

```diff
diff --git a/app/seal/loading.tsx b/app/seal/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/seal/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/me/loading.tsx`

```diff
diff --git a/app/me/loading.tsx b/app/me/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/me/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/archive/loading.tsx`

```diff
diff --git a/app/archive/loading.tsx b/app/archive/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/archive/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/throne/loading.tsx`

```diff
diff --git a/app/throne/loading.tsx b/app/throne/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/throne/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/closing/loading.tsx`

```diff
diff --git a/app/closing/loading.tsx b/app/closing/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/closing/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/invite/loading.tsx`

```diff
diff --git a/app/invite/loading.tsx b/app/invite/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/invite/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/rank-up/loading.tsx`

```diff
diff --git a/app/rank-up/loading.tsx b/app/rank-up/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/rank-up/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/simulator/loading.tsx`

```diff
diff --git a/app/simulator/loading.tsx b/app/simulator/loading.tsx
new file mode 100644
index 0000000..f316e79
--- /dev/null
+++ b/app/simulator/loading.tsx
@@ -0,0 +1,5 @@
+import { PageSkeleton } from '@/components/PageSkeleton';
+
+export default function Loading() {
+  return <PageSkeleton />;
+}
```

### `app/layout.tsx`

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index 04fc219..0f62bb2 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -9,6 +9,8 @@ import { signOut } from './auth-actions';
 import { currentAccount } from '@/lib/supabase-server';
 import { indexingAllowed, testSeason } from '@/lib/flags';
 import { MainNav } from '@/components/MainNav';
+import { NavProgress } from '@/components/NavProgress';
+import { Suspense } from 'react';
 import { ProfileDialogProvider } from '@/components/ProfileDialog';
 
 
@@ -50,6 +52,7 @@ export default async function RootLayout({ children }: { children: React.ReactNo
             {open && ds.availability === 'live' && testSeason() && <span className="demo-flag" data-testid="test-season-flag">Test season</span>}
           </div>
         </div>
+        <Suspense fallback={null}><NavProgress /></Suspense>
         <ProfileDialogProvider>
           <div className="shell">
             <header className="site-header">
```

### `app/india/page.tsx`

```diff
diff --git a/app/india/page.tsx b/app/india/page.tsx
index f9b043b..92408a2 100644
--- a/app/india/page.tsx
+++ b/app/india/page.tsx
@@ -11,10 +11,11 @@ export const metadata: Metadata = { title: 'India' };
 export default async function IndiaPage() {
   const ds = await getDataSource();
   const season = ds.season();
-  const [summaries, viewer] = await Promise.all([ds.cities(), ds.viewer()]);
-  const homeCity = cityById(viewer?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
+  // The India board is the same for everyone (the city only labels it), so it is read alongside the rest.
+  const def = cityById(DEFAULT_CITY_ID)!;
+  const [summaries, viewer, national] = await Promise.all([ds.cities(), ds.viewer(), ds.board({ level: 'india', cityId: def.id, locality: def.localities[0] }, { limit: 5 })]);
+  const homeCity = cityById(viewer?.member.cityId) ?? def;
   const mine = summaries.find((s) => s.cityId === homeCity.id);
-  const national = await ds.board({ level: 'india', cityId: homeCity.id, locality: homeCity.localities[0] }, { limit: 5 });
   const movers = summaries.filter((s) => s.previousRank !== null && s.previousRank !== s.rank);
   return (
     <>
```

### `components/BoardFilters.tsx`

```diff
diff --git a/components/BoardFilters.tsx b/components/BoardFilters.tsx
index de1f3f2..d534737 100644
--- a/components/BoardFilters.tsx
+++ b/components/BoardFilters.tsx
@@ -1,6 +1,7 @@
 'use client';
 // City, locality and search controls for The Board. They only change the URL; the server ranks the board.
 import { useRouter } from 'next/navigation';
+import { startNav } from './NavProgress';
 import { useState } from 'react';
 import type { Level } from '@/lib/geo';
 
@@ -12,6 +13,7 @@ export function BoardFilters({ view, level, cityId, locality, query, cities, loc
   const go = (p: Record<string, string>) => {
     const s = new URLSearchParams({ level, city: cityId, ...(level === 'locality' ? { locality } : {}), ...(view !== 'season' && view !== 'none' ? { view } : {}), ...p });
     if (!s.get('q')) s.delete('q');
+    startNav();
     router.push(`${basePath}?${s.toString()}`);
   };
   return (
```

### `components/SignInForm.tsx`

```diff
diff --git a/components/SignInForm.tsx b/components/SignInForm.tsx
index 4191dfd..2ca7e6d 100644
--- a/components/SignInForm.tsx
+++ b/components/SignInForm.tsx
@@ -1,4 +1,5 @@
 'use client';
+import Link from 'next/link';
 import { useActionState, useState } from 'react';
 import { signIn, type SignInResult } from '@/app/auth-actions';
 
@@ -10,7 +11,7 @@ export function SignInForm({ demo }: { demo: boolean }) {
       {!demo && <>
         <label className="field"><span className="field-label">Email</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
         <label className="field"><span className="field-label">Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
-        <p style={{ margin: '8px 0 0', fontSize: 14 }}><a href="/forgot" style={{ textDecoration: 'underline' }}>Forgot your password?</a></p>
+        <p style={{ margin: '8px 0 0', fontSize: 14 }}><Link href="/forgot" style={{ textDecoration: 'underline' }}>Forgot your password?</Link></p>
       </>}
       {res && !res.ok && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{res.message}</p>}
       <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }} data-testid="signin-submit">{pending ? 'Signing in…' : demo ? 'Continue as the demo member' : 'Sign in'} <span className="arrow" aria-hidden="true">↗</span></button>
```

### `app/globals.css`

```diff
diff --git a/app/globals.css b/app/globals.css
index f0e99b3..ae5b883 100644
--- a/app/globals.css
+++ b/app/globals.css
@@ -1000,3 +1000,8 @@ h1, h2, h3, h4 { text-wrap: balance; }
 .dethroned span { font-size: 16px; } .dethroned a { text-decoration: underline; font-weight: 700; }
 .dethroned small { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #B1CCC3; flex-basis: 100%; }
 @media (max-width: 860px) { .bill-stage { grid-template-columns: 1fr; } .bill { margin: 0 auto; } }
+
+/* ---------- Navigation feedback ---------- */
+.nav-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 1000; background: linear-gradient(90deg, transparent, #0C251F 30%, #CCFF00 50%, #0C251F 70%, transparent); background-size: 200% 100%; animation: nav-progress 1s linear infinite; }
+@keyframes nav-progress { from { background-position: 100% 0; } to { background-position: -100% 0; } }
+@media (prefers-reduced-motion: reduce) { .nav-progress { animation: none; background: #0C251F; } }
```

## 1f13233e2f2b5e1e600c45b0062972e5f92f53c3 2026-11-14 12:20:41 +0000 Section A on staging: anti-snipe on #01 only, operations checks and health probe, CI and uptime workflows, no committed staging password

### `app/api/health/route.ts`

```diff
diff --git a/app/api/health/route.ts b/app/api/health/route.ts
new file mode 100644
index 0000000..e58a5a0
--- /dev/null
+++ b/app/api/health/route.ts
@@ -0,0 +1,29 @@
+// Health probe for uptime monitoring. Says whether the site can reach the ranking database, whether the season
+// clock is running and whether any integrity alert is open. No member data, no alert details.
+// 200 = healthy, 503 = needs attention. Cached at the edge for 10 s so a monitor (or a crowd) cannot load the database.
+import { NextResponse } from 'next/server';
+import { dataSourceName, supabaseConfig } from '@/lib/config';
+
+export const dynamic = 'force-dynamic';
+const CACHE = { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' };
+
+export async function GET() {
+  const source = dataSourceName();
+  if (source === 'demo') return NextResponse.json({ healthy: true, source }, { headers: CACHE });
+  const cfg = supabaseConfig();
+  if (source === 'unavailable' || !cfg) return NextResponse.json({ healthy: false, source, database: 'not configured' }, { status: 503, headers: CACHE });
+  const started = Date.now();
+  try {
+    const res = await fetch(`${cfg.url}/rest/v1/rpc/get_health`, {
+      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
+      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }, body: '{}',
+    });
+    const ms = Date.now() - started;
+    if (res.status === 404) return NextResponse.json({ healthy: true, source, database: 'ok', checks: 'not installed', ms }, { headers: CACHE });
+    if (!res.ok) return NextResponse.json({ healthy: false, source, database: `error ${res.status}`, ms }, { status: 503, headers: CACHE });
+    const h = await res.json() as { healthy: boolean; season: unknown; clock_age_seconds: number | null; checked_at: string };
+    return NextResponse.json({ ...h, source, ms, region: process.env.VERCEL_REGION ?? null }, { status: h.healthy ? 200 : 503, headers: CACHE });
+  } catch {
+    return NextResponse.json({ healthy: false, source, database: 'unreachable', ms: Date.now() - started }, { status: 503, headers: CACHE });
+  }
+}
```

## 087f92a0c50e4da1fb210465d3e100416f80ba1e 2026-11-14 16:20:07 +0000 National city expansion: 45 cities in 19 states/UTs and 6 regions

### `app/(home)/page.tsx`

```diff
diff --git a/app/(home)/page.tsx b/app/(home)/page.tsx
index 3f29a47..fd9180b 100644
--- a/app/(home)/page.tsx
+++ b/app/(home)/page.tsx
@@ -1,7 +1,7 @@
 import Link from 'next/link';
 import { getDataSource, rankingsOpen } from '@/lib/data';
 import type { Board, BoardEvent } from '@/lib/data/types';
-import { CITIES, STATES, cityById, DEFAULT_CITY_ID, scopeName, type Level, type Scope } from '@/lib/geo';
+import { CITIES, STATES, cityById, DEFAULT_CITY_ID, featuredCities, scopeName, type Level, type Scope } from '@/lib/geo';
 import { timeLeft } from '@/lib/season';
 import { inr, pad2 } from '@/lib/format';
 import { HomeBoard } from '@/components/HomeBoard';
@@ -171,15 +171,16 @@ export default async function ScenePage({ searchParams }: { searchParams: Promis
       </div>
 
       <div className="section-head"><div><p>Territories</p><h2>Pick your ground</h2></div>
-        <Link className="textlink" href="/cities">All cities ↗</Link></div>
-      <div className="terr-grid">
-        {CITIES.map((c) => { const sm = summaries.find((x) => x.cityId === c.id); return (
+        <Link className="textlink" href="/cities">All {CITIES.length} cities ↗</Link></div>
+      <div className="terr-grid" data-testid="featured-cities">
+        {featuredCities({ viewerCityId: viewer?.member.cityId, currentCityId: city.id, summaries }).map((c) => { const sm = summaries.find((x) => x.cityId === c.id); return (
           <Link className="terr" key={c.id} href={`/?city=${c.id}`} aria-current={c.id === city.id ? 'true' : undefined} scroll={false}>
             <small>{STATES[c.state]}</small><b>{c.name}</b>
             <span>{sm ? `${sm.members} ranked · #${pad2(sm.rank)} city` : 'Open territory'}</span>
           </Link>
         ); })}
       </div>
+      <Link className="btn explore-cities" href="/cities" data-testid="explore-cities">Explore all {CITIES.length} cities <span className="arrow">→</span></Link>
       <div className="loc-chips" aria-label={`Localities in ${city.name}`}>
         {city.localities.filter((l) => l !== 'Other').map((l) => (
           <Link key={l} href={`/board?level=locality&city=${city.id}&locality=${encodeURIComponent(l)}`} className={ranked.has(l) ? '' : 'open'}>{l}{ranked.has(l) ? '' : ' · unclaimed'}</Link>
```

### `lib/data/demo.ts`

```diff
diff --git a/lib/data/demo.ts b/lib/data/demo.ts
index 8e00fca..59c54b3 100644
--- a/lib/data/demo.ts
+++ b/lib/data/demo.ts
@@ -105,7 +105,8 @@ function buildLog() {
   const r500 = (v: number) => Math.max(500, 500 * Math.round(v / 500));
   const members: EngineMember[] = [];
   const profile = new Map<string, { p: P; city: string; memberNo: number }>();
-  for (const c of CITIES) for (const p of PEOPLE[c.id]) {
+  // Demo people exist for the five launch cities only; the other cities stay empty (nothing is invented for them).
+  for (const c of CITIES) for (const p of PEOPLE[c.id] ?? []) {
     members.push({ id: p[0], cityId: c.id, state: c.state, locality: p[2] });
     profile.set(p[0], { p, city: c.id, memberNo: p[0] === VIEWER ? 4812 : 100 + Math.floor(rnd() * 4900) });
   }
@@ -118,7 +119,7 @@ function buildLog() {
   for (const s of SIM_SEASONS) {
     const end = Math.min(s.scheduledEnd, SIM_NOW) - HOUR;
     for (const c of CITIES) {
-      PEOPLE[c.id].forEach((p, i) => {
+      (PEOPLE[c.id] ?? []).forEach((p, i) => {
         if (scripted.has(p[0])) return;
         if (rnd() < 0.18 && s.id < 4) return; // some members skip a season (breaks streaks)
         const target = Math.max(1000, r500(TOP[c.id] * Math.pow(0.8, i) * (0.85 + rnd() * 0.3) * (s.id === 4 ? 0.85 : 1)));
@@ -315,7 +316,8 @@ export const demoSource: DataSource = {
     } satisfies ViewerSeal;
   },
   async cities() {
-    const tot = (t: number) => CITIES.map((c) => ({ c, t: boardAt(SIM, CURRENT.id, `city:${c.id}`, t).reduce((a, r) => a + r.score, 0) })).sort((a, b) => b.t - a.t);
+    // Like the live source: only cities with a season total are ranked; empty cities have no summary.
+    const tot = (t: number) => CITIES.map((c) => ({ c, t: boardAt(SIM, CURRENT.id, `city:${c.id}`, t).reduce((a, r) => a + r.score, 0) })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t);
     const now = tot(SIM_NOW), prev = tot(SIM_NOW - DAY);
     return now.map(({ c, t }, i): CitySummary => {
       const b = boardAt(SIM, CURRENT.id, `city:${c.id}`, SIM_NOW);
```

### `components/CityIndex.tsx`

```diff
diff --git a/components/CityIndex.tsx b/components/CityIndex.tsx
index 0af3830..1ec67aa 100644
--- a/components/CityIndex.tsx
+++ b/components/CityIndex.tsx
@@ -1,40 +1,60 @@
 'use client';
-// City index with working region filter and sort. Sorting here only orders cities for browsing;
-// it never decides a member's rank.
+// City index: search, region filter and sort, with cities grouped under their state or union territory.
+// Sorting here only orders cities for browsing; it never decides a member's rank.
 import Link from 'next/link';
 import { useMemo, useState } from 'react';
 
-export interface CityCardData { id: string; name: string; stateCode: string; region: string; mark: string; nickname: string; members: number | null; total: number | null; isViewerCity: boolean; }
+export interface CityCardData { id: string; name: string; stateCode: string; stateName: string; region: string; mark: string; nickname: string; members: number | null; total: number | null; isViewerCity: boolean; }
 
-export function CityIndex({ cities, regions }: { cities: CityCardData[]; regions: string[] }) {
+const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim();
+
+export function CityIndex({ cities, regions, states }: { cities: CityCardData[]; regions: string[]; states: { code: string; name: string }[] }) {
   const [region, setRegion] = useState('All');
   const [sort, setSort] = useState<'members' | 'alpha' | 'total'>('members');
-  const list = useMemo(() => {
-    const l = cities.filter((c) => region === 'All' || c.region === region);
-    return [...l].sort((a, b) => sort === 'alpha' ? a.name.localeCompare(b.name) : sort === 'total' ? (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name) : (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name));
-  }, [cities, region, sort]);
+  const [query, setQuery] = useState('');
+  const groups = useMemo(() => {
+    const q = norm(query);
+    const shown = cities.filter((c) => (region === 'All' || c.region === region) && (!q || norm(c.name).includes(q) || norm(c.stateName).includes(q)));
+    const order = (a: CityCardData, b: CityCardData) => sort === 'alpha' ? a.name.localeCompare(b.name)
+      : sort === 'total' ? (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name)
+      : (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name);
+    return states.map((s) => ({ ...s, cities: shown.filter((c) => c.stateCode === s.code).sort(order) })).filter((g) => g.cities.length > 0);
+  }, [cities, states, region, sort, query]);
+  const count = groups.reduce((n, g) => n + g.cities.length, 0);
   return (
     <>
-      <div className="filterbar" role="group" aria-label="Filter cities">
-        {['All', ...regions].map((r) => (
-          <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)}>{r === 'All' ? 'All cities' : `${r} India`}</button>
-        ))}
+      <div className="filterbar city-filters" role="group" aria-label="Find and filter cities">
+        <label><span className="sr-only">Search cities or states</span>
+          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a city or state" data-testid="city-search" />
+        </label>
         <label><span className="sr-only">Sort cities</span>
           <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
             <option value="members">Sort: Most members</option><option value="alpha">Alphabetical</option><option value="total">Top board total</option>
           </select>
         </label>
+        <div className="region-chips" role="group" aria-label="Region">
+          {['All', ...regions].map((r) => (
+            <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)} data-testid={`region-${r}`}>{r === 'All' ? 'All cities' : `${r} India`}</button>
+          ))}
+        </div>
       </div>
-      <div className="city-grid">
-        {list.map((c) => (
-          <Link key={c.id} className="city-card" href={`/board?level=city&city=${c.id}`} data-testid={`city-${c.id}`}>
-            <span className="watermark" aria-hidden="true">{c.mark}</span>
-            <span className="city-rank">{c.stateCode} / {c.region} India</span>
-            <span><h3>{c.name}</h3><p>{c.nickname}{c.members !== null ? ` · ${c.members} on the board` : ''}</p></span>
-            <span className="city-footer"><span>{c.isViewerCity ? 'Your city' : 'Season open'}</span><b>Open board ↗</b></span>
-          </Link>
-        ))}
-      </div>
+      <p className="city-count" aria-live="polite" data-testid="city-count">{count === cities.length ? `${count} cities` : `${count} of ${cities.length} cities`}</p>
+      {groups.length === 0 && <p className="activity-empty" data-testid="city-empty">No city or state matches “{query}”.</p>}
+      {groups.map((g) => (
+        <section key={g.code} className="state-group" aria-labelledby={`state-${g.code}`} data-testid={`state-${g.code}`}>
+          <h2 className="state-head" id={`state-${g.code}`}>{g.name}<span>{g.cities.length} {g.cities.length === 1 ? 'city' : 'cities'}</span></h2>
+          <div className="city-grid">
+            {g.cities.map((c) => (
+              <Link key={c.id} className="city-card" href={`/board?level=city&city=${c.id}`} data-testid={`city-${c.id}`}>
+                <span className="watermark" aria-hidden="true">{c.mark}</span>
+                <span className="city-rank">{c.stateCode} / {c.region} India</span>
+                <span><h3>{c.name}</h3><p>{c.nickname}{c.members !== null ? ` · ${c.members} on the board` : ''}</p></span>
+                <span className="city-footer"><span>{c.isViewerCity ? 'Your city' : 'Season open'}</span><b>Open board ↗</b></span>
+              </Link>
+            ))}
+          </div>
+        </section>
+      ))}
     </>
   );
 }
```

## Repair (uncommitted, this audit): `git diff` on `feature/website-v1` against 087f92a

### `app/(home)/page.tsx`

```diff
diff --git a/app/(home)/page.tsx b/app/(home)/page.tsx
index fd9180b..3c78d41 100644
--- a/app/(home)/page.tsx
+++ b/app/(home)/page.tsx
@@ -1,6 +1,7 @@
 import Link from 'next/link';
-import { getDataSource, rankingsOpen } from '@/lib/data';
-import type { Board, BoardEvent } from '@/lib/data/types';
+import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
+import type { Board, BoardEvent, CitySummary } from '@/lib/data/types';
+import { Suspense } from 'react';
 import { CITIES, STATES, cityById, DEFAULT_CITY_ID, featuredCities, scopeName, type Level, type Scope } from '@/lib/geo';
 import { timeLeft } from '@/lib/season';
 import { inr, pad2 } from '@/lib/format';
@@ -25,20 +26,25 @@ function eventText(e: BoardEvent) {
 
 export default async function ScenePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
   const sp = await searchParams;
-  const ds = await getDataSource();
-  const season = ds.season();
-  const left = timeLeft(season, ds.now());
-  const viewer = await ds.viewer();
-  const city = cityById(sp.city) ?? cityById(viewer?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
-  const locality = viewer && viewer.member.cityId === city.id ? viewer.member.locality : city.localities[0];
+  // Reads start in the same round trip as the season row. Only the member's own profile (one prefetched read)
+  // is needed before them, to pick the city; the full viewer (standings) is read alongside the rest.
+  const ds = await getDataSourceEarly();
+  const me = await ds.viewerMember();
+  const city = cityById(sp.city) ?? cityById(me?.cityId) ?? cityById(DEFAULT_CITY_ID)!;
+  const locality = me && me.cityId === city.id ? me.locality : city.localities[0];
   const scopes = Object.fromEntries(LEVELS.map((l) => [l, { level: l, cityId: city.id, locality } satisfies Scope])) as Record<Level, Scope>;
   // Every read below depends only on the city, so they run together: the page waits for the slowest, not the sum.
   const since = new Date(ds.now().getTime() - 86_400_000);
-  const [boardList, events, moments, summaries, reigns, archive, respect, declared, mySocial] = await Promise.all([
+  // The city summaries (45 cities) are the slowest read and only feed the Gazette headline and the featured
+  // cities: they stream into those two sections instead of holding back the whole page.
+  const summariesP = ds.cities();
+  const [boardList, events, moments, reigns, archive, respect, declared, mySocial, viewer] = await Promise.all([
     Promise.all(LEVELS.map((l) => ds.board(scopes[l], { limit: 10 }))), ds.events(scopes.city, 3), ds.crownMoments(scopes.city, since),
-    ds.cities(), ds.throneHistory({ scope: scopes.city, limit: 40 }), ds.archive(), ds.respectBoard(scopes.city, { limit: 1 }),
-    ds.declarations({ cityId: city.id }), viewer ? ds.social(viewer.member.username) : null,
+    ds.throneHistory({ scope: scopes.city, limit: 40 }), ds.archive(), ds.respectBoard(scopes.city, { limit: 1 }),
+    ds.declarations({ cityId: city.id }), me ? ds.social(me.username) : null, ds.viewer(), ds.ready(),
   ]);
+  const season = ds.season();
+  const left = timeLeft(season, ds.now());
   const boards = Object.fromEntries(LEVELS.map((l, n) => [l, boardList[n]])) as Record<Level, Board>;
   const names = Object.fromEntries(LEVELS.map((l) => [l, scopeName(scopes[l])])) as Record<Level, string>;
   const cityBoard = boards.city;
@@ -53,7 +59,7 @@ export default async function ScenePage({ searchParams }: { searchParams: Promis
   const second = cityBoard.rows[1];
   const ranked = new Set(boards.city.rows.map((r) => r.member.locality));
 
-  const edition = buildEdition({ city, season, now: ds.now(), open, board: cityBoard, reigns, moments: latestMoment ? [latestMoment] : [], events, cities: summaries, respect });
+  const editionInput = { city, season, now: ds.now(), open, board: cityBoard, reigns, moments: latestMoment ? [latestMoment] : [], events, respect };
   const myCity = viewer?.standings.find((s) => s.level === 'city');
   // Rival strip: each rival's current city rank next to yours.
   const rivalNames = viewer ? (await readDemoSocial({ follows: [], rivals: mySocial?.rivals.map((r) => r.member.username) ?? [], respected: {} })).rivals : [];
@@ -90,9 +96,9 @@ export default async function ScenePage({ searchParams }: { searchParams: Promis
       {open && season.endsAt.getTime() - ds.now().getTime() < 86_400_000 && (
         <Link className="gz-strip" href={`/closing?city=${city.id}`} data-testid="closing-strip"><small>The Closing</small><b>The board closes within a day. Watch the final stretch.</b><span>Open ↗</span></Link>
       )}
-      <Link className="gz-strip" href={`/gazette?city=${city.id}`} data-testid="gazette-strip">
-        <small>The {city.name} Gazette</small><b>{edition.lead.headline}</b><span>Read today&apos;s edition ↗</span>
-      </Link>
+      <Suspense fallback={<GazetteStripView cityId={city.id} cityName={city.name} headline={'\u00a0'} pending />}>
+        <GazetteStrip summariesP={summariesP} input={editionInput} />
+      </Suspense>
 
       {latestMoment && (
         <CrownMoment moment={{ id: `${latestMoment.boardName}-${latestMoment.at.getTime()}`, boardName: latestMoment.boardName, toName: nm(latestMoment.to),
@@ -172,14 +178,9 @@ export default async function ScenePage({ searchParams }: { searchParams: Promis
 
       <div className="section-head"><div><p>Territories</p><h2>Pick your ground</h2></div>
         <Link className="textlink" href="/cities">All {CITIES.length} cities ↗</Link></div>
-      <div className="terr-grid" data-testid="featured-cities">
-        {featuredCities({ viewerCityId: viewer?.member.cityId, currentCityId: city.id, summaries }).map((c) => { const sm = summaries.find((x) => x.cityId === c.id); return (
-          <Link className="terr" key={c.id} href={`/?city=${c.id}`} aria-current={c.id === city.id ? 'true' : undefined} scroll={false}>
-            <small>{STATES[c.state]}</small><b>{c.name}</b>
-            <span>{sm ? `${sm.members} ranked · #${pad2(sm.rank)} city` : 'Open territory'}</span>
-          </Link>
-        ); })}
-      </div>
+      <Suspense fallback={<FeaturedCitiesView viewerCityId={me?.cityId ?? null} currentCityId={city.id} summaries={null} />}>
+        <FeaturedCities summariesP={summariesP} viewerCityId={me?.cityId ?? null} currentCityId={city.id} />
+      </Suspense>
       <Link className="btn explore-cities" href="/cities" data-testid="explore-cities">Explore all {CITIES.length} cities <span className="arrow">→</span></Link>
       <div className="loc-chips" aria-label={`Localities in ${city.name}`}>
         {city.localities.filter((l) => l !== 'Other').map((l) => (
@@ -219,3 +220,33 @@ export default async function ScenePage({ searchParams }: { searchParams: Promis
     </>
   );
 }
+
+// ---- Sections fed by the city summaries, streamed so the rest of the page does not wait for them ----
+type EditionInput = Omit<Parameters<typeof buildEdition>[0], 'cities'>;
+// Placeholders (pending) carry no test id: while a streamed section is swapped in, both briefly exist in the page.
+function GazetteStripView({ cityId, cityName, headline, pending = false }: { cityId: string; cityName: string; headline: string; pending?: boolean }) {
+  return (
+    <Link className="gz-strip" href={`/gazette?city=${cityId}`} data-testid={pending ? undefined : 'gazette-strip'}>
+      <small>The {cityName} Gazette</small><b>{headline}</b><span>Read today&apos;s edition ↗</span>
+    </Link>
+  );
+}
+async function GazetteStrip({ summariesP, input }: { summariesP: Promise<CitySummary[]>; input: EditionInput }) {
+  const edition = buildEdition({ ...input, cities: await summariesP });
+  return <GazetteStripView cityId={input.city.id} cityName={input.city.name} headline={edition.lead.headline} />;
+}
+function FeaturedCitiesView({ viewerCityId, currentCityId, summaries }: { viewerCityId: string | null; currentCityId: string; summaries: CitySummary[] | null }) {
+  return (
+    <div className="terr-grid" data-testid={summaries ? 'featured-cities' : undefined} aria-busy={summaries ? undefined : true}>
+      {featuredCities({ viewerCityId, currentCityId, summaries: summaries ?? [] }).map((c) => { const sm = summaries?.find((x) => x.cityId === c.id); return (
+        <Link className="terr" key={c.id} href={`/?city=${c.id}`} aria-current={c.id === currentCityId ? 'true' : undefined} scroll={false}>
+          <small>{STATES[c.state]}</small><b>{c.name}</b>
+          <span>{!summaries ? '\u00a0' : sm ? `${sm.members} ranked · #${pad2(sm.rank)} city` : 'Open territory'}</span>
+        </Link>
+      ); })}
+    </div>
+  );
+}
+async function FeaturedCities({ summariesP, viewerCityId, currentCityId }: { summariesP: Promise<CitySummary[]>; viewerCityId: string | null; currentCityId: string }) {
+  return <FeaturedCitiesView viewerCityId={viewerCityId} currentCityId={currentCityId} summaries={await summariesP} />;
+}
```

### `app/board/page.tsx`

```diff
diff --git a/app/board/page.tsx b/app/board/page.tsx
index 094d9f0..8886fe5 100644
--- a/app/board/page.tsx
+++ b/app/board/page.tsx
@@ -1,6 +1,6 @@
 import type { Metadata } from 'next';
 import Link from 'next/link';
-import { getDataSource, rankingsOpen } from '@/lib/data';
+import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
 import { BOARD_VIEWS, VIEW_LABEL, movers, parseView } from '@/lib/data/views';
 import { cityOptionGroups, LEVELS, LEVEL_LABEL, cityById, parseScope, scopeName } from '@/lib/geo';
 import { timeLeft } from '@/lib/season';
@@ -13,8 +13,11 @@ export const metadata: Metadata = { title: 'The Board' };
 
 export default async function BoardPage({ searchParams }: { searchParams: Promise<{ level?: string; city?: string; locality?: string; q?: string; view?: string }> }) {
   const sp = await searchParams;
-  const ds = await getDataSource();
-  const viewer = await ds.viewer();
+  // Reads start without waiting for the season row; only the member's own profile (one prefetched read) decides
+  // which board to show when the address names none.
+  const ds = await getDataSourceEarly();
+  const named = !!sp.city && (sp.level !== 'locality' || !!sp.locality);   // the address fully decides the board
+  const viewer = named ? null : await ds.viewerMember().then((member) => (member ? { member } : null));
   const scope = parseScope(sp, viewer?.member.cityId, viewer?.member.locality);
   const view = parseView(sp.view);
   const query = view === 'season' ? (sp.q ?? '').slice(0, 60) : '';
@@ -24,6 +27,7 @@ export default async function BoardPage({ searchParams }: { searchParams: Promis
     view === 'hall' ? ds.hallOfFame(scope, { limit: 100 }) : view === 'respect' ? ds.respectBoard(scope, { limit: 100 }) : null,
     view === 'season' && (scope.level === 'city' || scope.level === 'locality') ? ds.mostBacked(scope.cityId, 100) : null,
   ]);
+  await ds.ready();
   const board = other ?? (view === 'movers' ? movers(seasonBoard) : seasonBoard);
   const backers = backed ? Object.fromEntries(backed.map((b) => [b.member.username, b.backers])) : undefined;
   const city = cityById(scope.cityId)!;
@@ -33,6 +37,7 @@ export default async function BoardPage({ searchParams }: { searchParams: Promis
   const href = (l: string, vw: string) => `/board?level=${l}&city=${scope.cityId}${l === 'locality' ? `&locality=${encodeURIComponent(scope.locality)}` : ''}${vw !== 'season' ? `&view=${vw}` : ''}`;
   const levelHref = (l: string) => href(l, view);
   const v = seasonBoard.viewerRow;
+  const me = viewer?.member ?? (await ds.viewerMember());
   const unavailable = !rankingsOpen(ds);
 
   return (
@@ -79,8 +84,8 @@ export default async function BoardPage({ searchParams }: { searchParams: Promis
           ) : (
             <>
               <div className="big">—</div>
-              <h3>{viewer ? <>Not on<br />this board.</> : <>Not on the<br />register yet.</>}</h3>
-              <p>{viewer ? `Your boards are ${viewer.member.locality}, ${CITY_NAMES[viewer.member.cityId]}, and their state and India boards.` : 'Create a profile to see your own row here.'}</p>
+              <h3>{me ? <>Not on<br />this board.</> : <>Not on the<br />register yet.</>}</h3>
+              <p>{me ? `Your boards are ${me.locality}, ${CITY_NAMES[me.cityId]}, and their state and India boards.` : 'Create a profile to see your own row here.'}</p>
             </>
           )}
           <div className="aside-stat"><span>Season</span><b>{season.label}</b></div>
```

### `app/cities/page.tsx`

```diff
diff --git a/app/cities/page.tsx b/app/cities/page.tsx
index 2b52a82..e0a0d1c 100644
--- a/app/cities/page.tsx
+++ b/app/cities/page.tsx
@@ -1,13 +1,15 @@
 import type { Metadata } from 'next';
-import { getDataSource, rankingsOpen } from '@/lib/data';
+import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
 import { CITIES, REGIONS, STATES, STATE_ORDER } from '@/lib/geo';
 import { CityIndex, type CityCardData } from '@/components/CityIndex';
 
 export const metadata: Metadata = { title: 'Cities' };
 
 export default async function CitiesPage() {
-  const ds = await getDataSource();
-  const [summaries, viewer] = await Promise.all([ds.cities(), ds.viewer()]);
+  // Reads start in the same round trip as the season row; only the member's own profile (one prefetched read) is needed.
+  const ds = await getDataSourceEarly();
+  const [summaries, me] = await Promise.all([ds.cities(), ds.viewerMember(), ds.ready()]);
+  const viewer = me ? { member: me } : null;
   const cards: CityCardData[] = CITIES.map((c) => {
     const s = summaries.find((x) => x.cityId === c.id);
     return { id: c.id, name: c.name, stateCode: c.state, stateName: STATES[c.state], region: c.region, mark: c.mark, nickname: c.nickname ?? STATES[c.state],
```

### `app/gazette/page.tsx`

```diff
diff --git a/app/gazette/page.tsx b/app/gazette/page.tsx
index 4a4ee4b..1ceef05 100644
--- a/app/gazette/page.tsx
+++ b/app/gazette/page.tsx
@@ -1,6 +1,6 @@
 import type { Metadata } from 'next';
 import Link from 'next/link';
-import { getDataSource, rankingsOpen } from '@/lib/data';
+import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
 import { CITIES, DEFAULT_CITY_ID, cityById, type Scope } from '@/lib/geo';
 import { buildEdition } from '@/lib/gazette';
 import { inr, inrShort } from '@/lib/format';
@@ -10,15 +10,18 @@ export const metadata: Metadata = { title: 'The Gazette' };
 
 export default async function GazettePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
   const sp = await searchParams;
-  const ds = await getDataSource();
-  const viewer = await ds.viewer();
-  const city = cityById(sp.city) ?? cityById(viewer?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
+  // Reads start in the same round trip as the season row; the member's own profile (one prefetched read) is only
+  // needed when the address names no city.
+  const ds = await getDataSourceEarly();
+  const viewerCity = cityById(sp.city) ? null : (await ds.viewerMember())?.cityId;
+  const city = cityById(sp.city) ?? cityById(viewerCity) ?? cityById(DEFAULT_CITY_ID)!;
   const scope: Scope = { level: 'city', cityId: city.id, locality: city.localities[0] };
   const now = ds.now();
   const [board, reigns, moments, events, cities, respect, backed, declarations] = await Promise.all([
     ds.board(scope, { limit: 10 }), ds.throneHistory({ scope, limit: 40 }), ds.crownMoments(scope, new Date(now.getTime() - 7 * 86_400_000)),
     ds.events(scope, 12), ds.cities(), ds.respectBoard(scope, { limit: 3 }), ds.mostBacked(city.id, 3), ds.declarations({ cityId: city.id }),
   ]);
+  await ds.ready();
   const ed = buildEdition({ city, season: ds.season(), now, open: rankingsOpen(ds), board, reigns, moments, events, cities, respect, backed, declarations });
   return (
     <article className="gazette" data-testid="gazette">
```

### `app/india/page.tsx`

```diff
diff --git a/app/india/page.tsx b/app/india/page.tsx
index 92408a2..7f49417 100644
--- a/app/india/page.tsx
+++ b/app/india/page.tsx
@@ -1,6 +1,6 @@
 import type { Metadata } from 'next';
 import Link from 'next/link';
-import { getDataSource, rankingsOpen } from '@/lib/data';
+import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
 import { cityById, DEFAULT_CITY_ID } from '@/lib/geo';
 import { inrShort, pad2 } from '@/lib/format';
 import { BoardList } from '@/components/BoardList';
@@ -9,11 +9,13 @@ import { CITY_NAMES } from '@/components/cityNames';
 export const metadata: Metadata = { title: 'India' };
 
 export default async function IndiaPage() {
-  const ds = await getDataSource();
-  const season = ds.season();
-  // The India board is the same for everyone (the city only labels it), so it is read alongside the rest.
+  // Every read starts in the same round trip as the season row. The India board is the same for everyone (the city
+  // only labels it); the member's own profile is one prefetched read.
+  const ds = await getDataSourceEarly();
   const def = cityById(DEFAULT_CITY_ID)!;
-  const [summaries, viewer, national] = await Promise.all([ds.cities(), ds.viewer(), ds.board({ level: 'india', cityId: def.id, locality: def.localities[0] }, { limit: 5 })]);
+  const [summaries, me, national] = await Promise.all([ds.cities(), ds.viewerMember(), ds.board({ level: 'india', cityId: def.id, locality: def.localities[0] }, { limit: 5 }), ds.ready()]);
+  const viewer = me ? { member: me } : null;
+  const season = ds.season();
   const homeCity = cityById(viewer?.member.cityId) ?? def;
   const mine = summaries.find((s) => s.cityId === homeCity.id);
   const movers = summaries.filter((s) => s.previousRank !== null && s.previousRank !== s.rank);
```

### `app/layout.tsx`

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index 0f62bb2..22572fd 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -27,30 +27,85 @@ export const dynamic = 'force-dynamic';
 
 export const viewport: Viewport = { themeColor: '#0C251F', width: 'device-width', initialScale: 1 };
 
-export default async function RootLayout({ children }: { children: React.ReactNode }) {
+// The shell (navigation, page skeleton) streams at once. The three parts that need the database (season line,
+// season pill and account area, footer line) stream in their own boundaries, so the first paint and the page's
+// own loading state never wait for a database round trip.
+async function SeasonLine() {
   const ds = await getDataSource();
   const season = ds.season();
   const left = timeLeft(season, ds.now());
   const open = rankingsOpen(ds);
+  return (
+    <>
+      {open && <>
+        <span className="opt">{season.label}</span>
+        <span className="opt" aria-hidden="true">•</span>
+        <span className="opt">{left.closed ? 'Season closed' : `${left.days} days left`}</span>
+      </>}
+      {ds.availability === 'demo' && <span className="demo-flag" data-testid="demo-flag">Demo data</span>}
+      {!open && <span className="demo-flag">Rankings not open yet</span>}
+      {open && ds.availability === 'live' && testSeason() && <span className="demo-flag" data-testid="test-season-flag">Test season</span>}
+    </>
+  );
+}
+
+async function HeaderAccount() {
+  const ds = await getDataSource();
+  const season = ds.season();
   const viewer = await ds.viewer();
   const account = viewer ? null : await currentAccount();
   const viewerLabel = viewer ? (viewer.member.masked ? viewer.member.publicLabel : viewer.member.displayName ?? viewer.member.username) : null;
+  return (
+    <>
+      <div className="season-pill">{season.short}</div>
+      {viewer ? (
+        <details className="profile-menu" data-testid="profile-menu">
+          <summary aria-label={`Account menu for ${viewerLabel}`}>
+            <span className="avatar-mini" aria-hidden="true">{initials(viewerLabel!)}</span>
+            <span className="who">{viewer.member.masked ? viewer.member.publicLabel : `@${viewer.member.username}`}<small>{ds.availability === 'demo' ? 'Demo member · ' : ''}No. {memberNo(viewer.member.memberNo)}</small></span>
+          </summary>
+          <div className="menu">
+            <Link href="/seal">The Seal</Link>
+            <Link href="/me">Profile</Link>
+            <Link href="/invite">Invite friends</Link>
+            <form action={signOut}><button type="submit" data-testid="sign-out">Sign out</button></form>
+          </div>
+        </details>
+      ) : (
+        <div className="auth-actions" data-testid="auth-actions">
+          <Link className="signin" href="/signin">Sign in</Link>
+          <Link className="btn" href="/join" data-testid="create-profile">{account ? 'Finish profile' : 'Create profile'}</Link>
+        </div>
+      )}
+    </>
+  );
+}
+// Same footprint as the signed-out header while the account loads, invisible and not focusable.
+const HeaderAccountFallback = () => (
+  <>
+    <div className="season-pill" style={{ visibility: 'hidden' }} aria-hidden="true">S00 / NOV &apos;26</div>
+    <div className="auth-actions" style={{ visibility: 'hidden' }} aria-hidden="true"><span className="signin">Sign in</span><span className="btn">Create profile</span></div>
+  </>
+);
+
+async function FooterLine() {
+  const ds = await getDataSource();
+  return (
+    <>
+      <span>BAAP KA PAISA © {ds.season().year}</span>
+      <span>{ds.availability === 'demo' ? 'Demo data · not live · no payments' : 'Payments are not open'}</span>
+    </>
+  );
+}
+
+export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
     <html lang="en-IN">
       <body>
         <a className="skip-link" href="#main">Skip to content</a>
         <div className="topline">
           <div className="live"><i className="dot" aria-hidden="true" /> The public status register <span style={{ opacity: .5 }}>/</span> India</div>
-          <div className="rightline">
-            {open && <>
-              <span className="opt">{season.label}</span>
-              <span className="opt" aria-hidden="true">•</span>
-              <span className="opt">{left.closed ? 'Season closed' : `${left.days} days left`}</span>
-            </>}
-            {ds.availability === 'demo' && <span className="demo-flag" data-testid="demo-flag">Demo data</span>}
-            {!open && <span className="demo-flag">Rankings not open yet</span>}
-            {open && ds.availability === 'live' && testSeason() && <span className="demo-flag" data-testid="test-season-flag">Test season</span>}
-          </div>
+          <div className="rightline"><Suspense fallback={null}><SeasonLine /></Suspense></div>
         </div>
         <Suspense fallback={null}><NavProgress /></Suspense>
         <ProfileDialogProvider>
@@ -62,32 +117,12 @@ export default async function RootLayout({ children }: { children: React.ReactNo
               </Link>
               <MainNav />
               <div className="header-right">
-                <div className="season-pill">{season.short}</div>
-                {viewer ? (
-                  <details className="profile-menu" data-testid="profile-menu">
-                    <summary aria-label={`Account menu for ${viewerLabel}`}>
-                      <span className="avatar-mini" aria-hidden="true">{initials(viewerLabel!)}</span>
-                      <span className="who">{viewer.member.masked ? viewer.member.publicLabel : `@${viewer.member.username}`}<small>{ds.availability === 'demo' ? 'Demo member · ' : ''}No. {memberNo(viewer.member.memberNo)}</small></span>
-                    </summary>
-                    <div className="menu">
-                      <Link href="/seal">The Seal</Link>
-                      <Link href="/me">Profile</Link>
-                      <Link href="/invite">Invite friends</Link>
-                      <form action={signOut}><button type="submit" data-testid="sign-out">Sign out</button></form>
-                    </div>
-                  </details>
-                ) : (
-                  <div className="auth-actions" data-testid="auth-actions">
-                    <Link className="signin" href="/signin">Sign in</Link>
-                    <Link className="btn" href="/join" data-testid="create-profile">{account ? 'Finish profile' : 'Create profile'}</Link>
-                  </div>
-                )}
+                <Suspense fallback={<HeaderAccountFallback />}><HeaderAccount /></Suspense>
               </div>
             </header>
             <main id="main">{children}</main>
             <footer className="site-footer">
-              <span>BAAP KA PAISA © {season.year}</span>
-              <span>{ds.availability === 'demo' ? 'Demo data · not live · no payments' : 'Payments are not open'}</span>
+              <Suspense fallback={<span>BAAP KA PAISA</span>}><FooterLine /></Suspense>
               <nav aria-label="Explore" className="footer-links">
                 <Link href="/join">Create profile</Link><Link href="/invite">Invite</Link><Link href="/archive">Archive</Link><Link href="/throne">Throne history</Link><Link href="/closing">The Closing</Link><Link href="/simulator">Season simulator</Link><Link href="/rank-up">Rank Up preview</Link>
               </nav>
```

### `app/seal/page.tsx`

```diff
diff --git a/app/seal/page.tsx b/app/seal/page.tsx
index 9324cd4..8a8e232 100644
--- a/app/seal/page.tsx
+++ b/app/seal/page.tsx
@@ -1,6 +1,6 @@
 import type { Metadata } from 'next';
 import Link from 'next/link';
-import { getDataSource } from '@/lib/data';
+import { getDataSourceEarly } from '@/lib/data';
 import { LEVEL_LABEL, STATES, cityById, scopeName } from '@/lib/geo';
 import { inr, memberNo, pad2 } from '@/lib/format';
 import { Seal } from '@/components/Seal';
@@ -14,9 +14,10 @@ import { Crown, PastChampionMark } from '@/components/Crown';
 export const metadata: Metadata = { title: 'The Seal' };
 
 export default async function SealPage() {
-  const ds = await getDataSource();
+  // The member's own profile and standings load in the same round trip as the season row.
+  const ds = await getDataSourceEarly();
+  const [viewer] = await Promise.all([ds.viewer(), ds.ready()]);
   const season = ds.season();
-  const viewer = await ds.viewer();
   const intro = (
     <section className="page-intro">
       <div><div className="eyebrow">Permanent member identity / 04</div><h1>The Seal.<br />Your status.</h1></div>
```

### `app/u/[username]/page.tsx`

```diff
diff --git a/app/u/[username]/page.tsx b/app/u/[username]/page.tsx
index 7503a47..501cab0 100644
--- a/app/u/[username]/page.tsx
+++ b/app/u/[username]/page.tsx
@@ -1,7 +1,7 @@
 import type { Metadata } from 'next';
 import Link from 'next/link';
 import { notFound } from 'next/navigation';
-import { getDataSource } from '@/lib/data';
+import { getDataSource, getDataSourceEarly } from '@/lib/data';
 import { LEVEL_LABEL, STATES, cityById, scopeName } from '@/lib/geo';
 import { inr, memberNo, pad2 } from '@/lib/format';
 import { Crown } from '@/components/Crown';
@@ -23,20 +23,25 @@ export async function generateMetadata({ params }: { params: Promise<{ username:
 
 export default async function MemberPage({ params }: { params: Promise<{ username: string }> }) {
   const { username } = await params;
-  const ds = await getDataSource();
-  const m = await ds.member(decodeURIComponent(username));
+  // Every read that depends only on the name in the address starts at once, in the same round trip as the season
+  // row and the member lookup, instead of waiting for the lookup and then the viewer.
+  const ds = await getDataSourceEarly();
+  const addressName = decodeURIComponent(username);
+  const demo = ds.availability === 'demo';
+  const byName = (n: string) => Promise.all([ds.standings(n), ds.achievements(n), ds.throneHistory({ username: n, limit: 100 }), ds.social(n), ds.backing(n), ds.socials(n), ds.declarations({ username: n })] as const);
+  const earlyP = byName(addressName); earlyP.catch(() => {});
+  const [m, me] = await Promise.all([ds.member(addressName), ds.viewerMember()]);
   if (!m) notFound();
-  // Everything below depends only on the member and the viewer, so it is read in one parallel batch.
-  const viewer = await ds.viewer();
+  const viewer = me ? { member: me } : null;
   const isSelf = viewer?.member.username === m.username;
-  const demo = ds.availability === 'demo';
-  const [standings, achievements, allReigns, social, backing, myBacking, recentMoments, handles, feudAll, liveState, viewerSocial] = await Promise.all([
-    ds.standings(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 100 }), ds.social(m.username),
-    ds.backing(m.username), viewer && !isSelf ? ds.backing(viewer.member.username) : null,
+  // The lookup can return the stored spelling of the name; reads are only reused when they were made for it.
+  const [[standings, achievements, allReigns, social, backing, socialsRaw, feudAll], myBacking, recentMoments, liveState, viewerSocial] = await Promise.all([
+    m.username === addressName ? earlyP : byName(m.username),
+    viewer && !isSelf ? ds.backing(viewer.member.username) : null,
     ds.crownMoments({ level: 'city', cityId: m.cityId, locality: m.locality }, new Date(ds.now().getTime() - 86_400_000)),
-    m.masked ? null : ds.socials(m.username), ds.declarations({ username: m.username }),
     viewer && !demo && !isSelf ? socialState(m.username) : null, viewer && demo ? ds.social(viewer.member.username) : null,
   ]);
+  const handles = m.masked ? null : socialsRaw;
   const reigns = allReigns.slice(0, 10);
   const grouped = groupAchievements(achievements);
   const demoState = viewer && demo ? await readDemoSocial({ follows: [], rivals: viewerSocial?.rivals.map((r) => r.member.username) ?? [], respected: {} }) : null;
```

### `components/CrownMoment.tsx`

```diff
diff --git a/components/CrownMoment.tsx b/components/CrownMoment.tsx
index 71dbc9c..ad39f05 100644
--- a/components/CrownMoment.tsx
+++ b/components/CrownMoment.tsx
@@ -21,6 +21,18 @@ export function CrownMoment({ moment, autoPlay = true }: { moment: CrownMomentDa
     window.addEventListener('keydown', onKey);
     return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
   }, [open]);
+  // A tap on the backdrop closes the takeover AND reaches what was tapped underneath (a link, a button, a field),
+  // so the visitor's first tap is never swallowed by the overlay.
+  const passThrough = (e: React.MouseEvent<HTMLDivElement>) => {
+    const overlay = e.currentTarget;
+    overlay.style.pointerEvents = 'none';
+    const under = document.elementFromPoint(e.clientX, e.clientY);
+    overlay.style.pointerEvents = '';
+    setOpen(false);
+    const target = under?.closest<HTMLElement>('a[href], button, summary, select, input, textarea, [role="button"]');
+    if (!target) return;
+    if (target.matches('input, select, textarea')) target.focus(); else target.click();
+  };
   return (
     <>
       <div className="crown-strip" data-testid="crown-strip">
@@ -29,7 +41,7 @@ export function CrownMoment({ moment, autoPlay = true }: { moment: CrownMomentDa
         <button type="button" onClick={() => setOpen(true)} data-testid="crown-replay">Watch the Crown Moment</button>
       </div>
       {open && (
-        <div className="crown-moment" role="dialog" aria-modal="true" aria-labelledby="cm-title" data-testid="crown-moment" onClick={() => setOpen(false)}>
+        <div className="crown-moment" role="dialog" aria-modal="true" aria-labelledby="cm-title" data-testid="crown-moment" onClick={passThrough}>
           <div className="cm-card" onClick={(e) => e.stopPropagation()}>
             <p className="cm-kicker">{moment.seasonLabel} · {moment.boardName}{moment.simulated ? ' · Simulation' : ''}</p>
             <div className="cm-insignia" aria-hidden="true"><span className="cm-crown"><Crown /></span><span className="cm-01">01</span></div>
```

### `lib/data/demo.ts`

```diff
diff --git a/lib/data/demo.ts b/lib/data/demo.ts
index 59c54b3..782d675 100644
--- a/lib/data/demo.ts
+++ b/lib/data/demo.ts
@@ -256,6 +256,8 @@ async function forViewer(b: Board): Promise<Board> {
 export const demoSource: DataSource = {
   availability: 'demo',
   now: () => new Date(SIM_NOW),
+  ready: async () => {},
+  async viewerMember() { return (await demoSource.viewer())?.member ?? null; },
   season: (): SeasonInfo => {
     const base = seasonFor(new Date(CURRENT.startsAt), null);
     return { ...base, number: CURRENT.id, startsAt: new Date(CURRENT.startsAt), endsAt: new Date(CURRENT.endsAt), label: seasonLabel(CURRENT.id),
```

### `lib/data/index.ts`

```diff
diff --git a/lib/data/index.ts b/lib/data/index.ts
index 2704817..757e3ba 100644
--- a/lib/data/index.ts
+++ b/lib/data/index.ts
@@ -7,23 +7,37 @@ import { loadSeason, prefetchViewer, supabaseSource } from './supabase';
 import type { DataSource } from './types';
 import { currentAccount } from '../supabase-server';
 
-/** One data source per request. The live source loads the season row once so every component agrees. */
-export const getDataSource = cache(async (): Promise<DataSource> => {
+/**
+ * One data source per request, shared by every component of that request. The live source starts loading the
+ * season row and (when signed in) the member's own profile at once; nothing waits for them until it is needed.
+ */
+const createSource = cache(async (): Promise<DataSource> => {
   const name = dataSourceName();
   if (name === 'demo') return demoSource;
   if (name === 'supabase') {
     const cfg = supabaseConfig();
     if (cfg) {
-      // The season row and the signed-in member's own profile are both needed by almost every page and neither
-      // depends on the other: read them at the same time.
       const seasonP = loadSeason(cfg);
       const acct = await currentAccount();               // local check, no network call
       if (acct) prefetchViewer(cfg, acct.token);
-      return supabaseSource(cfg, await seasonP, acct?.token ?? null);
+      return supabaseSource(cfg, seasonP, acct?.token ?? null);
     }
   }
   return unavailableSource(seasonOneMonth());
 });
+
+/** The request's data source with the season loaded: `season()` can be read straight away. */
+export const getDataSource = cache(async (): Promise<DataSource> => {
+  const ds = await createSource();
+  await ds.ready();
+  return ds;
+});
+
+/**
+ * The same data source before the season row has arrived, so a page can start its own reads in the same round
+ * trip as the season instead of after it. Call `await ds.ready()` before `ds.season()` or `rankingsOpen(ds)`.
+ */
+export const getDataSourceEarly = cache(async (): Promise<DataSource> => createSource());
 export type * from './types';
 
 /** True when there is a season whose rankings can be shown (demo data, or a live open/closed season). */
```

### `lib/data/supabase.ts`

```diff
diff --git a/lib/data/supabase.ts b/lib/data/supabase.ts
index 7e9bb3d..9e44199 100644
--- a/lib/data/supabase.ts
+++ b/lib/data/supabase.ts
@@ -61,7 +61,11 @@ export function prefetchViewer(cfg: Cfg, token: string) {
   if (!early.has(key)) { early.set(key, rpcRaw(cfg, 'get_me', {}, token).catch(() => [])); setTimeout(() => early.delete(key), 10_000); }
 }
 
-export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string | null = null): DataSource {
+export function supabaseSource(base: Cfg, seasonP: Promise<SeasonInfo>, token: string | null = null): DataSource {
+  // The season row arrives in parallel with the page's own reads (getDataSourceEarly); season() is valid once ready().
+  let seasonCache: SeasonInfo | null = null;
+  const readyP = seasonP.then((s) => { seasonCache = s; });
+  readyP.catch(() => {});   // a failure still reaches every caller that awaits ready(); this only avoids an unhandled-rejection report
   // Reads carry the member's own token when signed in, so the database can mark "your row".
   const cfg = base;
   // One data source exists per request (lib/data/index.ts), so identical reads within a request are made once
@@ -75,16 +79,29 @@ export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string
     return p;
   };
   let viewerP: ReturnType<DataSource['viewer']> | null = null;
-  async function loadViewer(): ReturnType<DataSource['viewer']> {
-    if (!token) return null;
-    const recordP = rpc<{ season_id: number; starts_at: string; level: string; scope_key: string; final_rank: number }[]>(cfg, 'get_my_season_record').catch(() => []);   // started now, used below
-      const me = (await rpc<{ username: string; display_name: string; masked: boolean; anon_label: string | null; title: string | null; flex_line: string | null; city_id: string; state_code: string; locality: string; member_no: number; joined_at: string; lifetime_paise: number; season_score_paise: number }[]>(cfg, 'get_me'))[0];
+  type MeRow = { username: string; display_name: string; masked: boolean; anon_label: string | null; title: string | null; flex_line: string | null; city_id: string; state_code: string; locality: string; member_no: number; joined_at: string; lifetime_paise: number; season_score_paise: number };
+  // The member's own profile: one read (prefetched in lib/data/index.ts), shared by viewerMember() and viewer().
+  let meP: Promise<{ me: MeRow; member: PublicMember; lifetime: number } | null> | null = null;
+  function loadMe() {
+    if (!meP) meP = (async () => {
+      if (!token) return null;
+      const me = (await rpc<MeRow[]>(cfg, 'get_me'))[0];
       if (!me) return null; // account exists but has no member profile yet
       const publicName = me.masked && me.anon_label ? me.anon_label : me.username;
       const lifetime = Math.round(Number(me.lifetime_paise) / 100);
       // Your own view shows your real name and number even in Mystery mode; `masked` tells the UI what others see.
       const member: PublicMember = { username: publicName, displayName: me.display_name, masked: me.masked, publicLabel: publicName, title: me.title, flexLine: me.flex_line,
         cityId: me.city_id, state: me.state_code as StateCode, locality: me.locality, memberNo: me.member_no, seasonScore: Math.round(Number(me.season_score_paise) / 100), lifetimeTier: lifetimeTier(lifetime) };
+      return { me, member, lifetime };
+    })();
+    return meP;
+  }
+  async function loadViewer(): ReturnType<DataSource['viewer']> {
+    if (!token) return null;
+    const recordP = rpc<{ season_id: number; starts_at: string; level: string; scope_key: string; final_rank: number }[]>(cfg, 'get_my_season_record').catch(() => []);   // started now, used below
+      const mine = await loadMe();
+      if (!mine) return null;
+      const { me, member, lifetime } = mine; const publicName = member.username;
       const [standings, archive] = await Promise.all([src.standings(publicName), recordP]);
       const joined = seasonFor(new Date(me.joined_at), null);
       const bySeason = new Map<number, { starts: string; city: number | null; loc: number | null }>();
@@ -98,7 +115,8 @@ export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string
   const src: DataSource = {
     availability: 'live',
     now: () => new Date(),
-    season: () => seasonCache,
+    season: () => { if (!seasonCache) throw new Error('season() read before ready()'); return seasonCache; },
+    ready: () => readyP,
     async board(scope, opts = {}) {
       const rows = await rpc<BoardDbRow[]>(cfg, 'get_board', { ...boardArgs(scope), p_limit: opts.limit ?? 100, p_query: opts.query || null });
       const limit = opts.limit ?? 100;
@@ -137,6 +155,7 @@ export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string
       if (!viewerP) viewerP = loadViewer();
       return viewerP;
     },
+    async viewerMember() { return (await loadMe())?.member ?? null; },
 
     async cities() {
       const rows = await rpc<{ city_id: string; members: number; season_total_paise: number; leader_name: string | null; leader_masked: boolean | null; rank: number | null; prev_rank: number | null }[]>(cfg, 'get_city_summaries');
@@ -185,8 +204,9 @@ export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string
         pick_rank: number | null; pick_of: number | null; pick_gap_paise: number | null; pick_since: string | null; history: { season_id: number; name: string; display: string | null; masked: boolean; city: string; final_rank: number | null }[] }[]>(cfg, 'get_backing', { p_name: name }).catch(() => null);
       const r = rows?.[0];
       if (!r) return null;
+      await readyP;
       return {
-        open: r.season_id !== null, seasonLabel: r.season_id ? `Season ${r.season_id}` : seasonCache.label, backers: r.backers, contender: r.contender,
+        open: r.season_id !== null, seasonLabel: r.season_id ? `Season ${r.season_id}` : seasonCache!.label, backers: r.backers, contender: r.contender,
         pick: r.pick_name ? { member: lite(r.pick_name, r.pick_display, !!r.pick_masked, r.pick_city!, r.pick_locality!), cityRank: r.pick_rank, cityOf: r.pick_of ?? 0, gapToFirst: Math.round(Number(r.pick_gap_paise ?? 0) / 100), since: new Date(r.pick_since!) } : null,
         history: r.history.map((h) => ({ seasonLabel: `Season ${h.season_id}`, member: lite(h.name, h.display, h.masked, h.city, ''), finalRank: h.final_rank, crowned: h.final_rank === 1 })),
       } satisfies BackingView;
```

### `lib/data/types.ts`

```diff
diff --git a/lib/data/types.ts b/lib/data/types.ts
index 510e86e..3c93ed8 100644
--- a/lib/data/types.ts
+++ b/lib/data/types.ts
@@ -126,7 +126,12 @@ export interface DataSource {
   availability: Availability;
   /** "As of" clock used for season maths. Real time, or a fixed clock for demo data. */
   now(): Date;
+  /** The current season. Only valid after `ready()` has resolved (always true for getDataSource()). */
   season(): SeasonInfo;
+  /** The signed-in member's own public profile, from one read (no standings or record). Null when signed out. */
+  viewerMember(): Promise<PublicMember | null>;
+  /** Resolves once the season row has loaded. getDataSourceEarly() callers await it before calling season(). */
+  ready(): Promise<void>;
   board(scope: Scope, opts?: { limit?: number; query?: string }): Promise<Board>;
   /** Lifetime Score ranking across all seasons. Never resets. */
   hallOfFame(scope: Scope, opts?: { limit?: number }): Promise<Board>;
```

### `lib/data/unavailable.ts`

```diff
diff --git a/lib/data/unavailable.ts b/lib/data/unavailable.ts
index af8d09c..5c085f8 100644
--- a/lib/data/unavailable.ts
+++ b/lib/data/unavailable.ts
@@ -7,6 +7,8 @@ export function unavailableSource(seasonOneMonth?: string | null): DataSource {
   return {
     availability: 'unavailable',
     now: () => new Date(),
+    ready: async () => {},
+    viewerMember: async () => null,
     season: () => seasonFor(new Date(), seasonOneMonth),
     async board(scope) { return { scope, rows: [], total: 0, viewerRow: null }; },
     async hallOfFame(scope) { return { scope, rows: [], total: 0, viewerRow: null }; },
```

### `tests/e2e/site.spec.ts`

```diff
diff --git a/tests/e2e/site.spec.ts b/tests/e2e/site.spec.ts
index 10113a5..0c6437c 100644
--- a/tests/e2e/site.spec.ts
+++ b/tests/e2e/site.spec.ts
@@ -287,6 +287,22 @@ test.describe('season simulator (server-side engine)', () => {
     await expect(page.getByTestId('sim-result')).toContainText('Season extended');
     await expect(page.locator('.rank-row.first')).toHaveAttribute('data-member', 'sim.zoya');
   });
+  test('the first tap while a Crown Moment is open reaches what was tapped (closes and navigates)', async ({ page }) => {
+    await page.goto('/simulator?step=7');
+    await expect(page.getByTestId('crown-moment')).toBeVisible();
+    const link = page.locator('nav.main-nav a[href="/india"]').first();
+    const box = (await link.boundingBox())!;
+    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // a real tap on the backdrop above the link
+    await expect(page).toHaveURL(/\/india$/);
+    await expect(page.getByTestId('crown-moment')).toHaveCount(0);
+  });
+  test('a tap on an empty part of the Crown Moment backdrop only closes it', async ({ page }) => {
+    await page.goto('/simulator?step=7');
+    await expect(page.getByTestId('crown-moment')).toBeVisible();
+    await page.mouse.click(5, 420);
+    await expect(page.getByTestId('crown-moment')).toHaveCount(0);
+    await expect(page).toHaveURL(/\/simulator\?step=7$/);
+  });
   test('closing freezes the result and awards the Season Crown', async ({ page }) => {
     await page.goto('/simulator?step=10');
     await expect(page.getByTestId('sim-closed')).toContainText('2 extensions');
```
