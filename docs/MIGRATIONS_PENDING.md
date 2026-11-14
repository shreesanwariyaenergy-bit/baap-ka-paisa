# Migration register: pending production migrations

Seven files (18 November 2026) plus two added on 14 November (#8, #9) in `supabase/pending/`. **None is applied to production.** All nine are applied
to the separate staging project and verified there on the real Supabase stack (`docs/STAGING_REPORT.md`),
and tested on a throwaway local Postgres 16. Every production table they touch is empty (checked read-only on 15 Nov: 0 accounts, 0
members, 0 seasons, 0 ledger rows).

Apply in the order shown. Each file ends with its own rollback statements.

| # | File | Depends on | Adds | Changes to existing objects | Until applied |
|---|---|---|---|---|---|
| 1 | `20261112000600_social_actions.sql` | — | `social_action()` | Direct write privileges on `follows`, `respects`, `rivals` removed from browser roles (reads of own rows kept) | Follow, Respect, rival buttons say "being switched on"; the back-dated Respect hole stays open (no members, so no exposure) |
| 2 | `20261112000800_registration_gate.sql` | — | `registration_gate`, `registration_allowlist`, `registration_allowed()`, trigger on `members` | New trigger on `members`: refuses a profile unless the gate allows the signed-in account | Registration is gated by the app only |
| 3 | `20261114000900_ledger_integrity.sql` | Applied migration `…0700_season_clock` (uses `engine_settings`) | `record_credit()`, `ledger_invariants()`, `board_from_key()`, `late_payments`, one index | Columns `rank_ledger.captured_at`, `engine_settings.settle_seconds`; bodies of `ledger_guard()` and `season_tick()`; write privileges on `rank_ledger` removed from browser roles | Audit findings C1 and C2 stay open; no payment can be recorded safely |
| 4 | `20261115001000_declarations.sql` | — | `declarations`, `declaration_blocks`, six functions | None | Declarations and blocking work on demo data only |
| 5 | `20261115001100_backing.sql` | — | `backings`, four functions, trigger on `seasons` | Allowed achievement list gains `backed-the-crown`; new trigger on `seasons` fires once when a season is marked closed | Backing works on demo data only; no backer counts on live boards |
| 6 | `20261116001200_season_scores.sql` | **#3** (needs database-stamped, increasing ledger times) | `season_scores` (+4 indexes), trigger `rank_ledger_a_scores`, `board_top()`, `score_invariants()` | Bodies of `ledger_effects()` and `ranked_board_at()` (same results) | Credits stay at about 9 a second |
| 7 | `20261116001300_social_handles.sql` | #1 for the "followers only" setting to mean anything (reads `follows`) | `member_socials`, `set_my_socials()`, `get_socials()` | None | Profile saves say handles "are being switched on" |
| 8 | `20261117001400_anti_snipe_throne.sql` | **#6** (replaces its `ledger_effects()`) | None | Body of `ledger_effects()`: the season is extended only when a credit takes #01 on one of the member's boards | Any overtake at any rank anywhere extends the national season |
| 9 | `20261117001500_operations.sql` | #3, #6, applied `…0700_season_clock` | `ops_alerts`, `run_checks()`, `get_health()` (visitors may call it) | Column `engine_settings.clock_last_run`; body of `season_clock()` (records each run) | No alert when the clock stops, a close is missed or an invariant breaks; `/api/health` reports "checks not installed" |

## Rollback considerations

- #1, #2, #4, #5, #7: drop the new objects and restore the grants listed in the file. Rows written meanwhile
  (follows, declarations, backings, handles) are lost with their tables in #4, #5, #7; in #1 the three social
  tables are existing tables and keep their rows.
- #3: restore `ledger_guard()` and `season_tick()` from `supabase/migrations/…0400_season_engine.sql`, drop
  the new functions and `late_payments`, drop the two columns. **Only clean while the ledger is empty**: once
  payments exist, dropping `captured_at` loses evidence and `late_payments` holds refunds owed.
- #6: drop the trigger, restore `ledger_effects()` (from `…0410`) and `ranked_board_at()` (from `…0400`), drop
  `season_scores`. Safe at any time: the table is derived from the ledger and can be rebuilt from it.
- #5 leaves the widened achievement list in place if any `backed-the-crown` rows exist.

## What each was tested for (local)

Commands: `npm run test:db`, `bash scripts/db-audit.sh`, `bash scripts/load-test.sh`.

| # | Evidence |
|---|---|
| 1 | Execute privileges printed: PUBLIC no, anon no, authenticated yes. Refused: signed-out call, no-session call, direct insert as self, as another member, back-dated Respect, direct update and delete, self-action, second Respect the same day, sixth rival, unknown or NULL action. Concurrent, separate connections: 4 + 4 simultaneous rival requests end at exactly 5; 6 simultaneous Respects give 1 row. Rollback restores grants and keeps rows. App side: every button calls `social_action()` and nothing else (mocked) |
| 2 | Role by role: anon, no-role, unknown role, unknown "admin" role, not-on-list, another account's id, own id by direct insert (row security) all refused; allow-listed via `create_member()` allowed; service role and owner connection allowed by design; forged member claim on an owner connection refused. Unconfirmed email refused. Allow-list unreadable and unwritable from browser roles |
| 3 | First-started-last-finished: consistent. Credit in flight at the close: waits, then counted. Retry: `already_recorded`. Two identical webhooks at once: one row. Same reference, different amount: refused. Paid before the bell, confirmed after: recorded before the bell and in the frozen results. Two such payments in reverse order: both recorded; first confirmed ranks higher. Paid after the bell, or arriving after the close: `late`, quarantined, retry stays `late`. Future capture time: refused. Back-dated insert: time overwritten. Late overtake in the last 15 minutes: season extended and open again. 60 credits from 12 connections in random order with retries: 60 rows, strictly ordered. `ledger_invariants()` across locality, city, state, India: none; and it detects deliberate damage at each level. Permissions: `record_credit()` and `ledger_invariants()` executable by service role only |
| 4 | Holder cannot declare; vacant throne refused; unknown line refused; snapshot figures correct; one standing per board; 72-hour cooldown; numbering never reused; Mystery-mode challenger shown by label only and not findable by username; block withdraws from public view; block list and unblock; outcome "made good" read from the throne record; lapses at season close; moderator removal is service-role only |
| 5 | Self, non-contender and masked-by-username refused; one per season, second refused; counts and pick with live rank; ranks identical before and after backing; at close, backers of the final city #01 awarded and others not; history survives the season |
| 6 | `score_invariants()` "identical" after: concurrent overtakes, duplicate webhooks, late payments and closure, late overtake and extension, **a refund (compensating negative row: #01 and open reign move to the right member, original row untouched)**, and the stress run with a second closure. All of #3's scenarios pass with it in place. 1,000 concurrent credits: 9.3/s before, 241/s after, zero differences |
| 7 | Bad handle and bad visibility refused; owner sees own handles and setting; "followers" hidden from a non-follower and visible after following; "nobody" hidden from followers; Mystery mode never shows handles; table unreadable from browser roles |

## After applying (per migration)

1. Re-run the read-only refusal checks against production (`docs/AUDIT.md`, section 3).
2. #2: set the gate to `allowlist`, add tester emails, switch off sign-ups in Supabase Auth, send one invitation.
3. #3 and #6: run `select * from ledger_invariants()` and `select * from score_invariants()`; both must return nothing.

## #8 and #9 (14 November)

Tested locally (`scripts/db-test.sh`, `supabase/tests/section_a.sql`): an overtake below #01 does not extend; taking a
vacant locality throne extends by 15 minutes; taking four thrones at once extends once; running totals match the ledger.
The clock alert is raised once, resolved when the clock runs, and a missed close is reported. Visitors may call
`get_health()` only; `run_checks()` and `ops_alerts` are refused to visitors and members.
Staging: applied from commit `1f13233` (md5 recorded in `staging_tools.applied`, identical to the files). pg_cron
installed on staging only, with jobs `bkp-season-clock` (every minute) and `bkp-checks` (every 5 minutes). The first run
resolved the "clock never ran" alert; integrity checks on staging data are clean.

Production, after approval: apply #8 and #9 after #1–#7, then run the two `cron.schedule` lines at the top of #9.
Rollback: #8, re-run `ledger_effects()` from #6; #9, as written at the top of the file.
