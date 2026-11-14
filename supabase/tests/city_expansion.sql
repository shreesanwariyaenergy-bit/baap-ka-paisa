-- City expansion migration, tested on a throwaway local Postgres by scripts/db-test.sh. Test members only.
-- The database has every migration EXCEPT the city expansion when this file starts.
-- Part A builds rankings in the original cities, the migration runs, Part B proves nothing existing changed
-- and the new cities work at every board level. Never run against a live project.
\set ON_ERROR_STOP 1
set bkp.ledger_clock = 'caller';
update public.registration_gate set mode = 'open';
create temp table t (k text primary key, u uuid);
create temp table before_boards (level text, city text, rank int, name text, score bigint);
create temp table before_localities (id bigint, city_id text, name text);
create temp table before_cities as select * from public.cities;
create temp table before_states as select * from public.states;

-- ---------- Part A: rankings in the original cities ----------
do $$
declare t0 timestamptz := date_trunc('minute', now()); r record; x uuid;
begin
  for r in select * from (values ('ca', 'surat', 'Vesu'), ('cb', 'surat', 'Other'), ('cc', 'pune', 'Baner'), ('cd', 'delhi', 'Dwarka')) v(n, city, loc) loop
    insert into auth.users (email, email_confirmed_at) values (r.n || '@test.invalid', now()) returning id into x;
    perform set_config('request.jwt.claim.sub', x::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_member('t.' || r.n, 'T ' || r.n, date '1990-01-01', r.city, r.loc);
    insert into t values (r.n, x);
  end loop;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.schedule_season(1, t0 - interval '2 days', t0 + interval '20 days');
  update public.seasons set status = 'open' where id = 1;
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
    select u, 1, 'credit', amt, ref, 'test', at from (values
      ('ca', 300000, 'a1', t0 - interval '40 hours'), ('cb', 200000, 'b1', t0 - interval '39 hours'),
      ('cc', 250000, 'c1', t0 - interval '38 hours'), ('cd', 150000, 'd1', t0 - interval '37 hours')) v(k, amt, ref, at)
    join t using (k) order by at;
end $$;
insert into before_boards select 'city', 'surat', rank, public_name, season_score_paise from public.get_board('city', 'surat', null, 50, null);
insert into before_boards select 'state', 'surat', rank, public_name, season_score_paise from public.get_board('state', 'surat', null, 50, null);
insert into before_boards select 'india', null, rank, public_name, season_score_paise from public.get_board('india', null, null, 50, null);
insert into before_boards select 'locality', 'surat', rank, public_name, season_score_paise from public.get_board('locality', 'surat', 'Other', 50, null);
insert into before_localities select id, city_id, name from public.localities;

-- ---------- The migration ----------
\i supabase/pending/20261118001600_city_expansion.sql

-- ---------- Part B ----------
do $$
declare n int; x uuid; t0 timestamptz := date_trunc('minute', now());
begin
  -- 1. Nothing existing changed: reference rows, locality ids, boards
  assert (select count(*) from before_localities b join public.localities l using (id) where l.city_id = b.city_id and l.name = b.name) = 67, 'original locality ids unchanged';
  assert not exists (select * from before_cities except select * from public.cities), 'original city rows unchanged';
  assert not exists (select * from before_states except select * from public.states), 'original state rows unchanged (DL keeps "Delhi")';
  assert not exists (
    (select level, city, rank, name, score from before_boards)
    except all (
      select 'city', 'surat', rank, public_name, season_score_paise from public.get_board('city', 'surat', null, 50, null)
      union all select 'state', 'surat', rank, public_name, season_score_paise from public.get_board('state', 'surat', null, 50, null)
      union all select 'india', null, rank, public_name, season_score_paise from public.get_board('india', null, null, 50, null)
      union all select 'locality', 'surat', rank, public_name, season_score_paise from public.get_board('locality', 'surat', 'Other', 50, null))), 'existing boards identical after the migration';
  assert (select count(*) from public.members) = 4 and (select count(*) from public.rank_ledger) = 4, 'members and ledger untouched';
  raise notice 'city expansion: original cities, localities (ids), states and boards unchanged';

  -- 2. Totals and shape
  assert (select count(*) from public.states) = 19 and (select count(*) from public.cities) = 45, '19 states, 45 cities';
  assert (select count(distinct region) from public.cities) = 6, 'six regions';
  assert not exists (select 1 from public.cities c where (select name from public.localities l where l.city_id = c.id order by id desc limit 1) <> 'Other'), 'every city ends with Other';
  assert (select count(*) from public.get_city_summaries()) = 45, 'city summaries cover all 45 cities';
  raise notice 'city expansion: 19 states, 45 cities, 6 regions, Other in every city, summaries for 45 cities';

  -- 3. New cities work at every level
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  for n in 1..3 loop
    insert into auth.users (email, email_confirmed_at) values ('new' || n || '@test.invalid', now()) returning id into x;
    perform set_config('request.jwt.claim.sub', x::text, true);
    perform public.create_member('t.new' || n, 'New ' || n, date '1990-01-01',
      (array['jaipur', 'jaipur', 'noida'])[n], (array['Walled City', 'Other', 'Sectors 1–39'])[n]);
    insert into t values ('new' || n, x);
  end loop;
  -- a locality from another city is refused
  insert into auth.users (email, email_confirmed_at) values ('bad@test.invalid', now()) returning id into x;
  perform set_config('request.jwt.claim.sub', x::text, true);
  begin perform public.create_member('t.bad', 'Bad', date '1990-01-01', 'jaipur', 'Vesu'); assert false, 'wrong-city locality must be refused';
  exception when others then if sqlerrm like '%wrong-city%' then raise; end if; end;
  begin perform public.create_member('t.bad', 'Bad', date '1990-01-01', 'newdelhi', 'Other'); assert false, 'unknown city must be refused';
  exception when others then if sqlerrm like '%unknown city%' then raise; end if; end;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
    select u, 1, 'credit', amt, ref, 'test', at from (values
      ('new1', 400000, 'n1', t0 - interval '30 hours'), ('new2', 100000, 'n2', t0 - interval '29 hours'), ('new3', 500000, 'n3', t0 - interval '28 hours')) v(k, amt, ref, at)
    join t using (k) order by at;
  assert (select public_name from public.get_board('locality', 'jaipur', 'Walled City', 5, null) where rank = 1) = 't.new1', 'locality board in a new city';
  assert (select public_name from public.get_board('locality', 'jaipur', 'Other', 5, null) where rank = 1) = 't.new2', 'Other board in a new city';
  assert (select count(*) from public.get_board('city', 'jaipur', null, 50, null)) = 2, 'city board in a new city';
  assert (select count(*) from public.get_board('state', 'jaipur', null, 50, null)) = 2, 'new state board (RJ) has only Rajasthan members';
  assert (select count(*) from public.get_board('state', 'noida', null, 50, null)) = 1, 'Noida ranks in Uttar Pradesh, not Delhi';
  assert (select count(*) from public.get_board('state', 'delhi', null, 50, null)) = 1, 'Delhi state board unchanged by Noida';
  assert (select public_name from public.get_board('india', null, null, 50, null) where rank = 1) = 't.new3', 'India board includes new cities';
  assert (select count(*) from public.get_board('india', null, null, 50, null)) = 7, 'India board has all 7 ranked members';
  assert (select count(*) from public.get_board('city', 'bengaluru', null, 50, null)) = 0, 'an empty new city board is simply empty';
  assert not exists (select 1 from public.score_invariants()), 'running totals match the ledger';
  raise notice 'city expansion: new cities rank on locality, Other, city, state and India boards; wrong localities refused';
end $$;

-- 4. A second run is refused by the pre-checks and changes nothing (the refusal is caught here, so the suite
--    prints no ERROR line for this expected failure)
\set mig `cat supabase/pending/20261118001600_city_expansion.sql`
select set_config('bkp.city_migration', :'mig', false) is not null as loaded \gset
do $$
declare refused boolean := false;
begin
  begin execute current_setting('bkp.city_migration');
  exception when others then refused := sqlerrm like 'city expansion: expected 3 states%'; end;
  assert refused, 'a second run must be refused by the pre-checks';
  assert (select count(*) from public.cities) = 45 and (select count(*) from public.states) = 19 and (select count(*) from public.localities) = 335, 'second run changed nothing';
  raise notice 'city expansion: second run refused, nothing duplicated';
end $$;
