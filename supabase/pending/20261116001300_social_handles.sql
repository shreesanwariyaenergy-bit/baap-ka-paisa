-- PENDING REVIEW. Not applied to any database.
-- Social handles on profiles. New objects only: one table and two functions. Nothing existing is changed.
-- A member chooses who sees their handles: everyone, only members who follow them, or nobody (default).
-- Handles are never shown for a member in Mystery mode. They are shown as written: nothing verifies them.

create table public.member_socials (
  member_id uuid primary key references public.members (id) on delete cascade,
  instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  snapchat text check (snapchat ~ '^[A-Za-z0-9._-]{1,30}$'),
  visibility text not null default 'nobody' check (visibility in ('everyone', 'followers', 'nobody')),
  updated_at timestamptz not null default now()
);
alter table public.member_socials enable row level security;     -- no policies: reached only through the functions below
revoke all on public.member_socials from public, anon, authenticated;

create function public.set_my_socials(p_instagram text, p_snapchat text, p_visibility text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ig text := nullif(btrim(coalesce(p_instagram, ''), ' @'), ''); v_sc text := nullif(btrim(coalesce(p_snapchat, ''), ' @'), '');
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if not exists (select 1 from public.members m where m.id = v_uid) then raise exception 'Create your profile first' using errcode = 'no_data_found'; end if;
  if p_visibility is null or p_visibility not in ('everyone', 'followers', 'nobody') then raise exception 'Choose who can see your socials' using errcode = 'invalid_parameter_value'; end if;
  if v_ig is not null and v_ig !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'Instagram handles use letters, numbers, dots and underscores' using errcode = 'check_violation'; end if;
  if v_sc is not null and v_sc !~ '^[A-Za-z0-9._-]{1,30}$' then raise exception 'Snapchat handles use letters, numbers, dots, hyphens and underscores' using errcode = 'check_violation'; end if;
  insert into public.member_socials (member_id, instagram, snapchat, visibility) values (v_uid, v_ig, v_sc, p_visibility)
  on conflict (member_id) do update set instagram = excluded.instagram, snapchat = excluded.snapchat, visibility = excluded.visibility, updated_at = now();
end $$;

-- Handles the CALLER is allowed to see for one member. The owner always sees their own (with the setting).
create function public.get_socials(p_name text) returns table (instagram text, snapchat text, visibility text, is_self boolean)
language sql stable security definer set search_path = '' as $$
  select s.instagram, s.snapchat, case when m.id = auth.uid() then s.visibility end, m.id = auth.uid()
  from public.members m join public.member_socials s on s.member_id = m.id
  where ((m.masked and m.anon_label = p_name) or (not m.masked and m.username = p_name::extensions.citext))
    and (m.id = auth.uid()
      or (not m.masked and (s.visibility = 'everyone'
        or (s.visibility = 'followers' and exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = m.id)))))
$$;

revoke execute on function public.set_my_socials(text, text, text), public.get_socials(text) from public, anon, authenticated;
grant execute on function public.get_socials(text) to anon, authenticated;
grant execute on function public.set_my_socials(text, text, text) to authenticated;

-- Rollback: drop function public.get_socials(text), public.set_my_socials(text, text, text); drop table public.member_socials;
