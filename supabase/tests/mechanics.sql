-- Declarations and Backing against the real schema (local throwaway database), with test members.
\set ON_ERROR_STOP 1
update public.registration_gate set mode = 'open';
update public.engine_settings set settle_seconds = 0;
create temp table mm (k text primary key, u uuid);
do $$ declare r record; u uuid; begin
  for r in select * from (values ('king','surat','Vesu'),('ch','surat','Adajan'),('third','surat','Vesu'),('fan','surat','Pal'),('away','pune','Baner')) x(k, city, loc) loop
    insert into auth.users (email, email_confirmed_at) values ('mech-' || r.k || '@test.invalid', now()) returning id into u;
    perform set_config('request.jwt.claim.sub', u::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_member('mech.' || r.k, 'Mech ' || r.k, date '1990-01-01', r.city, r.loc, null, null, r.k = 'third');
    insert into mm values (r.k, u);
  end loop;
end $$;
select public.schedule_season(50, clock_timestamp(), clock_timestamp() + interval '1 day') \gset
select pg_sleep(0.05) \gset
select public.season_clock() \gset
create function pg_temp.as_member(k text) returns void language sql as $$ select set_config('request.jwt.claim.sub', (select u::text from mm where mm.k = as_member.k), false), set_config('request.jwt.claim.role', 'authenticated', false) $$;
create function pg_temp.pay(k text, paise bigint, ref text) returns text language sql as $$ select outcome from public.record_credit((select u from mm where mm.k = pay.k), paise, ref, clock_timestamp(), 'mech') $$;
do $$
declare d1 bigint; d2 bigint; r record; n int; anon text := (select anon_label from public.members where username = 'mech.third');
begin
  perform pg_temp.pay('king', 1000000, 'm1'); perform pg_temp.pay('ch', 400000, 'm2'); perform pg_temp.pay('third', 300000, 'm3');
  -- ---------- Declarations ----------
  perform pg_temp.as_member('king');
  begin perform public.declare_for('city', 0); assert false, 'holder cannot declare for own throne'; exception when check_violation then null; end;
  perform pg_temp.as_member('away');
  begin perform public.declare_for('city', 0); assert false, 'vacant throne (Pune)'; exception when check_violation then null; end;
  perform pg_temp.as_member('ch');
  begin perform public.declare_for('city', 9); assert false, 'free text / unknown line'; exception when invalid_parameter_value then null; end;
  begin perform public.declare_for(null, 0); assert false; exception when invalid_parameter_value then null; end;
  d1 := public.declare_for('city', 1);
  select * into r from public.get_declarations(null, null, d1);
  assert r.status = 'standing' and r.seq = 1 and r.h_name = 'mech.king' and r.c_name = 'mech.ch' and r.holder_score_paise = 1000000 and r.challenger_score_paise = 400000 and r.required_paise = 650000, 'snapshot figures';
  begin perform public.declare_for('city', 0); assert false, 'already standing'; exception when unique_violation then null; end;
  begin perform public.declare_for('india', 0); assert false, 'cooldown across boards'; exception when check_violation then null; end;
  -- Mystery-mode challenger appears by label only
  perform pg_temp.as_member('third'); d2 := public.declare_for('city', 2);
  select * into r from public.get_declarations(null, null, d2);
  assert r.c_masked and r.c_name = anon and r.c_display is null and r.seq = 2, 'masked challenger by label, numbered 2';
  assert (select count(*) from public.get_declarations('surat', null, null)) = 2 and (select count(*) from public.get_declarations('pune', null, null)) = 0;
  assert (select count(*) from public.get_declarations(null, 'mech.third', null)) = 0, 'a masked member is not findable by username';
  -- the holder blocks the masked challenger: declaration leaves public view; no new one allowed
  perform pg_temp.as_member('king'); perform public.block_challenger(anon);
  assert (select count(*) from public.get_declarations('surat', null, null)) = 1, 'withdrawn from public view';
  -- moves and outcome come from the ledger and the throne record
  perform pg_temp.pay('king', 100000, 'm4');
  perform pg_temp.pay('ch', 750000, 'm5');                                        -- 11,500 > 11,000: takes Surat
  select * into r from public.get_declarations(null, null, d1);
  assert r.status = 'won' and r.resolved_at is not null and jsonb_array_length(r.moves) = 2 and r.moves->0->>'who' = 'holder', 'made good by the board';
  -- moderation: service role only; number not reused
  perform public.remove_declaration(d1, 'test');
  assert (select count(*) from public.get_declarations(null, null, d1)) = 0;
  perform pg_temp.as_member('fan');
  begin perform public.declare_for('city', 0); exception when others then assert false, 'fan may declare: ' || sqlerrm; end;
  assert (select max(seq) from public.declarations where level = 'city') = 3, 'numbers 1 and 2 are never reused';
  -- the holder's block list and unblocking
  perform pg_temp.as_member('king');
  assert (select count(*) from public.get_my_blocks()) = 1 and (select public_name from public.get_my_blocks()) = anon, 'block list by public name';
  perform public.block_challenger(anon, false); assert (select count(*) from public.get_my_blocks()) = 0, 'unblocked';
  perform public.block_challenger(anon);
  -- ---------- Social handles ----------
  perform pg_temp.as_member('ch');
  begin perform public.set_my_socials('bad handle!', null, 'everyone'); assert false; exception when check_violation then null; end;
  begin perform public.set_my_socials('ok', null, 'the-world'); assert false; exception when invalid_parameter_value then null; end;
  perform public.set_my_socials('@ch.insta', 'ch_snap', 'followers');
  select * into r from public.get_socials('mech.ch'); assert r.instagram = 'ch.insta' and r.is_self and r.visibility = 'followers', 'owner sees own handles and setting';
  perform pg_temp.as_member('fan'); assert (select count(*) from public.get_socials('mech.ch')) = 0, 'followers-only: hidden from a non-follower';
  perform public.social_action('follow', 'mech.ch');
  select * into r from public.get_socials('mech.ch'); assert r.instagram = 'ch.insta' and r.snapchat = 'ch_snap' and r.visibility is null and not r.is_self, 'visible to a follower; setting not disclosed';
  perform pg_temp.as_member('ch'); perform public.set_my_socials('ch.insta', null, 'nobody');
  perform pg_temp.as_member('fan'); assert (select count(*) from public.get_socials('mech.ch')) = 0, 'nobody: hidden even from followers';
  perform pg_temp.as_member('third'); perform public.set_my_socials('secret.third', null, 'everyone');
  perform pg_temp.as_member('fan'); assert (select count(*) from public.get_socials(anon)) = 0 and (select count(*) from public.get_socials('mech.third')) = 0, 'Mystery mode never shows handles';
  -- ---------- Backing ----------
  begin perform public.back_member('mech.fan'); assert false, 'yourself'; exception when check_violation then null; end;
  begin perform public.back_member('mech.away'); assert false, 'not on the board'; exception when check_violation then null; end;
  begin perform public.back_member('mech.third'); assert false, 'masked member is not reachable by username'; exception when no_data_found then null; end;
  perform public.back_member('mech.ch');
  begin perform public.back_member('mech.king'); assert false, 'one per season, locked'; exception when unique_violation then null; end;
  perform pg_temp.as_member('away'); perform public.back_member('mech.king');
  perform pg_temp.as_member('third'); perform public.back_member('mech.ch');
  select * into r from public.get_backing('mech.ch'); assert r.backers = 2 and r.contender and r.pick_name is null;
  select * into r from public.get_backing('mech.fan'); assert r.backers = 0 and r.pick_name = 'mech.ch' and r.pick_rank = 1 and r.pick_gap_paise = 0, 'pick with current rank';
  assert (select string_agg(public_name || ':' || backers, ',') from public.get_most_backed('surat', 5)) = 'mech.ch:2,mech.king:1';
  -- backing never changes a score or rank
  assert (select string_agg(m.username::text, '>' order by b.rank) from public.ranked_board_at(50, 'city', 'surat', null, clock_timestamp()) b join public.members m on m.id = b.member_id) = 'mech.ch>mech.king>mech.third';
  -- close the season: backers of the final #01 are awarded; the others are not
  perform public.season_clock((select ends_at + interval '1 second' from public.seasons where id = 50));
  assert (select string_agg(m.username::text, ',' order by m.username::text) from public.member_achievements a join public.members m on m.id = a.member_id where a.achievement = 'backed-the-crown') = 'mech.fan,mech.third', 'Backed the Crown';
  select * into r from public.get_backing('mech.fan');
  assert r.pick_name is null and r.history->0->>'name' = 'mech.ch' and (r.history->0->>'final_rank')::int = 1, 'history survives the season';
  select * into r from public.get_declarations(null, 'mech.fan', null); assert r.status = 'lapsed', 'unfulfilled declaration lapses at the close';
  assert (select count(*) from public.ledger_invariants()) = 0, 'ledger still consistent';
  raise notice 'DECLARATIONS AND BACKING OK';
end $$;
-- permissions
set session authorization authenticator; set role anon;
do $$ begin
  perform * from public.get_declarations('surat', null, null); perform * from public.get_backing('mech.ch'); perform * from public.get_most_backed('surat', 5);
  begin perform public.declare_for('city', 0); assert false; exception when insufficient_privilege then null; end;
  begin perform public.back_member('mech.ch'); assert false; exception when insufficient_privilege then null; end;
  begin perform 1 from public.declarations; assert false; exception when insufficient_privilege then null; end;
  begin perform 1 from public.backings; assert false; exception when insufficient_privilege then null; end;
  begin perform 1 from public.member_socials; assert false; exception when insufficient_privilege then null; end;
  begin perform public.set_my_socials('x', null, 'everyone'); assert false; exception when insufficient_privilege then null; end;
  begin perform public.get_my_blocks(); assert false; exception when insufficient_privilege then null; end;
  assert (select count(*) from public.get_socials('mech.ch')) = 0;
  raise notice 'MECHANICS ANON PERMISSIONS OK';
end $$;
reset role; set role authenticated;
do $$ begin
  begin insert into public.backings (season_id, backer, target) select 50, u, u from mm limit 1; assert false; exception when insufficient_privilege then null; end;
  begin update public.declarations set line = 0; assert false; exception when insufficient_privilege then null; end;
  begin perform public.remove_declaration(1, 'x'); assert false; exception when insufficient_privilege then null; end;
  raise notice 'MECHANICS AUTHENTICATED PERMISSIONS OK';
end $$;
reset role; reset session authorization;
