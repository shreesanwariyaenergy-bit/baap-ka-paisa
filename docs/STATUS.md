# BAAP KA PAISA — build status

Updated 10 November 2026 · branch `feature/website-v1` · repository `shreesanwariyaenergy-bit/baap-ka-paisa`.

Status key:
- **Implemented and tested**: works for live data and has automated tests.
- **Implemented with test data**: the logic is real and tested, but it only has simulated or rolled-back test data to work on until members, a season or payments exist.
- **Frontend only**: the screen and server-side validation exist; nothing is saved because the backing operation is not enabled.
- **Blocked by external approval**: waiting for a decision or approval outside the codebase.
- **Not started**: later roadmap phase.

## Update, 12 November 2026: launch switches, season clock, social actions

- **Launch switches (implemented and tested):** `BKP_REGISTRATION` (open / testers / closed; live default closed), `BKP_TESTER_CODE`, `BKP_ALLOW_INDEXING` (default off, plus `/robots.txt`), `BKP_SEASON_MODE=test`, payments switches (off; no payment code exists). See `lib/flags.ts`.
- **One address setting:** `BKP_SITE_URL` drives the Seal QR, confirmation and reset links and robots.txt (`lib/site.ts`).
- **Password reset (implemented; email round trip untested):** `/forgot`, `/reset`, through `/auth/callback?next=/reset`.
- **Follows, Respect, rivals (pending approval):** `supabase/pending/20261112000600_social_actions.sql` adds one function, `social_action`. The app already calls it and shows "being switched on" until it exists. Tested on a local database only.
- **Season clock (pending approval):** `supabase/pending/20261112000700_season_clock.sql` adds configurable season dates (`schedule_season`), optional monthly rollover and a one-minute schedule. Tested on a local database only.
- **Database test (`npm run test:db`):** loads every migration into a throwaway local Postgres and runs a full test season: schedule, open, entries, ₹500 overtake, anti-snipe, social actions, close, frozen results, Season Crown, rollover to Season 2, lifetime totals, and role permissions. Passing.
- **City nicknames:** removed from display (state name shown instead); the `nickname` field in `lib/geo.ts` is editable.
- **Product email:** `lib/email.ts` is ready for a provider through environment variables; nothing sends email yet. Sign-in emails are sent by Supabase Auth.

## Update, 11 November 2026: redesign and public registration

- **Design:** rebuilt on the Stitch "gazette" direction (newsprint paper, forest ink, lime action colour, hard shadows). New homepage order: hero, throne, board, territories, movement, The Seal, season.
- **Crown:** an original open royal crown (five curved points, diamond centre finial, jewelled band), placed on top of the 01 on every live board, the throne, The Seal and share image. Outline-only for past champions.
- **Registration (implemented and tested live):** `/join` five-step wizard (account, profile, eligibility, preview, done), `/signin`, sign-out, email-confirmation callback `/auth/callback`. Supabase Auth email + password; member profiles are created by the `create_member` database function. Verified end to end against the live database with a temporary account that was then removed.
- **Signed-in state:** header shows avatar, username and permanent member ID with Profile, The Seal, Invite and Sign out. Signed-out visitors see Sign in and Create profile. Demo visitors are signed out unless they choose "Continue as the demo member".
- **Profile saving (live):** display name, title, flex line and Mystery mode save through `update_my_profile`. Socials are not stored yet.
- **Growth:** shareable head-to-head pages `/vs/[a]/[b]`, invite links `/join?ref=username` (recorded on the new account's sign-up metadata; no reward), WhatsApp and copy-link sharing for The Seal.
- **Still pending:** confirmation emails use Supabase's built-in sender (low hourly limit) and the Supabase "Site URL" must be set to the public address; follows, Respect and rivals do not save in live mode yet; no season exists, so boards are empty.

## Core product

| Feature | Status | Notes |
|---|---|---|
| Navigation, layouts (320–1440 px), prototype visual system | Implemented and tested | 60 browser tests, no horizontal overflow at five widths |
| The Board: locality, city, state, India | Implemented and tested | Ranked in the database (`get_board`) or by the engine in demo mode |
| Board views: Season, Today's Movers, Hall of Fame, Most Respected | Implemented with test data | Live functions exist and are tested in rolled-back transactions; the live database has no members yet |
| Crown on #01 | Implemented and tested | Attached to the current #01 of the selected board, every level; never on Hall of Fame, Most Respected, Archive or past reigns |
| Season engine: status, open/close, freeze results | Implemented with test data | TypeScript engine (22 tests) and database functions (`season_tick`, `close_season`) verified with simulated events. `season_tick` is not scheduled, so no live season opens on its own |
| Anti-snipe extension (+15 min, 2 h cap) | Implemented with test data | Engine and database trigger; tested, including the cap and "passes nobody" cases |
| Ledger rules: ₹1,000 entry, ₹500 steps, open season only, append-only | Implemented with test data | Database constraints and triggers; no credits exist because payments are off |
| Crown Moment | Implemented with test data | Triggered by server-side #01 changes (`crown_events` / engine); demo shows Kinjal taking Surat #01 |
| Throne History | Implemented with test data | `/throne`; database records reigns on every ledger insert |
| Automatic achievements | Implemented with test data | Founding 500, Pioneer, Season Crown, Untouchable, Longest Reign, Revenge Taken, Climber of the Week, Streak, Most Respected. Engine and database. Climber of the Week in the database needs `award_climbers` to be run weekly (not scheduled) |
| Season simulator | Implemented and tested | `/simulator`; a fixed practice season replayed on the server, clearly labelled |
| The Seal (replaces My Card) | Implemented with test data | Front, reverse, member number, standings, season record, achievements, throne record, share image, QR. Needs a signed-in member for live use |
| Seal QR | Implemented with test data | Real QR encoding `https://baapkapaisa.example/u/…` (reserved placeholder domain) until `BKP_SITE_URL` is set |
| Share image (1080 × 1920) | Implemented and tested | `/api/seal-card/[username]` |
| Public profiles | Implemented and tested | Public fields only; Mystery mode hides name and member number |
| Cities, India, Archive | Implemented and tested | Archive reads frozen `season_results` |
| Onboarding (`/join`) | Frontend only | All checks run on the server (18+, username, city/locality list, flex line); nothing is stored |
| Profile editing and Mystery mode (`/me`) | Frontend only | Server-validated; demo changes are not saved |
| Follow, Respect, rivals | Frontend only (demo) / Implemented with test data (database) | Demo actions are checked on the server and kept in a browser cookie. Database tables, limits and RLS are tested; writing them needs sign-in |
| Rank Up preview | Frontend only | Exact amount and four-board preview; confirm button permanently disabled |
| Draft policy pages | Frontend only | Marked DRAFT — LEGAL REVIEW REQUIRED |

## Blocked by external approval or decision

| Feature | Waiting for |
|---|---|
| Sign-up, sign-in, phone OTP | Authentication decision; SMS provider and DLT registration |
| Saving profiles, follows, Respect, rivals for real members | Sign-in |
| Paid rank purchases, payment webhooks, ledger credits | Legal opinion, payment-provider approval, CA confirmation of GST and rank credit |
| Live seasons | Founder decision to schedule `season_tick` (and `award_climbers`) and create Season 1 |
| QR pointing at the real site | Final production domain (`BKP_SITE_URL`) |
| KYC and the Verified badge | KYC provider choice (blueprint: required above ₹5,000 lifetime) |
| Final policy text, Grievance Officer details | Legal review |

## Not started (later phases) and their dependencies

| Feature | Depends on |
|---|---|
| Admin console | Sign-in with roles; payments and ledger adjustments; moderation queue |
| Locality Map | Locality boundary data or an approved stylised map; live members |
| Crews | Sign-in; crew tables; Respect/follow data |
| The Vault (cosmetics) | Payments approval; product catalogue; GST treatment |
| Inner Circle, Spotlight, sponsorships, physical products | Payments approval; later-phase decision |
| Finale Predictions and Oracle badge | Sign-in; legal review of a free prediction game |
| Call-Out, Face-Off, Overtake Receipts | Sign-in; Face-Off needs legal review |
| Notifications (Morning Pulse, overtakes) | Sign-in; push permission; DPDP consent |

## Mock and simulated data

| Where | What | Shown when |
|---|---|---|
| `lib/data/demo.ts` | A seeded log of simulated payments and Respect for invented members, Seasons 1–4 (Aug–Nov 2026), processed by the season engine; the signed-in demo member "Ishaan Mehta"; a demo follow graph and rivals; fixed clock 10 Nov 2026, 6:00 pm IST | Only with `BKP_DATA_SOURCE=demo`; every page shows a "Demo data" flag |
| `lib/engine/scenario.ts` | Three simulated members and nine steps for `/simulator` | Always on `/simulator`, labelled "Simulation" |
| Demo cookie `bkp_demo_social` | Follows, rivals and Respect given by the demo member | Demo mode only; never sent to the database |
| `lib/geo.ts` | City nicknames and city-index codes | Always; editorial copy awaiting founder approval |
| `lib/legal.ts` | Policy outlines | Always, marked as drafts |

The live database contains reference data only (3 states, 5 cities, 67 localities). All database tests insert simulated rows inside transactions that are rolled back.

## Checks at this commit

- `npm run lint`, `npm run typecheck`: pass
- Unit tests: 60 passing (engine, season calendar, ranking, data sources, views, achievements, profile rules)
- Browser tests: 60 passing across demo, no-data and live-database projects
- Database: season engine verified with simulated events in rolled-back transactions; internal functions (`season_tick`, `close_season`, `award_climbers`, `ranked_board`) are not callable by anonymous clients (HTTP 401)
