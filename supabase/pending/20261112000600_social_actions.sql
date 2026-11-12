-- PENDING REVIEW. Not applied to any database.
-- Follows, Respect and rivals for signed-in members. Additive only: one new function, no table,
-- column, policy or grant on existing objects is changed or removed.
--
-- Members are addressed by their public name (username, or ANON label for a Mystery-mode member),
-- so a masked member's internal id and username are never needed by, or returned to, the browser.
-- Existing rules keep applying because they live on the tables:
--   * respects: primary key (giver, receiver, day) and trigger respects_day  -> one Respect per profile per IST day
--   * rivals:   trigger rivals_limit                                        -> at most 5 rivals
--   * all three: check constraints                                          -> never yourself

create function public.social_action(p_action text, p_target text)
returns table (following boolean, rival boolean, respected_today boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if not exists (select 1 from public.members m where m.id = v_uid) then
    raise exception 'Create your profile first' using errcode = 'no_data_found'; end if;
  if p_action not in ('state', 'follow', 'unfollow', 'respect', 'rival', 'unrival') then
    raise exception 'Unknown action' using errcode = 'invalid_parameter_value'; end if;

  select m.id into v_target from public.members m
   where (m.masked and m.anon_label = p_target) or (not m.masked and m.username = p_target::extensions.citext);
  if v_target is null then raise exception 'That member does not exist' using errcode = 'no_data_found'; end if;
  if v_target = v_uid then raise exception 'That is you' using errcode = 'check_violation'; end if;

  if p_action = 'follow' then
    insert into public.follows (follower, followee) values (v_uid, v_target) on conflict do nothing;
  elsif p_action = 'unfollow' then
    delete from public.follows f where f.follower = v_uid and f.followee = v_target;
  elsif p_action = 'respect' then
    if exists (select 1 from public.respects r where r.giver = v_uid and r.receiver = v_target and r.day = v_today) then
      raise exception 'You already gave Respect to this member today' using errcode = 'unique_violation'; end if;
    insert into public.respects (giver, receiver, day) values (v_uid, v_target, v_today);
  elsif p_action = 'rival' then
    if not exists (select 1 from public.rivals r where r.member_id = v_uid and r.rival_id = v_target) then
      insert into public.rivals (member_id, rival_id) values (v_uid, v_target);  -- rivals_limit trigger enforces 5
    end if;
  elsif p_action = 'unrival' then
    delete from public.rivals r where r.member_id = v_uid and r.rival_id = v_target;
  end if;

  return query select
    exists (select 1 from public.follows f where f.follower = v_uid and f.followee = v_target),
    exists (select 1 from public.rivals r where r.member_id = v_uid and r.rival_id = v_target),
    exists (select 1 from public.respects r where r.giver = v_uid and r.receiver = v_target and r.day = v_today);
end $$;

revoke execute on function public.social_action(text, text) from public, anon, authenticated;
grant execute on function public.social_action(text, text) to authenticated;

-- Rollback (removes the function; rows already written to follows / respects / rivals are kept):
--   drop function public.social_action(text, text);
