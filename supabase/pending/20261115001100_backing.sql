-- PENDING REVIEW. Not applied to any database.
-- Backing: each member may give one free backing per season to one contender. It is final once given,
-- never affects a score or a rank, and involves no money. When a season closes, everyone who backed the
-- member who finished #01 in that member's city is awarded "Backed the Crown".
-- New: one table, four functions, one trigger on seasons. One existing constraint is widened: the list
-- of allowed achievement ids gains 'backed-the-crown'.

create table public.backings (
  season_id int not null references public.seasons (id),
  backer uuid not null references public.members (id),
  target uuid not null references public.members (id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (season_id, backer),                           -- one per member per season, enforced by the table
  check (backer <> target)
);
create index backings_target_idx on public.backings (season_id, target);
alter table public.backings enable row level security;       -- no policies: reached only through the functions below
revoke all on public.backings from public, anon, authenticated;

alter table public.member_achievements drop constraint member_achievements_achievement_check;
alter table public.member_achievements add constraint member_achievements_achievement_check
  check (achievement in ('founding-500','pioneer','season-crown','untouchable','longest-reign','revenge-taken','climber-of-week','streak','most-respected','backed-the-crown'));

create function public.back_member(p_target text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_target uuid; s public.seasons;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if not exists (select 1 from public.members m where m.id = v_uid) then raise exception 'Create your profile first' using errcode = 'no_data_found'; end if;
  if p_target is null or btrim(p_target) = '' then raise exception 'That member does not exist' using errcode = 'no_data_found'; end if;
  select m.id into v_target from public.members m where (m.masked and m.anon_label = p_target) or (not m.masked and m.username = p_target::extensions.citext);
  if v_target is null then raise exception 'That member does not exist' using errcode = 'no_data_found'; end if;
  if v_target = v_uid then raise exception 'You cannot back yourself' using errcode = 'check_violation'; end if;
  select * into s from public.seasons x where x.status = 'open' and clock_timestamp() >= x.starts_at and clock_timestamp() < x.ends_at;
  if s.id is null then raise exception 'Backing is only open while a season is running' using errcode = 'check_violation'; end if;
  if coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = v_target and x.season_id = s.id), 0) <= 0 then
    raise exception 'They are not on the board this season' using errcode = 'check_violation'; end if;
  begin
    insert into public.backings (season_id, backer, target) values (s.id, v_uid, v_target);
  exception when unique_violation then
    raise exception 'Your backing for this season is already given and locked' using errcode = 'unique_violation';
  end;
end $$;

-- Public read for one member: who backs them this season, who they back, and their past seasons.
create function public.get_backing(p_name text)
returns table (season_id int, backers int, contender boolean, pick_name text, pick_display text, pick_masked boolean, pick_city text, pick_locality text,
               pick_rank int, pick_of int, pick_gap_paise bigint, pick_since timestamptz, history jsonb)
language sql stable security definer set search_path = '' as $$
  with m as (select * from public.members x where (x.masked and x.anon_label = p_name) or (not x.masked and x.username = p_name::extensions.citext)),
  s as (select x.id from public.seasons x where x.status = 'open'),
  p as (select b.target, b.created_at, t.masked, t.display_name, t.city_id, l.name as locality, public.public_name(t) as pname
        from public.backings b join m on m.id = b.backer join s on s.id = b.season_id join public.members t on t.id = b.target join public.localities l on l.id = t.locality_id),
  board as (select rb.member_id, rb.rank, rb.score_paise, count(*) over () as n, max(rb.score_paise) over () as top
            from s, p, public.ranked_board_at(s.id, 'city', p.city_id, null, clock_timestamp()) rb)
  select s.id,
    (select count(*) from public.backings b, m where b.season_id = s.id and b.target = m.id)::int,
    coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x, m where x.member_id = m.id and x.season_id = s.id), 0) > 0,
    (select pname from p), (select case when masked then null else display_name end from p), (select masked from p), (select city_id from p), (select locality from p),
    (select b.rank from board b, p where b.member_id = p.target), (select max(b.n)::int from board b), (select (b.top - b.score_paise)::bigint from board b, p where b.member_id = p.target),
    (select created_at from p),
    coalesce((select jsonb_agg(jsonb_build_object('season_id', b.season_id, 'name', public.public_name(t), 'display', case when t.masked then null else t.display_name end, 'masked', t.masked,
                'city', t.city_id, 'final_rank', (select r.final_rank from public.season_results r where r.season_id = b.season_id and r.level = 'city' and r.scope_key = t.city_id and r.member_id = t.id)) order by b.season_id desc)
              from public.backings b join m on m.id = b.backer join public.members t on t.id = b.target join public.seasons z on z.id = b.season_id and z.status = 'closed'), '[]'::jsonb)
  from m left join s on true
$$;

create function public.get_most_backed(p_city text, p_limit int default 5)
returns table (public_name text, display_name text, masked boolean, locality text, backers int, rank int)
language sql stable security definer set search_path = '' as $$
  select public.public_name(t), case when t.masked then null else t.display_name end, t.masked, l.name, x.n, rb.rank
  from (select b.target, count(*)::int as n, b.season_id from public.backings b join public.seasons s on s.id = b.season_id and s.status = 'open' group by b.target, b.season_id) x
  join public.members t on t.id = x.target and t.city_id = p_city join public.localities l on l.id = t.locality_id
  join lateral public.ranked_board_at(x.season_id, 'city', p_city, null, clock_timestamp()) rb on rb.member_id = t.id
  order by x.n desc, rb.rank asc limit least(greatest(coalesce(p_limit, 5), 1), 50)
$$;

-- Awarded once, the moment a season is marked closed (its results are already frozen at that point).
create function public.award_backers() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select b.backer, t.city_id from public.backings b join public.members t on t.id = b.target
           join public.season_results f on f.season_id = b.season_id and f.level = 'city' and f.scope_key = t.city_id and f.member_id = b.target and f.final_rank = 1
           where b.season_id = new.id loop
    perform public.award(r.backer, 'backed-the-crown', new.id, 'city', r.city_id, 'Backed the Crown', 'Backed the #01 of ' || r.city_id || ' at the Season ' || new.id || ' finale', new.ends_at);
  end loop;
  return null;
end $$;
create trigger seasons_award_backers after update of status on public.seasons
  for each row when (new.status = 'closed' and old.status is distinct from 'closed') execute function public.award_backers();

revoke execute on function public.back_member(text), public.get_backing(text), public.get_most_backed(text, int), public.award_backers() from public, anon, authenticated;
grant execute on function public.get_backing(text), public.get_most_backed(text, int) to anon, authenticated;
grant execute on function public.back_member(text) to authenticated;

-- Rollback: drop trigger seasons_award_backers on public.seasons; drop the four functions; drop table public.backings;
--   (leave the widened achievement list in place if any 'backed-the-crown' rows exist)
