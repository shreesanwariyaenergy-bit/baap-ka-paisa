# Staging verification report

18 November 2026. Target: Supabase project `baap-ka-paisa-staging` (Mumbai, free tier), real Auth, real REST
API, real roles. The app ran locally pointed at staging. **Production was not touched**: checked afterwards,
it still has 0 accounts, 0 members, 0 seasons, 0 ledger rows, 16 tables and none of the seven migrations.

Reproduce: `tests/staging/api.sh auth|social|mechanics`, `node tests/staging/journey.mjs`.

## Migrations

All 15 files (the 8 production already has, then the 7 pending) were executed on staging straight from the
repository at commit `082a9f6`, one after another, each verified before the next. Checksums of the seven
pending files on staging match the reviewed files. No migration failed.

One defect was found by testing and fixed in the pending Declarations file (commit `5f4774e`): after a
season closed, a declaration from a blocked challenger became publicly visible again as "lapsed". A holder's
block now hides that challenger's declarations whatever their outcome. The corrected function was applied
to staging from the committed file and re-verified.

## Verified on the real stack

| Area | Result |
|---|---|
| Sign-in | Correct password: session issued. Wrong password and unconfirmed email: refused with the right reason |
| Registration gate | Anonymous: denied. Confirmed but not allow-listed: "Registration is not open". Allow-listed: profile created with unique member numbers 102–106. Second profile for one account, under-18, direct insert into `members`: refused |
| Sessions | Valid token reads its own profile only; tampered token rejected by the API; tampered cookie treated as signed out by the app; sign-out removes the session cookie |
| Row security and permissions | Other members' rows, the allow-list, the gate, ledger writes, `record_credit`, the season clock and moderation removal are all unreachable from signed-in and signed-out browser roles |
| Service role | May record credits and run both consistency checks; may not edit a ledger row or run the season clock |
| Social actions | Follow (no duplicate), Respect (second the same day refused), yourself refused, Mystery member reachable by label only, unknown member and NULL action refused, direct and back-dated table writes denied |
| Social handles | Saved; visible to a follower, hidden from a non-follower and from signed-out visitors; bad handle refused |
| Declarations | Holder, vacant throne, unknown line, duplicate and anonymous refused; numbered declaration created; Mystery challenger shown by label only; block hides it; block list readable by the holder |
| Backing | Yourself, non-contender, second backing and direct insert refused; counts public; ranks unchanged |
| Ledger credits | Recorded in order; duplicate webhook returns `already_recorded`; refund by compensating row moves the running total from 10,000 to 9,000 |
| Bell and late payments | Paid before the bell and confirmed after: recorded before the bell and in the frozen results. Paid after the bell: quarantined. Confirmed after the close: quarantined; retry adds nothing. Future capture time: refused |
| Season lifecycle | Two full seasons: open, credits, close after the settling window, results frozen at every level, Season Crown, Most Respected, streaks, "Backed the Crown" to the right backer only, unresolved declaration lapsed, no reign left open |
| Consistency | `ledger_invariants()` across locality, city, state and India: no violations. `score_invariants()`: running totals identical to the ledger, including after the refund |
| App journey in a browser (22 steps) | Sign-in, profile wizard, Seal, saving handles, follow/Respect/rival, backing with lock, declaring, declaration page with price of the throne, Gazette coverage, board with backer counts, The Bill, three share images, Mystery privacy, holder blocking a challenger, block list, sign-out |

## Failed

None outstanding. First-run failures in the browser journey were faults in the test script (letter case of
displayed text; clicking a button again while the profile was still being created; not waiting for sign-out
to finish). Each was re-checked directly and passed.

## Findings to carry forward

- **Session cookies are readable by page scripts** (`httpOnly=false`), now observed on the real stack. Already
  listed as a Medium finding; fix belongs with the next hardening pass.
- **"Member does not exist" comes back as a server error (HTTP 500)** from the API instead of "not found". The
  app shows the right message; the status code should be corrected in the migrations.
- **Creating a profile took several seconds** from this location through the app. Belongs to the performance milestone.

## Not tested, and why

| Item | Why |
|---|---|
| Sign-up, confirmation, password-reset and invitation emails | Staging has no email provider. Supabase's built-in sender rejects test addresses and delivers only to team members. Needs a real inbox or a provider |
| Invitation flow | Sending an invite needs the dashboard or a secret key; neither is available to me |
| Concurrent credits on staging | `record_credit` is service-role only and I have no secret key outside the database, so credits ran one at a time here. Concurrency was verified locally (1,000 at once) |
| Five-rival limit under concurrency on staging | Only four eligible targets existed; verified locally |
| Anti-snipe extension on staging | Not exercised here; verified locally |
| Load and speed | Performance milestone |
| Payments | No provider |
