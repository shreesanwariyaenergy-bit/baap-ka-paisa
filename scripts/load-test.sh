#!/usr/bin/env bash
# Progressive load tests on a throwaway local Postgres (20,000 members, 60,000 ledger rows).
# Never touches the Supabase project. Numbers describe THIS machine; use them for relative bottlenecks.
set -uo pipefail
cd "$(dirname "$0")/.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}; D=$(mktemp -d /var/tmp/bkp-load.XXXXXX); PORT=${PG_TEST_PORT:-5547}
run() { if [ "$(id -u)" = 0 ]; then chown -R postgres "$D"; su postgres -c "$*"; else bash -c "$*"; fi; }
run "$BIN/initdb -D $D -A trust >/dev/null && $BIN/pg_ctl -D $D -o '-p $PORT -k /tmp -c max_connections=${MAXC:-60} -c shared_buffers=${SB:-224MB}' -l $D/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $D -m immediate stop >/dev/null"; rm -rf "$D"' EXIT
P="psql -q -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1"; B="$BIN/pgbench -h /tmp -p $PORT -U postgres -n bkp"
$P -c "create database bkp"; $P -d bkp -f supabase/tests/platform_stub.sql >/dev/null
for f in supabase/migrations/*.sql supabase/pending/*.sql; do [ -e "$f" ] && $P -d bkp -f "$f" >/dev/null; done
$P -d bkp -c "update public.registration_gate set mode = 'open'" >/dev/null
$P -d bkp -f supabase/tests/audit/perf.sql >/dev/null 2>&1
S=$(mktemp -d)
cat > $S/board.sql <<'SQL'
select count(*) from public.get_board('city', (array['surat','mumbai','pune','delhi','ahmedabad'])[1 + (random()*4)::int], null, 50, null);
SQL
cat > $S/home.sql <<'SQL'
\set c random(1, 5)
select count(*) from public.get_board('city', (array['surat','mumbai','pune','delhi','ahmedabad'])[:c], null, 10, null);
select count(*) from public.get_board('india', null, null, 10, null);
select count(*) from public.get_city_summaries();
select count(*) from public.get_season();
select count(*) from public.get_throne_history('city', (array['surat','mumbai','pune','delhi','ahmedabad'])[:c], null, null, 40);
SQL
cat > $S/profile.sql <<'SQL'
\set n random(1, 20000)
select count(*) from public.get_member('perf.' || :n);
select count(*) from public.get_standings('perf.' || :n);
SQL
cat > $S/register.sql <<'SQL'
\set n random(1, 2000000000)
begin;
with u as (insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), 'load' || :n || '@test.invalid', now()) returning id)
select set_config('request.jwt.claim.sub', id::text, true), set_config('request.jwt.claim.role', 'authenticated', true) from u;
select member_no from public.create_member('ld.' || :n, 'Load Tester', date '1990-01-01', 'mumbai', 'Bandra');
commit;
SQL
cat > $S/credit.sql <<'SQL'
\set n random(1, 20000)
\set r random(1, 2000000000)
select outcome from public.record_credit((select id from public.members where username = 'perf.' || :n), 50000, 'load-' || :r, clock_timestamp(), 'load');
SQL
bench() { # label script clients seconds-or-transactions flag
  out=$($B -f $S/$2.sql -c $3 -j 4 $5 $4 2>&1)
  echo "$1 | clients=$3 | $(echo "$out" | grep -E 'number of transactions actually|number of failed' | tr '\n' ' ' | sed -E 's/number of transactions actually processed: /done=/; s/number of failed transactions: /failed=/') | $(echo "$out" | grep -E '^tps' | sed -E 's/ \(.*//') | $(echo "$out" | grep 'latency average')"
}
echo "== READS (each transaction is one database call unless noted)"
for c in 10 50; do bench "city board top 50" board $c 10 -T; done
for c in 10 50; do bench "homepage read mix (5 calls)" home $c 10 -T; done
for c in 10 50; do bench "profile (2 calls)" profile $c 10 -T; done
echo "== REGISTRATIONS (account row + create_member)"
bench "5,000 registrations" register 50 100 -t
echo "duplicate profiles = $($P -d bkp -At -c "select count(*) - count(distinct id) from public.members") | duplicate usernames = $($P -d bkp -At -c "select count(*) - count(distinct username) from public.members") | duplicate member numbers = $($P -d bkp -At -c "select count(*) - count(distinct member_no) from public.members")"
echo "== RANK CREDITS (record_credit; every credit recomputes four boards under the season lock)"
bench "1,000 credits at once" credit 50 20 -t
echo "scores match ledger? $($P -d bkp -At -c "select coalesce(string_agg(distinct problem, chr(44)), chr(110)||chr(111)||chr(32)||chr(100)||chr(105)||chr(102)||chr(102)) from public.score_invariants()")"; echo "ledger consistent? $($P -d bkp -At -c "select coalesce(string_agg(distinct problem, ' | '), 'no violations') from public.ledger_invariants() where problem not like 'board has a #01%' and problem not like 'ledger rank%'") | duplicate payment refs = $($P -d bkp -At -c "select count(*) - count(distinct payment_ref) from public.rank_ledger")"
echo "== CONNECTION LIMIT: 100 clients against max_connections=${MAXC:-60}"
$B -f $S/board.sql -c 100 -j 4 -T 3 2>&1 | grep -E "too many|FATAL|tps" | head -2
