# BAAP KA PAISA — build status

Updated 10 November 2026 · branch `feature/website-v1` · repository `shreesanwariyaenergy-bit/baap-ka-paisa`.

Status key:
- **Implemented and tested**: works for live data and has automated tests.
- **Implemented with test data**: the logic is real and tested, but it only has simulated or rolled-back test data to work on until members, a season or payments exist.
- **Frontend only**: the screen and server-side validation exist; nothing is saved because the backing operation is not enabled.
- **Blocked by external approval**: waiting for a decision or approval outside the codebase.
- **Not started**: later roadmap phase.

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
