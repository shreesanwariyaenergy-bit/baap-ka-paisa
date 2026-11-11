-- Member registration and self-service profile. Additive only.
-- A signed-in account (Supabase Auth) creates exactly one member profile through create_member().
-- No table becomes writable from the browser; every write goes through these checked functions.

create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[a-z0-9._]{3,24}$'
    and p_username !~ '^[._]' and p_username !~ '[._]$' and p_username !~ '\.\.'
    and p_username !~ '^anon[-.]?[0-9]'
    and p_username not in ('admin','support','help','baapkapaisa','baap.ka.paisa','official','moderator','system','anon','me','seal')
    and not exists (select 1 from public.members m where m.username = p_username::extensions.citext)
$$;

create function public.new_anon_label() returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  loop
    v := 'ANON-' || lpad((floor(random() * 9000) + 100)::int::text, 3, '0');
    exit when not exists (select 1 from public.members m where m.anon_label = v);
  end loop;
  return v;
end $$;

create function public.create_member(p_username text, p_display_name text, p_date_of_birth date, p_city text, p_locality text,
                                     p_title text default null, p_flex_line text default null, p_mystery boolean default false)
returns table (member_no bigint, public_name text, masked boolean)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_loc bigint; v_no bigint; v_anon text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if exists (select 1 from public.members m where m.id = v_uid) then raise exception 'This account already has a profile' using errcode = 'unique_violation'; end if;
  if not public.username_available(lower(p_username)) then raise exception 'That username is not available' using errcode = 'unique_violation'; end if;
  if p_date_of_birth is null or p_date_of_birth > ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date then
    raise exception 'Members must be 18 or older' using errcode = 'check_violation'; end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 40 then raise exception 'Display name must be 1 to 40 characters' using errcode = 'check_violation'; end if;
  select l.id into v_loc from public.localities l join public.cities c on c.id = l.city_id where l.city_id = p_city and l.name = p_locality and c.active;
  if v_loc is null then raise exception 'Choose a launch city and one of its localities' using errcode = 'check_violation'; end if;
  if p_mystery then v_anon := public.new_anon_label(); end if;
  insert into public.members (id, username, display_name, masked, anon_label, title, flex_line, city_id, locality_id)
    values (v_uid, lower(p_username), btrim(p_display_name), coalesce(p_mystery, false), v_anon, nullif(p_title, ''), nullif(btrim(coalesce(p_flex_line, '')), ''), p_city, v_loc)
    returning members.member_no into v_no;
  insert into public.member_private (member_id, date_of_birth) values (v_uid, p_date_of_birth);
  return query select v_no, coalesce(v_anon, lower(p_username)), coalesce(p_mystery, false);
end $$;

create function public.get_me()
returns table (username text, display_name text, masked boolean, anon_label text, title text, flex_line text, city_id text, state_code text,
               locality text, member_no bigint, joined_at timestamptz, place_locked_until timestamptz, lifetime_paise bigint, season_score_paise bigint)
language sql stable security definer set search_path = '' as $$
  select m.username::text, m.display_name, m.masked, m.anon_label, m.title, m.flex_line, m.city_id, c.state_code, l.name, m.member_no,
    m.created_at, m.place_locked_until,
    coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = m.id), 0)::bigint,
    coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = m.id and x.season_id = public.current_season_id()), 0)::bigint
  from public.members m join public.cities c on c.id = m.city_id join public.localities l on l.id = m.locality_id
  where m.id = auth.uid()
$$;

create function public.update_my_profile(p_display_name text, p_title text, p_flex_line text, p_mystery boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 40 then raise exception 'Display name must be 1 to 40 characters' using errcode = 'check_violation'; end if;
  update public.members m set
    display_name = btrim(p_display_name),
    title = nullif(p_title, ''),
    flex_line = nullif(btrim(coalesce(p_flex_line, '')), ''),
    anon_label = case when p_mystery and m.anon_label is null then public.new_anon_label() else m.anon_label end,
    masked = coalesce(p_mystery, false)
  where m.id = v_uid;
  if not found then raise exception 'No profile for this account' using errcode = 'no_data_found'; end if;
end $$;

revoke execute on function public.username_available(text), public.new_anon_label(), public.create_member(text, text, date, text, text, text, text, boolean),
  public.get_me(), public.update_my_profile(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.create_member(text, text, date, text, text, text, text, boolean) to authenticated;
grant execute on function public.get_me() to authenticated;
grant execute on function public.update_my_profile(text, text, text, boolean) to authenticated;

-- A signed-in member's own frozen season finishes (for The Seal's reverse).
create function public.get_my_season_record()
returns table (season_id int, starts_at timestamptz, level text, scope_key text, final_rank int)
language sql stable security definer set search_path = '' as $$
  select r.season_id, s.starts_at, r.level, r.scope_key, r.final_rank
  from public.season_results r join public.seasons s on s.id = r.season_id
  where r.member_id = auth.uid() and r.level in ('locality', 'city')
  order by r.season_id desc
$$;
revoke execute on function public.get_my_season_record() from public, anon, authenticated;
grant execute on function public.get_my_season_record() to authenticated;
