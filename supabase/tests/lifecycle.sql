-- Full season lifecycle and social actions, with test members only. Run by scripts/db-test.sh
-- against a throwaway local Postgres. Never run against the live project.
\set ON_ERROR_STOP 1
-- This suite replays a season on a simulated clock, so it uses the owner-only import override.
set bkp.ledger_clock = 'caller';
update public.engine_settings set settle_seconds = 0;   -- the simulated clock closes seasons at their end; the settling window is tested in scripts/db-audit.sh
create temp table t (k text primary key, u uuid);
do $$
declare
  t0 timestamptz := date_trunc('minute', now());
  s1_start timestamptz := t0 - interval '10 days';
  s1_end timestamptz := t0 + interval '10 minutes';
  a uuid; b uuid; c uuid; v_tmp uuid; v int; r record; ok boolean;
  procedure_note text;
begin
  -- ---- registration gate (pending migration): closed, then allow-list, then open ----
  insert into auth.users (email, email_confirmed_at) values ('gate@test.invalid', now()) returning id into a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin perform public.create_member('t.gate', 'Gate Test', date '1990-01-01', 'surat', 'Vesu'); assert false, 'closed gate must refuse'; exception when insufficient_privilege then null; end;
  update public.registration_gate set mode = 'allowlist';
  begin perform public.create_member('t.gate', 'Gate Test', date '1990-01-01', 'surat', 'Vesu'); assert false, 'not on the list must be refused'; exception when insufficient_privilege then null; end;
  begin insert into public.registration_allowlist (email) values ('GATE@test.invalid'); assert false; exception when check_violation then null; end;
  update auth.users set email = 'Gate@Test.invalid' where id = a;
  insert into public.registration_allowlist (email) values ('gate@test.invalid');
  perform public.create_member('t.gate', 'Gate Test', date '1990-01-01', 'surat', 'Vesu');
  -- identity: an allow-listed, signed-in account cannot create a profile under another account's id,
  -- even on a path that skips row security (this block runs as the table owner with a member session)
  insert into auth.users (email, email_confirmed_at) values ('victim@test.invalid', now()) returning id into v_tmp;
  begin insert into public.members (id, username, display_name, city_id, locality_id) select v_tmp, 't.stolen', 'Stolen', 'surat', l.id from public.localities l where l.city_id = 'surat' limit 1;
    assert false, 'profile for another account must be refused'; exception when insufficient_privilege then null; end;
  begin perform public.create_member('t.gate2', 'Second', date '1990-01-01', 'surat', 'Vesu'); assert false, 'one profile per account'; exception when unique_violation then null; end;
  -- an anonymous API request can never insert
  perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claim.role', 'anon', true);
  begin insert into public.members (id, username, display_name, city_id, locality_id) select v_tmp, 't.anon', 'Anon', 'surat', l.id from public.localities l where l.city_id = 'surat' limit 1;
    assert false, 'anonymous insert must be refused'; exception when insufficient_privilege then null; end;
  -- administrative insert (service role / owner connection, no member session) is allowed and bypasses the gate by design
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.registration_gate set mode = 'closed';
  insert into public.members (id, username, display_name, city_id, locality_id) select v_tmp, 't.admin', 'Admin Made', 'surat', l.id from public.localities l where l.city_id = 'surat' limit 1;
  delete from public.members where id = v_tmp;
  update public.registration_gate set mode = 'allowlist';
  perform set_config('request.jwt.claim.sub', a::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
  update auth.users set email_confirmed_at = null where id = a;
  assert not public.registration_allowed(), 'an unconfirmed email is never allowed';
  delete from public.member_private where member_id = a; delete from public.members where id = a;
  update public.registration_gate set mode = 'open';
  -- ---- test members (three in Surat) ----
  for r in select * from (values ('aarav','Vesu',false),('bhavna','Adajan',false),('chirag','Vesu',true)) x(n, loc, masked) loop
    insert into auth.users (email) values (r.n || '@test.invalid') returning id into a;
    perform set_config('request.jwt.claim.sub', a::text, true);
    perform public.create_member('t.' || r.n, initcap(r.n) || ' Test', date '1990-01-01', 'surat', r.loc, 'Founder', null, r.masked);
    insert into t values (r.n, a);
  end loop;
  select u into a from t where k = 'aarav'; select u into b from t where k = 'bhavna'; select u into c from t where k = 'chirag';
  assert (select count(distinct member_no) from public.members) = 3, 'member numbers are unique';

  -- ---- configurable dates: schedule, re-date, open ----
  perform public.schedule_season(1, s1_start - interval '1 day', s1_end);
  perform public.schedule_season(1, s1_start, s1_end);                       -- re-date while upcoming
  assert (select status from public.seasons where id = 1) = 'upcoming';
  begin insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values (a, 1, 'credit', 100000, 'T-early', 'test', t0 - interval '9 days');
    assert false, 'credit before open must fail'; exception when check_violation then null; end;
  perform public.season_clock(t0 - interval '9 days 1 hour');
  assert (select status from public.seasons where id = 1) = 'open', 'season 1 opens on the clock';
  begin perform public.schedule_season(1, s1_start, s1_end + interval '1 day'); assert false, 're-dating an open season must fail'; exception when check_violation then null; end;

  -- ---- entries and overtakes ----
  begin insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values (a, 1, 'credit', 50000, 'T-low', 'test', t0 - interval '9 days');
    assert false, 'entry below Rs 1,000 must fail'; exception when check_violation then null; end;
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values
    (a, 1, 'credit', 100000, 'T-1', 'test', t0 - interval '9 days'),
    (b, 1, 'credit', 100000, 'T-2', 'test', t0 - interval '8 days');
  assert (select member_id from public.ranked_board_at(1, 'city', 'surat', null, t0) where rank = 1) = a, 'earlier entry wins a tie';
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values (b, 1, 'credit', 50000, 'T-3', 'test', t0 - interval '7 days');
  assert (select member_id from public.ranked_board_at(1, 'city', 'surat', null, t0) where rank = 1) = b, 'Rs 500 step overtakes';
  assert (select count(*) from public.crown_events where season_id = 1 and level = 'city') = 2, 'two crown events on the city board';
  assert (select count(*) from public.throne_reigns where season_id = 1 and level = 'city') = 2, 'two reigns';
  begin update public.rank_ledger set rank_credit_paise = 1 where payment_ref = 'T-1'; assert false, 'ledger is append-only'; exception when insufficient_privilege then null; end;

  -- ---- anti-snipe: overtake 5 minutes before the end extends by 15 minutes ----
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values (c, 1, 'credit', 200000, 'T-4', 'test', s1_end - interval '5 minutes');
  assert (select ends_at from public.seasons where id = 1) = s1_end + interval '15 minutes', 'anti-snipe extends by 15 minutes';
  assert (select scheduled_end from public.seasons where id = 1) = s1_end;

  -- ---- social actions (pending migration), as signed-in members ----
  perform set_config('request.jwt.claim.sub', a::text, true);
  select * into r from public.social_action('follow', 't.bhavna'); assert r.following and not r.rival and not r.respected_today;
  perform public.social_action('follow', 't.bhavna');                         -- idempotent
  assert (select count(*) from public.follows where follower = a) = 1;
  select * into r from public.social_action('respect', 't.bhavna'); assert r.respected_today;
  begin perform public.social_action('respect', 't.bhavna'); assert false, 'second Respect the same day must fail'; exception when unique_violation then null; end;
  begin perform public.social_action('follow', 't.aarav'); assert false, 'cannot follow yourself'; exception when check_violation then null; end;
  begin perform public.social_action('follow', 't.chirag'); assert false, 'a masked member is not reachable by username'; exception when no_data_found then null; end;
  select * into r from public.social_action('rival', (select anon_label from public.members where id = c)); assert r.rival, 'masked member reachable by ANON label';
  select * into r from public.social_action('unrival', (select anon_label from public.members where id = c)); assert not r.rival;
  select * into r from public.social_action('unfollow', 't.bhavna'); assert not r.following and r.respected_today;
  -- unknown and Mystery-mode-by-username give the identical error: no way to probe who is masked
  declare m1 text; m2 text; begin
    begin perform public.social_action('follow', 't.chirag'); exception when others then m1 := sqlstate || sqlerrm; end;
    begin perform public.social_action('follow', 't.nobody'); exception when others then m2 := sqlstate || sqlerrm; end;
    assert m1 = m2, 'masked and unknown are indistinguishable';
  end;
  begin perform public.social_action('delete-everything', 't.bhavna'); assert false; exception when invalid_parameter_value then null; end;
  -- rival limit: five allowed, the sixth refused
  for i in 1..6 loop
    insert into auth.users (email) values ('r' || i || '@test.invalid') returning id into v_tmp;
    perform set_config('request.jwt.claim.sub', v_tmp::text, true);
    perform public.create_member('t.r' || i, 'Rival ' || i, date '1990-01-01', 'pune', 'Baner');
  end loop;
  perform set_config('request.jwt.claim.sub', a::text, true);
  for i in 1..5 loop perform public.social_action('rival', 't.r' || i); end loop;
  begin perform public.social_action('rival', 't.r6'); assert false, 'sixth rival must fail'; exception when check_violation then null; end;
  for i in 1..5 loop perform public.social_action('unrival', 't.r' || i); end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.social_action('follow', 't.bhavna'); assert false, 'signed-out callers are refused'; exception when invalid_authorization_specification then null; end;
  assert (select respect_this_season from public.get_social('t.bhavna')) = 1, 'Respect counts on the public profile';
  assert (select count(*) from public.get_respect_board('city', 'surat', null, 10)) = 1, 'Respect board lists the receiver';

  -- ---- close, freeze, achievements ----
  perform public.season_clock(s1_end + interval '1 minute');
  assert (select status from public.seasons where id = 1) = 'open', 'still open during the extension';
  perform public.season_clock(s1_end + interval '16 minutes');
  assert (select status from public.seasons where id = 1) = 'closed', 'closes after the extension';
  assert (select member_id from public.season_results where season_id = 1 and level = 'city' and final_rank = 1) = c, 'final #01 frozen';
  assert (select count(*) from public.season_results where season_id = 1 and level = 'india') = 3, 'only ranked members are frozen';
  assert exists (select 1 from public.member_achievements where member_id = c and achievement = 'season-crown' and season_id = 1 and level = 'city'), 'Season Crown awarded';
  assert not exists (select 1 from public.throne_reigns where season_id = 1 and ended_at is null), 'reigns closed';
  begin insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values (a, 1, 'credit', 50000, 'T-late', 'test', s1_end + interval '20 minutes');
    assert false, 'credit after close must fail'; exception when check_violation then null; end;
  assert (select count(*) from public.seasons) = 1, 'no rollover while it is switched off';

  -- ---- monthly rollover ----
  update public.engine_settings set auto_rollover = true;
  perform public.season_clock(s1_end + interval '17 minutes');
  select * into r from public.seasons where id = 2;
  assert r.id = 2, 'season 2 scheduled';
  assert extract(day from r.starts_at at time zone 'Asia/Kolkata') = 1 and (r.starts_at at time zone 'Asia/Kolkata')::time = time '00:00', 'starts on the 1st, 00:00 IST';
  assert (r.scheduled_end at time zone 'Asia/Kolkata')::time = time '23:59' and extract(day from (r.scheduled_end + interval '1 minute') at time zone 'Asia/Kolkata') = 1, 'ends on the last day, 23:59 IST';
  perform public.season_clock(r.starts_at + interval '1 minute');
  assert (select status from public.seasons where id = 2) = 'open', 'season 2 opens';
  assert (select count(*) from public.ranked_board_at(2, 'india', null, null, r.starts_at + interval '1 minute')) = 0, 'season board resets';
  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at) values (a, 2, 'credit', 100000, 'T-5', 'test', r.starts_at + interval '2 minutes');

  -- ---- lifetime records survive the reset ----
  assert (select sum(rank_credit_paise) from public.rank_ledger where member_id = a) = 200000, 'lifetime adds both seasons';
  assert (select count(*) from public.get_hall_of_fame('india', null, null, 10)) = 3, 'Hall of Fame keeps every member';
  assert (select count(*) from public.season_results where season_id = 1) > 0, 'season 1 results stay frozen';
  assert (select count(distinct member_no) from public.members) = (select count(*) from public.members) and (select min(member_no) from public.members) >= 101, 'member numbers unchanged';
  perform public.season_clock(r.scheduled_end + interval '1 minute');
  assert (select status from public.seasons where id = 2) = 'closed';
  assert exists (select 1 from public.member_achievements where member_id = a and achievement = 'season-crown' and season_id = 2);
  raise notice 'LIFECYCLE OK';
end $$;

-- ---- permissions: what the browser roles can and cannot do ----
set role anon;
do $$ begin
  begin perform public.social_action('follow', 't.bhavna'); assert false; exception when insufficient_privilege then null; end;
  begin perform public.season_clock(); assert false; exception when insufficient_privilege then null; end;
  begin perform public.schedule_season(9, now(), now() + interval '1 day'); assert false; exception when insufficient_privilege then null; end;
  begin perform 1 from public.engine_settings; assert false; exception when insufficient_privilege then null; end;
  begin insert into public.follows (follower, followee) select id, id from public.members; assert false; exception when insufficient_privilege then null; end;
  begin perform 1 from public.respects; assert false; exception when insufficient_privilege then null; end;
  begin perform public.registration_allowed(); assert false; exception when insufficient_privilege then null; end;
  -- legitimate public reads still work for signed-out visitors
  perform * from public.get_social('t.bhavna'); perform * from public.get_respect_board('city', 'surat', null, 10);
  perform * from public.get_board('city', 'surat', null, 10, null); perform * from public.get_member('t.bhavna');
  perform * from public.get_throne_history('city', 'surat', null, null, 10); perform * from public.get_season();
  raise notice 'ANON PERMISSIONS OK';
end $$;
reset role;
select 'EXECUTE social_action  PUBLIC=' || has_function_privilege('public', 'public.social_action(text,text)', 'execute')
  || '  anon=' || has_function_privilege('anon', 'public.social_action(text,text)', 'execute')
  || '  authenticated=' || has_function_privilege('authenticated', 'public.social_action(text,text)', 'execute') as privileges \gset
\echo :privileges
grant select on t to authenticated;
set role authenticated;
do $$
declare me uuid := (select u from t where k = 'aarav'); other uuid := (select u from t where k = 'bhavna'); r record;
begin
  perform set_config('request.jwt.claim.sub', me::text, true);
  -- the function works under the browser role, even though that role can no longer write the tables
  select * into r from public.social_action('follow', 't.bhavna'); assert r.following;
  -- direct table writes, as yourself and as someone else
  begin insert into public.follows (follower, followee) values (me, other); assert false; exception when insufficient_privilege then null; end;
  begin insert into public.follows (follower, followee) values (other, me); assert false, 'acting as someone else'; exception when insufficient_privilege then null; end;
  begin insert into public.respects (giver, receiver, day, created_at) values (me, other, current_date - 3, now() - interval '3 days'); assert false, 'back-dated Respect'; exception when insufficient_privilege then null; end;
  begin insert into public.rivals (member_id, rival_id) values (me, other); assert false; exception when insufficient_privilege then null; end;
  begin delete from public.follows where follower = other; assert false; exception when insufficient_privilege then null; end;
  begin update public.respects set giver = me; assert false; exception when insufficient_privilege then null; end;
  -- other members' rows stay invisible; your own are readable
  assert (select count(*) from public.follows) = 1 and (select count(*) from public.follows where follower <> me) = 0, 'only your own follows are visible';
  assert (select count(*) from public.members) = 1, 'only your own member row is visible';
  begin insert into public.members (id, username, city_id, locality_id) values (gen_random_uuid(), 't.fake', 'surat', 1); assert false; exception when others then null; end;
  begin perform 1 from public.registration_allowlist; assert false; exception when insufficient_privilege then null; end;
  begin update public.registration_gate set mode = 'open'; assert false; exception when insufficient_privilege then null; end;
  begin insert into public.registration_allowlist (email) values ('me@test.invalid'); assert false, 'adding yourself to the allow-list'; exception when insufficient_privilege then null; end;
  begin delete from public.registration_allowlist; assert false; exception when insufficient_privilege then null; end;
  perform public.social_action('unfollow', 't.bhavna');
  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'DIRECT ACCESS ATTEMPTS REFUSED OK';
end $$;
do $$ begin
  begin perform public.season_clock(); assert false; exception when insufficient_privilege then null; end;
  begin perform public.schedule_next_month(); assert false; exception when insufficient_privilege then null; end;
  begin update public.engine_settings set auto_rollover = true; assert false; exception when insufficient_privilege then null; end;
  begin perform public.social_action('follow', 't.bhavna'); assert false; exception when invalid_authorization_specification then null; end; -- allowed to call, refused without a session
  raise notice 'AUTHENTICATED PERMISSIONS OK';
end $$;
reset role;

-- ---- unrelated objects untouched by the social migration: grants on every other table are as before ----
do $$ declare bad text; begin
  select string_agg(c.relname, ', ') into bad from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('follows', 'respects', 'rivals', 'engine_settings', 'registration_gate', 'registration_allowlist', 'rank_ledger', 'late_payments', 'declarations', 'declaration_blocks', 'backings')
     and not has_table_privilege('authenticated', c.oid, 'insert');
  assert bad is null, 'grants changed on: ' || bad;
  raise notice 'OTHER TABLE GRANTS UNCHANGED OK';
end $$;

-- ---- rollback of the social migration restores the previous permissions and removes the function; rows stay ----
do $$ declare n_before int := (select count(*) from public.respects); begin
  drop function public.social_action(text, text);
  grant insert, update, delete, truncate, references, trigger on public.follows, public.respects, public.rivals to anon, authenticated;
  grant select on public.follows, public.respects, public.rivals to anon;
  assert has_table_privilege('authenticated', 'public.follows', 'insert') and has_table_privilege('anon', 'public.respects', 'select');
  assert to_regprocedure('public.social_action(text,text)') is null;
  assert (select count(*) from public.respects) = n_before and n_before > 0, 'rows are preserved';
  assert (select count(*) from pg_policies where schemaname = 'public' and tablename in ('follows', 'respects', 'rivals')) = 8, 'the eight policies are untouched';
  raise notice 'SOCIAL ROLLBACK OK';
end $$;
