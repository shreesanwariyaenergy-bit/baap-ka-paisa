# BAAP KA PAISA — engineering reliability audit

Date: 13 November 2026 · Commit audited: `50de8f8` · Auditor: the implementing engineer (not independent).

**Verdict: not production-ready.** The site is safe to keep online in its current state (no members, no season, no
payments, registration closed). It must not take real money or open registration until the Critical and High
findings below are fixed and independently verified.

Read `docs/ARCHITECTURE.md` first for how the system fits together.

> **Update 14 Nov 2026:** a fix for C1 and C2 is written and passes locally (`supabase/pending/20261114000900_ledger_integrity.sql`; `db-audit.sh` S1b, S3, INV and STRESS). It is **not applied** and not independently reviewed, so both findings remain open.

## How to reproduce

| What | Command | Touches production? |
|---|---|---|
| Integrity and performance experiments (real concurrent connections) | `bash scripts/db-audit.sh` | No. Throwaway local Postgres 16 |
| Season lifecycle, permissions, attack attempts | `npm run test:db` | No. Throwaway local Postgres 16 |
| Unit tests (90) | `npm test` | No |
| Browser tests (84) | `npx playwright test --trace off` | Reads the live database; writes nothing |
| Deployed-site smoke test (45 read-only checks) | `node scripts/smoke.mjs https://baap-ka-paisa.vercel.app` | Reads only |

Limits of this audit: the local database uses a stub for Supabase Auth (`supabase/tests/platform_stub.sql`), so
nothing here proves behaviour of the real Supabase Auth and REST layers except the deployed checks in section 3.
No load test was run against the deployed site. No real email was sent or received. Nobody independent has
reviewed any of it.

## 1. Findings

Severity is the impact at a public launch with real money. "Exposure today" is the impact right now.

### Critical

**C1. A request that starts first but finishes last corrupts the throne record.** Reproduced (`db-audit.sh`, S1b).
The ledger trigger works out "who is #01" as of the row's `created_at`, which is the transaction's start time,
not the order in which rows are committed. When an earlier-started credit commits after a later-started one, the
board shows member 5 at #01 while the open reign belongs to member 4, and four reigns end before they start.
Crown Moments, Throne History, Untouchable, Revenge Taken, the Gazette and Declarations all read that record.
Scores and ranks themselves stay correct. Exposure today: none (no credits can be written).
Fix: one `record_credit()` function that takes the season lock first and then stamps the time itself; remove the
caller's ability to supply `created_at`; revoke direct inserts on `rank_ledger`.

**C2. A credit in flight while the season closes is saved into the closed season.** Reproduced (S3).
The guard checks "season is open" before the lock is taken. A credit that passes the guard and then waits behind
`close_season` is committed afterwards: it counts on the live board (member 6 at #01) but is missing from the
frozen results (member 5 recorded as the winner), and four reigns stay open in a closed season. With real money
this is a paid entry that the permanent record ignores. Exposure today: none.
Fix: re-check the season under the lock inside `record_credit()`; decide the business rule for a payment that
settles after the close (see Decisions).

**C3. There is no payment write path, and its hardest parts are undesigned.** Not a bug: nothing is built.
Missing: provider webhook signature verification, replay protection, reconciliation against the provider's
settlement report, refunds and chargebacks as compensating entries, an audit log of who credited what.
Duplicate protection exists and works (S2: a repeated `payment_ref` is refused by a unique constraint), but a
retried webhook must get "already recorded", not an error. Exposure today: none (payments are off).

### High

**H1. Read load will saturate the database long before "thousands of users".** Measured locally at 20,000 members
and 60,000 ledger rows: India board 230 ms, one member's standings 710 ms, city summaries 2.0 s, city board
55 ms. Every board is recomputed from the raw ledger on every request, and no page is cached
(`force-dynamic` everywhere). The homepage makes roughly a dozen such calls per view. Fix: a maintained
per-season score table with indexes, and short-lived caching of public boards.

**H2. Write throughput is capped at about 11 rank credits per second.** One credit takes 90 ms at that size and
every credit in a season waits for one lock. The busiest moment is the final minutes of a season, which is
exactly when anti-snipe invites a rush. The cost grows with the ledger. Fix: same score table (makes "who is #01"
an index lookup), then a concurrent stress test with a stated target.

**H3. The web functions run in the United States and the database is in Mumbai.** Verified on the deployment
(`regions: iad1`; database `ap-south-1`). Every database call crosses the world, about a dozen times per page.
Fix: move the Vercel function region to Mumbai (`bom1`).

**H4. No backup or recovery that has been tested, and "staging" is production.** The Supabase project is on the
free plan: no point-in-time recovery, and free projects are paused after inactivity. No restore has ever been
tried. The staging site and the future production site share one database, so there is nowhere to rehearse a
migration or a load test. Fix: a paid plan with point-in-time recovery, a separate staging project, a restore drill.

**H5. No monitoring, alerting or error tracking.** If a page or database function starts failing, nobody is told.
There are no uptime checks, no error reports, no slow-query alerts, no audit trail of administrative actions.

**H6. No rate limiting or abuse controls in the application.** The tester code, sign-in, password-reset request
and public read functions can be called without limit. Six wrong passwords in a row were not throttled (deployed
check). The password-reset form can be used to send email to arbitrary addresses within Supabase's own limits.
Direct Supabase sign-up is still enabled, so bare accounts can be created outside the app (Migration C and the
dashboard switch close this).

**H7. A live permission hole on the social tables until Migration A is applied.** A signed-in member can write
`follows`, `respects` and `rivals` directly through the REST API, including a Respect with a chosen date.
Exposure today: none (no members). Fix written and tested locally: `supabase/pending/…0600_social_actions.sql`.

**H8. Authentication has never been exercised end to end with real email.** Sign-up confirmation, password reset
and invitations depend on Supabase URL settings and email delivery that only a real inbox can verify.

### Medium

- **M1. Session cookies are readable by page scripts.** *(Fixed on the feature branch 18 Nov 2026, verified on staging; see `docs/PERFORMANCE.md`.)* `lib/supabase-server.ts` says sessions are httpOnly, but no
  cookie options are set, so the library default (not httpOnly) applies. Any script-injection bug would expose
  session tokens. Fix: set `httpOnly`, `secure`, `sameSite=lax`.
- **M2. No timeout or retry on database calls.** `rpcRaw` uses `fetch` with no deadline; a slow database hangs page
  renders until the platform limit. An error page exists and works, but there is no partial degradation.
- **M3. Row security is the only barrier on private tables.** The signed-out role holds table privileges on every
  table, including `member_private` and `rank_ledger`; only row policies stop reads (deployed check: returns an
  empty list, not "denied"). Fix: revoke table privileges that no policy needs.
- **M4. No Content-Security-Policy header.** HSTS, frame denial, no-sniff, referrer and permissions policies are
  present.
- **M5. Database changes are applied by hand through a tool, not by a pipeline.** Nothing checks that the live
  schema matches `supabase/migrations`. Database tests run against a stub, not the real Supabase stack.
- **M6. Demo code ships in the production bundle.** Simulated members and the prototype mechanics (Backing,
  Declarations) are gated by the data-source setting, not excluded from the build. A wrong environment variable
  would show invented data on the live site (the page would carry a "Demo data" flag).
- **M7. Registration gating is application-only until Migration C.** See H6.
- **M8. Maintainability.** One 870-line stylesheet with very long lines, inline styles in pages, and pages that fetch and assemble
  data themselves. Workable for one engineer; slows a team.

### Low

- **L1.** Eleven foreign keys without a covering index (Supabase performance advisor).
- **L2.** Supabase's security advisor flags the 13 public read functions as callable without signing in. This is the
  intended design (they return public fields only); each needs a line of justification for a reviewer.
- **L3.** `username_available` lets anyone test whether a username exists. Accepted for registration.
- **L4.** Build prints an Edge-runtime warning from the Supabase client in `middleware.ts`.
- **L5.** Confirm the Vercel plan permits commercial use before launch.

## 2. Your test scenarios

| Scenario | Result | Evidence |
|---|---|---|
| Two users overtake the same member simultaneously | Correct when both start together (serialized by the season lock). **Wrong when the first to start finishes last (C1)** | `db-audit.sh` S1, S1b |
| Repeated requests for the same transaction | Second is refused by the unique `payment_ref`. No "already recorded" reply yet (C3) | S2 |
| Unauthorized user modifies another member's data | Refused: direct writes, acting as someone else, back-dated rows, internal functions | `npm run test:db`; deployed checks below |
| Expired or invalid session | Pages render signed out, no errors | Deployed: `/seal`, `/me`, `/join`, `/` return 200 with a forged cookie |
| Application restart during a ranking operation | A credit and all its effects are one database transaction: it fully applies or fully rolls back. Not tested by killing a process | Code review of `ledger_effects` |
| Database failure during a multi-step operation | Same for the ledger. **Registration is two steps across two systems** (auth account, then member profile): a failure between them leaves an account without a profile; the next sign-in retries it | Code review of `register` / `ensureMember` |
| Large leaderboard queries | Slow at 20,000 members (H1) | `db-audit.sh` PERF |
| Many users on the same city board | Reads do not block each other, but each recomputes the board (H1). Not load-tested | PERF; no load test |
| Season closes while requests are processed | **Late credit is saved into the closed season (C2)** | S3 |

## 3. Checks run against the deployed staging site and live database (13 Nov 2026)

All were attempts that must be refused or reads. Nothing was created.

- Internal functions with the public key: `season_clock`, `season_tick`, `close_season`, `schedule_season`,
  `create_member`, `update_my_profile`, `get_me` → HTTP 401 permission denied.
- Direct inserts into `rank_ledger` and `members` → 401 (row security). Reads of `member_private`, `rank_ledger`,
  `members` → empty; `engine_settings` → 401.
- Forged session cookie and wrong tester cookie on `/seal`, `/me`, `/join`, `/` → 200, signed-out content.
- Response headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies present; no CSP.
- `npm audit --omit=dev`: 0 known vulnerabilities. Git history scan: no keys or tokens committed; `.env.local`
  is not tracked.
- Live database state: 0 accounts, 0 members, 0 seasons, rollover off, no scheduler installed.

## 4. Status by area

Nothing has been independently reviewed. Nothing involving accounts, money or seasons is production-ready.

| Area | Implemented | Locally tested | Tested on deployed staging | Independently reviewed | Production-ready |
|---|---|---|---|---|---|
| Public pages (boards, cities, Gazette, throne, archive) | Yes | Yes | Yes (smoke, empty data) | No | No (H1, H3) |
| Sign-in, sessions, password reset | Yes | Partly (no real auth stack) | Pages only; no real email | No | No (H8, M1, H6) |
| Registration and gate | Yes | Yes (stub) | Closed state only | No | No (H6, H8) |
| Row security and function permissions | Yes | Yes | Refusals verified | No | No (H7, M3) |
| Ranking ledger and overtaking | Yes | Yes, **with two failures** | No | No | No (C1, C2) |
| Season open, close, rollover | Yes | Yes | No (no season exists) | No | No (C2) |
| Payments | No | — | — | — | No (C3) |
| Follow, Respect, rivals | Yes | Yes | No (migration pending) | No | No |
| Backing, Declarations | Demo only | Yes | Hidden on live | No | No (no database design) |
| Backups, monitoring, rate limiting | No | — | — | — | No (H4, H5, H6) |

## 5. Roadmap to production

Each phase ends with evidence a second engineer can check.

**Phase 0 — close what is open now (days).** Apply Migrations A and C; switch off Supabase sign-ups; httpOnly
cookies (M1); timeouts on database calls (M2); revoke unneeded table privileges (M3); CSP header (M4); move the
function region to Mumbai (H3). Exit: deployed checks in section 3 repeated, plus a real invite, confirmation and
password reset done by hand.

**Phase 1 — ledger integrity (1–2 weeks).** `record_credit()` as the only way to write a credit: lock first, stamp
the time itself, re-check the season under the lock, return "already recorded" for a known `payment_ref`.
An invariant checker that rebuilds reigns and crown events from the ledger and compares them with what is stored.
A concurrent stress test (many connections, random start and commit order, a close in the middle). Exit: `db-audit.sh`
S1b and S3 pass; the stress test ends with zero invariant violations.

**Phase 2 — scale (1–2 weeks).** A per-season score table maintained inside the credit transaction, with indexes
for each board level; boards read from it. Short caching of public boards. A load test against a staging copy
with agreed targets (for example: 500 concurrent readers, 50 credits per second in the final minute, 95% of pages
under 500 ms). Exit: the load-test report.

**Phase 3 — operations (1 week, needs spend).** Supabase paid plan with point-in-time recovery; a separate staging
project; migrations applied by a pipeline with a drift check; a restore drill with the time it took written down;
error tracking and uptime alerts; rate limits on sign-in, reset, tester code and public reads; a written rollback
procedure for both the site (Vercel instant rollback) and the database.

**Phase 4 — payments (after legal and provider approval).** Signed webhooks, replay protection, reconciliation,
refunds as compensating entries, an audit log, and the rule for payments that settle after a season closes.

**Phase 5 — independent audit and launch gate.** An outside engineer repeats sections 2 and 3, reviews every
SECURITY DEFINER function and policy, and runs a penetration test. Launch only when every Critical and High is
closed with evidence.

## 6. Decisions needed from the founder

1. A payment that settles seconds after a season closes: refund it, or credit it to the next season?
2. Budget for a paid Supabase plan, a second (staging) project and, if required, a paid Vercel plan.
3. Approval to apply Migrations A and C and the Phase 0 code changes.
4. Whether to bring the independent engineer in before Phase 1 (to review the ledger design) or after Phase 2.
