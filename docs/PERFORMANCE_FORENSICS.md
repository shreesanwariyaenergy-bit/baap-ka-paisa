# Performance forensic audit, change history and repair

14 November 2026. Branch `feature/website-v1` (starting commit `087f92a`). Repairs are **uncommitted and not
deployed**: every after-measurement below is from a local production build. Full line-level diffs of every
performance-related change, historical and new: `docs/PERFORMANCE_FORENSICS_DIFFS.md`.

Test conditions (all measurements are browser **emulation** or automated tests; no physical device was used):
- Phone emulation: Chromium, 390×844, deviceScaleFactor 3, touch, **4× CPU slowdown**, Lighthouse "slow 4G" network
  (150 ms added latency, 1.6 Mbps down, 750 kbps up). Script: scratch `mobile.mjs` (Web Vitals observers, Event Timing).
- This workspace is in the US. Live-site numbers include the US→Mumbai distance (~250 ms per round trip) on top of
  the throttle. Local builds read the staging database in Mumbai through the same distance, which exaggerates every
  sequential database stage; the same distance applies to before and after.
- Server and database timings: `BKP_TRACE=1` call traces (preview runtime logs and local logs).

## A. Executive diagnosis

- **Is it slow?** Interactions are not: typing, filters and taps are handled in ≤ 80 ms (Event Timing, 4× CPU).
  Main-thread blocking is small (TBT 60–126 ms, 2–3 long tasks of 110–165 ms on cold loads, mostly hydration;
  111–119 kB JavaScript). The waits are in **loading data for each page**: every tap and every first visit is a
  server render that waits on database round trips.
- **Primary root causes (confirmed):**
  1. Until 14 Nov 17:05 UTC, production ran a 12 Nov build in the US (`iad1`) without any performance work: this
     was the 2–3 s lag first reported. Fixed by the production deployment of `c502dc2` (region `bom1`).
  2. **The shared layout blocked every page on database reads.** `app/layout.tsx` awaited the season row and, for
     members, the full viewer profile (two more sequential reads) before sending any HTML. No skeleton, header or
     navigation could reach the phone until then, and each page then waited for the season again before starting
     its own reads.
  3. **That blocking layout caused an intermittent hydration failure** (React #418 plus
     `Cannot read properties of null (reading 'parentNode')` from the streaming swap script): **9 of 60** throttled
     loads on the old build locally, about **15 %** of live production loads; React then discards and rebuilds the
     affected part of the page on the phone.
  4. The 45-city summary (`get_city_summaries`, released today) became the slowest call on the critical path of
     Home, Cities, India and Gazette (94–197 ms per call on the preview; 72 ms of it inside the database).
  5. Sequential stages on the profile page (season → member → viewer → batch) and on signed-in Board/Gazette
     (viewer standings before the board).
- **Why earlier attempts failed:** round 1 (`3a06ba0`) parallelised reads *inside* each page but left the layout
  and the season read in front of them; it was measured in the US against a production that was never redeployed.
  Round 2 (`f1d6566`) added loading skeletons, which work on in-app taps but **could not stream on a first visit**
  because the layout above them was blocked, and in combination with that blocking layout produced the hydration
  race. The region fix existed as a setting from 13 Nov but production was not rebuilt until today. In short: we
  optimised the queries inside pages and the client feedback, while the request-level blocking above the pages was
  never measured (first-byte time was not tracked separately from content time).
- **Ready for a national launch?** CONDITIONALLY READY: see H.

## B. Historical change ledger

All 45 commits on `main` and `feature/website-v1` were inspected (`git log --all`; the clone is complete, not
shallow; there are no other branches, no reverts and no `vercel.json` in history). Commits with
performance-related code: `8a56e11`, `3a06ba0`, `f1d6566`, `857415a`, `1f13233`, `c0ddc0d`, `5042068`, `087f92a`,
plus `d2da1fa` and `ab9b9d5` (SQL and load-test). Full diffs: `docs/PERFORMANCE_FORENSICS_DIFFS.md`.

| # | Commit, date | File (line ranges) | Change | Before | Intent | Actual now | Status | Evidence | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `8a56e11` 11 Nov | `app/layout.tsx` (−1,6 +1,6; −10,11 +10,6); `app/fonts.css` (new); 16 `public/fonts/*.woff2` | Fonts self-hosted with `@font-face … font-display: swap` instead of `next/font/google` | `next/font` (also self-hosted at build, with size-adjusted fallbacks) | Builds independent of a font CDN | Fonts load from the site's own domain; no metric fallback → small layout shift when fonts swap (CLS up to 0.11–0.15 on Gazette/India cold loads) | Present | Request lists; CLS measurements (D) | Neutral for speed; small CLS cost; not changed (typography out of scope) |
| 2 | `3a06ba0` 14 Nov | `lib/trace.ts` (new, 1–13) | `tracedFetch`: one log line per database/auth call when `BKP_TRACE=1` | No tracing | Measure calls | Active only on the feature-branch preview (variable set 14 Nov); off in production; cost: one `console.log` per call | Present | Used throughout this audit | Effective (diagnostic) |
| 3 | `3a06ba0` | `lib/data/supabase.ts` `rpcRaw` (−15,12 +15,27) | One retry on a dropped connection; 401 → read as visitor | Errors failed the page | Reliability | As intended | Present | Earlier concurrency test (1 ECONNRESET in 370 → 0) | Effective (reliability) |
| 4 | `3a06ba0` | `lib/data/supabase.ts` `supabaseSource` memo (+64,12) | Identical reads in one request made once | Duplicate calls (e.g. Home 25 calls) | Fewer calls | Home 11 calls | Present | Call counts (PERFORMANCE.md) | Effective |
| 5 | `3a06ba0` | `lib/data/supabase.ts` `prefetchViewer` (+53,8) | `get_me` started before the season returns | Sequential | Overlap | Still used; now also feeds `viewerMember()` | Present | Traces | Effective |
| 6 | `3a06ba0` | `lib/data/supabase.ts` `viewer()`/`loadViewer` (−84,27 +129,15) | Viewer computed once, record read alongside | Recomputed | Fewer calls | Restructured today (`loadMe`) | Modified | — | Effective |
| 7 | `3a06ba0` | `lib/data/supabase.ts` `standings` | Member + standings in parallel | Sequential | One stage less | As intended | Present | Traces | Effective |
| 8 | `3a06ba0` | `lib/data/supabase.ts` `social` (+173,2) | Rival standings started early | Sequential | Overlap | As intended | Present | — | Unverified (no rivals on staging) |
| 9 | `3a06ba0` | `lib/data/index.ts` (−13,7 +13,14) | Season and account read in parallel | Sequential | Overlap | **Still awaited the season before returning, so every page and the layout waited for it** | Modified today | First byte = `get_season` time (D) | Partly effective; root cause 2 remained |
| 10 | `3a06ba0` | `lib/supabase-server.ts` (−17,16 +22,22) | `getClaims()` (local JWT check) instead of `getUser()` (Auth round trip); `cache()` per request | One Auth call per request | Remove Auth round trip | No Auth call per page; signing keys (`jwks.json`) downloaded per cold instance: 30–75 ms in Mumbai, ~250 ms from the US | Present | Preview traces | Effective, with a cold-instance cost |
| 11 | `3a06ba0` | `middleware.ts` (+1,2; −17,7 +21,8) | `getClaims()` and cookie options in middleware | `getUser()` | Same | Middleware (signed-in requests only) also downloads signing keys per cold isolate | Present | Traces (`[info/middleware]`) | Effective, same cold cost |
| 12 | `3a06ba0` | `lib/auth-cookies.ts` (new) | httpOnly session cookies | Readable by scripts | Security | — | Present | Journey test | Not performance |
| 13 | `3a06ba0` | `app/page.tsx` (−32,27 +32,32), `app/board/page.tsx` (−18,10 +18,14), `app/me/page.tsx`, `app/seal/page.tsx`, `app/u/[username]/page.tsx` | Page reads in one parallel batch | Many sequential awaits | Fewer stages | Batches kept; **the layout and season read in front of them were untouched** | Present (several modified today) | US measurements: Home 4.6 → 1.1–1.4 s server | Effective inside pages; insufficient overall |
| 14 | `3a06ba0` | `app/auth-actions.ts` (−30,21 +30,22; −81 +82) | Registration checks in parallel; no season read | Sequential | Faster sign-up | As intended | Present | Create profile 3.3 → 1.3 s | Effective |
| 15 | `f1d6566` 14 Nov | 12 `loading.tsx` files, `components/PageSkeleton.tsx` (new), `app/page.tsx` → `app/(home)/page.tsx` | Loading skeletons per section | Old page stayed until new one arrived | Feedback < 100 ms | **In-app taps: skeleton in 42–65 ms. First visits: never streamed early (layout blocked).** Part of the hydration race | Present | First byte vs content (D); hydration counts | Partly effective; harmful in combination with #9 until fixed today |
| 16 | `f1d6566` | `components/NavProgress.tsx` (new), `app/layout.tsx` (+9,2; +52,1), `components/BoardFilters.tsx` (+1; +13) | Progress bar on every in-site navigation | No feedback for filter changes | Feedback | Works (bar within ~50 ms) | Present | Navigation test | Effective (feedback only) |
| 17 | `f1d6566` | `app/india/page.tsx` (−11,10 +11,11) | National board read in the batch | Sequential | One stage less | Modified today | Modified | — | Effective |
| 18 | `f1d6566` | `components/SignInForm.tsx` | "Forgot" link uses client navigation | Full reload | — | — | Present | — | Effective (minor) |
| 19 | `857415a`, `c0ddc0d`, `5042068` | `tests/perf/frontend.mjs`, `deployed.mjs`, `journey-deployed.mjs` | Measurement scripts | — | Measure | **Test-only, never part of the deployed build** | Present | — | Diagnostic |
| 20 | `1f13233` 14 Nov | `app/api/health/route.ts` (new) | Health probe, edge-cached 10 s | — | Monitoring | Not on any page's path | Present | — | Not user-facing |
| 21 | `d2da1fa` 13 Nov | `supabase/pending/20261116001200_season_scores.sql` | Running totals table for fast boards and credits | Boards computed from the ledger | Scale | **Applied to staging only, not production** | Pending in production | Load tests (9.3 → 241 credits/s) | Effective on staging; not live |
| 22 | — (Vercel setting, 13 Nov) | Project Function Region `bom1` | Functions in Mumbai | `iad1` | Remove US↔India round trips | **Took effect in production only with `c502dc2` (14 Nov 17:05 UTC)**; previews since 13 Nov | Present | `x-vercel-id …::bom1::`, deployment `regions` | Effective, late |
| 23 | `5c144f0` (empty) + Vercel preview variables, 14 Nov | `BKP_DATA_SOURCE`, staging URL/key, `BKP_TRACE=1` for branch `feature/website-v1` | Preview reads staging, with tracing | Preview on demo data | Realistic preview | As intended | Present | — | Diagnostic |
| 24 | `087f92a` 14 Nov | `app/(home)/page.tsx` (+175,9), `lib/geo.ts` `featuredCities`, `lib/data/demo.ts` (cities filter) | Six featured cities from city summaries; 45 cities | 5 cities | City expansion | **`get_city_summaries` grew ~9× and became the slowest call on Home, Cities, India, Gazette** | Modified today (Home streamed) | Preview traces (94–197 ms) | Regression (not a performance change) |
| 25 | `087f92a` | `components/CityIndex.tsx` | Client-side search/filter/grouping (`useMemo`) | Region filter only | City discovery | Keystroke ≤ 80 ms, filter tap ≤ 142 ms at 4× CPU | Present | Event Timing | Effective |

Never deployed or never connected: the measurement scripts (#19); the region-trial branches proposed earlier
(push refused, never created); `season_scores` (#21) is not in production. No performance change was reverted.

## C. Deployment and infrastructure (verified 14 Nov ~17:10 UTC)

| | Production | Preview |
|---|---|---|
| URL | `baapkapaisa.com` (also `www.`, `.in`, `baap-ka-paisa.vercel.app`) | `baap-ka-paisa-git-feature-website-v1-…vercel.app` |
| Deployment, commit | `dpl_5TiDPuZhyboS3a9u6TofBuXZ2uwK`, `main` `c502dc2` | `dpl_HMui2tWFAfxJtyhKawvkYEa4fmH8`, `087f92a` |
| Source | identical (`git diff 087f92a c502dc2` is empty) | |
| Function region | `bom1` (`x-vercel-id iad1::bom1::…`) | `bom1` |
| Database | `kxbqaqbistbmxczyqbvq` production, Mumbai; 0 members, 0 seasons; 9 older migrations not applied | `wxrhwkdymjipaftipbgy` staging, Mumbai; 5 members, open season; all migrations |
| Differences | — | `BKP_TRACE=1`; staging data; registration closed in both |

## D. Measurements (before = `087f92a`, after = repairs; same machine, same conditions, back to back)

Server only (local build → staging, signed out; median of 5 after one warm-up; "first byte" = shell):

| Route | First byte before → after | Full page before → after |
|---|---|---|
| Home | 645 → 18 ms | 1,390 → 786 ms |
| Cities | 295 → 13 ms | 1,010 → 757 ms |
| India | 281 → 11 ms | 932 → 765 ms |
| Gazette | 292 → 22 ms | 973 → 702 ms |
| City board | 276 → 15 ms | 578 → 298 ms |
| Locality board | 276 → 13 ms | 554 → 300 ms |
| Profile | 1,254 → 722 ms | 1,259 → 726 ms (3 sequential stages → 1) |

Phone emulation, signed out (p50 of 3; content = page content in place):

| Route | TTFB before → after | FCP cold before → after | Content cold before → after | Content warm before → after |
|---|---|---|---|---|
| Home | 617 → 11 | 1,108 → 716 | 2,067 → 1,501 | 1,564 → 984 |
| Cities | 375 → 12 | 924 → 736 | 1,270 → 1,083 | 772 → 865 |
| India | 682 → 12 | 1,184 → 700 | 1,608 → 1,357 | 1,054 → 839 |
| Gazette | 291 → 14 | 828 → 720 | 1,637 → 1,386 | 1,135 → 812 |
| City board | 279 → 12 | 800 → 724 | 1,183 → 1,077 | 1,022 → 582 |
| Locality board | 276 → 11 | 808 → 740 | 1,168 → 1,098 | 707 → 541 |
| Seal (signed out) | 297 → 10 | 808 → 732 | 393 → 1,050* | 769 → 599 |
| Jaipur board (new city) | 334 → 12 | 832 → 720 | 1,595 → 1,057 | 1,111 → 793 |

\* Signed-out Seal before rendered without its skeleton (15 kB of JS on that sample); not comparable.

| Interaction (phone emulation) | Before p50 | After p50 |
|---|---|---|
| Tap Cities → Jaipur board | 1,897 ms | 1,276 ms |
| Tap board → Home | 1,985 ms | 1,236 ms |
| Tap Home → India | 1,298 ms | 931 ms |
| Tap India → Gazette | 1,595 ms | 975 ms |
| Board city picker → Pune | 1,093 ms | 858 ms |
| Board locality picker → Baner | 1,066 ms | 775 ms |
| First visual response to any tap | 43–83 ms | 47–60 ms |
| Search "jai" (3 keystrokes) / region tap | 444 / 117 ms | 443 / 95 ms |
| Event Timing, worst keydown / click | 56 / 72 ms | 64 / 64 ms |

Signed in (staging test member, phone emulation, p50 of 3): first paint Home 1,452 → 252 ms, Board 1,444 → 264,
Gazette 1,088 → 244, Profile 2,096 → 1,148; content with account menu Home 3,169 → 2,391, Board 2,340 → 1,292,
Gazette 2,348 → 1,850, Profile 2,203 → 1,231, Seal 1,341 → 1,395 (unchanged: needs the full standings).

Hydration / stream-swap errors (throttled, 60 loads each, local): before **9/60**, after **0/60**. Live production
before repair: 6/40 (unthrottled) through this workspace.

Live, unrepaired, for reference (phone emulation, p50): production taps 627–805 ms, preview (staging data) 1,003–1,128
ms; JavaScript 111–119 kB; TBT 62–126 ms; CLS ≤ 0.083 except Gazette/India cold up to 0.15.

Breakdown of a typical tap after repair, from these measurements: browser feedback ≤ 60 ms; server work in Mumbai
≈ 40–130 ms (board) and ≈ 100–200 ms (Home, Cities, India, Gazette); database per call 16–54 ms warm, up to 368 ms
on a cold connection; the rest is network distance (US workspace here; roughly 50–100 ms round trip in India on 4G,
not measured from India).

## E. Root causes, ranked

| # | Cause | Where | Status | Previous work | Correction | Measure |
|---|---|---|---|---|---|---|
| 1 | Production on an old US build | Vercel production | CONFIRMED, fixed 17:05 UTC by `c502dc2` | Region set 13 Nov, never redeployed | Redeploy (done) | `x-vercel-id`, deployment `regions` |
| 2 | Layout blocks all HTML on the season and viewer reads | `app/layout.tsx` 30–37 (old) | CONFIRMED | Not addressed (#9, #15) | F1 | First byte 276–699 → 7–22 ms |
| 3 | Hydration / stream-swap failures (15 %) | Same blocking layout + streamed skeletons | CONFIRMED (9/60 → 0/60) | Introduced by #15 with #9 | F1 | Error counts |
| 4 | Every page waits for the season before its own reads | `lib/data/index.ts`, page heads | CONFIRMED | #9 partial | F2 | One stage less; board 578 → 298 ms |
| 5 | Full viewer (standings) read before Board/Gazette/Home/Cities/India batches | page heads | CONFIRMED (signed in) | — | F2 (`viewerMember()`) | Signed-in Board 2,340 → 1,292 ms |
| 6 | 45-city summary on Home's critical path | `app/(home)/page.tsx` | CONFIRMED | Regression from #24 | F4 (streamed) | Home cold 2,067 → 1,501 ms |
| 7 | Profile: three sequential stages | `app/u/[username]/page.tsx` | CONFIRMED | #13 partial | F3 | 1,259 → 726 ms |
| 8 | Crown Moment swallows the first tap | `components/CrownMoment.tsx` | CONFIRMED (earlier test: ~10 s wait) | — | F5 | 2 new browser tests |
| 9 | Parallel calls each open a new connection (20–50 ms → 100–125 ms), cold first call 187–368 ms | network layer to Supabase | CONFIRMED in traces | — | Not changed (needs a deployed test) | Preview traces |
| 10 | 45-city summary itself costs 72 ms in the database and grows with members (≈ 2.2 s at 20k members locally) | `get_city_summaries()` | CONFIRMED | — | Database function rewrite (migration, needs approval) | DB timing |
| 11 | Font swap shifts layout (CLS up to 0.15) | `app/fonts.css` (no size-adjusted fallback) | LIKELY | #1 | Metric-matched fallback faces (typography change: needs approval) | CLS |
| 12 | Signing-key download per cold instance | `middleware.ts`, `lib/supabase-server.ts` | CONFIRMED in traces, small | #10/#11 | Ship the public key with the app (configuration change) | Traces |

## F. Repair record (uncommitted; exact diffs in `docs/PERFORMANCE_FORENSICS_DIFFS.md`, "Repair" section)

| Fix | Files | Change | Why | Measured effect |
|---|---|---|---|---|
| F1 | `app/layout.tsx` | Layout no longer awaits data; season line, season pill + account area, footer line stream in their own `<Suspense>` boundaries (same markup; invisible same-size placeholder for the account area) | Cause 2, 3 | First byte 7–22 ms; hydration errors 9/60 → 0/60 |
| F2 | `lib/data/index.ts`, `lib/data/supabase.ts`, `lib/data/types.ts`, `lib/data/demo.ts`, `lib/data/unavailable.ts`; pages Home, Board, Cities, India, Gazette, Seal | `getDataSourceEarly()` + `ds.ready()`: pages start reads in the same round trip as the season; `viewerMember()`: the member's own profile from the one prefetched read; `getDataSource()` unchanged for all other callers | Cause 4, 5 | Board 578 → 298 ms; signed-in Board 2,340 → 1,292 ms |
| F3 | `app/u/[username]/page.tsx` | Name-based reads start with the member lookup; redone with the stored spelling if it differs | Cause 7 | 1,259 → 726 ms |
| F4 | `app/(home)/page.tsx` | Gazette strip and featured cities stream from the summaries promise (placeholders without test ids) | Cause 6 | Home 1,390 → 786 ms (server); 2,067 → 1,501 ms (phone, cold) |
| F5 | `components/CrownMoment.tsx`; `tests/e2e/site.spec.ts` (+2 tests) | A tap on the backdrop closes it and reaches the link/button/field underneath | Cause 8 | Tests: one tap closes and navigates; empty-area tap only closes |

Checks on the repaired code: TypeScript pass; lint pass; unit 121/121; production build pass; browser tests
(demo, visitor, unavailable) 83/83; no console or page errors in any measurement run. Database code unchanged.
**Not deployed:** the live preview and production still run `087f92a`/`c502dc2` without these repairs.

## G. Remaining blockers and limits

- Repairs are local only; they need a commit, a preview deployment and the same measurements on the preview
  (your approval), then production.
- Connection reuse to Supabase (cause 9) is the largest remaining server lever; it needs a deployed test.
- `get_city_summaries()` (cause 10) needs a database-function rewrite before large membership (migration, approval).
- `season_scores` and the other pending migrations are not in production (boards are computed from the ledger there).
- Font-swap layout shift (cause 11) would need a typography-level change (approval).
- Nothing was measured on a physical phone or from India.
- `BKP_TRACE=1` remains on the preview (variable change, approval).

## H. Release readiness

**CONDITIONALLY READY**, provided:
1. The repairs are committed, deployed to the preview and re-measured there (same scripts), then released to
   production.
2. A real phone in India confirms taps in well under a second on 4G.
3. Before large membership: the `get_city_summaries()` rewrite and the `season_scores` migration in production.
