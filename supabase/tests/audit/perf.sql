\timing off
alter table public.members disable trigger members_registration_gate;
alter table public.rank_ledger disable trigger rank_ledger_effects;
alter table public.rank_ledger disable trigger rank_ledger_guard;
insert into public.seasons (id, starts_at, scheduled_end, ends_at, status) values (4, now() - interval '5 days', now() + interval '20 days', now() + interval '20 days', 'open');
insert into auth.users (id, email) select gen_random_uuid(), 'p' || g || '@test.invalid' from generate_series(1, 20000) g;
insert into public.members (id, username, display_name, city_id, locality_id)
  select u.id, 'perf.' || row_number() over (), 'Perf Member', l.city_id, l.id
  from (select id, row_number() over () as rn from auth.users where email like 'p%@test.invalid') u
  join (select id, city_id, row_number() over () as rn, count(*) over () as c from public.localities) l on l.rn = (u.rn % l.c) + 1;
insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
  select m.id, 4, 'credit', (2 + (random() * 40)::int) * 50000, 'perf-' || m.username || '-' || k, 'audit', now() - interval '4 days' + (random() * interval '3 days')
  from public.members m cross join generate_series(1, 3) k where m.username like 'perf.%';
alter table public.rank_ledger enable trigger rank_ledger_effects;
alter table public.rank_ledger enable trigger rank_ledger_guard;
analyze;
select count(*) as members from public.members; select count(*) as ledger_rows from public.rank_ledger where season_id = 4;
\timing on
\echo == read: city board top 100
select count(*) from public.get_board('city', 'mumbai', null, 100, null);
\echo == read: India board top 100
select count(*) from public.get_board('india', null, null, 100, null);
\echo == read: standings of one member
select count(*) from public.get_standings('perf.777');
\echo == read: city summaries
select count(*) from public.get_city_summaries();
\echo == read: hall of fame India
select count(*) from public.get_hall_of_fame('india', null, null, 100);
\echo == write: ONE rank credit (runs the ledger trigger while holding the season lock)
insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor) select id, 4, 'credit', 50000, 'perf-one', 'audit' from public.members where username = 'perf.777';
