-- Anti-snipe rule: extend the season only when a credit takes #01 on one of the member's boards.
-- Depends on 20261116001200_season_scores.sql (replaces its ledger_effects()). Same results otherwise:
-- reigns, Crown Moments, Revenge Taken, Founding 500 and Pioneer are unchanged.
--
-- Why: under the earlier rule any overtake at any rank, on any board in India, extended the whole national
-- season. With thousands of members that makes every season run to the 2-hour cap (docs/PLATFORM_REVIEW.md, T4).
--
-- Rollback: re-run the ledger_effects() definition from 20261116001200_season_scores.sql.

create or replace function public.ledger_effects() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_city text; v_loc text; v_new bigint; v_old bigint; v_old_reached timestamptz; lvl text; v_key text; v_top uuid;
  v_open public.throne_reigns; s public.seasons; v_n int; v_latest boolean; v_took_throne boolean := false;
begin
  -- True for every row stamped by the database clock: it is the newest row of its season, so "the board as of
  -- this row" is simply the board now. False only for an owner import with caller-supplied times.
  v_latest := not exists (select 1 from public.rank_ledger x where x.season_id = new.season_id and x.created_at > new.created_at);
  select m.city_id, l.name into v_city, v_loc from public.members m join public.localities l on l.id = m.locality_id where m.id = new.member_id;
  select * into s from public.seasons where id = new.season_id for update;
  select coalesce(sum(r.rank_credit_paise), 0) into v_new from public.rank_ledger r
    where r.member_id = new.member_id and r.season_id = new.season_id and (r.created_at, r.id) <= (new.created_at, new.id);
  v_old := v_new - new.rank_credit_paise;
  select max(r.created_at) into v_old_reached from public.rank_ledger r
    where r.member_id = new.member_id and r.season_id = new.season_id and (r.created_at, r.id) < (new.created_at, new.id);

  -- #01 changes on each of the member's four boards.
  foreach lvl in array array['locality', 'city', 'state', 'india'] loop
    v_key := public.board_scope_key(lvl, v_city, v_loc);
    v_top := null;
    if v_latest then v_top := public.board_top(new.season_id, lvl, v_city, v_loc);   -- index lookup
    else select b.member_id into v_top from public.ranked_board_at(new.season_id, lvl, v_city, v_loc, new.created_at) b where b.rank = 1; end if;
    v_open := null;
    select * into v_open from public.throne_reigns t where t.season_id = new.season_id and t.level = lvl and t.scope_key = v_key and t.ended_at is null;
    if v_top is not null and (v_open.id is null or v_open.member_id <> v_top) then
      if v_open.id is not null then
        update public.throne_reigns set ended_at = new.created_at, end_reason = 'overtaken' where id = v_open.id;
        perform public.check_untouchable(v_open.id, new.created_at);
      end if;
      insert into public.crown_events (season_id, level, scope_key, from_member, to_member, at) values (new.season_id, lvl, v_key, v_open.member_id, v_top, new.created_at);
      if exists (select 1 from public.throne_reigns t where t.member_id = v_top and t.level = lvl and t.scope_key = v_key and t.end_reason = 'overtaken' and t.ended_at >= new.created_at - interval '24 hours') then
        perform public.award(v_top, 'revenge-taken', new.season_id, lvl, v_key, 'Revenge Taken', 'Took back #01 within 24 hours', new.created_at);
      end if;
      insert into public.throne_reigns (season_id, level, scope_key, member_id, started_at) values (new.season_id, lvl, v_key, v_top, new.created_at);
      if v_top = new.member_id then v_took_throne := true; end if;
    end if;
  end loop;

  -- Anti-snipe: a credit that takes #01 on any of the member's four boards in the last
  -- 15 minutes extends the season by 15 minutes, 2 hours at most. Overtakes below #01 do not move the close.
  if new.kind = 'credit' and v_took_throne and new.created_at >= s.ends_at - interval '15 minutes'
     and least(s.ends_at + interval '15 minutes', s.scheduled_end + interval '2 hours') > s.ends_at then
    update public.seasons set ends_at = least(s.ends_at + interval '15 minutes', s.scheduled_end + interval '2 hours') where id = s.id;
    insert into public.season_extensions (season_id, at, new_end, ledger_id)
      values (s.id, new.created_at, least(s.ends_at + interval '15 minutes', s.scheduled_end + interval '2 hours'), new.id);
  end if;

  -- Founding 500 and Pioneer on a member's first ever credit, in time order.
  if new.kind = 'credit' and not exists (select 1 from public.rank_ledger r where r.member_id = new.member_id and r.kind = 'credit' and (r.created_at, r.id) < (new.created_at, new.id)) then
   -- Once a city has its 500 founders and the locality has its pioneer, there is nothing left to work out.
   if (select count(*) from public.member_achievements a where a.achievement = 'founding-500' and a.scope_key = v_city) < 500
      or not exists (select 1 from public.member_achievements a where a.achievement = 'pioneer' and a.scope_key = v_city || '/' || v_loc) then
    select count(*) into v_n from (
      select r.member_id, min(r.created_at) as first_at from public.rank_ledger r join public.members m on m.id = r.member_id
      where m.city_id = v_city and r.kind = 'credit' group by r.member_id
    ) f where f.first_at <= new.created_at;
    if v_n <= 500 then perform public.award(new.member_id, 'founding-500', null, 'city', v_city, 'Founding 500', 'Founding member no. ' || v_n || ' of 500 in ' || v_city, new.created_at); end if;
    if not exists (select 1 from public.rank_ledger r join public.members m on m.id = r.member_id join public.localities l on l.id = m.locality_id
                   where m.city_id = v_city and l.name = v_loc and r.member_id <> new.member_id and r.kind = 'credit' and (r.created_at, r.id) < (new.created_at, new.id)) then
      perform public.award(new.member_id, 'pioneer', null, 'locality', v_city || '/' || v_loc, 'Pioneer of ' || v_loc, 'First member ever to rank in ' || v_loc, new.created_at);
    end if;
   end if;
  end if;
  return null;
end $$;
