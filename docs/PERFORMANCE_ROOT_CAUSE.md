# Performance: what you were testing, measured root cause, production recommendation

14 November 2026. Measurements only: no application code changed in this round, nothing deployed to production,
no production setting or data touched.

## 1. What you were testing

Vercel's runtime log shows your visits (12:41–13:09 UTC, served by the Mumbai edge) on `baap-ka-paisa.vercel.app`.
The same production deployment also serves `www.baapkapaisa.com`.

| | Production (what you tested) | Development preview (the fixes) |
|---|---|---|
| URL | `baap-ka-paisa.vercel.app`, `www.baapkapaisa.com` | `baap-ka-paisa-git-feature-website-v1-shreesanwariyaenergy-bit.vercel.app` |
| Deployment | `dpl_4R431JhSHbisJ95p4tY1gD6nJCBm` | `dpl_BvV2uyNmMqZR5JGAYrcHo5JXrMPv` |
| Branch, commit | `main`, `30a1fb0` (built 12 Nov) | `feature/website-v1`, `c0ddc0d` (app code identical to `5c144f0`) |
| Performance changes | **None** (predates both rounds) | All |
| Data | Production database (empty) | Staging database (preview-only variables scoped to this branch) |
| Function region | **`iad1`, Washington DC**: `regions: ["iad1"]`, `x-vercel-id …::iad1` | **`bom1`, Mumbai**: `regions: ["bom1"]`, `x-vercel-id …::bom1`, `/api/health` `"region":"bom1"` |

Your Mumbai setting is correct and is the only region setting. There is no `vercel.json`, no per-function
override and no route-level `preferredRegion`. Vercel fixes the region when a deployment is built. Production was
built on 12 Nov, before the setting existed, and has not been rebuilt since.

## 2. Measurements

### From Mumbai (a client in the same city as your visitors' nearest Vercel edge)

The client is the staging database server (AWS Mumbai) fetching each page over HTTPS: full HTML, signed out,
5 rounds per route, 12 routes, both deployments, run alternately in the same 10 minutes. The "not found" page reads
no data, so "over baseline" is the time spent on the page's data and rendering.

| Section | Production p50 / p95 (ms) | Preview p50 / p95 (ms) | Production over baseline | Preview over baseline |
|---|---|---|---|---|
| Not-found baseline | 525 / 978 | 102 / 1,238* | 0 | 0 |
| Home | **3,133 / 4,290** | **203 / 626** | 2,608 | 101 |
| Gazette | 1,187 / 1,586 | 134 / 434 | 662 | 32 |
| Cities | 1,099 / 1,175 | 124 / 354 | 574 | 22 |
| India | 1,340 / 1,893 | 130 / 142 | 815 | 28 |
| City board | 754 / 1,130 | 116 / 149 | 229 | 14 |
| Locality board | 742 / 1,167 | 124 / 181 | 217 | 22 |
| Hall of Fame | 986 / 1,365 | 124 / 150 | 461 | 22 |
| Profile | 773 / 1,516 (page not found: no members) | 165 / 400 | 248 | 63 |
| The Bill | 534 / 561 (page not found) | 178 / 180 | 9 | 76 |
| Seal (signed out) | 489 / 957 | 96 / 130 | −36 | −6 |
| Archive | 713 / 729 | 119 / 145 | 188 | 17 |

\* The p95 spikes on the preview (baseline 1,238, Home 626, Gazette 434, Profile 400) are the first request after the
function had been idle. That is cause 3 below.

Even the production *not-found* page costs 525 ms from Mumbai, against 102 ms on the preview. That is the
India–US round trip before any data is read.

### Database and server time inside the preview (Vercel runtime traces, `BKP_TRACE=1`)

| Work | Measured from `bom1` |
|---|---|
| One database call on a warm connection (`get_season`, `get_me`, `get_board`, profile batch) | **16–54 ms** |
| Signed-in check `get_me` (every member page) | 16–44 ms |
| First database call after the function was idle a few seconds | **446–454 ms** |
| Home's 11 parallel calls when they each need a new connection | 90–200 ms each (instead of ~30) |
| Session key download `jwks.json`, when not already cached | 30–75 ms in Mumbai, 223–250 ms when the session check ran in the US |

For comparison, the same calls from a US function took 250–650 ms each (performance round 1).

### Browser (Chromium) from this workspace in the US (adds ~450–850 ms of US–India network to every number)

The session check before each page runs at the Vercel edge nearest the visitor. For my test traffic that was the US
edge, so signed-in numbers here include a US→Mumbai key download that an Indian visitor does not pay.

| Section | Preview signed out: click→content p50/p95 | Preview signed in: click→content p50/p95 | Production signed out: click→content p50/p95 |
|---|---|---|---|
| Home | 707 / 1,595† | 1,121 / 1,741† | 3,516 / 4,326 |
| Gazette | 606 / 867 | 881 / 1,118 | 1,079 / 1,468 |
| Cities | 572 / 723 | 840 / 1,089 | 606 / 1,060 |
| India | 599 / 603 | 933 / 1,002 | 852 / 1,666 |
| City board | 586 / 590 | 821 / 1,073 | (not comparable, see note) |
| Locality board | 573 / 610 | 884 / 963 | (not comparable) |
| Hall of Fame | 576 / 625 | 987 / 1,090 | (not comparable) |
| Profile | 658 / 682 | 1,086 / 1,129 | 667 / 867 (page not found) |
| The Bill | 623 / 657 | 1,065 / 1,479 | 619 / 689 (page not found) |
| Seal | 548 / 814 | 896 / 1,084 | 538 / 975 |
| Archive | 558 / 644 | 996 / 1,249 | 655 / 1,458 |

† One Home click per run went to the page already open, which left the script's progress marker waiting 15 s. That is a
script artefact: real clicks on the current page are ignored by the site. The p95 shown is the full-load figure. On
production, the board clicks finished instantly because the script's wait matched before the content changed (fixed in
the script afterwards). Production has no members, so no signed-in run was possible there.

**Not measured:** a signed-in run *from Mumbai*. It would have meant pasting a session token into a database query,
which was refused as credential handling. Signed-in server and database cost is taken from the traces above.

## 3. Root causes, in order of impact

1. **Production runs an old build in the US.** Every database call crosses India–US (250–650 ms) and the old code
   makes them one after another. Home: 2.6 s of server work from Mumbai, against 0.1 s on the current code in Mumbai.
   This is the 2–3 second delay you see, and it is entirely the deployed production build. *Fix: deploy the current
   branch to production. No setting change is needed.*
2. **The production build also lacks round 1's fixes:** fewer and parallel reads, one viewer lookup per request, local
   session verification. Measured gain on the same staging data in round 1: Home 4.6 → 1.1–1.4 s, even with the
   server in the US.
3. **Remaining, on the current code:** the first database call after a few idle seconds costs ~450 ms, and Home's 11
   parallel calls open 11 connections. This is connection setup between the function and Supabase, not query time
   (queries run in 0.3–10 ms). It shows only in p95 (Home 626 ms, Profile 400 ms) and in the first page after a pause.
   *Proposed fix, not yet made:* keep connections open longer and reuse them (one HTTP/2 connection for parallel calls),
   and/or read Home in one combined call. Code-only, no spend.
4. **Remaining, signed-in only:** the session check downloads Supabase's public keys when its instance has no copy:
   30–75 ms in Mumbai, often twice per page (session check, then page). *Proposed fix, not yet made:* ship the public
   key with the app (it is public), so verification needs no network call.

No sign of a database bottleneck, an N+1 pattern, sequential page requests in the browser, repeated fetching, or slow
client-side rendering. Pages make one request per navigation and the client renders in 150–280 ms (round 2,
4× CPU-throttled).

## 4. Recommendation

**Deploy `feature/website-v1` to production.** On Mumbai measurements this takes the sections from 0.5–3.1 s (p50) to
0.1–0.2 s, with p95 at or under about 0.6 s.

Before deploying (needs your approval):
1. Read-only check: run the live-mode browser tests against the production database, signed out, with the new build
   locally. Newer features (declarations, backing, handles, Most Backed) are written to show "being switched on" when
   their database functions are missing. This confirms it against the real production schema, which lacks the nine
   pending migrations.
2. Merge `feature/website-v1` into `main` (or promote the tested preview build). Vercel builds it in `bom1` with the
   production variables already set. Nothing else changes.
3. After deploy: `/api/health` must report `"region":"bom1"`. It will report `healthy: true` with
   `checks: "not installed"` until migration #9 is applied. Repeat the Mumbai measurement on production.
4. Rollback: Vercel instant rollback to `dpl_4R431…`. No database change is involved.

Separately, and only if you want them: causes 3 and 4 above are small code changes I can make and verify on the
preview first.

## 5. Changes made in this round

All reversible, none on production:
- Vercel **preview** variables scoped to branch `feature/website-v1`: `BKP_DATA_SOURCE=supabase`, staging
  `SUPABASE_URL` and publishable key, `BKP_TRACE=1` (temporary). The general preview setting (demo data) and all
  production variables are unchanged.
- Workspace network allow-list: the preview hostname, so the deployed site could be measured in a browser.
- Staging only: table `staging_tools.perf_probe` (timing rows), function `staging_tools.probe()` (timed HTTPS
  requests). Not readable by browser roles. Neither exists on production (checked: no `staging_tools` schema, no
  `http` extension there).
- `tests/perf/deployed.mjs`: deployed-site browser benchmark.
