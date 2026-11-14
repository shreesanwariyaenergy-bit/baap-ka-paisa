-- PENDING REVIEW. Not applied to any database.
-- Season scores: a maintained running total per member per season, so "who is #01" and "what is this board"
-- are index reads instead of re-adding the whole ledger. The ledger stays the single source of truth:
-- this table is derived from it inside the same transaction, and score_invariants() proves they agree.
-- No ranking rule changes. Requires the ledger integrity migration (database-stamped, increasing times).
--
-- New: table season_scores (+4 indexes), trigger rank_ledger_a_scores, functions board_top(), score_invariants().
-- Changed: bodies of ledger_effects() and ranked_board_at() (same names, same results).

create table public.season_scores (
  season_id int not null references public.seasons (id),
  member_id uuid not null references public.members (id),
  city_id text not null, state_code text not null, locality_id bigint not null,
  score_paise bigint not null,
  reached_at timestamptz not null,                 -- ledger time of the member's latest row: the tie-breaker
  primary key (season_id, member_id)
);
create index season_scores_india_idx on public.season_scores (season_id, score_paise desc, reached_at, member_id);
create index season_scores_state_idx on public.season_scores (season_id, state_code, score_paise desc, reached_at, member_id);
create index season_scores_city_idx on public.season_scores (season_id, city_id, score_paise desc, reached_at, member_id);
create index season_scores_locality_idx on public.season_scores (season_id, locality_id, score_paise desc, reached_at, member_id);
alter table public.season_scores enable row level security;      -- no policies: read only through functions
revoke all on public.season_scores from public, anon, authenticated;

insert into public.season_scores (season_id, member_id, city_id, state_code, locality_id, score_paise, reached_at)
  select x.season_id, x.member_id, m.city_id, c.state_code, m.locality_id, sum(x.rank_credit_paise), max(x.created_at)
  from public.rank_ledger x join public.members m on m.id = x.member_id join public.cities c on c.id = m.city_id group by 1, 2, 3, 4, 5;

-- Runs before ledger_effects (triggers fire in name order), in the same transaction as the ledger row.
create function public.ledger_scores() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.season_scores (season_id, member_id, city_id, state_code, locality_id, score_paise, reached_at)
    select new.season_id, new.member_id, m.city_id, c.state_code, m.locality_id, new.rank_credit_paise, new.created_at
    from public.members m join public.cities c on c.id = m.city_id where m.id = new.member_id
  on conflict (season_id, member_id) do update
    set score_paise = public.season_scores.score_paise + excluded.score_paise,
        reached_at = greatest(public.season_scores.reached_at, excluded.reached_at);
  return null;
end $$;
create trigger rank_ledger_a_scores after insert on public.rank_ledger for each row execute function public.ledger_scores();

-- The current #01 of a board: one index lookup.
create function public.board_top(p_season int, p_level text, p_city text, p_locality text) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.member_id from public.season_scores s
  where s.season_id = p_season and s.score_paise > 0
    and case p_level when 'india' then true
      when 'state' then s.state_code = (select c.state_code from public.cities c where c.id = p_city)
      when 'city' then s.city_id = p_city
      when 'locality' then s.locality_id = (select l.id from public.localities l where l.city_id = p_city and l.name = p_locality)
      else false end
  order by s.score_paise desc, s.reached_at asc, s.member_id limit 1
$$;

-- Same results as before. "As of now or later" reads the maintained table; a question about the past still
-- re-adds the ledger exactly as it always did.
create or replace function public.ranked_board_at(p_season int, p_level text, p_city text, p_locality text, p_at timestamptz)
returns table (member_id uuid, rank int, score_paise bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.rank_ledger x where x.season_id = p_season and x.created_at > p_at) then
    return query
      select s.member_id, (row_number() over (order by s.score_paise desc, s.reached_at asc, s.member_id))::int, s.score_paise
      from public.season_scores s
      where s.season_id = p_season and s.score_paise > 0
        and case p_level when 'india' then true
          when 'state' then s.state_code = (select c.state_code from public.cities c where c.id = p_city)
          when 'city' then s.city_id = p_city
          when 'locality' then s.locality_id = (select l.id from public.localities l where l.city_id = p_city and l.name = p_locality)
          else false end;
  else
    return query
  with scope as (
    select m.id from public.members m
    join public.localities l on l.id = m.locality_id
    join public.cities c on c.id = m.city_id
    where case p_level
      when 'india' then true
      when 'state' then c.state_code = (select c2.state_code from public.cities c2 where c2.id = p_city)
      when 'city' then m.city_id = p_city
      when 'locality' then m.city_id = p_city and l.name = p_locality
      else false end
  ), sc as (
    select r.member_id, sum(r.rank_credit_paise)::bigint as score, max(r.created_at) as reached
    from public.rank_ledger r
    where r.season_id = p_season and r.created_at <= p_at and r.member_id in (select id from scope)
    group by r.member_id having sum(r.rank_credit_paise) > 0
  )
  select sc.member_id, (row_number() over (order by sc.score desc, sc.reached asc, sc.member_id))::int, sc.score from sc;
  end if;
end $$;

create or replace function public.ledger_effects() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_city text; v_loc text; v_new bigint; v_old bigint; v_old_reached timestamptz; lvl text; v_key text; v_top uuid;
  v_open public.throne_reigns; s public.seasons; v_n int; v_latest boolean;
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

  -- Anti-snipe: an overtake in the last 15 minutes extends the season by 15 minutes (2 hours at most).
  if new.kind = 'credit' and new.created_at >= s.ends_at - interval '15 minutes' and exists (
    select 1 from (
      select r.member_id, sum(r.rank_credit_paise) as score, max(r.created_at) as reached
      from public.rank_ledger r where r.season_id = new.season_id and r.member_id <> new.member_id and (r.created_at, r.id) < (new.created_at, new.id)
      group by r.member_id having sum(r.rank_credit_paise) > 0
    ) x
    where (v_old = 0 or x.score > v_old or (x.score = v_old and x.reached < v_old_reached)) and x.score < v_new
  ) then
    if least(s.ends_at + interval '15 minutes', s.scheduled_end + interval '2 hours') > s.ends_at then
      update public.seasons set ends_at = least(s.ends_at + interval '15 minutes', s.scheduled_end + interval '2 hours') where id = s.id;
      insert into public.season_extensions (season_id, at, new_end, ledger_id)
        values (s.id, new.created_at, least(s.ends_at + interval '15 minutes', s.scheduled_end + interval '2 hours'), new.id);
    end if;
  end if;

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
    end if;
  end loop;

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

-- Proof that the maintained table equals the ledger. One row per difference; none = identical.
create function public.score_invariants() returns table (problem text, detail text)
language sql stable security definer set search_path = '' as $$
  with l as (select x.season_id, x.member_id, sum(x.rank_credit_paise)::bigint as score, max(x.created_at) as reached from public.rank_ledger x group by 1, 2)
  select 'score differs from the ledger', coalesce(l.season_id, s.season_id) || '/' || coalesce(l.member_id, s.member_id)
  from l full join public.season_scores s on s.season_id = l.season_id and s.member_id = l.member_id
  where l.member_id is null or s.member_id is null or l.score <> s.score_paise or l.reached <> s.reached_at
  union all
  select 'member location differs', s.member_id::text from public.season_scores s join public.members m on m.id = s.member_id
  where m.city_id <> s.city_id or m.locality_id <> s.locality_id
$$;

revoke execute on function public.ledger_scores(), public.board_top(int, text, text, text), public.score_invariants(),
  public.ledger_effects(), public.ranked_board_at(int, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.score_invariants() to service_role;

-- Rollback: drop trigger rank_ledger_a_scores on public.rank_ledger; re-create ledger_effects() and ranked_board_at()
--   from supabase/migrations; drop function public.ledger_scores(), public.board_top(int,text,text,text), public.score_invariants();
--   drop table public.season_scores;
