-- Audit fixture: an open season and N test members (local throwaway database only).
update public.registration_gate set mode = 'open';
select public.schedule_season(1, now() - interval '10 days', now() + interval '10 days');
select public.season_clock();
create table audit_ids (n int primary key, id uuid);
do $$ declare i int; u uuid; begin
  for i in 1..9 loop
    insert into auth.users (email, email_confirmed_at) values ('a' || i || '@test.invalid', now()) returning id into u;
    perform set_config('request.jwt.claim.sub', u::text, true);
    perform public.create_member('aud.' || i, 'Audit ' || i, date '1990-01-01', 'surat', 'Vesu');
    insert into audit_ids values (i, u);
  end loop;
end $$;
