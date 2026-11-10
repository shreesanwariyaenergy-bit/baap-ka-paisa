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
| `/api/seal-card/[username]` | Seal share image, 1080 × 1920 PNG |

## Data

All pages read from one typed boundary, `lib/data/types.ts` (`DataSource`). Ranks arrive already computed on the server;
the browser never sorts to decide a rank.

- `BKP_DATA_SOURCE=demo` — invented review data (`lib/data/demo.ts`). Every page shows a "Demo data" flag.
- `BKP_DATA_SOURCE=unavailable` — no backend connected; honest empty states. Default for production builds.

No BAAP KA PAISA Supabase project exists yet, so there is no live adapter. Payments are not implemented and stay off.
