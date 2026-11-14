# Performance milestone

Scheduled after feature integration and before public launch. No feature is removed and no leaderboard
figure may be served stale. Nothing in this file has been changed yet: this is the baseline and the plan.

## Baseline (15 Nov 2026, deployed site, empty database)

Time until the server starts answering, three samples each, measured from outside India. These are
server times only; they exclude download, rendering and the visitor's own network.

| Page | Seconds |
|---|---|
| Home `/` | 5.57 · 2.52 · 2.23 |
| Gazette | 1.08 · 1.08 · 0.65 |
| Cities | 0.71 · 0.72 · 0.65 |
| Throne history | 0.65 · 0.68 · 0.61 |
| Board | 0.82 · 0.43 · 0.39 |
| The Seal (signed out), sign-in, terms | 0.39 – 0.47 |
| `robots.txt` (no database call) | 0.94 · 0.22 · 0.21 |

The first sample of a page is a cold start. A page with no database call answers in about 0.2 s, so nearly
all of the rest is waiting on the database.

## What the baseline already shows

1. **The homepage is the 3–4 second page.** It makes about 13 database reads and several of them wait for
   one another instead of running together. Each read crosses from the US (where the site's server code
   runs, Vercel `iad1`) to Mumbai (where the database is) and back.
2. **Every page repeats the same reads.** The layout and the page each ask for the season and the signed-in
   member; nothing is shared between navigations and nothing is cached.
3. **The numbers above are with an empty database.** With 20,000 members the board reads themselves take
   0.2 – 0.7 s each (`scripts/db-audit.sh`), which will add to every figure above.

## Plan (measure, change one thing, measure again)

| Step | Change | Expected effect | Needs approval |
|---|---|---|---|
| 1 | Move the server region to Mumbai (`bom1`) | Removes the intercontinental round trip from every read | Yes: production infrastructure |
| 2 | Run independent reads together; fetch shared data once per request | Homepage waits for its slowest read, not the sum | No |
| 3 | One database call per page for what the page needs, where several small calls exist today | Fewer round trips | Database functions: yes |
| 4 | A maintained per-season score table so boards are an index read | Board reads stay fast as members grow; credits get cheaper | Yes: migration |
| 5 | Short shared caching of public boards **keyed to the ledger**: a cached board is reused only while no credit has been recorded since it was built | Many readers share one read; never shows a rank that the ledger has moved past | No |
| 6 | Browser side: measure real interaction times on a mid-range phone on a slow connection; remove unnecessary re-renders, prefetch likely next pages, keep the page usable while data loads | Navigation and taps feel immediate | No |

Target: common interactions within 1 second where technically practical, on a mobile connection in India.

## How it will be reported

Before and after, per step, with the same measurements: server time per page (cold and warm), number of
database reads per page, database time per read at 20,000 members, and field measurements on a throttled
phone profile (time to first content, time to interactive, navigation time between the main pages).

## Results: staging, 18 November 2026

Measured with the app running on this workspace's server (US East, the same region Vercel uses for
production today, `iad1`) against the staging Supabase project in Mumbai. Script: `tests/perf/baseline.mjs`
(server time until the page is fully rendered, median of 3 warm requests; `BKP_TRACE=1` logs every outbound
call). Network noise between runs is about ±300 ms.

### Where the time went (measured)

- **The database is fast.** Every read function runs in 0.3–10 ms inside the database (median of 5, staging).
- **Each call costs a round trip of ~250 ms** between US East and Mumbai, and ~650 ms when a new connection has
  to be opened (several pages open many at once).
- **Pages made calls one after another.** The signed-in homepage made 39 calls in about 8 sequential steps.
- **The same call was repeated** within one page: the signed-in member's profile was read up to 4 times per
  request (once by the header, again by the page), and `get_member` up to 15 times.
- **Every signed-in page waited on a call to the Auth server** before it could start reading.

### Changes (code only; no database or infrastructure change)

| Change | Where |
|---|---|
| Identical reads within one request are made once and shared. Nothing is kept between requests, so no rank can be stale | `lib/data/supabase.ts` |
| The signed-in member's profile is computed once per request and started at the same time as the season read | `lib/data/supabase.ts`, `lib/data/index.ts` |
| Independent reads on the homepage, profile, board, The Seal and `/me` run as one parallel batch | `app/page.tsx`, `app/u/[username]/page.tsx`, `app/board/page.tsx`, `app/seal/page.tsx`, `app/me/page.tsx` |
| Sessions verified locally against the project's published ES256 signing key (`getClaims`) instead of a call to the Auth server on every request | `lib/supabase-server.ts`, `middleware.ts` |
| Registration no longer reads the season just to validate the form; its checks run together | `app/auth-actions.ts` |
| A dropped connection on a read is retried once; a token the database rejects is read as a visitor instead of an error page | `lib/data/supabase.ts` |
| Optional call tracing (`BKP_TRACE=1`), off by default | `lib/trace.ts` |

### Before and after (ms)

| Page | Before | After | Calls before → after |
|---|---|---|---|
| Visitor homepage | 4,571 | ~1,050–1,400 | 12 → 11 |
| Visitor profile `/u/…` | 3,470 | ~1,250 | 13 → 9 |
| Visitor city board | 1,552 | ~960 | 2 → 2 |
| Member homepage | 6,727 | ~2,200–2,400 | 39 → 25 |
| Member profile `/u/…` | 4,591 | ~1,500 | 25 → 17 |
| Member `/me` | 3,926 | ~1,800–2,000 | 29 → 16 |
| Member The Seal | 3,082 | ~1,100–1,600 | 15 → 9 |
| Member board | 2,250 | ~1,200–1,500 | 12 → 7 |
| **Create profile (wizard's last step)** | **3,332** | **1,315** | 5 → 5 (two season reads removed; the username check moved in) |

### Concurrency (visitors, app on one local server process, staging database)

| Concurrent | Homepage req/s, p50 / p97.5 | City board req/s, p50 / p97.5 |
|---|---|---|
| 5 | 4.7, 964 / 1,774 ms | 8.7, 534 / 940 ms |
| 10 | 11.9, 903 / 1,382 ms | 16.7, 534 / 967 ms |
| 20 | 19.1, 914 / 2,110 ms | 36, 532 / 716 ms |
| 40 | 22.6, 1,603 / 4,170 ms, **0 errors** (before the retry: 1 failure in 370, a reset connection) | 66.8, 551 / 957 ms |

The board scales almost linearly (1–2 calls per view). The homepage flattens near 20–25 per second because
each view makes 11 calls (~250 database calls per second at the plateau). Not determined: whether the limit
is the staging database (free tier), this workspace's network proxy or the single local server process.

### Still open

1. **Region (largest remaining cost).** Every call still crosses US East ↔ Mumbai. With the functions taking
   0.3–10 ms, running the server in Mumbai (`bom1`) should bring each call to tens of milliseconds. Not
   measured: it needs a Vercel setting change (infrastructure; your approval).
2. **Call count on the homepage.** 11 calls for a visitor, 25 for a member. One combined read function per page
   would cut this to a few; that is a database change (new functions, no table change) for a later review.
3. **Public-page caching** for signed-out visitors keyed to the ledger, as planned. Not started.
4. **Session revocation trade-off:** with local verification, a session revoked elsewhere (for example "sign
   out everywhere", a deleted account) stays valid until its token expires, 1 hour by default. Sign-out on the
   same device still ends the session immediately. Acceptable for launch in my view; shorten the token lifetime
   in Supabase if not.

## Session cookies (finding M1)

- **Finding (confirmed on staging):** the Supabase session cookies were readable by page scripts
  (`httpOnly=false`, the library default). Any script-injection bug would have exposed a member's session.
- **Why it is safe to change:** the site never reads the session in the browser; there is no browser Supabase
  client. Every sign-in, refresh and sign-out happens on the server.
- **Change:** `lib/auth-cookies.ts` sets `httpOnly`, `secure` (production builds), `sameSite=lax`, same lifetime;
  used by the server client and the middleware.
- **Verified on staging:** the 22-step journey passes and now fails if a session cookie is script-readable;
  observed `httpOnly=true secure=true`; `document.cookie` after sign-in contains no session.
- **Rollout:** existing sessions keep their old cookie flags until the next refresh rewrites them (within the
  token lifetime). Nothing for members to do. Rollback: remove `cookieOptions` from the two clients.

## Launch-blocking lag investigation, 19 November 2026

Scripts: `tests/perf/navigation.mjs` (real browser clicks through the sections, p50/p95/p99 from click),
`tests/perf/baseline.mjs` (server time and every outbound call), `tests/perf/frontend.mjs` (browser cost on a
4×-slowed phone CPU). App run on this workspace's server (US East, same region as production today) against
the staging database (Mumbai).

### Root causes (measured)

1. **No feedback on click.** Only `/board` had a loading state, so after a click the old page stayed on screen,
   unchanged, until the server had built the whole new page: the 2–3 s the member feels.
2. **Every database call crosses US East ↔ Mumbai**: ~250 ms each, ~650 ms when a new connection opens. The
   database work itself is 0.3–10 ms. A page needs 2–5 rounds of calls one after another.
3. **Repeated and sequential calls** (fixed in the previous round: 39 → 25 calls on the member homepage).
4. **Not a cause:** the browser. Pages send 111–118 kB of JavaScript, no images other than icons, and paint in
   150–280 ms even on a 4×-slowed phone CPU. No full page reloads were found: navigation uses the client router.

### Fixes in this round

| Change | Files |
|---|---|
| Loading state for every section that never answers "not found" or redirects (home, Gazette, Cities, India, board, Seal, `/me`, archive, throne, closing, invite, simulator, Rank Up). Next.js prefetches these shells for links in view | `components/PageSkeleton.tsx`, `app/*/loading.tsx`, homepage moved to `app/(home)/page.tsx` (route group: the address does not change) |
| A progress bar on every in-site click, including filter changes on the same page and pages that keep exact 404s and redirects (profile, Bill, declaration, sign-in, join) | `components/NavProgress.tsx`, `app/layout.tsx`, `components/BoardFilters.tsx` |
| India page reads its board, the city list and the member together | `app/india/page.tsx` |
| Forgot-password link uses the client router | `components/SignInForm.tsx` |

A root-level loading state was tried first and rejected: under it, unknown members returned a normal page
instead of a 404, and signed-in redirects ran in the browser. The tests caught it.

### Navigation, click to screen (ms, 5 rounds, visitor / member)

| Section | Feedback before | Feedback after | Complete before (p50) | Complete after (p50) |
|---|---|---|---|---|
| Gazette | 1,052 / 1,717 | **56 / 55** | 1,055 / 1,719 | 1,038 / 1,638 |
| Cities | 624 / 1,007 | **48 / 47** | 627 / 1,009 | 659 / 841 |
| India | 882 / 1,136 | **48 / 47** | 886 / 1,138 | 628 / 643 |
| Board | 49 / 56 | 47 / 47 | — | 626 / 1,627 |
| Locality board, Hall of Fame | 277–1,269 | progress bar, under 100 | 347–1,297 | 564–1,272 |
| Profile, The Bill | 1,255–1,960 | **6–7** (progress bar) | 1,297–2,006 | 1,255–1,910 |
| The Seal | 333 / 1,309 | **47 / 46** | 335 / 1,312 | 665 / 907 |
| Home | 1,299 / 2,482 | **49 / 42** | 1,302 / 2,488 | 1,325 / 1,855 |

Feedback target (under 100 ms) is met everywhere. Completion is still bounded by the US–Mumbai round trips.

### Remaining bottleneck and the fix that needs approval

Server region. With the database in Mumbai and the server in US East, each of the 2–5 sequential rounds costs
250–650 ms. Running the server in Mumbai (`bom1`, a one-line `vercel.json` setting, free on every plan) should
bring each round to roughly 5–20 ms: estimated server time per page 100–300 ms instead of 600–1,900 ms, and
members in India also reach the server over a short distance. **Not measured:** the measurement needed two
temporary preview deployments on separate branches, which is outside "existing development branch only" and
was not done. Options: approve those two temporary branches, or approve the region setting on the
development branch's preview (with that preview reading staging instead of demo data).

### Not done, deliberately

Caching rankings between requests. Without a cheap "has anything changed" signal from the database, any
cache would show some members an out-of-date rank. A small read-only function returning the latest ledger,
throne and season change would allow exact caching; that is a database change for review.
