# Performance milestone

Scheduled after feature integration and before public launch. No feature is removed and no leaderboard
figure may be served stale. Nothing in this file has been changed yet: this is the baseline and the plan.

## Baseline (15 Nov 2026, deployed site, empty database)

Time until the server starts answering, three samples each, measured from outside India. These are
server times only; they exclude download, rendering and the visitor's own network.

| Page | Seconds |
|---|---|
| Home `/` | 5.57 · 2.52 · 2.23 |
| Gazette | 1.08 · 1.08 · 0.65 |
| Cities | 0.71 · 0.72 · 0.65 |
| Throne history | 0.65 · 0.68 · 0.61 |
| Board | 0.82 · 0.43 · 0.39 |
| The Seal (signed out), sign-in, terms | 0.39 – 0.47 |
| `robots.txt` (no database call) | 0.94 · 0.22 · 0.21 |

The first sample of a page is a cold start. A page with no database call answers in about 0.2 s, so nearly
all of the rest is waiting on the database.

## What the baseline already shows

1. **The homepage is the 3–4 second page.** It makes about 13 database reads and several of them wait for
   one another instead of running together. Each read crosses from the US (where the site's server code
   runs, Vercel `iad1`) to Mumbai (where the database is) and back.
2. **Every page repeats the same reads.** The layout and the page each ask for the season and the signed-in
   member; nothing is shared between navigations and nothing is cached.
3. **The numbers above are with an empty database.** With 20,000 members the board reads themselves take
   0.2 – 0.7 s each (`scripts/db-audit.sh`), which will add to every figure above.

## Plan (measure, change one thing, measure again)

| Step | Change | Expected effect | Needs approval |
|---|---|---|---|
| 1 | Move the server region to Mumbai (`bom1`) | Removes the intercontinental round trip from every read | Yes: production infrastructure |
| 2 | Run independent reads together; fetch shared data once per request | Homepage waits for its slowest read, not the sum | No |
| 3 | One database call per page for what the page needs, where several small calls exist today | Fewer round trips | Database functions: yes |
| 4 | A maintained per-season score table so boards are an index read | Board reads stay fast as members grow; credits get cheaper | Yes: migration |
| 5 | Short shared caching of public boards **keyed to the ledger**: a cached board is reused only while no credit has been recorded since it was built | Many readers share one read; never shows a rank that the ledger has moved past | No |
| 6 | Browser side: measure real interaction times on a mid-range phone on a slow connection; remove unnecessary re-renders, prefetch likely next pages, keep the page usable while data loads | Navigation and taps feel immediate | No |

Target: common interactions within 1 second where technically practical, on a mobile connection in India.

## How it will be reported

Before and after, per step, with the same measurements: server time per page (cold and warm), number of
database reads per page, database time per read at 20,000 members, and field measurements on a throttled
phone profile (time to first content, time to interactive, navigation time between the main pages).
