# Pending database migrations

Six files in `supabase/pending/`, written and tested on a throwaway local database (`npm run test:db`,
`bash scripts/db-audit.sh`). **None is applied.** Apply in this order; each is independent of the later ones.
Every table they touch is empty on the live project (checked read-only, 15 Nov 2026).

| # | File | What it adds | What it changes on existing objects | Until it is applied |
|---|---|---|---|---|
| 1 | `…0600_social_actions.sql` | `social_action()` | Removes direct write privileges on `follows`, `respects`, `rivals` from browser roles | Follow, Respect and rival buttons say "being switched on" |
| 2 | `…0800_registration_gate.sql` | `registration_gate`, `registration_allowlist`, a trigger on `members` | A new trigger on `members` (refuses inserts unless allowed) | Registration is gated by the app only |
| 3 | `…0900_ledger_integrity.sql` | `record_credit()`, `ledger_invariants()`, `late_payments` | New columns `rank_ledger.captured_at`, `engine_settings.settle_seconds`; one index; bodies of `ledger_guard()` and `season_tick()`; write privileges on `rank_ledger` removed from browser roles | Audit findings C1 and C2 stay open; no payment can be recorded safely |
| 4 | `…1000_declarations.sql` | `declarations`, `declaration_blocks`, five functions | Nothing | Declarations work on demo data only |
| 5 | `…1100_backing.sql` | `backings`, four functions, a trigger on `seasons` | The allowed achievement list gains `backed-the-crown`; a new trigger on `seasons` fires once when a season closes | Backing works on demo data only |

| 6 | `…1200_season_scores.sql` | `season_scores` (+4 indexes), a trigger on `rank_ledger`, `board_top()`, `score_invariants()` | Bodies of `ledger_effects()` and `ranked_board_at()` (same results) | Credits stay at about 9 a second. Needs #3 first |

Each file ends with its rollback. After applying #2: set the gate to `allowlist`, add tester emails, switch
off sign-ups in Supabase Auth, and send one invitation to verify the email journey.
