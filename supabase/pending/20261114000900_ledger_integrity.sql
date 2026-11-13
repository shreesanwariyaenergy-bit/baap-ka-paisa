-- PENDING REVIEW. Not applied to any database.
-- Ledger integrity (audit findings C1 and C2).
--
-- C1: effects were computed "as of" a row's created_at, which was the transaction's START time, so a
--     request that started first but finished last corrupted the throne record.
-- C2: "is the season open?" was checked before the season lock was taken, so a credit waiting behind
--     close_season() was saved into a closed season.
--
-- Fix, enforced at the table for every writer:
--   1. Every ledger insert first locks its season row. All writers and close_season() queue on it.
--   2. Only then is the row's time stamped, by the database clock. Time order = lock order = commit order.
--   3. The season is re-read under that lock: closed or past its end means the row is refused.
-- The caller can no longer choose created_at. The single exception is an owner connection (SQL editor,
-- migrations, the local test suite) that explicitly sets bkp.ledger_clock = 'caller' for a data import.
-- API roles connect as "authenticator" and can never use it.
--
-- This REPLACES the body of the existing function ledger_guard() (same trigger, same name). It changes no
-- table, column, policy or grant. Existing rows are untouched (the live ledger is empty).

create or replace function public.ledger_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.seasons; v_caller_clock boolean;
begin
  select * into s from public.seasons where id = new.season_id for update;          -- 1. queue on the season
  if not found then raise exception 'Unknown season %', new.season_id using errcode = 'foreign_key_violation'; end if;

  v_caller_clock := coalesce(current_setting('bkp.ledger_clock', true), '') = 'caller' and session_user in ('postgres', 'supabase_admin');
  if not v_caller_clock then new.created_at := clock_timestamp(); end if;            -- 2. stamp after the lock

  if new.kind = 'credit' then                                                        -- 3. validate under the lock
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
revoke execute on function public.ledger_guard() from public, anon, authenticated;

-- The one way application code records a settled payment. Safe to call twice with the same reference:
-- the second call changes nothing and reports already_recorded = true.
create function public.record_credit(p_member uuid, p_amount_paise bigint, p_payment_ref text, p_actor text)
returns table (ledger_id bigint, season_id int, recorded_at timestamptz, already_recorded boolean)
language plpgsql security definer set search_path = '' as $$
declare v_season int; r public.rank_ledger;
begin
  if p_member is null or p_actor is null or btrim(p_actor) = '' then raise exception 'Member and actor are required' using errcode = 'invalid_parameter_value'; end if;
  if p_payment_ref is null or btrim(p_payment_ref) = '' then raise exception 'A payment reference is required' using errcode = 'invalid_parameter_value'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 50000 <> 0 then
    raise exception 'Amounts go in steps of ₹500' using errcode = 'check_violation'; end if;
  loop
    select * into r from public.rank_ledger x where x.payment_ref = p_payment_ref;
    if found then
      if r.member_id <> p_member or r.rank_credit_paise <> p_amount_paise or r.kind <> 'credit' then
        raise exception 'Payment reference % was already used for a different credit', p_payment_ref using errcode = 'unique_violation'; end if;
      return query select r.id, r.season_id, r.created_at, true; return;
    end if;
    select s.id into v_season from public.seasons s where s.status = 'open';
    if v_season is null then raise exception 'No season is open for credits' using errcode = 'check_violation'; end if;
    begin
      insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor)
        values (p_member, v_season, 'credit', p_amount_paise, p_payment_ref, p_actor) returning * into r;
      return query select r.id, r.season_id, r.created_at, false; return;
    exception when unique_violation then null;   -- the same reference arrived twice at once: read it back
    end;
  end loop;
end $$;
revoke execute on function public.record_credit(uuid, bigint, text, text) from public, anon, authenticated;

-- Consistency check: everything derived must agree with the ledger. Returns one row per violation.
create function public.ledger_invariants() returns table (problem text, detail text)
language sql stable security definer set search_path = '' as $$
  select 'reign ends before it starts', t.id::text from public.throne_reigns t where t.ended_at < t.started_at
  union all
  select 'open reign in a closed season', t.id::text from public.throne_reigns t join public.seasons s on s.id = t.season_id where t.ended_at is null and s.status = 'closed'
  union all
  select 'credit recorded outside its season', x.id::text from public.rank_ledger x join public.seasons s on s.id = x.season_id
   where x.kind = 'credit' and (x.created_at < s.starts_at or x.created_at >= s.ends_at)
  union all
  select 'open city reign is not the board #01', t.scope_key from public.throne_reigns t join public.seasons s on s.id = t.season_id and s.status = 'open'
   where t.level = 'city' and t.ended_at is null
     and t.member_id is distinct from (select b.member_id from public.ranked_board_at(t.season_id, 'city', t.scope_key, null, clock_timestamp()) b where b.rank = 1)
  union all
  select 'frozen result differs from the ledger', r.season_id || '/' || r.scope_key || '/' || r.final_rank
   from public.season_results r join public.seasons s on s.id = r.season_id
   where r.level = 'city' and (r.member_id, r.final_rank) not in (select b.member_id, b.rank from public.ranked_board_at(r.season_id, 'city', r.scope_key, null, 'infinity') b)
$$;
revoke execute on function public.ledger_invariants() from public, anon, authenticated;

-- Rollback: re-create ledger_guard() from supabase/migrations/20261110000400_season_engine.sql, then
--   drop function public.record_credit(uuid, bigint, text, text), public.ledger_invariants();
