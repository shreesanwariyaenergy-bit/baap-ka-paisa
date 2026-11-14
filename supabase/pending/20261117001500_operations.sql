-- Operations: season-clock heartbeat, integrity checks on a schedule, an alert log and a public health probe.
-- Depends on 20261112000700_season_clock (applied), 20261114000900_ledger_integrity and 20261116001200_season_scores.
-- Additive: one column, one table, three functions. Nothing changes how ranks are computed.
--
-- Schedule (Supabase pg_cron). Run only when the clock should start (production needs separate approval):
--   create extension if not exists pg_cron;
--   select cron.schedule('bkp-season-clock', '* * * * *', 'select public.season_clock()');
--   select cron.schedule('bkp-checks', '*/5 * * * *', 'select public.run_checks()');
--
-- Rollback:
--   select cron.unschedule('bkp-checks');
--   drop function public.get_health(), public.run_checks(timestamptz);
--   drop table public.ops_alerts;
--   re-run season_clock() from 20261112000700_season_clock.sql;
--   alter table public.engine_settings drop column clock_last_run;

alter table public.engine_settings add column clock_last_run timestamptz;

-- The clock records when it last ran, so a stopped schedule is visible.
create or replace function public.season_clock(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.season_tick(p_now);
  if (select e.auto_rollover from public.engine_settings e) then
    perform public.schedule_next_month(p_now);
    perform public.season_tick(p_now);
  end if;
  update public.engine_settings set clock_last_run = clock_timestamp();
end $$;
revoke execute on function public.season_clock(timestamptz) from public, anon, authenticated;

-- Alert log. Readable and writable by the service role and owner only.
create table public.ops_alerts (
  id bigint generated always as identity primary key,
  raised_at timestamptz not null default now(),
  kind text not null check (kind in ('ledger', 'scores', 'missed-close', 'clock-stopped')),
  detail text not null,
  resolved_at timestamptz
);
create unique index ops_alerts_open_once on public.ops_alerts (kind, detail) where resolved_at is null;
alter table public.ops_alerts enable row level security;
revoke all on public.ops_alerts from public, anon, authenticated;

-- Runs every check, raises each problem once while it lasts, and resolves alerts whose problem has gone.
-- Returns the number of open alerts.
create or replace function public.run_checks(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare v_settle interval; v_found text[] := '{}'; r record; v_key text;
begin
  select make_interval(secs => coalesce(e.settle_seconds, 0)) into v_settle from public.engine_settings e;
  if to_regclass('pg_temp.bkp_found') is null then create temp table bkp_found (kind text, detail text) on commit drop; end if;
  truncate pg_temp.bkp_found;
  insert into pg_temp.bkp_found select 'ledger', left(i.problem || ': ' || coalesce(i.detail, ''), 300) from public.ledger_invariants() i;
  insert into pg_temp.bkp_found select 'scores', left(i.problem || ': ' || coalesce(i.detail::text, ''), 300) from public.score_invariants() i;
  -- A season still open well after its close plus the settling window: the clock did not close it.
  insert into pg_temp.bkp_found select 'missed-close', 'season ' || s.id || ' still open, due ' || to_char(s.ends_at + v_settle, 'YYYY-MM-DD HH24:MI TZ')
    from public.seasons s where s.status = 'open' and s.ends_at + v_settle + interval '15 minutes' < p_now;
  -- The clock should run every minute while a season is open or scheduled.
  insert into pg_temp.bkp_found select 'clock-stopped', 'season clock last ran ' || coalesce(to_char(e.clock_last_run, 'YYYY-MM-DD HH24:MI TZ'), 'never')
    from public.engine_settings e
   where (e.clock_last_run is null or e.clock_last_run < p_now - interval '5 minutes')
     and exists (select 1 from public.seasons s where s.status in ('open', 'upcoming'));
  insert into public.ops_alerts (kind, detail, raised_at)
    select distinct f.kind, f.detail, p_now from pg_temp.bkp_found f
    where not exists (select 1 from public.ops_alerts a where a.kind = f.kind and a.detail = f.detail and a.resolved_at is null);
  update public.ops_alerts a set resolved_at = p_now
   where a.resolved_at is null and not exists (select 1 from pg_temp.bkp_found f where f.kind = a.kind and f.detail = a.detail);
  return (select count(*) from public.ops_alerts where resolved_at is null);
end $$;
revoke execute on function public.run_checks(timestamptz) from public, anon, authenticated;

-- Public health probe. Says only whether the system is healthy; no alert details, no member data.
create or replace function public.get_health() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'database', 'ok',
    'season', (select jsonb_build_object('id', s.id, 'status', s.status, 'ends_at', s.ends_at)
                 from public.seasons s where s.status = 'open' order by s.starts_at limit 1),
    'clock_age_seconds', (select extract(epoch from now() - e.clock_last_run)::int from public.engine_settings e),
    'healthy', not exists (select 1 from public.ops_alerts a where a.resolved_at is null),
    'checked_at', now());
$$;
revoke execute on function public.get_health() from public;
grant execute on function public.get_health() to anon, authenticated;
