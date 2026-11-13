-- PENDING REVIEW. Not applied to any database.
-- Registration gate inside the database. Today the "registration closed" switch lives only in the
-- web app: anyone can call Supabase Auth sign-up directly with the public key, confirm the email, and
-- call create_member() themselves. This makes the database refuse them.
--
-- registration_gate.mode:  closed    - nobody can create a member profile (default)
--                          allowlist - only emails listed in registration_allowlist
--                          open      - any confirmed account (public launch)

create table public.registration_gate (
  id boolean primary key default true check (id),
  mode text not null default 'closed' check (mode in ('closed', 'allowlist', 'open')),
  updated_at timestamptz not null default now()
);
create table public.registration_allowlist (
  email text primary key check (email = lower(btrim(email))),   -- always stored in lower case
  note text,
  added_at timestamptz not null default now()
);
alter table public.registration_gate enable row level security;       -- no policies: invisible to the browser
alter table public.registration_allowlist enable row level security;  -- no policies: invisible to the browser
revoke all on public.registration_gate, public.registration_allowlist from public, anon, authenticated;
insert into public.registration_gate default values;

-- True when the signed-in account may create a member profile right now.
create function public.registration_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select case (select g.mode from public.registration_gate g)
    when 'open' then auth.uid() is not null
    when 'allowlist' then exists (
      select 1 from auth.users u join public.registration_allowlist a on a.email = lower(u.email)
      where u.id = auth.uid() and u.email_confirmed_at is not null)
    else false end
$$;

-- Runs before every new member row, whichever function or role inserts it.
--   * A browser request (role anon or authenticated) may only create the profile of the account it is
--     signed in as, and only when the gate allows that account.
--   * The service role and a direct owner connection (SQL editor, migrations) are administrative: they
--     are not held to the gate. They are never reachable with the publishable key.
create function public.enforce_registration_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_role text := coalesce(auth.role(), '');
begin
  if v_role not in ('anon', 'authenticated') and v_uid is null then
    return new;                                                    -- administrative insert
  end if;
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if new.id is distinct from v_uid then
    raise exception 'A profile can only be created for the signed-in account' using errcode = 'insufficient_privilege';
  end if;
  if not public.registration_allowed() then
    raise exception 'Registration is not open' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger members_registration_gate before insert on public.members
  for each row execute function public.enforce_registration_gate();

revoke execute on function public.registration_allowed(), public.enforce_registration_gate() from public, anon, authenticated;
grant execute on function public.registration_allowed() to authenticated;  -- lets the app show "you are on the list"

-- Operating it (SQL editor, as the project owner):
--   update public.registration_gate set mode = 'allowlist', updated_at = now();
--   insert into public.registration_allowlist (email, note) values ('tester@example.com', 'internal tester');
--
-- Rollback:
--   drop trigger members_registration_gate on public.members;
--   drop function public.enforce_registration_gate(), public.registration_allowed();
--   drop table public.registration_allowlist, public.registration_gate;
