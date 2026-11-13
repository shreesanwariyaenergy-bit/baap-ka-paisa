-- Local stand-in for the Supabase platform objects the migrations rely on.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema extensions; create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema public, auth, extensions to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator; alter role service_role bypassrls;
create role some_other_role nologin; grant some_other_role to authenticator; grant usage on schema public to some_other_role, service_role;
alter default privileges in schema public grant all on tables to service_role, some_other_role;
