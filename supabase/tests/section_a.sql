-- Anti-snipe on #01 only, season-clock heartbeat, integrity checks and health probe. Test members only.
-- Run by scripts/db-test.sh against a throwaway local Postgres. Never run against a live project.
\set ON_ERROR_STOP 1
set bkp.ledger_clock = 'caller';
update public.registration_gate set mode = 'open';
create temp table t (k text primary key, u uuid);
do $$
declare t0 timestamptz := date_trunc('minute', now()); v_end timestamptz := t0 + interval '1 day'; r record; x uuid; n int; h jsonb;
begin
  for r in select * from (values ('sa','surat','Vesu'),('sb','surat','Vesu'),('sc','surat','Adajan'),('sd','mumbai','Worli')) v(n, city, loc) loop
    insert into auth.users (email, email_confirmed_at) values (r.n || '@test.invalid', now()) returning id into x;
    perform set_config('request.jwt.claim.sub', x::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_member('t.' || r.n, 'T ' || r.n, date '1990-01-01', r.city, r.loc);
    insert into t values (r.n, x);
  end loop;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.schedule_season(1, t0 - interval '2 days', v_end);
  update public.seasons set status = 'open' where id = 1;
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
    select u, 1, 'credit', amt, ref, 'test', at from (values
      ('sa', 500000, 'a1', t0 - interval '40 hours'), ('sb', 200000, 'b1', t0 - interval '39 hours'), ('sd', 300000, 'd1', t0 - interval '38 hours')) v(k, amt, ref, at)
    join t using (k) order by at;

  -- Operations (the ledger so far is consistent and in the past, so the only problem is the clock).
  -- The clock has never run while a season is open, so the check raises one alert.
  n := public.run_checks();
  assert n = 1 and exists (select 1 from public.ops_alerts where kind = 'clock-stopped' and resolved_at is null), 'clock-stopped raised';
  n := public.run_checks();
  assert (select count(*) from public.ops_alerts) = 1, 'an open problem is raised once, not every run';
  h := public.get_health();
  assert (h->>'healthy')::boolean = false and h->>'database' = 'ok' and (h->'season'->>'id')::int = 1, 'health reports unhealthy';
  perform public.season_clock();
  n := public.run_checks();
  assert n = 0 and (select resolved_at is not null from public.ops_alerts where kind = 'clock-stopped'), 'resolved once the clock runs';
  assert (public.get_health()->>'healthy')::boolean, 'healthy again';
  raise notice 'operations: clock-stopped raised once and resolved; health probe reflects alerts';

  -- sb passes sd on the India board in the last 15 minutes but takes #01 nowhere: no extension.
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
    select u, 1, 'credit', 150000, 'b2', 'test', v_end - interval '5 minutes' from t where k = 'sb';
  assert (select rank from public.ranked_board_at(1, 'india', null, null, v_end) b join t on t.u = b.member_id where t.k = 'sb') = 2, 'sb overtook sd on India';
  assert (select ends_at from public.seasons where id = 1) = v_end, 'an overtake below #01 must not extend';
  assert not exists (select 1 from public.season_extensions), 'no extension row';

  -- sc's first credit takes the vacant Adajan throne in the last 15 minutes: extended by 15 minutes.
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
    select u, 1, 'credit', 100000, 'c1', 'test', v_end - interval '4 minutes' from t where k = 'sc';
  assert (select ends_at from public.seasons where id = 1) = v_end + interval '15 minutes', 'taking a #01 must extend';
  assert (select count(*) from public.season_extensions) = 1, 'one extension row';

  -- sb takes Vesu, Surat, Gujarat and India in the new last 15 minutes: one more extension (not four).
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at)
    select u, 1, 'credit', 200000, 'b3', 'test', v_end + interval '5 minutes' from t where k = 'sb';
  assert (select ends_at from public.seasons where id = 1) = v_end + interval '30 minutes', 'second throne take extends once';
  assert (select count(*) from public.season_extensions) = 2, 'two extension rows';
  assert not exists (select 1 from public.score_invariants()), 'running totals match the ledger';
  raise notice 'anti-snipe on #01 only: below-#01 overtake no extension; vacant locality throne +15; four thrones at once +15 once';

  -- A season left open after its close is reported as a missed close.
  n := public.run_checks(v_end + interval '2 hours');
  assert exists (select 1 from public.ops_alerts where kind = 'missed-close' and resolved_at is null), 'missed close raised';
  raise notice 'operations: a season left open after its close is raised as a missed close';
end $$;
\echo '--- operations permissions, role by role'
select r as role,
       has_function_privilege(r, 'public.get_health()', 'execute') as get_health,
       has_function_privilege(r, 'public.run_checks(timestamptz)', 'execute') as run_checks,
       has_table_privilege(r, 'public.ops_alerts', 'select') as read_alerts
  from unnest(array['anon', 'authenticated']) r;
