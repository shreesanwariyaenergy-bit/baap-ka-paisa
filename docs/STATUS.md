# BAAP KA PAISA — build status

Updated 10 November 2026. Branch `feature/website-v1`.

## Done

| Area | What exists | Data |
|---|---|---|
| Navigation | The Scene, The Board, Cities, India, The Seal, Archive in the prototype's header and mobile bottom bar; policy links in the footer | — |
| The Scene | City-first hero, current #01 leader panel, board summary band, home board with four level tabs, City dispatch (last 24 hours), city index panel, territory cards | Live or demo |
| The Board | Locality / City / State / India; city and locality pickers; server-side search; your own row pinned; honest counts and empty states | Live or demo |
| Board views | Season (default), Today's Movers (climbers and new entries, last 24 hours), Hall of Fame (Lifetime Score, no live crown) | Live or demo |
| Crown | One unisex SVG mark in two variants (full for large displays, compact for rows), attached above `01` on every live season board and level; outline-only past-champion mark in the Archive and a non-gold Hall of Fame #1 | — |
| The Seal | Replaces My Card. Front/back flip (mouse, touch, keyboard, reduced motion), four territory standings, season record, insignias, Lifetime Score, real 1080 × 1920 share image with download, share and copy-link | Demo only (needs sign-in) |
| Cities, India | City index with working region filter and sort; national overview, city ranking by combined Season Score, 24-hour city moves, national board | Live or demo |
| Archive | Past seasons, year and city filters, expandable champion lists | Live or demo |
| Public profile | `/u/[username]`, public fields only; Mystery mode hides name and member number | Live or demo |
| Rank Up | Preview only: targets, custom amount (₹1,000 entry, ₹500 steps), exact amount, before → after on all four boards; confirm button disabled | Demo only (needs sign-in) |
| Policies | Terms, Privacy, Refunds, Grievance, Community guidelines, each marked DRAFT — LEGAL REVIEW REQUIRED | Blueprint rules only |
| Database | Schema, launch geography, append-only ledger, RLS, read functions for board, member, standings, cities, season, archive, Hall of Fame | Supabase `baap-ka-paisa` |

Checks: lint, typecheck, 26 unit tests, 48 browser tests (demo, no-data and live-database projects) at 320, 390, 768, 1024 and 1440 px.

## Mock and placeholder data still in the code

| Where | What | When it shows |
|---|---|---|
| `lib/data/demo.ts` | Every demo member, score, movement, archive season, the signed-in "Ishaan Mehta", his record and insignias, and a fixed demo clock (10 Nov 2026, 6:00 pm IST) | Only with `BKP_DATA_SOURCE=demo`; every page then shows a "Demo data" flag |
| `lib/geo.ts` | City nicknames ("The Diamond City" …) and city-index references (vehicle registration series such as GJ-05) | Always. Editorial copy, not from the blueprint: needs founder approval |
| `lib/legal.ts` | Policy outlines | Always, marked as drafts |
| Live mode | No signed-in member exists, so The Seal and Rank Up show "Sign-in is not open yet" | `BKP_DATA_SOURCE=supabase` |

The live database holds no members and no season, so live pages show "Rankings not open yet". Nothing is invented in live mode.

## Not built, and why

| Feature (blueprint) | Blocked by |
|---|---|
| Sign-up, sign-in, onboarding (18+ gate, city/locality lock), Me / settings, Mystery mode toggle, profile editing | Authentication deferred by founder |
| Respect and Most Respected board, follows, rivals, call-outs, predictions | Need signed-in members |
| Rank Up purchase, payment webhooks, ledger credits | Payments deferred; legal, provider and CA approval |
| Season open / close jobs, anti-snipe extension, freezing season results | Operational configuration deferred; no season has been created |
| Crown Moment banner and Throne History | Need recorded #01 changes, which come from real ledger credits |
| Badges awarded automatically (Founding 500, Pioneer, Untouchable …) | Same as above |
| QR code on The Seal | No confirmed public domain |
| Admin console | Deferred by founder |
| Locality map, Crews, Vault, Inner Circle, City Wars page | Later phases in the blueprint |

## Notes

- Supabase security advisor flags the `get_*` functions as callable without sign-in. This is intended: they are the public read API and return public fields only.
- Free-plan Supabase projects pause after about 7 days without activity.
