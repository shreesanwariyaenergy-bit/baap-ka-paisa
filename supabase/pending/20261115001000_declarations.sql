-- PENDING REVIEW. Not applied to any database.
-- Declarations: a member formally and publicly declares for the throne of a board they are on.
-- A declaration changes no score and no rank. Its outcome is read from the throne record.
-- New objects only: two tables and six functions. No existing object is changed.
-- There is no free text: the "line" is an index into a fixed list held by the application.

create table public.declarations (
  id bigint generated always as identity primary key,
  season_id int not null references public.seasons (id),
  level text not null check (level in ('locality', 'city', 'state', 'india')),
  scope_key text not null,
  seq int not null check (seq > 0),                          -- number on that board that season; never reused
  challenger uuid not null references public.members (id),
  holder uuid not null references public.members (id),
  line smallint not null default 0 check (line between 0 and 3),
  holder_score_paise bigint not null,                        -- figures at the moment of declaring
  challenger_score_paise bigint not null,
  required_paise bigint not null,
  declared_at timestamptz not null default clock_timestamp(),   -- the database clock, same as ledger time
  removed_at timestamptz, removed_reason text,               -- moderation
  unique (season_id, level, scope_key, seq),
  check (challenger <> holder)
);
create index declarations_challenger_idx on public.declarations (challenger, declared_at desc);
create index declarations_holder_idx on public.declarations (holder);
create table public.declaration_blocks (
  holder uuid not null references public.members (id),
  challenger uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  primary key (holder, challenger), check (holder <> challenger)
);
alter table public.declarations enable row level security;         -- no policies: reached only through the functions below
alter table public.declaration_blocks enable row level security;
revoke all on public.declarations, public.declaration_blocks from public, anon, authenticated;

-- Outcome, read from the board's own record. Never stored.
create function public.declaration_outcome(d public.declarations) returns table (status text, resolved_at timestamptz, taken_by uuid)
language sql stable security definer set search_path = '' as $$
  select case when d.removed_at is not null then 'removed'
              -- A holder's block hides every declaration that challenger made against them, whatever came of it.
              when exists (select 1 from public.declaration_blocks b where b.holder = d.holder and b.challenger = d.challenger) then 'withdrawn'
              when c.id is not null and c.to_member = d.challenger then 'won'
              when c.id is not null then 'throne-moved'
              when s.status = 'closed' then 'lapsed'
              else 'standing' end,
         case when d.removed_at is not null then d.removed_at when c.id is not null then c.at when s.status = 'closed' then s.ends_at end,
         case when c.id is not null and c.to_member <> d.challenger then c.to_member end
  from public.seasons s
  left join lateral (select e.id, e.to_member, e.at from public.crown_events e
                     where e.season_id = d.season_id and e.level = d.level and e.scope_key = d.scope_key and e.at > d.declared_at order by e.at limit 1) c on true
  where s.id = d.season_id
$$;

-- Declare for the #01 of a board the caller is on. Limits: one standing declaration per board,
-- one declaration every 72 hours, three per season, and not against a holder who has blocked the caller.
create function public.declare_for(p_level text, p_line int default 0) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); me public.members; v_loc text; s public.seasons; v_key text; v_top uuid; v_top_score bigint; v_mine bigint; v_seq int; v_id bigint;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select * into me from public.members m where m.id = v_uid;
  if me.id is null then raise exception 'Create your profile first' using errcode = 'no_data_found'; end if;
  if p_level is null or p_level not in ('locality', 'city', 'state', 'india') then raise exception 'Unknown board' using errcode = 'invalid_parameter_value'; end if;
  if p_line is null or p_line not between 0 and 3 then raise exception 'Unknown line' using errcode = 'invalid_parameter_value'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bkp-declare:' || v_uid::text, 11));   -- one declaration at a time per member
  select * into s from public.seasons x where x.status = 'open' and clock_timestamp() >= x.starts_at and clock_timestamp() < x.ends_at;
  if s.id is null then raise exception 'Declarations are only open while a season is running' using errcode = 'check_violation'; end if;
  select l.name into v_loc from public.localities l where l.id = me.locality_id;
  v_key := public.board_scope_key(p_level, me.city_id, v_loc);
  select b.member_id, b.score_paise into v_top, v_top_score from public.ranked_board_at(s.id, p_level, me.city_id, v_loc, clock_timestamp()) b where b.rank = 1;
  if v_top is null then raise exception 'Nobody holds this throne' using errcode = 'check_violation'; end if;
  if v_top = v_uid then raise exception 'You already hold this throne' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.declaration_blocks b where b.holder = v_top and b.challenger = v_uid) then
    raise exception 'You cannot declare against this member' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from public.declarations d, public.declaration_outcome(d) o
             where d.challenger = v_uid and d.season_id = s.id and d.level = p_level and d.scope_key = v_key and o.status = 'standing') then
    raise exception 'Your declaration for this throne is already standing' using errcode = 'unique_violation'; end if;
  if exists (select 1 from public.declarations d where d.challenger = v_uid and d.removed_at is null and d.declared_at > clock_timestamp() - interval '72 hours') then
    raise exception 'A member may declare once every 72 hours' using errcode = 'check_violation'; end if;
  if (select count(*) from public.declarations d where d.challenger = v_uid and d.season_id = s.id and d.removed_at is null) >= 3 then
    raise exception 'A member may make 3 declarations per season' using errcode = 'check_violation'; end if;
  select coalesce(sum(x.rank_credit_paise), 0) into v_mine from public.rank_ledger x where x.member_id = v_uid and x.season_id = s.id;
  perform pg_advisory_xact_lock(hashtextextended('bkp-declare-board:' || s.id || '|' || p_level || '|' || v_key, 12));
  select coalesce(max(d.seq), 0) + 1 into v_seq from public.declarations d where d.season_id = s.id and d.level = p_level and d.scope_key = v_key;
  insert into public.declarations (season_id, level, scope_key, seq, challenger, holder, line, holder_score_paise, challenger_score_paise, required_paise)
    values (s.id, p_level, v_key, v_seq, v_uid, v_top, p_line, v_top_score, v_mine, greatest(case when v_mine > 0 then 50000 else 100000 end, v_top_score - v_mine + 50000))
    returning id into v_id;
  return v_id;
end $$;

-- Public read. Removed and withdrawn declarations are never returned. Mystery-mode members appear by label only.
create function public.get_declarations(p_city text default null, p_name text default null, p_id bigint default null)
returns table (id bigint, seq int, season_id int, level text, scope_key text, line smallint, declared_at timestamptz, status text, resolved_at timestamptz,
  holder_score_paise bigint, challenger_score_paise bigint, required_paise bigint, holder_now_paise bigint, challenger_now_paise bigint,
  c_name text, c_display text, c_masked boolean, c_city text, c_locality text, h_name text, h_display text, h_masked boolean, h_city text, h_locality text,
  taken_by_name text, moves jsonb)
language sql stable security definer set search_path = '' as $$
  select d.id, d.seq, d.season_id, d.level, d.scope_key, d.line, d.declared_at, o.status, o.resolved_at,
    d.holder_score_paise, d.challenger_score_paise, d.required_paise,
    coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = d.holder and x.season_id = d.season_id), 0)::bigint,
    coalesce((select sum(x.rank_credit_paise) from public.rank_ledger x where x.member_id = d.challenger and x.season_id = d.season_id), 0)::bigint,
    public.public_name(c), case when c.masked then null else c.display_name end, c.masked, c.city_id, cl.name,
    public.public_name(h), case when h.masked then null else h.display_name end, h.masked, h.city_id, hl.name,
    (select public.public_name(t) from public.members t where t.id = o.taken_by),
    coalesce((select jsonb_agg(jsonb_build_object('at', x.created_at, 'who', case when x.member_id = d.holder then 'holder' else 'challenger' end, 'amount_paise', x.rank_credit_paise) order by x.created_at)
              from public.rank_ledger x where x.season_id = d.season_id and x.member_id in (d.holder, d.challenger)
                and x.created_at > d.declared_at and x.created_at <= coalesce(o.resolved_at, clock_timestamp())), '[]'::jsonb)
  from public.declarations d
  cross join lateral public.declaration_outcome(d) o
  join public.members c on c.id = d.challenger join public.localities cl on cl.id = c.locality_id
  join public.members h on h.id = d.holder join public.localities hl on hl.id = h.locality_id
  where o.status not in ('removed', 'withdrawn')
    and (p_id is null or d.id = p_id)
    and (p_city is null or (d.level = 'city' and d.scope_key = p_city) or (d.level = 'locality' and d.scope_key like p_city || '/%'))
    and (p_name is null or public.public_name(c) = p_name or public.public_name(h) = p_name)
  order by d.declared_at desc limit 50
$$;

-- A holder stops one challenger from declaring against them. Standing declarations from that challenger leave public view.
create function public.block_challenger(p_name text, p_block boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_other uuid;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select m.id into v_other from public.members m where (m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext);
  if v_other is null or v_other = v_uid then raise exception 'That member does not exist' using errcode = 'no_data_found'; end if;
  if coalesce(p_block, true) then insert into public.declaration_blocks (holder, challenger) values (v_uid, v_other) on conflict do nothing;
  else delete from public.declaration_blocks b where b.holder = v_uid and b.challenger = v_other; end if;
end $$;

-- The caller's own block list, by public name.
create function public.get_my_blocks() returns table (public_name text, display_name text, masked boolean, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select public.public_name(m), case when m.masked then null else m.display_name end, m.masked, b.created_at
  from public.declaration_blocks b join public.members m on m.id = b.challenger where b.holder = auth.uid() order by b.created_at desc
$$;

-- Moderation: hide a declaration. Its number is kept so it is never reused. Not callable from the browser.
create function public.remove_declaration(p_id bigint, p_reason text) returns void
language sql security definer set search_path = '' as $$
  update public.declarations set removed_at = clock_timestamp(), removed_reason = p_reason where id = p_id and removed_at is null
$$;

revoke execute on function public.declaration_outcome(public.declarations), public.declare_for(text, int), public.get_declarations(text, text, bigint),
  public.block_challenger(text, boolean), public.get_my_blocks(), public.remove_declaration(bigint, text) from public, anon, authenticated;
grant execute on function public.get_declarations(text, text, bigint) to anon, authenticated;
grant execute on function public.declare_for(text, int), public.block_challenger(text, boolean), public.get_my_blocks() to authenticated;
grant execute on function public.remove_declaration(bigint, text) to service_role;

-- Rollback: drop the six functions, then  drop table public.declaration_blocks, public.declarations;
