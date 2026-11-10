-- Season engine for live data. Additive only: new tables, triggers on new ledger rows, lifecycle
-- functions and read functions. Mirrors lib/engine/engine.ts.
-- Nothing here is scheduled: season_tick() must be called by an operator or a cron job that has
-- not been set up, so no live competition starts on its own.

-- ---------- Tables ----------
create table public.throne_reigns (
  id bigint generated always as identity primary key,
  season_id int not null references public.seasons (id),
  level text not null check (level in ('locality', 'city', 'state', 'india')),
  scope_key text not null,
  member_id uuid not null references public.members (id),
  started_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason in ('overtaken', 'season-end')),
  check ((ended_at is null) = (end_reason is null))
);
create unique index throne_one_open_reign on public.throne_reigns (season_id, level, scope_key) where ended_at is null;
create index throne_member_idx on public.throne_reigns (member_id);

create table public.crown_events (
  id bigint generated always as identity primary key,
  season_id int not null references public.seasons (id),
  level text not null, scope_key text not null,
  from_member uuid references public.members (id),
  to_member uuid not null references public.members (id),
  at timestamptz not null
);
create index crown_events_scope_idx on public.crown_events (level, scope_key, at desc);

create table public.season_extensions (
  id bigint generated always as identity primary key,
  season_id int not null references public.seasons (id),
  at timestamptz not null,
  new_end timestamptz not null,
  ledger_id bigint not null references public.rank_ledger (id)
);

create table public.member_achievements (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members (id),
  achievement text not null check (achievement in ('founding-500','pioneer','season-crown','untouchable','longest-reign','revenge-taken','climber-of-week','streak','most-respected')),
  season_id int references public.seasons (id),
  level text, scope_key text,
  label text not null, detail text not null,
  awarded_at timestamptz not null
);
create unique index member_achievements_once on public.member_achievements (member_id, achievement, coalesce(season_id, 0), coalesce(level, ''), coalesce(scope_key, ''), awarded_at);

create table public.respects (
  giver uuid not null references public.members (id),
  receiver uuid not null references public.members (id),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (giver, receiver, day),
  check (giver <> receiver)
);
create table public.follows (
  follower uuid not null references public.members (id),
  followee uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create table public.rivals (
  member_id uuid not null references public.members (id),
  rival_id uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  primary key (member_id, rival_id),
  check (member_id <> rival_id)
);
create function public.enforce_rival_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.rivals r where r.member_id = new.member_id) >= 5 then
    raise exception 'A member can have up to 5 rivals' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger rivals_limit before insert on public.rivals for each row execute function public.enforce_rival_limit();

create function public.enforce_respect_day() returns trigger language plpgsql set search_path = '' as $$
begin
  new.day := (new.created_at at time zone 'Asia/Kolkata')::date;  -- one Respect per profile per IST day
  return new;
end $$;
create trigger respects_day before insert on public.respects for each row execute function public.enforce_respect_day();

alter table public.throne_reigns enable row level security;
alter table public.crown_events enable row level security;
alter table public.season_extensions enable row level security;
alter table public.member_achievements enable row level security;
alter table public.respects enable row level security;
alter table public.follows enable row level security;
alter table public.rivals enable row level security;
-- Signed-in members manage only their own social rows. No member rows can be created by clients,
-- so these policies do nothing until sign-up exists.
create policy "give respect as yourself" on public.respects for insert to authenticated with check (giver = (select auth.uid()));
create policy "see respect you gave" on public.respects for select to authenticated using (giver = (select auth.uid()));
create policy "follow as yourself" on public.follows for insert to authenticated with check (follower = (select auth.uid()));
create policy "unfollow as yourself" on public.follows for delete to authenticated using (follower = (select auth.uid()));
create policy "see who you follow" on public.follows for select to authenticated using (follower = (select auth.uid()));
create policy "add rivals as yourself" on public.rivals for insert to authenticated with check (member_id = (select auth.uid()));
create policy "remove your rivals" on public.rivals for delete to authenticated using (member_id = (select auth.uid()));
create policy "see your rivals" on public.rivals for select to authenticated using (member_id = (select auth.uid()));

-- ---------- Helpers ----------
create function public.board_scope_key(p_level text, p_city text, p_locality text) returns text
language sql stable set search_path = '' as $$
  select case p_level
    when 'india' then 'india'
    when 'state' then (select c.state_code from public.cities c where c.id = p_city)
    when 'city' then p_city
    else p_city || '/' || p_locality end
$$;

-- Ranking of one board for a given season as it stood at a point in time.
create function public.ranked_board_at(p_season int, p_level text, p_city text, p_locality text, p_at timestamptz)
returns table (member_id uuid, rank int, score_paise bigint)
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
  ), sc as (
    select r.member_id, sum(r.rank_credit_paise)::bigint as score, max(r.created_at) as reached
    from public.rank_ledger r
    where r.season_id = p_season and r.created_at <= p_at and r.member_id in (select id from scope)
    group by r.member_id having sum(r.rank_credit_paise) > 0
  )
  select sc.member_id, (row_number() over (order by sc.score desc, sc.reached asc, sc.member_id))::int, sc.score from sc
$$;

create function public.award(p_member uuid, p_id text, p_season int, p_level text, p_scope text, p_label text, p_detail text, p_at timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.member_achievements (member_id, achievement, season_id, level, scope_key, label, detail, awarded_at)
  values (p_member, p_id, p_season, p_level, p_scope, p_label, p_detail, p_at)
  on conflict do nothing
$$;

create function public.check_untouchable(p_reign_id bigint, p_now timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.throne_reigns;
begin
  select * into r from public.throne_reigns where id = p_reign_id;
  if r.level = 'city' and coalesce(r.ended_at, p_now) - r.started_at >= interval '72 hours'
     and not exists (select 1 from public.member_achievements a where a.member_id = r.member_id and a.achievement = 'untouchable' and a.season_id = r.season_id and a.scope_key = r.scope_key) then
    perform public.award(r.member_id, 'untouchable', r.season_id, r.level, r.scope_key, 'Untouchable', 'Held city #01 for 72 hours straight', r.started_at + interval '72 hours');
  end if;
end $$;

-- ---------- Ledger rules ----------
-- Before insert: a credit needs an open season covering its time, and a first credit of at least ₹1,000.
create function public.ledger_guard() returns trigger language plpgsql set search_path = '' as $$
declare s public.seasons;
begin
  select * into s from public.seasons where id = new.season_id;
  if new.kind = 'credit' then
    if s.status <> 'open' or new.created_at < s.starts_at or new.created_at >= s.ends_at then
      raise exception 'Season % is not open for credits', new.season_id using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.rank_ledger x where x.member_id = new.member_id and x.season_id = new.season_id)
       and new.rank_credit_paise < 100000 then
      raise exception 'Entering a season starts at ₹1,000' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger rank_ledger_guard before insert on public.rank_ledger for each row execute function public.ledger_guard();

-- After insert: anti-snipe, Crown Moments and throne reigns, Founding 500, Pioneer, Revenge Taken.
create function public.ledger_effects() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_city text; v_loc text; v_new bigint; v_old bigint; v_old_reached timestamptz; lvl text; v_key text; v_top uuid;
  v_open public.throne_reigns; s public.seasons; v_n int;
begin
  select m.city_id, l.name into v_city, v_loc from public.members m join public.localities l on l.id = m.locality_id where m.id = new.member_id;
  select * into s from public.seasons where id = new.season_id for update;
  select coalesce(sum(r.rank_credit_paise), 0) into v_new from public.rank_ledger r where r.member_id = new.member_id and r.season_id = new.season_id;
  v_old := v_new - new.rank_credit_paise;
  select max(r.created_at) into v_old_reached from public.rank_ledger r where r.member_id = new.member_id and r.season_id = new.season_id and r.id <> new.id;

  -- Anti-snipe: an overtake in the last 15 minutes extends the season by 15 minutes (2 hours at most).
  if new.kind = 'credit' and new.created_at >= s.ends_at - interval '15 minutes' and exists (
    select 1 from (
      select r.member_id, sum(r.rank_credit_paise) as score, max(r.created_at) as reached
      from public.rank_ledger r where r.season_id = new.season_id and r.member_id <> new.member_id
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
    select b.member_id into v_top from public.ranked_board_at(new.season_id, lvl, v_city, v_loc, new.created_at) b where b.rank = 1;
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

  -- Founding 500 and Pioneer on a member's first ever credit.
  if new.kind = 'credit' and not exists (select 1 from public.rank_ledger r where r.member_id = new.member_id and r.id <> new.id and r.kind = 'credit') then
    select count(distinct r.member_id) into v_n from public.rank_ledger r join public.members m on m.id = r.member_id where m.city_id = v_city and r.kind = 'credit';
    if v_n <= 500 then perform public.award(new.member_id, 'founding-500', null, 'city', v_city, 'Founding 500', 'Founding member no. ' || v_n || ' of 500 in ' || v_city, new.created_at); end if;
    if not exists (select 1 from public.rank_ledger r join public.members m on m.id = r.member_id join public.localities l on l.id = m.locality_id
                   where m.city_id = v_city and l.name = v_loc and r.member_id <> new.member_id and r.kind = 'credit') then
      perform public.award(new.member_id, 'pioneer', null, 'locality', v_city || '/' || v_loc, 'Pioneer of ' || v_loc, 'First member ever to rank in ' || v_loc, new.created_at);
    end if;
  end if;
  return null;
end $$;
create trigger rank_ledger_effects after insert on public.rank_ledger for each row execute function public.ledger_effects();

-- ---------- Season lifecycle (operator / cron only; not scheduled) ----------
create function public.close_season(p_season int, p_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.seasons; b record; v_prev int; v_n int; r record; v_top uuid;
begin
  select * into s from public.seasons where id = p_season for update;
  if s.status <> 'open' or p_at < s.ends_at then raise exception 'Season % cannot close yet', p_season; end if;
  -- Freeze every board that has ranked members.
  for b in
    select distinct 'locality'::text as level, m.city_id::text as city_id, l.name::text as locality from public.rank_ledger x join public.members m on m.id = x.member_id join public.localities l on l.id = m.locality_id where x.season_id = p_season
    union select distinct 'city'::text, m.city_id::text, null::text from public.rank_ledger x join public.members m on m.id = x.member_id where x.season_id = p_season
    union select 'state'::text, min(m.city_id)::text, null::text from public.rank_ledger x join public.members m on m.id = x.member_id join public.cities c on c.id = m.city_id where x.season_id = p_season group by c.state_code
    union select 'india'::text, null::text, null::text
  loop
    insert into public.season_results (season_id, level, scope_key, member_id, final_rank, final_score_paise)
      select p_season, b.level, public.board_scope_key(b.level, b.city_id, b.locality), rb.member_id, rb.rank, rb.score_paise
      from public.ranked_board_at(p_season, b.level, b.city_id, b.locality, s.ends_at) rb;
    v_top := null;
    select rb.member_id into v_top from public.ranked_board_at(p_season, b.level, b.city_id, b.locality, s.ends_at) rb where rb.rank = 1;
    if v_top is not null then
      perform public.award(v_top, 'season-crown', p_season, b.level, public.board_scope_key(b.level, b.city_id, b.locality), 'Season Crown', '#01 at the Season ' || p_season || ' finale', s.ends_at);
    end if;
  end loop;
  -- Close open reigns.
  for r in select id from public.throne_reigns where season_id = p_season and ended_at is null loop
    update public.throne_reigns set ended_at = s.ends_at, end_reason = 'season-end' where id = r.id;
    perform public.check_untouchable(r.id, s.ends_at);
  end loop;
  -- Streaks: consecutive ranked seasons ending with this one.
  for r in select distinct x.member_id from public.season_results x where x.season_id = p_season and x.level = 'india' loop
    v_n := 1; v_prev := p_season - 1;
    while exists (select 1 from public.season_results y where y.season_id = v_prev and y.level = 'india' and y.member_id = r.member_id) loop v_n := v_n + 1; v_prev := v_prev - 1; end loop;
    if v_n >= 2 then perform public.award(r.member_id, 'streak', p_season, null, null, 'Streak ×' || v_n, 'Ranked in ' || v_n || ' seasons in a row', s.ends_at); end if;
  end loop;
  -- Most Respected.
  v_top := null;
  select x.receiver into v_top from public.respects x where x.created_at >= s.starts_at and x.created_at < s.ends_at
    group by x.receiver order by count(*) desc, min(x.created_at) asc limit 1;
  if v_top is not null then perform public.award(v_top, 'most-respected', p_season, null, null, 'Most Respected', '#01 on the Respect board in Season ' || p_season, s.ends_at); end if;
  update public.seasons set status = 'closed' where id = p_season;
end $$;

-- Climber of the Week for one completed IST week (Monday start), per city.
create function public.award_climbers(p_week_start timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare v_season int; c record; best record;
begin
  select s.id into v_season from public.seasons s where s.starts_at <= p_week_start + interval '7 days' - interval '1 second' and s.ends_at > p_week_start + interval '7 days' - interval '1 second' order by s.starts_at desc limit 1;
  if v_season is null then return; end if;
  for c in select id from public.cities where active loop
    best := null;
    select e.member_id, coalesce(st.rank, (select count(*) from public.ranked_board_at(v_season, 'city', c.id, null, p_week_start))::int + 1) - e.rank as jump into best
    from public.ranked_board_at(v_season, 'city', c.id, null, p_week_start + interval '7 days' - interval '1 second') e
    left join public.ranked_board_at(v_season, 'city', c.id, null, p_week_start) st on st.member_id = e.member_id
    order by 2 desc, e.rank asc limit 1;
    if best.member_id is not null and best.jump > 0 then
      perform public.award(best.member_id, 'climber-of-week', v_season, 'city', c.id, 'Climber of the Week', 'Up ' || best.jump || ' places in ' || c.id || ', week of ' || to_char(p_week_start at time zone 'Asia/Kolkata', 'YYYY-MM-DD'), p_week_start + interval '7 days');
    end if;
  end loop;
end $$;

-- One tick of the season clock: open due seasons, close finished ones, award Untouchable on open reigns.
create function public.season_tick(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare s record; r record;
begin
  for s in select id from public.seasons where status = 'open' and ends_at <= p_now order by starts_at loop
    perform public.close_season(s.id, p_now);
  end loop;
  update public.seasons set status = 'open' where status = 'upcoming' and starts_at <= p_now and ends_at > p_now
    and not exists (select 1 from public.seasons o where o.status = 'open');
  for r in select id from public.throne_reigns where ended_at is null loop perform public.check_untouchable(r.id, p_now); end loop;
end $$;

-- Longest Reign: computed at read time from the throne history (always the current record).
-- ---------- Read functions (public fields only) ----------
create function public.public_name(m public.members) returns text language sql stable set search_path = '' as $$
  select case when m.masked then m.anon_label else m.username::text end
$$;

create function public.get_throne_history(p_level text default null, p_city text default null, p_locality text default null, p_name text default null, p_limit int default 50)
returns table (season_id int, level text, scope_key text, public_name text, display_name text, masked boolean, started_at timestamptz, ended_at timestamptz, end_reason text, untouchable boolean, revenge boolean)
language sql stable security definer set search_path = '' as $$
  select t.season_id, t.level, t.scope_key, public.public_name(m), case when m.masked then null else m.display_name end, m.masked,
    t.started_at, t.ended_at, t.end_reason,
    exists (select 1 from public.member_achievements a where a.member_id = t.member_id and a.achievement = 'untouchable' and a.season_id = t.season_id and a.scope_key = t.scope_key and a.awarded_at between t.started_at and coalesce(t.ended_at, now())),
    exists (select 1 from public.member_achievements a where a.member_id = t.member_id and a.achievement = 'revenge-taken' and a.scope_key = t.scope_key and a.awarded_at = t.started_at)
  from public.throne_reigns t join public.members m on m.id = t.member_id
  where (p_level is null or (t.level = p_level and t.scope_key = public.board_scope_key(p_level, p_city, p_locality)))
    and (p_name is null or (m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext))
  order by t.started_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

create function public.get_crown_moments(p_level text, p_city text, p_locality text, p_since timestamptz)
returns table (season_id int, level text, scope_key text, from_name text, from_masked boolean, from_display text, to_name text, to_masked boolean, to_display text, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.season_id, e.level, e.scope_key,
    public.public_name(f), f.masked, case when f.masked then null else f.display_name end,
    public.public_name(t), t.masked, case when t.masked then null else t.display_name end, e.at
  from public.crown_events e
  left join public.members f on f.id = e.from_member
  join public.members t on t.id = e.to_member
  where e.level = p_level and e.scope_key = public.board_scope_key(p_level, p_city, p_locality) and e.at >= p_since
  order by e.at desc limit 20
$$;

create function public.get_achievements(p_name text)
returns table (achievement text, label text, detail text, season_id int, level text, scope_key text, awarded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with m as (select * from public.members m where (m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext))
  select a.achievement, a.label, a.detail, a.season_id, a.level, a.scope_key, a.awarded_at
  from public.member_achievements a join m on m.id = a.member_id
  union all
  -- Longest Reign is the current record per city, derived from the throne history.
  select 'longest-reign', 'Longest Reign', 'Record city #01 reign in ' || x.scope_key, x.season_id, 'city', x.scope_key, x.started_at
  from (
    select distinct on (t.scope_key) t.* from public.throne_reigns t where t.level = 'city'
    order by t.scope_key, coalesce(t.ended_at, now()) - t.started_at desc, t.started_at
  ) x join m on m.id = x.member_id
  order by 7 desc
$$;

create function public.get_respect_board(p_level text, p_city text default null, p_locality text default null, p_limit int default 100)
returns table (rank int, total int, public_name text, display_name text, masked boolean, city_id text, state_code text, locality text, respect_count int)
language sql stable security definer set search_path = '' as $$
  with s as (select x.starts_at, x.ends_at from public.seasons x where x.id = public.current_season_id()),
  scope as (
    select m.id from public.members m join public.localities l on l.id = m.locality_id join public.cities c on c.id = m.city_id
    where case p_level when 'india' then true
      when 'state' then c.state_code = (select c2.state_code from public.cities c2 where c2.id = p_city)
      when 'city' then m.city_id = p_city when 'locality' then m.city_id = p_city and l.name = p_locality else false end
  ),
  cnt as (
    select r.receiver, count(*)::int as n, max(r.created_at) as reached from public.respects r, s
    where r.created_at >= s.starts_at and r.created_at < s.ends_at and r.receiver in (select id from scope) group by r.receiver
  ),
  ranked as (select receiver, n, (row_number() over (order by n desc, reached asc, receiver))::int as rank, (count(*) over ())::int as total from cnt)
  select r.rank, r.total, public.public_name(m), case when m.masked then null else m.display_name end, m.masked, m.city_id, c.state_code, l.name, r.n
  from ranked r join public.members m on m.id = r.receiver join public.cities c on c.id = m.city_id join public.localities l on l.id = m.locality_id
  where r.rank <= least(greatest(coalesce(p_limit, 100), 1), 100)
  order by r.rank
$$;

create function public.get_social(p_name text)
returns table (followers int, following int, respect_this_season int, rival_names text[])
language sql stable security definer set search_path = '' as $$
  with m as (select * from public.members m where (m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext)),
  s as (select x.starts_at, x.ends_at from public.seasons x where x.id = public.current_season_id())
  select (select count(*) from public.follows f, m where f.followee = m.id)::int,
    (select count(*) from public.follows f, m where f.follower = m.id)::int,
    (select count(*) from public.respects r, m, s where r.receiver = m.id and r.created_at >= s.starts_at and r.created_at < s.ends_at)::int,
    coalesce((select array_agg(public.public_name(x) order by rv.created_at) from public.rivals rv join m on m.id = rv.member_id join public.members x on x.id = rv.rival_id), '{}')
  from m
$$;

-- ---------- Privileges ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_board(text, text, text, int, text) to anon, authenticated;
grant execute on function public.get_member(text) to anon, authenticated;
grant execute on function public.get_standings(text) to anon, authenticated;
grant execute on function public.get_city_summaries() to anon, authenticated;
grant execute on function public.get_season() to anon, authenticated;
grant execute on function public.get_archive() to anon, authenticated;
grant execute on function public.get_hall_of_fame(text, text, text, int) to anon, authenticated;
grant execute on function public.get_throne_history(text, text, text, text, int) to anon, authenticated;
grant execute on function public.get_crown_moments(text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.get_achievements(text) to anon, authenticated;
grant execute on function public.get_respect_board(text, text, text, int) to anon, authenticated;
grant execute on function public.get_social(text) to anon, authenticated;
