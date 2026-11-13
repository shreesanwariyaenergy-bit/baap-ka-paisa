# Viral-scale readiness: a 100,000-visitor spike

15 November 2026. **Verdict: the current setup would not survive it.** Sign-up would fail first and
completely; the database would saturate within the first minutes; ranking integrity would hold.
The Vercel + Supabase architecture itself is adequate; what is missing is configuration, a paid tier,
caching of public pages and one data-model change. Nothing here has been changed in production.

Labels used below: **MEASURED** (run by `scripts/load-test.sh` or `scripts/db-audit.sh` on a throwaway local
database, 4 cores / 15 GB, 20,000 members, 60,000 ledger rows), **VERIFIED** (read from the live project
or the provider's documentation), **ESTIMATE** (arithmetic from the measured figures; not tested).

## 1. Current limits

| Item | Value | Basis |
|---|---|---|
| Database | Supabase, Mumbai, Postgres 17, `max_connections` 60, `shared_buffers` 224 MB (smallest instance) | VERIFIED on the live project |
| Sign-up email | Built-in sender delivers **only to the organisation's own team members** and is capped per hour | VERIFIED, Supabase docs |
| Sign-up email with own SMTP | Default **30 new users per hour** until raised in settings | VERIFIED, Supabase docs |
| Auth verification calls | 360 per hour **per IP address**, burst 30 | VERIFIED, Supabase docs |
| Auth token calls (sign-in, session refresh) | 1,800 per hour **per IP address**, burst 30 | VERIFIED, Supabase docs |
| Where our auth calls come from | The site's server, so **every member shares the server's IP addresses** | VERIFIED in `lib/supabase-server.ts`, `app/auth-actions.ts` |
| Free database plan | Paused after a week of low activity; no downloadable backups | VERIFIED, Supabase docs |
| Server region | US East (`iad1`); database in Mumbai | VERIFIED on the deployment |
| Vercel plan | Not visible through the tools I have. If Hobby: personal use only, roughly 1M requests and 100 GB a month | UNVERIFIED |
| Rate limiting, bot protection, monitoring | None | VERIFIED in code |

## 2. Measured capacity (local, stronger than the live database instance)

| Operation | Result |
|---|---|
| City board, top 50 | **86 reads/s** at saturation (116 ms at 10 clients, 595 ms at 50) |
| Homepage's database reads (5 calls) | **4.6 homepages/s** (2.1 s at 10 clients, 11.3 s at 50) |
| Profile page reads (2 calls) | **6.8 profiles/s** |
| 5,000 registrations, 50 at a time (database side) | 5,000 of 5,000 in 2.8 s, **1,816/s**; 0 duplicate profiles, usernames or member numbers |
| 1,000 rank credits at once | 1,000 of 1,000, **9.3/s**, the last one waited 107 s; 0 duplicate payments; ledger consistent |
| 100 clients against 60 connections | Refused: "too many clients" |
| One web server process, homepage (no database) | 75 pages/s, 656 ms median at 50 concurrent |

## 3. Scenarios

Page views assume six pages per visitor (ESTIMATE). Capacity is the measured 4.6 homepages/s.

| Scenario | Needs | Today | First failure |
|---|---|---|---|
| 100,000 visitors in 24 hours | ~7 pages/s average, ~30/s at peak | ~5/s | Database saturates at peak; pages time out |
| 100,000 visitors in one hour | ~170 pages/s | ~5/s | Database, by about 35× |
| 10,000 simultaneous visitors | Hundreds of pages/s | ~5/s | Database; then connection refusals |
| 5,000 simultaneous registrations | 5,000 emails and auth calls | 0 emails to the public | Email sender; then 30/hour; then per-IP auth limits |
| 10,000 simultaneous registrations | Same | Same | Same. The database side handled 1,816/s (MEASURED) |
| 1,000 simultaneous overtakes | 1,000 credits | 9.3/s | All are recorded correctly, but most requests time out waiting (ESTIMATE on timeout) |

## 4. What would break, in order

1. **Sign-up.** No public address can receive a confirmation email at all. With an email provider
   connected, the default is still 30 sign-ups an hour.
2. **Sign-in and sessions.** Because the server makes the calls, all members share one per-IP allowance:
   about 1,800 sign-ins or session refreshes an hour for the whole site.
3. **Every page.** Each board is recomputed from the ledger on every view and nothing is cached. About five
   homepage loads a second saturate a database stronger than the live one.
4. **Overtakes in a rush.** Correct, but one at a time at about nine a second.
5. **Share images.** `/api/seal-card` and `/api/declaration-card` draw a picture on every request with no
   cache and no limit: the cheapest way to exhaust the server budget.
6. **The plan itself**, if it is Hobby, and a free database that may be asleep when the spike arrives.

## 5. What holds under load (tested)

Duplicate registrations and member numbers (5,000 concurrent, none), duplicate payments (same reference
returns "already recorded"), two members claiming one position (season lock; consistent under 1,000
concurrent credits and the 60-credit random-order run), back-dated or forged times, and unauthorised calls
(role-by-role tests). These live in the database, so they do not depend on traffic. The ledger part is in a
migration that is **not yet applied**.

## 6. Architecture decisions

Keep Vercel + Supabase. Changes, in priority order:

| # | Change | Why | Cost | Approval |
|---|---|---|---|---|
| 1 | Email provider for sign-up mail, raise the hourly limit, add CAPTCHA to sign-up | Without it nobody can register | ~$20/month + usage | Auth settings: yes |
| 2 | Make auth calls count per visitor, not per server: forward the visitor's IP (needs a server-side secret key and a setting) or make sign-in calls from the browser | Removes the shared 1,800/hour ceiling | None | Design decision + auth setting |
| 3 | Paid database plan; larger instance for launch week | Removes pausing, adds backups, raises capacity | $25/month + $15–$210 for the instance | Yes |
| 4 | Cache public pages for signed-out visitors at the edge for a few seconds, cleared the moment a credit is recorded | Most viral visitors are signed out; database load stops growing with visitor count; no stale ranks | None | No (code) |
| 5 | Maintained per-season score table; boards become index reads | Board reads and credits become milliseconds | None | Migration: yes |
| 6 | Server region to Mumbai | Every database call stops crossing the world | None | Yes |
| 7 | Cache share images per ledger version; rate-limit them and the auth forms; firewall rules for bots | Closes the cheap denial-of-service paths | Included in Vercel Pro | Firewall: yes |
| 8 | Error tracking, uptime alerts, spend alerts | Know within minutes, not from users | $0–$26/month | Yes |
| 9 | Second Supabase project as staging; repeat these tests there over HTTP | Real numbers for the real stack | $0–$25/month | Yes |

Not needed now: background queues (email goes to the provider; awards happen inside the transaction),
read replicas, or a different platform.

## 7. Cost estimates

Prices are from third-party summaries dated July–November 2026, not the providers' own pages, and the
sources disagree on some tiers. **Check supabase.com/pricing, vercel.com/pricing and resend.com/pricing
before budgeting.** Monthly active users means members who sign in, not visitors.

| | Fixed | Usage | Emergency headroom |
|---|---|---|---|
| Today | $0 | — | — |
| 10,000 monthly active users | ~$65 (Vercel Pro $20, Supabase Pro $25, email $20) | ~$0–$15 database instance | — |
| 100,000 monthly active users | ~$65 | ~$60–$110 database instance; email ~$35–$90 | — |
| 100,000 visitors in one day | ~$65 | Within included web usage (ESTIMATE: ~600,000 page views, ~150 GB); email for sign-ups ~$65–$90 | Larger database instance for the week: ~$50 pro-rated |
| 1 million monthly active users | ~$65 | Supabase users beyond 100,000: ~$2,900; instance ~$210–$410; web requests and transfer ~$500–$1,300; email ~$900 | — |

## 8. Order of work

P0 (blocks any public launch): items 1, 2, 3. P1 (blocks a viral launch): 4, 5, 6, 7.
P2 (before scaling spend): 8, 9, then repeat the load tests against staging and publish before/after.
Items 4–6 are the same work as the performance milestone in `docs/PERFORMANCE.md`.
