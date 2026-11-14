# Platform resilience review

14 November 2026. Branch `feature/website-v1`. Read-only investigation, plus throwaway local Postgres tests
and measurements made earlier on staging. Nothing was changed in production, no migration was applied
anywhere, no setting was changed and nothing was bought.

**Short answer.** The ranking core is sound. All credits go through one database transaction that updates
all four boards together, so there is no eventual consistency and no race we could produce (1,000 concurrent
credits with retries and duplicates: zero differences). The weak points are around that core:

- one confirmed ledger defect: a refund after close reopens a throne in a closed season;
- payments do not exist yet. That is a missing feature, not a vulnerability, but most of the payment safety
  work is still to do;
- the Closing finale and the share images will fall over in a viral moment, because nothing is cached at
  the edge;
- there is no CI, no monitoring, no alerting and no scheduled season clock;
- the anti-snipe rule works nationally, which is a product decision you need to make.

"Tests pass" does not cover any of these points.

How to read the labels: **Defect** means it is wrong today. **Gap** means a capability is missing. **Decision**
means it works as designed, but the design should be challenged. "Code only" means it can be solved without spending money.

---

## 1. Throne integrity

### T1. A refund after the season closes reopens a throne in a closed season. Defect

- **Current:** `ledger_guard()` blocks *credits* outside an open season but lets every other row kind through
  (`supabase/pending/…0900_ledger_integrity.sql:67`). The after-insert trigger `ledger_effects()` then recomputes
  #01 at the refund's timestamp, which falls after the close, and opens a new reign.
- **Evidence (local, 14 Nov):** Two members, A at ₹2,000 and B at ₹1,500. The season closed and A was frozen as #01.
  Then a ₹2,000 reversal was recorded for A. Result: frozen results unchanged (correct), but
  `throne_reigns` now has **an open reign for B on the city, state and India boards of a closed season**.
  `ledger_invariants()` reports "open reign in a closed season" three times. Nothing prevented the
  insert.
- **Impact:** B's time on the throne grows forever, and Throne History, the Gazette and Hall of Fame
  can show a crown that was never won during the season. This becomes possible once refunds or chargebacks exist.
- **Fix (code only, about 20 lines of SQL):** Freeze closed seasons for ranking. A reversal on a closed season is recorded
  as a financial fact only: refuse it in the ledger and write it to a `post_season_adjustments` table, the way
  `late_payments` already works. As an alternative, `ledger_effects()` can skip reign and crown work when the season is not open. Also decide the rule:
  *frozen results are final, and a later chargeback does not re-crown anyone*. I recommend this rule. A
  chargeback can mark the record as "refunded" without moving the crown to someone who never held it.
- **Roadmap:** B (before payments).

### T2. A refund pushes the member's tie-break time later. Defect, minor

- **Current:** `reached_at` is the time of the member's latest ledger row of any kind (`…1200_season_scores.sql:37`).
  A partial refund therefore makes the member lose ties to people who reached the same score later.
- **Fix (code only):** `reached_at` = time of the latest *positive* row. The same change is needed in `ranked_board_at()` and in the TS engine.
- **Roadmap:** B.

### T3. One season lock serializes every credit nationwide. Decision: keep it

- **Current:** `ledger_guard()` locks the season row (`FOR UPDATE`), so credits run one at a time across India.
  That lock is what gives a strictly increasing ledger time, which is the tie-break rule you set.
- **Measured (local, 20,000 members, 60,000 ledger rows, 50 clients):** 183 credits/s mid-season and 179/s
  inside the anti-snipe window. Average wait 273 ms, zero failures, `score_invariants()` clean. Earlier run: 241/s.
  1,000 simultaneous overtakes are absorbed in about 5.5 s. Several users overtaking the same throne at once are
  ordered by ledger time, with no lost update.
- **Challenge considered and rejected:** per-city locks would raise throughput but break the national time order
  that decides ties on the State and India boards. Real payments arrive spread out over seconds, after a 10–60 s
  UPI flow, so 180/s is more than 600,000 overtakes an hour.
- **Unmeasured:** speed on Supabase Nano (free), which has less CPU than this machine. Measure on staging before
  launch. **Roadmap:** D. Revisit only if measured peak credits come within 50% of the ceiling.

### T4. Anti-snipe extends the whole country's season. Decision

- **Current:** any overtake at any rank, on any board, in the last 15 minutes adds 15 minutes for everyone, up to
  2 hours.
- **Measured:** one overtake by an unranked member in the final 12 minutes moved the national close by 15
  minutes. With thousands of members, some overtake almost certainly happens in every 15-minute window,
  so **every season will in practice run to the 2-hour cap**. The Closing countdown then becomes a rolling
  timer, and a #340 in Pune changes Mumbai's finale.
- **Options (code only):** (a) extend only when a #01 changes on some board (recommended: it matches
  "anti-snipe for the throne"); (b) per-board extensions (bigger change: closing becomes per-board); (c) keep
  the current rule and say plainly that "the season ends between 00:00 and 02:00".
- **Roadmap:** A. The rule must be fixed before the first public season. Changing it mid-season would be unfair.

### T5. The season clock is not running. Gap

- **Current:** `season_tick()` / the schedule in `…0700_season_clock.sql` are not scheduled. The schedule lines are
  commented out, so a season never closes on its own.
- **Impact:** no close, no frozen results, no Hall of Fame entry, and late payments stay in limbo. The design is right: the clock
  lives in the database, so a Vercel outage cannot stop a close.
- **Fix:** enable the one-minute pg_cron schedule (available on the free plan). This is a production change, so it needs your approval.
  Add an alert if a season is still open more than 15 minutes after `ends_at + settle`. **Roadmap:** A.

### T6. Stale "Price of the Throne" at checkout. Gap

- Between quoting "₹1,500 takes the throne" and the payment settling, someone else can pay. The credit is still
  correctly recorded and ranked, but the buyer is not #01. Integrity is intact. The risk is a dispute or a consumer
  complaint about a "misleading" price.
- **Fix (code only):** quote what money buys ("adds ₹1,500 to your Season Score"), not a guaranteed rank.
  Re-check the gap on the confirmation screen, and state "rank is not guaranteed" next to the Pay button. **Roadmap:** B.

### T7. Propagation across the four levels. Sound

One transaction updates locality, city, state and India together (`ledger_effects()`, `season_scores`).
`ledger_invariants()` and `score_invariants()` detect damage at every level, but **nothing runs them on a
schedule**. See O4.

---

## 2. Payment integrity

### P1. No payment path exists. Gap, not a vulnerability

There is no checkout, webhook route, signature check, refund call or reconciliation
(`grep cashfree|razorpay|webhook` returns nothing in `app/` and `lib/`). Only the database primitive exists:
`record_credit()` is idempotent per `payment_ref` (tested: retry, two identical webhooks at once, same reference with a different
amount, late capture, settle window, quarantine to `late_payments`). It is executable by the service role only.

### P2. What must be built before payments (all code only, no new infrastructure)

| Need | Design |
|---|---|
| Double-click Pay, latency, two tabs | A `payment_orders` table: the server creates the order **before** redirecting, keyed by `(member, season, client idempotency key)`. One open order per member per season. A second click returns the same order. The button disables on click. |
| Duplicate charge | The provider order id is unique, and `record_credit` is idempotent on it. Two orders paid by mistake both count as credits, or the second is refunded, per a written policy. |
| Webhook authenticity | Verify the HMAC on the **raw** body and a timestamp tolerance. Then **fetch the order from the provider API** and use its amount and status, never the payload's. |
| Retries, timeouts | Return 2xx only after the DB commit. On DB error return 5xx so the provider retries; `record_credit` makes retries safe. Provider call timeout 10 s with one backoff retry. |
| Durable inbox / dead-letter | A `payment_events` table storing every raw webhook (unique on provider event id) before processing. Failed rows stay with their error and form the dead-letter queue. No message broker is needed. |
| Late webhook | Already handled: a capture before the bell, confirmed within 10 min, counts. Later confirmations are quarantined to `late_payments` and default to refund. Still missing: the **refund executor**. |
| Reconciliation | A daily job comparing the provider settlement report with `rank_ledger` + `late_payments`: every captured payment is either a credit or a refund owed, and nothing else. |
| Refunds | A provider refund call. The confirmed refund is recorded as a reversal, with the T1 fix in place first. |
| Provider outage | A `payments_paused` switch in `engine_settings`, read by the Pay page. A circuit breaker: after N consecutive provider errors, show "payments paused" instead of letting users retry. |
| Keys | The provider secret and the service-role key are server-only in Vercel env. Today neither exists in Vercel. Keep it that way until then. |

**Roadmap:** all B. Legal clearance and merchant approval remain preconditions (standing rule).

### P3. Payment captured before the close, webhook late. Sound, already tested

Covered by the settle window (`captured_at < ends_at`, arriving within `settle_seconds` = 600). The season is closed only
after the window, under the same lock (`season_tick()`). A credit being processed at the moment of closure
waits for the lock and is then counted (tested).

---

## 3. Viral scale

Measured ceilings (staging, from a single app instance in this container, US → Mumbai): city board 66.8 req/s
at 40 concurrent; homepage 20–25 req/s (11 database calls per view); database functions 0.3–10 ms each. The
latency is the US-to-Mumbai network (250 ms per call), not the database.

### V1. The Closing finale polls the origin every 5 s per viewer. Will fail at scale

- **Current:** `components/ClosingStage.tsx:30` polls `/api/closing` every 5 s (live) with `no-store`. Each poll makes
  4–5 database calls (`lib/closing-live.ts:18-20`) and depends on the viewer.
- **Model:** 10,000 people watching a city finale → 2,000 req/s → about 9,000 database calls/s. That is about 100× the
  measured ceiling, at exactly the moment the product is about.
- **Fix (code only, small):** put the city in the URL so the response is the same for every viewer, and send
  `Cache-Control: public, s-maxage=2, stale-while-revalidate=3`. Vercel's CDN then sends about one request per city every
  2 s to the origin, whatever the audience size. Data is at most 2 s old and carries its "as of" time. This is not stale
  ranking: the poll is already 5 s.
- **Roadmap:** C, but it must be done **before the first public finale**.

### V2. Every page is dynamic and uncached. Gap

- **Current:** all pages are `force-dynamic`. A signed-out home view costs 11 database calls.
- **Model:** a 100,000-visitor spike over 10 minutes ≈ 170 views/s ≈ 1,900 calls/s. Function concurrency and Supabase
  Nano will saturate, and visitors see errors (one retry, then the error page).
- **Fix (code only):** cache signed-out HTML at the edge, keyed by a database **ranking version** (the latest ledger id,
  returned by `get_season()`). The cache stays valid until the ledger changes, so it is never stale. A short TTL with a visible
  "as of" time is the simpler alternative. Your rule "no stale ranking data" decides which one to use. Members stay dynamic.
- **Roadmap:** C.

### V3. Share images cannot be cached by the CDN. Gap

`seal-card`, `gazette-card` and `declaration-card` send `Cache-Control: private, max-age=60`. Every WhatsApp, X
or Telegram link preview renders a 1080×1350 image (CPU-heavy) plus database reads. A viral share means thousands
of renders. **Fix:** `public, s-maxage=300, stale-while-revalidate=600` (code only). **Roadmap:** C.

### V4. Server region. Corrected 14 Nov: the setting is already Mumbai; production has not been rebuilt since

Evidence (read-only, 14 Nov):
- Project Function Region setting: Mumbai. Every build since 13 Nov records `regions: ["bom1"]` (latest preview
  `dpl_JD2j8…`, commit `90e5cca`). The response header confirms it: `x-vercel-id: iad1:iad1::bom1::…`. The last
  part is the region that ran the function.
- **The live production deployment** (`dpl_4R431…`, commit `30a1fb0`, built 12 Nov, *before* the setting was
  changed) records `regions: ["iad1"]` and answers `x-vercel-id: iad1::iad1::…`. Vercel fixes a deployment's region
  when it is built. Production keeps running in the US until it is rebuilt.
- There is no `vercel.json`, no route-level `preferredRegion` and no other per-function override.
- Production and preview are the same Vercel project (`prj_UbK8…`) and use the same region setting.

**Why the earlier measurements showed US latency:** the performance runs did not measure a Vercel deployment. They ran
the app on this workspace's server, which is in US East (the first part of `x-vercel-id` is `iad1`, the Vercel edge nearest
to it), against the Mumbai database. Preview deployments have no database to measure: they run on demo data.

**Fix:** none needed in configuration. The next approved production deployment runs in `bom1`. To measure Mumbai
latency for real, a deployment must run in `bom1` *and* point at a database. `/api/health` reports
`region` (from `VERCEL_REGION`) and the database round-trip time, so the first production build can confirm both. **Roadmap:** A,
done when production is redeployed (your approval).

### V5. No rate limiting. Gap

- **Current:** there is none in the app. Supabase Auth limits its own endpoints (sign-in, sign-up, reset).
  Social actions are bounded by database rules (5 rivals, 1 Respect a day). Share images, server actions and
  `/api/closing` are not limited.
- **Fix:** Vercel Firewall custom rules and Attack Challenge Mode for bursts. Check what your plan includes before relying
  on it. Per-IP limits on the share-image routes. Do not build an in-memory limiter: serverless instances do not share
  memory. **Roadmap:** C (B for the Pay and webhook routes).

### V6. Pooling, indexing, N+1. Sound

The app never opens database connections. It talks to PostgREST, which pools them (Nano: 60 connections). Board reads use
covering indexes on `season_scores` (0.3–10 ms). The last round removed the N+1 and sequential calls. Locally, 100 direct
clients against 60 connections are refused. That does not apply through PostgREST, but it means **the payment webhook
must also go through PostgREST or the pooler, not a direct connection.**

### V7. Hosting plan terms. Gap, spend

Vercel's Hobby plan is for non-commercial use, and charging entry fees is commercial. The Supabase free plan has no
point-in-time recovery and pauses inactive projects. Before money is taken: Vercel Pro (about $20/month) and Supabase Pro
(about $25/month). **Roadmap:** B. **Do not buy until you decide.**

---

## 4. Security

| # | Finding | Status | Fix | Roadmap |
|---|---|---|---|---|
| S1 | Auth cookies were readable by page scripts | **Fixed on this branch** (`lib/auth-cookies.ts`, httpOnly), **not yet in production** | Ship with the next approved deploy | A |
| S2 | Production still has the social-table write hole (back-dated Respect) | Pending migration #1 closes it. No members, so no exposure today | Apply pending migrations (your approval) | A |
| S3 | No Content-Security-Policy. Only one raw-HTML spot: the server-generated QR SVG (`components/Seal.tsx:46`). React escapes everything else | Gap | CSP in report-only mode first, then enforce. Confirm HSTS on the custom domain | B |
| S4 | Staging test password committed in `tests/perf/*.mjs`, `tests/staging/*` (fake `@test.invalid` staging accounts only) | Low risk | Read it from an env var, then rotate the staging test password | A (trivial) |
| S5 | Session revocation: `getClaims()` checks tokens locally, so a signed-out or banned token works for reads until it expires (1 h) | Accepted trade-off | Every *write* is re-checked in the database (`auth.uid()` + membership). Optionally shorten token life (an auth setting: your call) | D |
| S6 | Staging has `extensions.http` and `staging_tools` (fetch from GitHub) | Staging only, owner only | Never replicate to production. Production checked clean | — |
| S7 | SQL injection: no dynamic SQL in any function; RPC arguments are parameterised | Sound | — | — |
| S8 | CSRF: Next server actions check Origin against Host; cookies are SameSite=Lax; the only API POST sets a practice cookie | Sound | Webhook route: signature only, no cookies | — |
| S9 | IDOR / RLS: tested role by role in `docs/AUDIT.md` and on staging (anon, member, other member, service role) | Sound | Re-run after applying pending migrations | — |
| S10 | Secrets: only publishable keys in Vercel, no service-role key anywhere client-side, `npm audit --omit=dev`: 0 | Sound | Add Dependabot (free) | C |
| S11 | SSRF: the app fetches no user-supplied URL (handles are stored, never fetched) | Sound | — | — |

---

## 5. Operational survival

### O1. No CI. Gap

There is no `.github/workflows`. The 109 unit tests, 89 browser tests and the database tests run only when someone
runs them, and Vercel builds whatever reaches `main`. **Fix (code only; GitHub Actions free minutes):** on every
push, run typecheck, unit tests, build, the browser suite and `scripts/db-test.sh` on a throwaway Postgres. Block merge
to `main` on failure. **Roadmap:** A.

### O2. Migrations are applied by hand. Gap

Staging and production are kept in step by a register document and manual apply. Drift is invisible.
**Fix (code only):** a script that compares function bodies and migration md5s between environments
(staging already records md5s in `staging_tools.applied`). Rule: the app always tolerates both schema versions
(it already shows "being switched on"). **Roadmap:** B.

### O3. Rollback. Mostly sound

Vercel keeps the previous deployment and rolls back instantly. A failed deploy never replaces the live one, and
season logic lives in the database, so a bad app deploy cannot corrupt the ledger. Database rollbacks are written
per file, but #3 (ledger integrity) rolls back cleanly **only while the ledger is empty**. Do not roll it back
after payments: roll forward instead.

### O4. No monitoring, alerting or health check. Gap

No error tracking, no uptime check, and no one is told when an invariant breaks or a season fails to close. Tracing is opt-in (`BKP_TRACE=1`).
**Fix (code only, free tiers):**
- `/api/health`: one database ping and the season state, edge-cached for 10 s.
- An external uptime check every 5 min.
- A scheduled job (pg_cron) running `ledger_invariants()` and `score_invariants()` every 5 min that writes to an `alerts` table.
- An emailed alert when that table gets a row.
- Error tracking (Sentry free tier).

**Proposed SLOs:** pages 99.5% monthly; a captured payment becomes rank within 60 s for 99.9%; **zero**
invariant violations (no error budget, so any violation pages you). **Roadmap:** A (health, uptime, invariant job), B
(payment SLO alerting).

### O5. Backups and disaster recovery. Gap, spend

The free plan gives no point-in-time recovery. The ledger is the financial record. **Before payments:** Supabase Pro daily
backups, plus your own nightly encrypted export of `rank_ledger`, `late_payments` and `payment_events`. The ledger is
append-only, so it can be rebuilt from export plus provider records. Restore must be practised once on staging. **Roadmap:** B.

### O6. Outages

| Scenario | What happens today | Needed |
|---|---|---|
| Database down | Pages retry once, then show the error page. No writes are lost (there are none to lose). The clock stops with the database and resumes after | A maintenance page switch. Rule: **if the database was down in the final hour, extend the season by the outage length** (write it down now) |
| Payment provider down | n/a (no payments) | The `payments_paused` switch (P2) |
| Vercel down | Site down. The database clock keeps closing seasons. Webhooks queue at the provider and retry | Nothing extra |
| Deploy fails mid-season | The previous deployment keeps serving | CI (O1) |

---

## 6. Patterns you asked about

| Pattern | Verdict |
|---|---|
| Distributed locking | Postgres row lock on the season is the right tool. No Redis |
| Message queue / dead-letter | A `payment_events` table (inbox + failure column). No broker until payments exceed thousands a minute |
| Exponential backoff | The provider retries webhooks. Our provider calls: 1 retry with backoff. Reads: 1 retry already |
| Circuit breaker | Only around the payment provider (P2) |
| Pub/sub, realtime | Not now. Supabase Realtime connections are capped per plan. CDN-cached polling (V1) scales better and costs nothing |
| Eventual consistency | Avoid for ranking (it is synchronous today; keep it). Acceptable only for edge caches that carry an "as of" time or a ranking version |
| Replication, read replicas | D: paid, and not needed while reads are 0.3–10 ms |
| API versioning | The RPC function names are the API. Never change a signature in place: add `fn_v2`, deploy the app, then drop the old one |
| Kubernetes, sharding, microservices, multi-region | **Not justified by any measurement.** One Postgres handles about 180 credits/s; the bottleneck is network distance and missing caching |

---

## 7. Stress scenarios: realistic limits

| Scenario | Result | Basis |
|---|---|---|
| 10,000 users on one city board | Data side fine (index reads, rank by window over one city). Page side: ~67 board views/s per app instance today | Measured, staging + local |
| 1,000 simultaneous overtakes | About 5.5 s to absorb, ordered, no loss, invariants clean | Measured, local |
| Many users overtaking the same throne | Serialized by ledger time; the last to commit holds the throne; one reign per change | Measured, local |
| Duplicate payments / webhooks | One ledger row per reference; a mismatched amount is refused | Tested, local + staging |
| Payment captured before close, webhook late | Counted within 10 min, quarantined after | Tested |
| Season closure while credits are processing | The close waits for the lock, then counts the credit | Tested |
| Refund after closure | **Opens a ghost throne (T1)** | Tested 14 Nov |
| DB connection saturation | Not reachable through PostgREST in our tests. Direct connections over 60 are refused | Measured, local |
| 100,000-visitor event | **Fails today** (V1, V2, V3) | Modelled from measured ceilings |
| Deploy failure during season | Previous deployment keeps serving | Platform behaviour |
| DB / provider outage | Error pages; no data loss; rule for extensions missing | Code reading |

Still to measure on staging (free, needs no approval beyond the existing staging permission): credit throughput on
Nano, and edge-cached throughput once V1 to V3 are built.

---

## 8. Roadmap

**A. Must fix before public launch**
1. T4: decide the anti-snipe rule (recommended: extend only when a #01 changes).
2. T5: schedule the season clock in production (approval) + alert on a missed close.
3. V4: already set to bom1; takes effect with the next approved production deployment.
4. S1 + S2: deploy the httpOnly cookie fix; apply the seven pending migrations (approval).
5. S4: remove the committed staging password.
6. O1: CI with all test suites, gating `main`.
7. O4: health check, uptime check, scheduled invariant job with email alert, error tracking.

**B. Must fix before enabling payments**
1. P2: orders with idempotency keys, verified webhooks, `payment_events` inbox/DLQ, refund executor, daily
   reconciliation, pause switch and circuit breaker.
2. T1: freeze closed seasons against reversals; T2: tie-break uses positive rows only.
3. T6: honest price wording and re-check before Pay.
4. V5: rate limits on Pay and webhook routes. S3: CSP.
5. O2: migration drift check. O5: backups + nightly ledger export + one restore drill.
6. V7: commercial-use hosting plans (spend, your decision).

**C. Needed for the first major traffic spike**
1. V1: CDN-cached Closing poll (**before the first public finale**).
2. V2: edge-cached signed-out pages keyed to a ranking version.
3. V3: cacheable share images. V5: firewall rules. S10: Dependabot.

**D. Only at substantial scale**
1. T3: revisit the national lock only if peak credits reach about 90/s sustained.
2. Read replicas, a larger database tier, a message broker: only on measured need.
3. S5: shorter token life if bans become common.

All of A and B except V7 and O5's paid backups can be done in code, without spending.

---

## 9. Section A status (14 November, staging and feature branch only)

| Item | Status | Evidence | Still needs |
|---|---|---|---|
| T4 anti-snipe rule | **Done.** Extends only when a credit takes #01 on one of the member's boards. TS engine, migration #8, homepage, Gazette and simulator copy | Unit tests (2 new), `section_a.sql`, ledger audit S4 still extends on a late #01 take; applied to staging, md5 matches | Your confirmation of the rule; production migration (approval) |
| T5 season clock | **Running on staging**: pg_cron `bkp-season-clock` every minute, heartbeat in `engine_settings.clock_last_run` | First run 12:34 UTC 14 Nov succeeded; season 3 is due to close at 06:15 UTC on 15 Nov, the first unattended close | Production: the two `cron.schedule` lines (approval) |
| V4 region | **Already set.** See V4: builds since 13 Nov run in `bom1` | `x-vercel-id …::bom1::` on the preview | A production redeploy (approval) |
| S1 httpOnly cookies | Done on the branch; staging journey checks it | Journey 22/22 (`httpOnly=true`) | Production deploy (approval) |
| S2 pending migrations | All 9 on staging | `staging_tools.applied` | Production (approval) |
| S4 committed password | **Removed** from every tracked file; scripts read `BKP_STAGING_PASSWORD` | `git grep` finds nothing | It is still in git history: rotate the staging test password (staging test accounts only) |
| O1 CI | **Added** `.github/workflows/ci.yml`: typecheck, lint, unit, build, 89 browser tests, database suite + ledger audit | First run failed on a YAML syntax error in the workflow file, fixed in the next commit | Optional: require it to pass before merging to `main` (GitHub branch protection: your setting) |
| O4 monitoring | **Added** migration #9 (`run_checks()` every 5 min on staging, `ops_alerts`, `get_health()`), `/api/health` (200/503, edge-cached 10 s, reports region and DB time), `.github/workflows/uptime.yml` (every 15 min; GitHub emails you when a scheduled run fails) | Staging: "clock never ran" raised, then resolved by the first clock run; health 200; visitors refused `run_checks` and `ops_alerts` | Set repository variable `BKP_HEALTH_URL` once production runs the new build. Error tracking (Sentry free tier) needs an account: your decision |
