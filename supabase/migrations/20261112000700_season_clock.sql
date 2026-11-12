-- Applied 13 Nov 2026. Schedule lines below remain commented out: the clock is not running.
-- Season clock: configurable season dates, optional monthly rollover, and a one-minute schedule.
-- Additive only. Nothing here is callable from the browser (no grants to anon or authenticated).

-- One-row settings table. RLS on with no policies: invisible to anon and authenticated.
create table public.engine_settings (
  id boolean primary key default true check (id),
  auto_rollover boolean not null default false,   -- create next month's season automatically
  updated_at timestamptz not null default now()
);
alter table public.engine_settings enable row level security;
revoke all on public.engine_settings from public, anon, authenticated;
insert into public.engine_settings default values;

-- Create or re-date a season that has not opened yet. Open and closed seasons can never be re-dated.
create function public.schedule_season(p_id int, p_starts_at timestamptz, p_scheduled_end timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_scheduled_end <= p_starts_at then raise exception 'A season must end after it starts' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.seasons s where s.id <> p_id and s.starts_at < p_scheduled_end and s.scheduled_end > p_starts_at) then
    raise exception 'Season % would overlap another season', p_id using errcode = 'check_violation'; end if;
  if exists (select 1 from public.seasons s where s.id = p_id and s.status <> 'upcoming') then
    raise exception 'Season % has already opened and cannot be re-dated', p_id using errcode = 'check_violation'; end if;
  insert into public.seasons (id, starts_at, scheduled_end, ends_at, status)
    values (p_id, p_starts_at, p_scheduled_end, p_scheduled_end, 'upcoming')
  on conflict (id) do update set starts_at = excluded.starts_at, scheduled_end = excluded.scheduled_end, ends_at = excluded.ends_at;
end $$;

-- Monthly rollover: after the latest season, add the next calendar month
-- (1st 00:00 IST to last day 23:59 IST). Does nothing if a future season is already scheduled.
create function public.schedule_next_month(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare v_last public.seasons; v_start timestamptz; v_id int;
begin
  select * into v_last from public.seasons order by starts_at desc limit 1;
  if v_last.id is null or v_last.status = 'upcoming' then return null; end if;
  -- The month after the latest season, or the current month if the latest season ended long ago.
  v_start := greatest(
    (date_trunc('month', v_last.starts_at at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata',
    date_trunc('month', p_now at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
  v_id := v_last.id + 1;
  perform public.schedule_season(v_id, v_start, ((v_start at time zone 'Asia/Kolkata') + interval '1 month' - interval '1 minute') at time zone 'Asia/Kolkata');
  return v_id;
end $$;

-- What the schedule runs: the existing season_tick, then the rollover if it is switched on.
create function public.season_clock(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.season_tick(p_now);
  if (select e.auto_rollover from public.engine_settings e) then
    perform public.schedule_next_month(p_now);
    perform public.season_tick(p_now);
  end if;
end $$;

revoke execute on function public.schedule_season(int, timestamptz, timestamptz), public.schedule_next_month(timestamptz), public.season_clock(timestamptz)
  from public, anon, authenticated;

-- Schedule (Supabase pg_cron). Run these two statements only when the clock should start:
--   create extension if not exists pg_cron;
--   select cron.schedule('bkp-season-clock', '* * * * *', 'select public.season_clock()');
--   select cron.schedule('bkp-climbers', '5 18 * * 0', $$select public.award_climbers(date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' - interval '7 days')$$);
--
-- Rollback:
--   select cron.unschedule('bkp-season-clock'); select cron.unschedule('bkp-climbers');
--   drop function public.season_clock(timestamptz), public.schedule_next_month(timestamptz), public.schedule_season(int, timestamptz, timestamptz);
--   drop table public.engine_settings;
