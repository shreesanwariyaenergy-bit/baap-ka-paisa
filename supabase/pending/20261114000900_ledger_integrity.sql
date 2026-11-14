-- PENDING REVIEW. Not applied to any database.
-- Ledger integrity (audit findings C1 and C2), payment capture time, and delayed webhooks.
-- No ranking rule changes: ₹1,000 entry, ₹500 steps, earlier-reached wins a tie, anti-snipe +15 min (2 h cap).
--
-- THE TWO TIMES
--   created_at  (ledger time)  Stamped by the database, after the season lock is held. It alone decides
--                              order, ranks, reigns and anti-snipe. No caller can set it.
--   captured_at (evidence)     When the payment provider captured the money, taken from the provider's
--                              signed webhook by the trusted payment backend. It is stored as evidence and
--                              answers exactly one question: "was this paid before the bell?". It never
--                              orders anything, so a wrong value cannot rewrite history.
--
-- THE BELL AND THE SETTLING WINDOW
--   At ends_at no new purchase can start. The season then stays open for settle_seconds (default 10
--   minutes) only for payments whose verified captured_at is before the bell. Such a credit is placed in
--   the final millisecond before the bell, in arrival order, and the normal rules run on it: if it is an
--   overtake inside the last 15 minutes, the season is extended exactly as if the webhook had not been late.
--   A payment that cannot be credited (captured after the bell, or arriving after the season has closed)
--   is never dropped and never credited silently: it is quarantined in late_payments and refunded. Nothing is
--   ever carried into the next season automatically.
--
-- WHAT THIS CHANGES ON EXISTING OBJECTS (all tables below are empty on the live project)
--   engine_settings  + column settle_seconds
--   rank_ledger      + column captured_at, + one index; write privileges removed from browser roles
--   ledger_guard()   body replaced (same trigger)
--   season_tick()    body replaced: a season closes settle_seconds after its end, re-checked under the lock

alter table public.engine_settings add column settle_seconds int not null default 600 check (settle_seconds between 0 and 3600);
alter table public.rank_ledger add column captured_at timestamptz;

-- The newest row of a season is read on every insert.
create index rank_ledger_season_time_idx on public.rank_ledger (season_id, created_at desc);

-- Browser roles never write the ledger. (Row security already refused them; this removes the privilege too.)
revoke insert, update, delete, truncate, references, trigger on public.rank_ledger from public, anon, authenticated;

-- Payments that arrived but could not be credited. Every row here is owed a refund.
create table public.late_payments (
  payment_ref text primary key,
  member_id uuid not null references public.members (id),
  amount_paise bigint not null check (amount_paise > 0),
  captured_at timestamptz,
  received_at timestamptz not null default now(),
  reason text not null check (reason in ('paid-after-close', 'arrived-after-settlement', 'no-open-season')),
  refunded_at timestamptz                          -- set by hand when the refund has been sent
);
alter table public.late_payments enable row level security;   -- no policies: invisible to the browser
revoke all on public.late_payments from public, anon, authenticated;

-- ---------- Table-level guard: runs for every ledger insert, whoever makes it ----------
create or replace function public.ledger_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.seasons; v_now timestamptz; v_last timestamptz; v_settle int;
begin
  select * into s from public.seasons where id = new.season_id for update;           -- 1. queue on the season
  if not found then raise exception 'Unknown season %', new.season_id using errcode = 'foreign_key_violation'; end if;
  v_now := clock_timestamp();                                                         -- 2. read the clock under the lock

  -- Owner-only import/test override: an owner connection may set bkp.ledger_clock = 'caller' and supply
  -- created_at itself. API connections (session user "authenticator") can never reach this branch.
  if coalesce(current_setting('bkp.ledger_clock', true), '') = 'caller' and session_user in ('postgres', 'supabase_admin') then
    if new.kind = 'credit' and (s.status <> 'open' or new.created_at < s.starts_at or new.created_at >= s.ends_at) then
      raise exception 'Season % is not open for credits', new.season_id using errcode = 'check_violation'; end if;
  else
    if new.captured_at is not null and new.captured_at > v_now + interval '2 minutes' then
      raise exception 'Capture time is in the future' using errcode = 'check_violation'; end if;
    select max(x.created_at) into v_last from public.rank_ledger x where x.season_id = s.id;
    if new.kind <> 'credit' then
      new.created_at := greatest(v_now, v_last + interval '1 microsecond');
    elsif s.status <> 'open' or v_now < s.starts_at then
      raise exception 'Season % is not open for credits', new.season_id using errcode = 'check_violation';
    elsif v_now < s.ends_at then
      -- 3a. normal: ledger time = now, and always later than every earlier row of the season
      new.created_at := greatest(v_now, v_last + interval '1 microsecond');
      if new.created_at >= s.ends_at then raise exception 'Season % is not open for credits', new.season_id using errcode = 'check_violation'; end if;
    else
      -- 3b. after the bell: only a payment verified as captured before it, inside the settling window
      select e.settle_seconds into v_settle from public.engine_settings e;
      if new.captured_at is null or new.captured_at >= s.ends_at or v_now >= s.ends_at + make_interval(secs => coalesce(v_settle, 0)) then
        raise exception 'Season % is not open for credits', new.season_id using errcode = 'check_violation'; end if;
      new.created_at := greatest(s.ends_at - interval '1 millisecond', coalesce(v_last, s.starts_at) + interval '1 microsecond');
      if new.created_at >= s.ends_at then raise exception 'Too many late credits to place before the close' using errcode = 'check_violation'; end if;
    end if;
  end if;

  if new.kind = 'credit'
     and not exists (select 1 from public.rank_ledger x where x.member_id = new.member_id and x.season_id = new.season_id)
     and new.rank_credit_paise < 100000 then
    raise exception 'Entering a season starts at ₹1,000' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------- Season clock: close only after the settling window, decided under the lock ----------
create or replace function public.season_tick(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare s record; v public.seasons; r record; v_settle interval;
begin
  select make_interval(secs => e.settle_seconds) into v_settle from public.engine_settings e;
  for s in select id from public.seasons where status = 'open' order by starts_at loop
    select * into v from public.seasons where id = s.id for update;                   -- wait for credits in flight
    if v.status = 'open' and v.ends_at + coalesce(v_settle, interval '0') <= p_now then
      perform public.close_season(v.id, p_now);
    end if;
  end loop;
  update public.seasons set status = 'open' where status = 'upcoming' and starts_at <= p_now and ends_at > p_now
    and not exists (select 1 from public.seasons o where o.status = 'open');
  for r in select id from public.throne_reigns where ended_at is null loop perform public.check_untouchable(r.id, p_now); end loop;
end $$;

-- ---------- The one way a settled payment becomes rank ----------
-- Called only by the payment backend after it has verified the provider's webhook signature.
-- Safe to call any number of times with the same reference.
--   outcome = recorded          credited now
--             already_recorded  this reference was credited before; nothing changed
--             late              could not be credited; quarantined in late_payments for a refund
create function public.record_credit(p_member uuid, p_amount_paise bigint, p_payment_ref text, p_captured_at timestamptz, p_actor text)
returns table (outcome text, ledger_id bigint, season_id int, recorded_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare s public.seasons; r public.rank_ledger; v_now timestamptz; v_settle int; v_reason text;
begin
  if p_member is null or p_actor is null or btrim(p_actor) = '' then raise exception 'Member and actor are required' using errcode = 'invalid_parameter_value'; end if;
  if p_payment_ref is null or btrim(p_payment_ref) = '' then raise exception 'A payment reference is required' using errcode = 'invalid_parameter_value'; end if;
  if p_captured_at is null then raise exception 'The verified capture time is required' using errcode = 'invalid_parameter_value'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 50000 <> 0 then raise exception 'Amounts go in steps of ₹500' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.members m where m.id = p_member) then raise exception 'Unknown member' using errcode = 'foreign_key_violation'; end if;
  if p_captured_at > clock_timestamp() + interval '2 minutes' then raise exception 'Capture time is in the future' using errcode = 'check_violation'; end if;

  -- One reference at a time, whatever happens next (two identical webhooks arriving together).
  perform pg_advisory_xact_lock(hashtextextended('bkp-payment:' || p_payment_ref, 7));
  select * into r from public.rank_ledger x where x.payment_ref = p_payment_ref;
  if found then
    if r.member_id <> p_member or r.rank_credit_paise <> p_amount_paise or r.kind <> 'credit' then
      raise exception 'Payment reference % was already used for a different credit', p_payment_ref using errcode = 'unique_violation'; end if;
    return query select 'already_recorded'::text, r.id, r.season_id, r.created_at; return;
  end if;
  if exists (select 1 from public.late_payments l where l.payment_ref = p_payment_ref) then
    return query select 'late'::text, null::bigint, null::int, null::timestamptz; return;
  end if;

  -- Decide under the season lock, so the answer cannot change before the row is written.
  select * into s from public.seasons where status = 'open' for update;
  v_now := clock_timestamp();
  select e.settle_seconds into v_settle from public.engine_settings e;
  v_reason := case
    when s.id is null or v_now < s.starts_at then 'no-open-season'
    when v_now >= s.ends_at and p_captured_at >= s.ends_at then 'paid-after-close'
    when v_now >= s.ends_at + make_interval(secs => coalesce(v_settle, 0)) then 'arrived-after-settlement'
  end;
  if v_reason is not null then
    insert into public.late_payments (payment_ref, member_id, amount_paise, captured_at, reason) values (p_payment_ref, p_member, p_amount_paise, p_captured_at, v_reason);
    return query select 'late'::text, null::bigint, s.id, null::timestamptz; return;
  end if;

  insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, captured_at)
    values (p_member, s.id, 'credit', p_amount_paise, p_payment_ref, p_actor, p_captured_at) returning * into r;
  return query select 'recorded'::text, r.id, r.season_id, r.created_at;
end $$;

-- ---------- Consistency check across all four board levels. One row per violation; none = consistent ----------
create function public.board_from_key(p_level text, p_key text) returns table (city text, locality text)
language sql stable security definer set search_path = '' as $$
  select case p_level when 'india' then null when 'state' then (select c.id from public.cities c where c.state_code = p_key order by c.id limit 1)
           when 'city' then p_key else split_part(p_key, '/', 1) end,
         case when p_level = 'locality' then substr(p_key, position('/' in p_key) + 1) end
$$;

create function public.ledger_invariants() returns table (problem text, detail text)
language sql stable security definer set search_path = '' as $$
  with boards as (   -- every board (level + key) that has ledger rows, per season
    select distinct x.season_id, lvl.level, public.board_scope_key(lvl.level, m.city_id, l.name) as scope_key
    from public.rank_ledger x join public.members m on m.id = x.member_id join public.localities l on l.id = m.locality_id
    cross join (values ('locality'), ('city'), ('state'), ('india')) lvl(level)
  ), live as (       -- the ledger's own answer for each board: now for an open season, at the close for a closed one
    select b.season_id, b.level, b.scope_key, s.status, rb.member_id, rb.rank
    from boards b join public.seasons s on s.id = b.season_id
    cross join lateral public.board_from_key(b.level, b.scope_key) k
    cross join lateral public.ranked_board_at(b.season_id, b.level, k.city, k.locality, case when s.status = 'closed' then s.ends_at else clock_timestamp() end) rb
  )
  select 'reign ends before it starts', t.id::text from public.throne_reigns t where t.ended_at < t.started_at
  union all
  select 'open reign in a closed season', t.level || ' ' || t.scope_key from public.throne_reigns t join public.seasons s on s.id = t.season_id where t.ended_at is null and s.status = 'closed'
  union all
  select 'credit recorded outside its season', x.id::text from public.rank_ledger x join public.seasons s on s.id = x.season_id
   where x.kind = 'credit' and (x.created_at < s.starts_at or x.created_at >= s.ends_at)
  union all
  select 'two ledger rows share one moment', x.season_id || ' @ ' || x.created_at from public.rank_ledger x group by x.season_id, x.created_at having count(*) > 1
  union all
  select 'credit captured after the close but credited', x.id::text from public.rank_ledger x join public.seasons s on s.id = x.season_id
   where x.captured_at is not null and x.captured_at >= s.ends_at
  union all
  select 'season end does not match its extensions', s.id::text from public.seasons s
   where s.ends_at <> least(s.scheduled_end + (select count(*) from public.season_extensions e where e.season_id = s.id) * interval '15 minutes', s.scheduled_end + interval '2 hours')
  union all   -- open season: the open reign of every board is that board's #01
  select 'open reign is not the board #01', t.level || ' ' || t.scope_key from public.throne_reigns t join public.seasons s on s.id = t.season_id and s.status = 'open'
   where t.ended_at is null and not exists (select 1 from live v where v.season_id = t.season_id and v.level = t.level and v.scope_key = t.scope_key and v.rank = 1 and v.member_id = t.member_id)
  union all   -- open season: every board with a #01 has an open reign
  select 'board has a #01 but no open reign', v.level || ' ' || v.scope_key from live v
   where v.status = 'open' and v.rank = 1 and not exists (select 1 from public.throne_reigns t where t.season_id = v.season_id and t.level = v.level and t.scope_key = v.scope_key and t.ended_at is null)
  union all   -- closed season: frozen results equal the ledger, in both directions, on every board
  select 'frozen result not supported by the ledger', r.season_id || ' ' || r.level || ' ' || r.scope_key || ' #' || r.final_rank from public.season_results r
   where not exists (select 1 from live v where v.season_id = r.season_id and v.level = r.level and v.scope_key = r.scope_key and v.member_id = r.member_id and v.rank = r.final_rank)
  union all
  select 'ledger rank missing from the frozen results', v.season_id || ' ' || v.level || ' ' || v.scope_key || ' #' || v.rank from live v
   where v.status = 'closed' and not exists (select 1 from public.season_results r where r.season_id = v.season_id and r.level = v.level and r.scope_key = v.scope_key and r.member_id = v.member_id and r.final_rank = v.rank)
  union all   -- every change of throne has exactly one reign starting at that moment, for that member
  select 'crown event without a matching reign', c.level || ' ' || c.scope_key from public.crown_events c
   where not exists (select 1 from public.throne_reigns t where t.season_id = c.season_id and t.level = c.level and t.scope_key = c.scope_key and t.member_id = c.to_member and t.started_at = c.at)
$$;

-- ---------- Who may run what ----------
-- Browser roles (anon, authenticated): nothing here. Only the service role, which exists solely on the
-- payment backend and is never shipped to a browser, may record a credit or run the consistency check.
revoke execute on function public.ledger_guard(), public.season_tick(timestamptz), public.board_from_key(text, text),
  public.record_credit(uuid, bigint, text, timestamptz, text), public.ledger_invariants() from public, anon, authenticated, service_role;
grant execute on function public.record_credit(uuid, bigint, text, timestamptz, text), public.ledger_invariants() to service_role;
grant select, insert, update on public.late_payments to service_role;

-- Rollback (the ledger must still be empty, or captured_at values are lost):
--   re-create ledger_guard() and season_tick() from supabase/migrations/20261110000400_season_engine.sql
--   drop function public.record_credit(uuid, bigint, text, timestamptz, text), public.ledger_invariants(), public.board_from_key(text, text);
--   drop table public.late_payments;  drop index public.rank_ledger_season_time_idx;
--   alter table public.rank_ledger drop column captured_at;  alter table public.engine_settings drop column settle_seconds;
--   grant insert, update, delete, truncate, references, trigger on public.rank_ledger to anon, authenticated;
