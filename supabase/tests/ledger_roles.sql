-- Who can run the ledger functions and write the ledger tables. Printed as a matrix, then proved by real calls.
\set ON_ERROR_STOP 1
\t on
select rpad('', 34) || string_agg(rpad(r, 15), '') from unnest(array['anon', 'authenticated', 'service_role', 'authenticator']) r;
select rpad(f.label, 34) || string_agg(rpad(case when has_function_privilege(r, f.sig, 'execute') then 'EXECUTE' else '-' end, 15), '' order by ord)
from (values ('record_credit()', 'public.record_credit(uuid,bigint,text,timestamptz,text)'), ('ledger_invariants()', 'public.ledger_invariants()'), ('ledger_guard()', 'public.ledger_guard()'),
             ('season_tick()', 'public.season_tick(timestamptz)'), ('season_clock()', 'public.season_clock(timestamptz)'), ('close_season()', 'public.close_season(int,timestamptz)'),
             ('schedule_season()', 'public.schedule_season(int,timestamptz,timestamptz)'), ('board_from_key()', 'public.board_from_key(text,text)')) f(label, sig),
     unnest(array['anon', 'authenticated', 'service_role', 'authenticator']) with ordinality r(r, ord) group by f.label order by f.label;
select rpad(t || ' ' || p, 34) || string_agg(rpad(case when has_table_privilege(r, 'public.' || t, p) then 'yes' else '-' end, 15), '' order by ord)
from unnest(array['rank_ledger', 'late_payments']) t, unnest(array['INSERT', 'UPDATE', 'DELETE', 'SELECT']) p, unnest(array['anon', 'authenticated', 'service_role', 'authenticator']) with ordinality r(r, ord) group by t, p order by t, p;
create function pg_temp.call_as(p_label text, p_role text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute 'set session authorization authenticator'; execute format('set role %I', p_role);
  perform set_config('request.jwt.claim.role', p_role, false);
  begin execute p_sql; v := 'ALLOWED'; exception when others then v := 'REFUSED (' || sqlerrm || ')'; end;
  reset role; reset session authorization; return rpad(p_label, 62) || v;
end $$;
\set rc 'select public.record_credit(''11111111-1111-1111-1111-111111111111'', 100000, %L, clock_timestamp(), ''role-test'')'
\set ins 'insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor) values (''11111111-1111-1111-1111-111111111111'', (select id from public.seasons order by id desc limit 1), ''credit'', 100000, %L, ''role-test'')'
select pg_temp.call_as('anon calls record_credit()', 'anon', format(:'rc', 'r-anon'));
select pg_temp.call_as('authenticated calls record_credit()', 'authenticated', format(:'rc', 'r-auth'));
select pg_temp.call_as('unknown role calls record_credit()', 'some_other_role', format(:'rc', 'r-other'));
select pg_temp.call_as('anon inserts into rank_ledger directly', 'anon', format(:'ins', 'i-anon'));
select pg_temp.call_as('authenticated inserts into rank_ledger directly', 'authenticated', format(:'ins', 'i-auth'));
select pg_temp.call_as('authenticated reads late_payments', 'authenticated', 'select * from public.late_payments');
select pg_temp.call_as('authenticated runs ledger_invariants()', 'authenticated', 'select * from public.ledger_invariants()');
select pg_temp.call_as('service_role calls record_credit() (no season open: quarantined)', 'service_role', format(:'rc', 'r-service'));
select pg_temp.call_as('service_role runs ledger_invariants()', 'service_role', 'select * from public.ledger_invariants()');
select pg_temp.call_as('service_role calls season_clock()', 'service_role', 'select public.season_clock()');
select 'rows written by these calls: ledger = ' || (select count(*) from public.rank_ledger where actor = 'role-test') || ', quarantine = ' || (select count(*) from public.late_payments where payment_ref like 'r-%');
