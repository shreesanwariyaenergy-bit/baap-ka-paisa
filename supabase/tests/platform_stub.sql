-- Local stand-in for the Supabase platform objects the migrations rely on.
do $r$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if; end $r$; do $r$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $r$; do $r$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if; end $r$;
create schema extensions; create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema public, auth, extensions to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
do $r$ begin if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if; end $r$; grant anon, authenticated, service_role to authenticator; alter role service_role bypassrls;
do $r$ begin if not exists (select 1 from pg_roles where rolname = 'some_other_role') then create role some_other_role nologin; end if; end $r$; grant some_other_role to authenticator; grant usage on schema public to some_other_role, service_role;
alter default privileges in schema public grant all on tables to service_role, some_other_role;
