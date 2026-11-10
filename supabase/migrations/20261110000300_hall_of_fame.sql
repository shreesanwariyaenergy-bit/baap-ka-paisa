-- Hall of Fame: Lifetime Score across every season. Never resets. Additive; changes no existing object.
-- Ties go to whoever reached their lifetime total first. Scope uses the member's current city and locality.
create function public.get_hall_of_fame(p_level text, p_city text default null, p_locality text default null, p_limit int default 100)
returns table (rank int, total int, is_viewer boolean, public_name text, display_name text, masked boolean,
               title text, flex_line text, city_id text, state_code text, locality text, member_no bigint,
               lifetime_paise bigint, lifetime_tier text)
language sql stable security definer set search_path = '' as $$
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
  ),
  life as (
    select r.member_id, sum(r.rank_credit_paise)::bigint as lt, max(r.created_at) as reached
    from public.rank_ledger r where r.member_id in (select id from scope)
    group by r.member_id having sum(r.rank_credit_paise) > 0
  ),
  ranked as (
    select member_id, lt, (row_number() over (order by lt desc, reached asc, member_id))::int as rank, (count(*) over ())::int as total from life
  )
  select r.rank, r.total, coalesce(m.id = (select auth.uid()), false),
    case when m.masked then m.anon_label else m.username::text end,
    case when m.masked then null else m.display_name end, m.masked,
    case when m.masked then null else m.title end,
    case when m.masked then null else m.flex_line end,
    m.city_id, c.state_code, l.name,
    case when m.masked then null else m.member_no end,
    r.lt, public.lifetime_tier(r.lt)
  from ranked r
  join public.members m on m.id = r.member_id
  join public.cities c on c.id = m.city_id
  join public.localities l on l.id = m.locality_id
  where r.rank <= least(greatest(coalesce(p_limit, 100), 1), 100) or m.id = (select auth.uid())
  order by r.rank
$$;
revoke execute on function public.get_hall_of_fame(text, text, text, int) from public, anon, authenticated;
grant execute on function public.get_hall_of_fame(text, text, text, int) to anon, authenticated;
