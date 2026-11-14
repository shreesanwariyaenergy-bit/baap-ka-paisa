# Deployment readiness: `feature/website-v1` to production

14 November 2026. Checks only. Nothing merged, deployed, migrated or switched on. Production was only read
(schema, grants and row counts).

## Verdict

**Ready to deploy the application code. The three pre-deploy steps (A1–A3) are completed; the deploy waits for your UI changes and your approval.**
No blocker comes from the new code itself. Every feature that needs a pending migration was checked: each degrades to
an honest "being switched on" state against the production database. Production has 0 members, 0 seasons and
0 ledger rows, so nothing live can be lost or corrupted by the deploy, and rollback is instant.

## 1. The nine pending migrations (none applied to production; all applied and verified on staging)

| # | File | What it changes |
|---|---|---|
| 1 | `20261112000600_social_actions.sql` | Adds `social_action()`, the only way to follow, give Respect or add a rival, with the one-Respect-per-day and five-rival limits enforced in the database. Removes direct browser writes on `follows`, `respects`, `rivals` (closes the back-dated Respect hole). |
| 2 | `20261112000800_registration_gate.sql` | Adds `registration_gate` (closed / allowlist / open), `registration_allowlist`, `registration_allowed()` and a trigger on `members` that refuses a profile the gate does not allow, whoever calls. |
| 3 | `20261114000900_ledger_integrity.sql` | Adds `record_credit()` (the only way a payment becomes rank; idempotent; service role only), `ledger_invariants()`, `late_payments` (quarantine and refunds), column `rank_ledger.captured_at`, setting `settle_seconds`. Rewrites `ledger_guard()` (database-stamped, strictly ordered times, settle window) and `season_tick()` (closes only after the settle window). Removes browser write grants on `rank_ledger`. |
| 4 | `20261115001000_declarations.sql` | Adds `declarations`, `declaration_blocks` and six functions: declare, read, block, list blocks, outcome, moderator removal. |
| 5 | `20261115001100_backing.sql` | Adds `backings`, four functions (back, read, Most Backed, award) and a trigger on `seasons` that awards "Backed the Crown" at close. |
| 6 | `20261116001200_season_scores.sql` | Adds `season_scores` (running totals, 4 indexes), its trigger, `board_top()`, `score_invariants()`. Rewrites `ledger_effects()` and `ranked_board_at()` to use them (same results, about 26× more credits per second). |
| 7 | `20261116001300_social_handles.sql` | Adds `member_socials`, `set_my_socials()`, `get_socials()` (Instagram/Snapchat with visibility rules). |
| 8 | `20261117001400_anti_snipe_throne.sql` | Rewrites `ledger_effects()`: the season is extended only when a credit takes #01 on one of the member's boards. |
| 9 | `20261117001500_operations.sql` | Adds `ops_alerts`, `run_checks()`, public `get_health()`, column `engine_settings.clock_last_run`. Rewrites `season_clock()` to record each run. |

Order, dependencies and rollback for each: `docs/MIGRATIONS_PENDING.md`.

## 2. Production schema against what the new code calls

The new code calls 27 database functions. Production has 16 of them; **11 are missing**, all introduced by the pending
migrations:

| Missing in production | From | How the new code behaves (checked in code) |
|---|---|---|
| `social_action` (state, follow, respect, rival) | #1 | Buttons answer "Follow, Respect and rivals are being switched on" (`app/actions.ts`) |
| `get_declarations`, `declare_for`, `block_challenger`, `get_my_blocks` | #4 | Lists empty; actions answer "Declarations are being switched on"; block list empty |
| `get_backing`, `get_most_backed`, `back_member` | #5 | Backing panel hidden or empty; action answers "Backing is being switched on" |
| `get_socials`, `set_my_socials` | #7 | Handles not shown; profile save says "Saved. Social handles are being switched on" |
| `get_health` | #9 | `/api/health` answers 200 with `checks: "not installed"` |

All 16 functions the new code shares with production exist with the same signatures (`get_board`, `get_member`,
`get_standings`, `get_season`, `get_me`, `create_member`, `update_my_profile`, …). Production also has the season
clock (`season_clock`), but it is not scheduled.

## 3. Features unavailable or degraded if deployed without the migrations

- **Unavailable, labelled "being switched on":** Follow / Respect / rivals; Declarations (declare, block, block list);
  Backing and Most Backed; Instagram/Snapchat handles; health checks and integrity alerts.
- **Working but empty until a season exists:** boards, Gazette, Cities, India, Hall of Fame, Archive, Throne history
  (production has 0 seasons and 0 members today, with the old build as with the new).
- **Still guarded by the application only:** registration. The database gate (#2) is missing, so the app setting
  `BKP_REGISTRATION` (unset, so closed) is the only guard. Any account that exists in production Supabase Auth could call
  `create_member` directly through the public API. This is true today with the old build as well, so it is not caused
  by the deploy.
- **Not possible regardless:** payments. No payment code exists, `paymentsEnabled()` is hard-wired off, and the
  ledger has no browser write policy (row security blocks writes even where default grants exist; checked read-only).

## 4. Preview: registration, payments and writes (verified on the deployed preview)

| Check | Result |
|---|---|
| Registration | `/join` shows "Opening soon" (`registration-closed`). `BKP_REGISTRATION` is not set for previews, so it is closed, and the `register` server action refuses with the same rule |
| Account creation | Only through `/join` (closed). Staging's database gate is also on `allowlist`, so even a direct API call is refused for unlisted emails (tested in the 22-step journey) |
| Payments | "Payments are not open, so nothing can be bought here yet" on `/rank-up`, `/join`, `/invite`. No payment code exists |
| Search engines | `robots.txt` `Disallow: /`, header `x-robots-tag: noindex` |
| Other writes | **Enabled for signed-in staging members, against the staging database only**: profile edit, follow / Respect / rival, backing, declaring, blocking, handles. That is the purpose of the preview. No production credentials exist in the preview environment |

## 5–7. Browser tests of the preview (real Chromium, real link clicks)

**From India: not possible from this workspace.** It runs in the US and has no browser in India. What was measured:
- **From Mumbai:** full page HTML, signed out, 5 rounds (`docs/PERFORMANCE_ROOT_CAUSE.md`). Preview p50 96–203 ms,
  p95 130–626 ms; production p50 489–3,133 ms.
- **From the US, in a browser:** below. Every number includes 450–850 ms of US–India network that a visitor in India does
  not pay.

Browser rendering adds about 50–370 ms on top of the first byte: on desktop, first paint comes ~50 ms after the first
byte and content is complete ~370 ms after it. Fonts and scripts come from the nearest Vercel edge. **Estimate for a
visitor in India** (not measured): the HTML time from Mumbai plus this rendering time, so roughly 0.15–0.6 s for a full
Home load and 0.1–0.3 s for in-site clicks. The direct confirmation is you opening the preview, or running
`node tests/perf/journey-deployed.mjs <url>` from a machine in India.

Journey Home → India → Cities → City board → Gazette → Seal → Hall of Fame → Home, click→content p50 / p95 in ms, from the US:

| Step | Desktop, signed out | iPhone 13, signed out | Desktop, signed in | iPhone 13, signed in (2 rounds) |
|---|---|---|---|---|
| Home full load: content in place | 951 | 1,010 | 1,249 | 1,235 |
| Home → India | 945 / 1,193 | 1,021 / 1,235 | 1,393 / 9,790‡ | 9,965‡ |
| India → Cities | 934 / 1,007 | 650 / 791 | 952 / 1,087 | 1,197 |
| Cities → City board | 689 / 897 | 730 / 827 | 1,264 / 1,322 | 1,373 |
| City board → Gazette | 738 / 826 | 676 / 771 | 1,040 / 1,306 | 1,242 |
| Gazette → Seal | 624 / 863 | 622 / 751 | 1,177 / 1,214 | 1,410 |
| Seal → Hall of Fame (two pages: board, then the Hall of Fame tab) | 1,341 / 1,354 | 1,391 / 1,406 | 2,485 / 2,494 | 2,025 |
| Hall of Fame → Home | 708 / 735 | 754 / 762 | 1,207 / 1,563 | 1,201 |

‡ Not slowness: the Crown Moment pop-up (full screen, once per browser session, closes itself after 9 s) was covering
the page. The test's click waited for it. A real visitor's first click closes it without navigating (issue N2).

Signed-in steps cost ~250–500 ms more *from the US* because the session check before each page runs at the visitor's
nearest edge (US for these tests) and downloads Supabase's signing keys from Mumbai. For a visitor in India that check
runs in Mumbai (30–75 ms, measured in the traces).

**Errors:**
- Browser console, all four runs: none from the site. The one failed load is Vercel's preview-only comment toolbar
  (`vercel.live/.../feedback.js`), blocked by this workspace's network. It is not part of the app and not on production.
- HTTP errors: none.
- Phone layout: no sideways overflow on any page of the journey.
- Vercel runtime logs (whole project, last 50 minutes): no errors, no warnings.

## 8. Security implications of testing the new code against production data

- **What it would take:** the production Supabase URL and publishable key in a running copy of the new code (locally,
  or as preview variables). The publishable key is designed to be public: it grants only what row security and
  function grants allow anonymous visitors. No service-role key exists anywhere, and none is needed.
- **The risk is writes, not reads.** A *preview* pointed at production would be a public URL (preview protection is
  off) where a signed-in production account could edit a profile, follow / Respect / rival (production still allows
  direct writes on those three tables, migration #1), or create a profile if registration were opened. Production has
  no members, so the exposure today is small, but it would be a second public door into production data.
- **Safe way:** run the new build *locally*, signed out, with registration closed, reading production through the
  publishable key from the environment (never written to a file or the repository). Signed out, the app can only call
  anonymous read functions. This is pre-deploy step A1.
- **Not safe:** pointing the shared preview at production, signing in to production from a test, or putting
  production values in committed files or test scripts.
- **Logs:** the temporary `BKP_TRACE=1` on the preview logs function names and durations only: no arguments, data or
  tokens. It should not be set on production.
- **Sessions:** cookies are per host. Preview, `vercel.app` and `baapkapaisa.com` sessions are separate.

## Blockers: all three completed (14 November 2026)

| # | Item | Status |
|---|---|---|
| A1 | Read-only check of the new build against production, signed out, run locally | **Done, passed.** All 35 routes: 30 return 200 and 5 return the expected 404s for items not in production. Health `checks: "not installed"`. Public journey passes on desktop and iPhone with no console or HTTP errors and no sideways overflow. 288 database calls, all to 11 read-only functions; no write or Auth calls; no server errors. Production write counters identical before (14:38:35 UTC) and after (14:47:02 UTC): 301 historical writes, 0 Auth users, 0 sessions, 0 members, 0 seasons, 0 ledger rows |
| A2 | Production `BKP_SITE_URL` | **Done.** Changed by me with your approval and read back from Vercel: `https://baapkapaisa.com`, target Production only (variable `yuxm9CFsJQt4p5xD`). Previously `https://baap-ka-paisa.vercel.app`. No Preview or Development value exists; the other eight variables are unchanged; no deployment was triggered. Takes effect with the next production deployment |
| A3 | Supabase Auth URL configuration (production `kxbqaqbistbmxczyqbvq`) | **Done by the owner in the Supabase dashboard (reported, not readable by the available tools).** Site URL set to `https://baapkapaisa.com`; the authentication callback URLs for `https://baapkapaisa.com/auth/callback` were added (the app uses `/auth/callback` for confirmation and `/auth/callback?next=/reset` for password reset); existing entries kept |

**After deploying, check A3 end to end:** request a password reset from `https://baapkapaisa.com/forgot` for a test
address and confirm the email link opens `https://baapkapaisa.com/auth/callback…` and lands on `/reset`. This sends
one email and creates no account.

Open before the deploy, from you: the city expansion and footer/UI changes.

## Non-blocking (can follow the deploy)

| # | Item |
|---|---|
| N1 | Apply the nine migrations (separate approval). Until then the features in section 3 say "being switched on". #2 (database registration gate) and #1 (close the social-table write hole) are the most valuable. Both matter before any public sign-up, not before this deploy |
| N2 | Crown Moment pop-up: a member's first click while it shows only closes it. Consider letting a click on a link both close it and navigate. Design change, your call |
| N3 | First request after a few idle seconds pays ~450 ms of connection setup; signed-in pages download signing keys. Code fixes proposed in `docs/PERFORMANCE_ROOT_CAUSE.md` (causes 3 and 4), not made |
| N4 | `www.baapkapaisa.in` redirects with 307 (temporary); the others use 308. Make it 308 in Vercel → Domains |
| N5 | Remove `BKP_TRACE` from the preview variables after testing |
| N6 | Season clock not scheduled in production (Section A item T5): there is no season yet. Schedule it when the first season is created |

## Deploy and rollback (after A1–A3 and your approval)

1. Merge `feature/website-v1` into `main`. Vercel builds it in `bom1` with the production variables.
2. Check `https://baapkapaisa.com/api/health` → `"region":"bom1"`, `healthy: true`, `checks: "not installed"`.
3. Repeat the Mumbai measurement on production.
4. Rollback: Vercel instant rollback to `dpl_4R431JhSHbisJ95p4tY1gD6nJCBm`. No database change is involved.
