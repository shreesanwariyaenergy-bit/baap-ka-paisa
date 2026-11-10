# BAAP KA PAISA — website

The Public Status Register, built from `BAAP_KA_PAISA_Prototype_v3.html` (visual contract) and the Product Blueprint (rules).
Next.js 15 App Router, TypeScript, plain CSS tokens in `app/globals.css`.

## Run

```bash
npm install
cp .env.example .env.local       # BKP_DATA_SOURCE=demo for review data
npm run dev                      # http://localhost:3000
```

## Checks

```bash
npm run lint && npm run typecheck && npm test
BKP_DATA_SOURCE=demo npm run build && npm run e2e   # starts two servers: demo (3200) and unavailable (3201)
```

## Pages

| Route | Page |
|---|---|
| `/` | The Scene |
| `/board?level=locality\|city\|state\|india&city=&locality=&q=` | The Board |
| `/cities` | Cities |
| `/india` | India |
| `/seal` | The Seal (replaces My Card) |
| `/archive` | Archive |
| `/u/[username]` | Public profile |
| `/board?view=movers\|hall` | Today's Movers, Hall of Fame |
| `/rank-up` | Rank Up preview (payments off) |
| `/legal/[terms\|privacy\|refunds\|grievance\|community]` | Draft policies |
| `/api/seal-card/[username]` | Seal share image, 1080 × 1920 PNG |

## Data

All pages read from one typed boundary, `lib/data/types.ts` (`DataSource`). Ranks arrive already computed on the server;
the browser never sorts to decide a rank.

- `BKP_DATA_SOURCE=demo` — invented review data (`lib/data/demo.ts`). Every page shows a "Demo data" flag.
- `BKP_DATA_SOURCE=supabase` — the live database (`lib/data/supabase.ts`), Supabase project `baap-ka-paisa` (`kxbqaqbistbmxczyqbvq`, Mumbai).
- `BKP_DATA_SOURCE=unavailable` — no backend connected; honest empty states. Default for production builds.

Payments are not implemented and stay off.

## Database (`supabase/migrations`)

| Migration | What it does |
|---|---|
| `…0000_core_schema` | States, cities, localities, seasons, members, private member data (18+ trigger), append-only rank ledger, frozen season results. RLS on every table. |
| `…0100_reference_data` | The five launch cities and their blueprint locality lists. |
| `…0300_hall_of_fame` | `get_hall_of_fame`: Lifetime Score ranking. |
| `…0200_read_functions` | `get_board`, `get_member`, `get_standings`, `get_city_summaries`, `get_season`, `get_archive`. Ranking (Season Score, earliest-to-reach tie-break, 24-hour movement) happens here. |

Guarantees, each tested against the live database inside rolled-back transactions:
- Ledger rows cannot be updated, deleted or truncated; corrections are new compensating rows.
- Credits must be positive multiples of ₹500 (50,000 paise) and carry a payment reference.
- Mystery-mode members return no name, title, flex line or member number, and cannot be found by their real username.
- Anonymous clients can read reference data and call the `get_*` functions only. Members, private data, the ledger and the internal ranking function are closed to them; nothing is writable.
- No season exists yet, so every board is honestly empty until Season 1 is created.

Not built yet: sign-up and sign-in (needs an SMS provider with DLT registration), profile editing, season open/close jobs, admin console, payments.

Running this app inside a sandbox with an HTTPS proxy needs `NODE_USE_ENV_PROXY=1` for Node's fetch.

See `docs/STATUS.md` for what is built, what still uses demo data, and what is blocked.
