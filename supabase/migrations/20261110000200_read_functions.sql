-- Read API for the website. Every function returns public fields only.
-- Ranking happens here, on the server, from the ledger. The browser never decides a rank.

create function public.lifetime_tier(p_paise bigint) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_paise >= 50000000 then 'Black'   -- ₹5,00,000
    when p_paise >= 10000000 then 'Gold'    -- ₹1,00,000
    when p_paise >= 2500000 then 'Silver'   -- ₹25,000
    when p_paise >= 500000 then 'Bronze'    -- ₹5,000
  end
$$;

-- The season whose board is shown: the open one, otherwise the most recently closed one.
create function public.current_season_id() returns int
language sql stable security definer set search_path = '' as $$
  select s.id from public.seasons s where s.status in ('open', 'closed')
  order by (s.status = 'open') desc, s.starts_at desc limit 1
$$;

-- Internal: every ranked member on one board, with yesterday's rank. Not callable by clients.
-- Order: Season Score desc, then whoever reached that score first (time of their latest ledger entry).
create function public.ranked_board(p_level text, p_city text, p_locality text)
returns table (member_id uuid, rank int, prev_rank int, total int, score_paise bigint)
language sql stable security definer set search_path = '' as $$
  with s as (select public.current_season_id() as id),
  scope as (
    select m.id from public.members m
    join public.localities l on l.id = m.locality_id
    join public.cities c on c.id = m.city_id
    where case p_level
      when 'india' then true
      when 'state' then c.state_code = (select c2.state_code from public.cities c2 where c2.id = p_city)
      when 'city' then m.city_id = p_city
      when 'locality' then m.city_id = p_city and l.name = p_locality
      else false end
  ),
  now_sc as (
    select r.member_id, sum(r.rank_credit_paise) as score, max(r.created_at) as reached
    from public.rank_ledger r join s on r.season_id = s.id
    where r.member_id in (select id from scope)
    group by r.member_id having sum(r.rank_credit_paise) > 0
  ),
  prev_sc as (
    select r.member_id, sum(r.rank_credit_paise) as score, max(r.created_at) as reached
    from public.rank_ledger r join s on r.season_id = s.id
    where r.member_id in (select id from scope) and r.created_at <= now() - interval '24 hours'
    group by r.member_id having sum(r.rank_credit_paise) > 0
  ),
  ranked as (
    select n.member_id, n.score,
      (row_number() over (order by n.score desc, n.reached asc, n.member_id))::int as rank,
      (count(*) over ())::int as total
    from now_sc n
  ),
  prev as (
    select p.member_id, (row_number() over (order by p.score desc, p.reached asc, p.member_id))::int as prank from prev_sc p
  )
  select r.member_id, r.rank, p.prank, r.total, r.score
  from ranked r left join prev p on p.member_id = r.member_id
$$;

-- Public board: top rows (max 100), optional search, plus the signed-in member's own row.
create function public.get_board(p_level text, p_city text default null, p_locality text default null, p_limit int default 100, p_query text default null)
returns table (rank int, prev_rank int, total int, is_viewer boolean, public_name text, display_name text, masked boolean,
               title text, flex_line text, city_id text, state_code text, locality text, member_no bigint,
               season_score_paise bigint, lifetime_tier text)
language sql stable security definer set search_path = '' as $$
  select b.rank, b.prev_rank, b.total, coalesce(m.id = (select auth.uid()), false),
    case when m.masked then m.anon_label else m.username::text end,
    case when m.masked then null else m.display_name end,
    m.masked,
    case when m.masked then null else m.title end,
    case when m.masked then null else m.flex_line end,
    m.city_id, c.state_code, l.name,
    case when m.masked then null else m.member_no end,
    b.score_paise,
    public.lifetime_tier((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = m.id)::bigint)
  from public.ranked_board(p_level, p_city, p_locality) b
  join public.members m on m.id = b.member_id
  join public.cities c on c.id = m.city_id
  join public.localities l on l.id = m.locality_id
  where (
      b.rank <= least(greatest(coalesce(p_limit, 100), 1), 100)
      and (coalesce(p_query, '') = ''
        or m.anon_label ilike '%' || p_query || '%'
        or l.name ilike '%' || p_query || '%'
        or (not m.masked and (m.username::text ilike '%' || p_query || '%' or m.display_name ilike '%' || p_query || '%')))
    )
    or m.id = (select auth.uid())
  order by b.rank
$$;

-- One member's public profile, by username (or ANON label for Mystery mode members).
create function public.get_member(p_name text)
returns table (public_name text, display_name text, masked boolean, title text, flex_line text, city_id text,
               state_code text, locality text, member_no bigint, season_score_paise bigint, lifetime_tier text)
language sql stable security definer set search_path = '' as $$
  select case when m.masked then m.anon_label else m.username::text end,
    case when m.masked then null else m.display_name end, m.masked,
    case when m.masked then null else m.title end,
    case when m.masked then null else m.flex_line end,
    m.city_id, c.state_code, l.name,
    case when m.masked then null else m.member_no end,
    coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = m.id and x.season_id = public.current_season_id()), 0)::bigint,
    public.lifetime_tier((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = m.id)::bigint)
  from public.members m
  join public.cities c on c.id = m.city_id
  join public.localities l on l.id = m.locality_id
  where (m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext)
$$;

-- A member's position on each of their four boards.
create function public.get_standings(p_name text)
returns table (level text, rank int, total int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid; v_city text; v_loc text; lvl text;
begin
  select m.id, m.city_id, l.name into v_id, v_city, v_loc
  from public.members m join public.localities l on l.id = m.locality_id
  where (m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext);
  if v_id is null then return; end if;
  foreach lvl in array array['locality', 'city', 'state', 'india'] loop
    return query
      select lvl,
        (select b.rank from public.ranked_board(lvl, v_city, v_loc) b where b.member_id = v_id),
        coalesce((select max(b.total) from public.ranked_board(lvl, v_city, v_loc) b), 0);
  end loop;
end $$;

-- City index: combined Season Score per city, now and 24 hours ago (City Wars basis). No money is pooled.
create function public.get_city_summaries()
returns table (city_id text, members int, season_total_paise bigint, leader_name text, leader_masked boolean, rank int, prev_rank int)
language sql stable security definer set search_path = '' as $$
  with s as (select public.current_season_id() as id),
  t as (
    select c.id as city_id,
      (select count(*) from public.ranked_board('city', c.id, null))::int as members,
      coalesce((select sum(r.rank_credit_paise) from public.rank_ledger r join public.members m on m.id = r.member_id join s on r.season_id = s.id where m.city_id = c.id), 0)::bigint as total,
      coalesce((select sum(r.rank_credit_paise) from public.rank_ledger r join public.members m on m.id = r.member_id join s on r.season_id = s.id where m.city_id = c.id and r.created_at <= now() - interval '24 hours'), 0)::bigint as prev_total
    from public.cities c where c.active
  )
  select t.city_id, t.members, t.total, ldr.public_name, ldr.masked,
    case when t.total > 0 then (row_number() over (order by t.total desc, t.city_id))::int end,
    case when t.prev_total > 0 then (rank() over (order by t.prev_total desc, t.city_id))::int end
  from t
  left join lateral (
    select g.public_name, g.masked from public.get_board('city', t.city_id, null, 1, null) g where g.rank = 1
  ) ldr on true
  order by t.total desc, t.city_id
$$;

-- Season calendar row to display: open, else latest closed, else next upcoming.
create function public.get_season()
returns table (id int, starts_at timestamptz, scheduled_end timestamptz, ends_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.starts_at, s.scheduled_end, s.ends_at, s.status from public.seasons s
  order by case s.status when 'open' then 0 when 'closed' then 1 else 2 end,
           case when s.status = 'upcoming' then s.starts_at end asc,
           s.starts_at desc
  limit 1
$$;

-- Archive: frozen #01 finishers per city and India for closed seasons.
create function public.get_archive()
returns table (season_id int, starts_at timestamptz, ends_at timestamptz, level text, scope_key text, public_name text, display_name text, masked boolean)
language sql stable security definer set search_path = '' as $$
  select r.season_id, s.starts_at, s.ends_at, r.level, r.scope_key,
    case when m.masked then m.anon_label else m.username::text end,
    case when m.masked then null else m.display_name end, m.masked
  from public.season_results r
  join public.seasons s on s.id = r.season_id and s.status = 'closed'
  join public.members m on m.id = r.member_id
  where r.final_rank = 1 and r.level in ('city', 'india')
  order by r.season_id desc, r.level, r.scope_key
$$;

-- Privileges: clients may call only the get_* read functions.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_board(text, text, text, int, text) to anon, authenticated;
grant execute on function public.get_member(text) to anon, authenticated;
grant execute on function public.get_standings(text) to anon, authenticated;
grant execute on function public.get_city_summaries() to anon, authenticated;
grant execute on function public.get_season() to anon, authenticated;
grant execute on function public.get_archive() to anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
