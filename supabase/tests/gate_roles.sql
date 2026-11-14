-- Role-by-role behaviour of the registration gate. Each case connects the way that role really does:
-- API roles as session user "authenticator" switching to their role; the owner as "postgres".
\set ON_ERROR_STOP 1
set bkp.ledger_clock = 'caller';
update public.registration_gate set mode = 'allowlist';
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'listed@test.invalid', now()), ('22222222-2222-2222-2222-222222222222', 'unlisted@test.invalid', now()),
  ('33333333-3333-3333-3333-333333333333', 'victim@test.invalid', now()), ('44444444-4444-4444-4444-444444444444', 'svc@test.invalid', now()),
  ('55555555-5555-5555-5555-555555555555', 'owner@test.invalid', now());
insert into public.registration_allowlist (email) values ('listed@test.invalid');
create function pg_temp.try(p_label text, p_session text, p_role text, p_jwt_role text, p_sub text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute format('set session authorization %I', p_session);
  if p_role is not null then execute format('set role %I', p_role); end if;
  perform set_config('request.jwt.claim.role', coalesce(p_jwt_role, ''), false); perform set_config('request.jwt.claim.sub', coalesce(p_sub, ''), false);
  begin execute p_sql; v := 'ALLOWED'; exception when others then v := 'REFUSED (' || sqlerrm || ')'; end;
  reset role; reset session authorization;
  return rpad(p_label, 62) || v;
end $$;
\set ins 'insert into public.members (id, username, display_name, city_id, locality_id) select %L, %L, ''Role Test'', ''surat'', (select id from public.localities where city_id = ''surat'' limit 1)'
\t on
select pg_temp.try('anon (API, no session), direct insert', 'authenticator', 'anon', 'anon', null, format(:'ins', '22222222-2222-2222-2222-222222222222', 'rt.anon'));
select pg_temp.try('API connection with no role claim, via create_member', 'authenticator', 'authenticated', null, '11111111-1111-1111-1111-111111111111', $$select public.create_member('rt.norole', 'Role Test', date '1990-01-01', 'surat', 'Vesu')$$);
select pg_temp.try('unknown role, direct insert', 'authenticator', 'some_other_role', 'some_other_role', null, format(:'ins', '22222222-2222-2222-2222-222222222222', 'rt.unknown'));
select pg_temp.try('unknown JWT role claiming a member id', 'authenticator', 'some_other_role', 'admin', '11111111-1111-1111-1111-111111111111', format(:'ins', '11111111-1111-1111-1111-111111111111', 'rt.fakeadmin'));
select pg_temp.try('authenticated, NOT on the allow-list, create_member', 'authenticator', 'authenticated', 'authenticated', '22222222-2222-2222-2222-222222222222', $$select public.create_member('rt.unlisted', 'Role Test', date '1990-01-01', 'surat', 'Vesu')$$);
select pg_temp.try('authenticated + allow-listed, direct insert for ANOTHER id', 'authenticator', 'authenticated', 'authenticated', '11111111-1111-1111-1111-111111111111', format(:'ins', '33333333-3333-3333-3333-333333333333', 'rt.stolen'));
select pg_temp.try('authenticated + allow-listed, direct insert for OWN id', 'authenticator', 'authenticated', 'authenticated', '11111111-1111-1111-1111-111111111111', format(:'ins', '11111111-1111-1111-1111-111111111111', 'rt.direct'));
select pg_temp.try('authenticated + allow-listed, create_member (the real path)', 'authenticator', 'authenticated', 'authenticated', '11111111-1111-1111-1111-111111111111', $$select public.create_member('rt.listed', 'Role Test', date '1990-01-01', 'surat', 'Vesu')$$);
select pg_temp.try('service role (API, service key), direct insert', 'authenticator', 'service_role', 'service_role', null, format(:'ins', '44444444-4444-4444-4444-444444444444', 'rt.service'));
select pg_temp.try('owner connection (postgres, no API request), direct insert', 'postgres', null, null, null, format(:'ins', '55555555-5555-5555-5555-555555555555', 'rt.owner'));
select pg_temp.try('owner connection but with a forged authenticated claim', 'postgres', null, 'authenticated', '22222222-2222-2222-2222-222222222222', format(:'ins', '22222222-2222-2222-2222-222222222222', 'rt.forged'));
select 'members created: ' || string_agg(username::text, ', ' order by username::text) from public.members where username::text like 'rt.%';
