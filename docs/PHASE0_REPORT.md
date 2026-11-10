# BAAP KA PAISA: Phase 0 report

Date: 10 November 2026. Scope: inspection and planning only. No application code, database, credentials or deployments were changed.

## 1. What was inspected

| Source | Status |
|---|---|
| Product Blueprint v1.1 (PDF, 22 pages) | Read in full |
| Master brief v1 (Claude Code master prompt) | Read in full |
| Master prompt v3 (Crown, Seal, Archive brief) | Read in full |
| Prototype v3 HTML and package zip | Read in full, rendered at 1440 px and 390 px; zip contains the same HTML plus a README |
| Rejected design system PDF | **Not attached.** Its contents are known only from the v3 brief's description (near-black, Instrument Serif, Inter, silver and gold) |
| Repository | **None exists.** The working folder was empty and not a git repository. A local repository was created for the design lab only; nothing has been pushed |
| Supabase | 6 projects visible (groundwork, groundwork-staging, outflex, status-network, Mobility-Production, Mobility-Staging). None is named BAAP KA PAISA. None was touched |
| Vercel | 3 projects (groundwork, status-network, outflex). None is BAAP KA PAISA. None was touched |

## 2. Prototype v3 critique

What to keep:
- The city-first composition: "who owns your city" is the right opening question.
- Forest green as a primary colour. It is unusual in this category and reads as authority, not money.
- A condensed display face for rank numerals.
- The crown attached to `01`, the pinned "your row", and a feed of board changes.

What is weak or wrong:
- **The Seal is a bank card.** Credit-card ratio (1.586), an EMV chip, a fake QR made of a checkerboard. The v3 brief explicitly rules this out.
- **Cream paper plus terracotta orange** is currently the most common generated-design palette. It makes the brand forgettable.
- **Monospace uppercase micro-labels everywhere** (top line, tabs, meta, buttons). Exhausting to read and generic.
- **Fake liveness:** "LIVE FEED", "Updated moments ago", a marquee ticker. The brief forbids these unless backed by real data.
- **Data that contradicts the blueprint:** Bengaluru, Jaipur, Chennai and Vadodara appear, but launch cities are Surat, Ahmedabad, Mumbai, Pune and Delhi. "Lifetime score: 03 seasons active" confuses Lifetime Score (rupees) with season count.
- **Dead controls:** region filters (West, South, North, East) and sort do nothing; archive buttons only show a toast.
- **Inconsistent crown:** switching board level on the home preview replaces the SVG crown with a `♛` text glyph (prototype line 219).
- Three display families at once (Barlow Condensed, Changa One, DM Mono) with Karla for body. Changa One reads as a gaming font.
- Mobile nav squeezes six items into a 390 px bar at 9 px type.

## 3. Conflicts and decisions needed

| # | Conflict | Sources | Impact | Proposal |
|---|---|---|---|---|
| C1 | Unmask Night reveals masked users automatically | Blueprint p8 vs brief v1 §3.3 | Privacy | Follow brief v1: users unmask only themselves. Unmask Night becomes an opt-in event |
| C2 | Social handles public by default (p5) vs Instagram link off by default (p20) | Blueprint internal | Privacy | Hidden by default (brief v1) |
| C3 | Handle verification requires DMing the brand account | Blueprint p5 vs brief v1 | Consent | Optional, never a condition of access |
| C4 | Notifications "Default on" | Blueprint p13 vs brief v1 §3.6 | DPDP, web push | Social and promotional notifications opt-in |
| C5 | Gold used for Untouchable ring and City Wars board | Blueprint p7, p9 vs v3 "gold only for crown" | Brand meaning | Gold only for current #01 crown and Crown Moments. Untouchable gets a non-gold mark |
| C6 | "Founding Member" cards in pre-launch vs Founding 500 = first 500 ranked | Blueprint p6 vs p21 | Badge integrity | Separate "Early member" marker for pre-launch signups |
| C7 | Inner Circle priced v1.5 (p18) but built v3 (p22); Spotlight and premium usernames priced v1.5 but not scheduled | Blueprint internal | Roadmap | Follow build scope; treat price table as later-phase |
| C8 | "Verified (KYC)" badge on profile from v1, KYC built in v2 | Blueprint p4 vs p22 | False claim | No Verified badge until KYC exists |
| C9 | "Profile" (blueprint) vs "The Seal" (v3) | Blueprint p16 vs v3 §0 | Navigation | v3 wins: The Seal is the member's own view; other members open as public profiles |
| C10 | Tier ring colours Bronze/Silver/Gold/Black | Blueprint p6 vs v3 gold rule | Brand meaning | Decision needed: a Gold *tier* uses the word "Gold" but should not use crown gold. Proposal: tiers shown as text and a neutral metal-free mark |
| C11 | Gurugram and Noida | Blueprint p3, p22 | Board scope | Kept out of Delhi in v1 (brief v1) |
| C12 | ₹1,000 entry "GST-inclusive" vs rank credit | Blueprint p1, brief v1 §1.4 | Money | Rank credit configurable, blocked until CA confirms |

No conflict was found on the ₹1,000 entry and ₹500 increments, the four-level hierarchy, or the monthly reset at 00:00 IST on the 1st.

## 4. Missing decisions and risks

- **SMS OTP needs DLT registration** in India (sender ID and templates) plus an SMS provider. Neither document mentions it. This can block launch by days or weeks.
- **Season close needs a server scheduler** (e.g. Supabase `pg_cron`) with a per-season lock so simultaneous overtakes are ordered correctly.
- **Payments:** live payments require written legal classification, written provider approval for this exact model, and CA confirmation of GST and rank credit. All three are outstanding.
- **Repository and accounts:** no GitHub repository, Supabase project or Vercel project exists for BAAP KA PAISA yet.
- **Rejected design system PDF** was referenced but not attached.

## 5. Proposed architecture (unchanged from the earlier plan)

Next.js App Router, TypeScript, Supabase (Postgres, Auth, Storage), Vercel, PWA. Ranking is server-authoritative: one database function validates a settled payment, appends to an immutable ledger, updates season and lifetime scores, computes rank changes for all four boards, and writes crown and movement events, inside one transaction. Money is integer paise. Feature flags `PAYMENTS_ENABLED` and `RANK_PURCHASES_ENABLED` default to false.

Routes: `/` (Scene), `/board/[level]/[place]`, `/seal`, `/@[username]` (public profile), `/archive`, `/places`, `/me` (settings), `/onboarding`, `/admin`, legal pages.

## 6. Requirements traceability (design-relevant rows)

| Requirement | Source | Screen / component | Lab coverage | Test |
|---|---|---|---|---|
| Four boards from one entry | Blueprint §2 | Board level switch, "your four seats" | All routes | Board tabs switch scope; counts change |
| Honest counts "#n of N" | Blueprint p3 | Board footer, Seal standing | All routes | Count equals rows rendered |
| Empty locality state | Blueprint p3 | Board empty state | All routes (e.g. Althan) | Empty board shows invitation, no fake rows |
| Season / Today's Movers / Hall of Fame views | Blueprint p3 | Board view toggle | Movers in Route C only; Hall of Fame not in lab | Phase 3 |
| Own row pinned | Blueprint p3 | Pinned row | All routes | Row visible when outside the shown set |
| Tie-break by first to reach score | Blueprint p1 | Ranking function | Shared core | Unit test in Phase 4 |
| Crown on `01`, scoped to board | v3 §0, §2A | Crown insignia | All routes, three different integrations | Crown follows #01 when level or city changes |
| Crown Moment | Blueprint p7, v3 §2A | Moment dialog | All routes | Shown only when #01 changed in the last 24 h |
| Revenge Window copy | Blueprint p8 | Moment dialog | All routes | Factual 24 h statement |
| The Seal replaces My Card | v3 §0 | Nav, Seal view | All routes | No "My Card" anywhere |
| Permanent member number vs dynamic rank | v3 §2B | Seal front | All routes | Number unchanged across scope switch |
| Seal reverse: stored records, marks | v3 §2B | Seal back | All routes | Record rows come from stored data, not current rank |
| No fake QR | v3 §2B | Seal back | All routes show a text URL instead | Visual check |
| Season vs Lifetime distinct | Brief v1 §3.1 | Seal facts | All routes | Labelled separately |
| Mystery mode hides identity | Blueprint p8 | Rows, profile, share card | All routes (ANON members) | Profile shows no name for masked users |
| 9:16 share card | Blueprint p5, v3 §2B | Share preview | All routes | Preview renders; export not built |
| City Wars | Blueprint p9 | Derby panel | Route C | Combined score from board data |
| Archive with non-gold treatment | v3 §2C | Archive view | All routes | No gold in archive |
| Locality map | Blueprint p9 | — | Not in lab | Later phase |
| Rank Up flow | Blueprint p16 | — | Not in lab (payments off) | Phase 3 design, disabled |

## 7. Milestones (work units, not dates)

1. Founder chooses a route (or a combination). 1 unit.
2. Design system from the chosen route: tokens, crown asset, Seal spec, share-card templates. 3 units.
3. Next.js app shell with mock adapters, all eleven page types, states, accessibility. 6 units.
4. Supabase schema, auth with 18+ gate, profiles, privacy, RLS tests. 5 units.
5. Ranking engine and season lifecycle with simulated payments, concurrency tests. 5 units.
6. Social layer: Respect, rivals, Scene, notifications. 4 units.
7. Payment sandbox adapter. Only after provider sandbox access. 3 units.
8. Hardening and launch readiness. 3 units.
