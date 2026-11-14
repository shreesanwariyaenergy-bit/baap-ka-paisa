# BAAP KA PAISA — architecture

For an engineer seeing this code for the first time. Findings and risks are in `docs/AUDIT.md`;
feature status is in `docs/STATUS.md`.

## What runs where

| Piece | Technology | Where |
|---|---|---|
| Website and server logic | Next.js 15 (App Router), React 19, TypeScript. Every page is rendered on the server per request | Vercel project `baap-ka-paisa`, function region `bom1` (Mumbai; the production build of 12 Nov predates the setting and runs in `iad1` until redeployed) |
| Database, accounts | Supabase project `baap-ka-paisa` (Postgres 17, Supabase Auth, REST) | `ap-south-1` (Mumbai), free plan |
| Source | GitHub `shreesanwariyaenergy-bit/baap-ka-paisa`. `main` deploys to production; `feature/website-v1` deploys a preview that uses demo data | |

There is no separate API service, queue, cache or background worker. The browser talks only to the Next.js
server; the Next.js server talks to Supabase with the **publishable key** plus, when signed in, the member's own
access token. No service-role key exists anywhere in the application or its environment.

## Trust boundaries

1. **Browser → Next.js.** Untrusted. All input is validated again on the server (`lib/profile-rules.ts`,
   server actions in `app/actions.ts` and `app/auth-actions.ts`). Sessions are Supabase Auth cookies, refreshed in
   `middleware.ts`.
2. **Anyone → Supabase REST directly.** Also untrusted: the publishable key is public by design, so the database
   must defend itself. Row security is on for every table. Clients have no write policy on any table except their
   own rows in `follows`, `respects`, `rivals` (to be removed by the pending social migration).
3. **Inside the database.** Reads go through `get_*` functions (SECURITY DEFINER, empty `search_path`, return
   public fields only). Writes go through checked functions (`create_member`, `update_my_profile`, pending
   `social_action`). Engine functions (`season_tick`, `close_season`, `season_clock`, `schedule_season`, `award`…)
   are executable by no client role. SECURITY DEFINER functions run as `postgres`, which bypasses row security:
   each function's own checks are its only protection.

## Data model (schema `public`)

| Table | Purpose | Client access |
|---|---|---|
| `states`, `cities`, `localities` | Reference data | Read |
| `seasons` | One row per season; `ends_at` moves with anti-snipe | Read |
| `members` | Public profile; `member_no` is a never-reused identity column | Own row only |
| `member_private` | Date of birth | Own row only |
| `rank_ledger` | **Append-only** credits, reversals, adjustments. The single source of truth for every score and rank | Own rows, read only |
| `season_results` | Ranks frozen when a season closes | Through functions |
| `throne_reigns`, `crown_events`, `season_extensions`, `member_achievements` | Derived by the ledger trigger | Through functions |
| `follows`, `respects`, `rivals` | Free social actions | Own rows |
| `engine_settings` | `auto_rollover` switch (off) | None |

Rules that live in the database: ₹1,000 entry and ₹500 steps (`rank_ledger` checks, `ledger_guard`), append-only
ledger (triggers refuse update, delete, truncate), one open season (partial unique index), one open reign per
board (partial unique index), unique `payment_ref`, anti-snipe (+15 min, 2 h cap) and all throne effects
(`ledger_effects`, which locks the season row), 18+ (`member_private` trigger), five rivals, one Respect per
profile per IST day.

Migrations: `supabase/migrations` (applied, in order) and `supabase/pending` (written and locally tested, **not
applied**: social actions, registration gate).

## Geography (45 cities)

Defined twice, and kept identical by `tests/unit/geo-sync.test.ts`:
- **Website:** `lib/geo.ts` (`STATES`, `STATE_REGION`, `REGIONS`, `CITIES` with each city's localities, mark and
  vehicle-series reference). Every page, picker and board name reads from here.
- **Database:** tables `states`, `cities`, `localities`, filled by `…0100_reference_data.sql` (the five launch cities)
  and the pending `20261118001600_city_expansion.sql` (the other 40). Registration (`create_member`) checks the chosen
  locality against these tables, so a city that exists in only one place cannot be joined.

Shape: 45 cities, 19 states and union territories, 6 regions.

| Region | States / UTs (cities) |
|---|---|
| West | Gujarat (Surat, Ahmedabad, Vadodara, Gandhinagar, Rajkot), Maharashtra (Mumbai, Pune, Nagpur, Nashik, Thane), Rajasthan (Jaipur, Jodhpur, Udaipur, Kota) |
| North | Delhi (NCT) (Delhi), Punjab (Ludhiana, Amritsar), Haryana (Gurugram, Faridabad, Hisar, Panipat), Uttar Pradesh (Lucknow, Kanpur, Noida, Varanasi, Agra, Ghaziabad), Chandigarh UT (Chandigarh) |
| South | Karnataka (Bengaluru), Telangana (Hyderabad), Tamil Nadu (Chennai), Kerala (Kochi) |
| East | West Bengal (Kolkata, Siliguri), Bihar (Patna), Jharkhand (Ranchi), Odisha (Bhubaneswar, Cuttack) |
| Central | Madhya Pradesh (Indore, Bhopal, Jabalpur, Gwalior), Chhattisgarh (Raipur, Bhilai) |
| North-East | Assam (Guwahati) |

Rules:
- City ids are lowercase letters only (database check); they are the URL (`?city=jaipur`) and never change.
- "Delhi (NCT)" is a website label; the database row for DL keeps its original name "Delhi" (no function reads state
  names). There is one Delhi board (the wider NCT); no New Delhi city and no Delhi NCR entity. Gurugram and Faridabad
  rank in Haryana, Noida and Ghaziabad in Uttar Pradesh.
- **Localities are major, recognisable areas only** (about five per new city, up to eight for the largest), not
  streets, societies or landmarks. Sector-based cities use non-overlapping sector bands (Gandhinagar, Noida,
  Chandigarh). The five launch cities keep their original lists unchanged.
- **Every city ends with `Other`**, a real locality board for residents whose area is not listed. Registration shows
  it as "Other"; wherever a board is named it reads "Other areas of <city>" (`localityLabel`, display only). The
  90-day city and locality lock applies to it like any other locality.
- Discovery: the homepage features six cities (the member's own city, the city on show, then cities with members by
  member count and season total, then the five launch cities and Bengaluru) and links to all 45. The Cities page
  searches city and state names, filters by the six regions and groups cities under state/UT headings. Registration
  and board pickers group cities by state/UT with native option groups.
- Demo data has members in the five launch cities only; the other boards are empty in demo mode.
- Vehicle-series references are cosmetic (city index). Faridabad HR-51, Hyderabad TG-09, Siliguri WB-74 and Bhilai
  CG-07 were checked against several secondary sources (insurance and registry guides, Telangana Today and The Hans
  India for the 2024 TS→TG change), not the official Parivahan list.

## Application layout

- `lib/data/` — the `DataSource` interface (`types.ts`) and its three implementations chosen by
  `BKP_DATA_SOURCE`: `supabase.ts` (live), `demo.ts` (simulation), `unavailable.ts`. Pages never query the
  database directly.
- `lib/engine/` — a pure TypeScript copy of the season rules (`engine.ts`) used by the demo and the simulator,
  plus the prototype mechanics that exist **only** in demo: `backing.ts`, `callout.ts`. The database
  implementation in SQL is the authority for live data; the two are kept in step by tests, not by shared code.
- `lib/flags.ts` — launch switches. Registration, payments and search indexing are off unless an environment
  variable turns them on. `lib/site.ts` — the one public-address setting.
- `lib/gazette.ts`, `lib/claim.ts` — text and claims derived from board records.
- `app/` — routes. `app/actions.ts` (profile, social, demo prototypes) and `app/auth-actions.ts` (registration,
  sign-in, password reset) are the only server-side entry points that change anything.
- `components/` — presentational and small interactive components.

## Environment variables

`BKP_DATA_SOURCE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `BKP_SITE_URL`, `BKP_REGISTRATION`,
`BKP_TESTER_CODE`, `BKP_ALLOW_INDEXING`, `BKP_SEASON_MODE`, `PAYMENTS_ENABLED`, `RANK_PURCHASES_ENABLED`,
`BKP_EMAIL_*`. Documented in `.env.example`. None is a database-admin secret. `BKP_TESTER_CODE` and
`BKP_EMAIL_API_KEY` are the only confidential values and are not set today.

## Tests

| Suite | Scope | Command |
|---|---|---|
| Unit (Vitest) | Engine rules, ranking, season calendar, flags, Gazette, Backing, Declarations, claims | `npm test` |
| Browser (Playwright) | Demo, signed-out, no-data and live-data sites on local servers | `npx playwright test --trace off` |
| Database lifecycle | Every migration on a throwaway Postgres: full season, permissions, attack attempts, rollback | `npm run test:db` |
| Database audit | Concurrency, season-close race, duplicate payment, performance at 20,000 members | `bash scripts/db-audit.sh` |
| Deployed smoke | Read-only route checks on a deployed address | `node scripts/smoke.mjs <address>` |

## Known structural limits

Boards are recomputed from the ledger on every request and nothing is cached; all credits in a season are
serialized by one lock; staging and production share one database; there is no monitoring, rate limiting or
tested backup. See `docs/AUDIT.md` for evidence and the plan.
