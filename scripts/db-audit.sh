#!/usr/bin/env bash
# Reproduces the integrity and performance findings in docs/AUDIT.md on a throwaway local Postgres.
# Uses real concurrent connections. Never touches the Supabase project.
set -uo pipefail
cd "$(dirname "$0")/.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}; D=$(mktemp -d /var/tmp/bkp-audit.XXXXXX); PORT=${PG_TEST_PORT:-5546}
run() { if [ "$(id -u)" = 0 ]; then chown -R postgres "$D"; su postgres -c "$*"; else bash -c "$*"; fi; }
run "$BIN/initdb -D $D -A trust >/dev/null && $BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $D -m immediate stop >/dev/null"; rm -rf "$D"' EXIT
P="psql -q -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1"
$P -c "create database bkp"; $P -d bkp -f supabase/tests/platform_stub.sql
for f in supabase/migrations/*.sql supabase/pending/*.sql; do [ -e "$f" ] && $P -d bkp -f "$f" >/dev/null; done
$P -d bkp -f supabase/tests/audit/setup.sql >/dev/null
credit() { echo "insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor) select id, 1, 'credit', $2, '$3', 'audit' from audit_ids where n=$1"; }
state() { $P -d bkp -At -c "select 'board #1 = member ' || (select a.n from public.ranked_board_at(1,'city','surat',null,now()) b join audit_ids a on a.id=b.member_id where b.rank=1) || ' | open reign = member ' || coalesce((select string_agg(a.n::text, ',') from public.throne_reigns t join audit_ids a on a.id=t.member_id where t.level='city' and t.ended_at is null), 'none') || ' | reigns ending before they start = ' || (select count(*) from public.throne_reigns where ended_at < started_at)"; }

echo "S1  Two members overtake the same holder at the same moment"
$P -d bkp -c "$(credit 1 500000 H)"
( $P -d bkp -c "begin; $(credit 2 600000 A); select pg_sleep(1.5); commit;" >/dev/null & ); sleep 0.4
$P -d bkp -c "$(credit 3 700000 B)"; sleep 2; state

echo "S1b A request that started first finishes last"
( $P -d bkp -c "begin; select now(); select pg_sleep(1.2); $(credit 4 800000 C); commit;" >/dev/null & ); sleep 0.5
$P -d bkp -c "$(credit 5 900000 D)"; sleep 1.5; state

echo "S2  The same payment reference twice"
$P -d bkp -c "$(credit 2 50000 A)" 2>&1 | head -1

echo "S3  The season closes while a credit is in flight"
$P -d bkp -c "alter table public.seasons drop constraint if exists seasons_check1; update public.seasons set scheduled_end = now() + interval '2 seconds', ends_at = now() + interval '2 seconds' where id = 1"
( $P -d bkp -c "begin; select now(); select pg_sleep(3.2); $(credit 6 5000000 IN-FLIGHT); commit;" >/dev/null 2>&1 & ); sleep 2.6
$P -d bkp -c "begin; select public.season_clock(); select pg_sleep(1.5); commit;" >/dev/null; sleep 1.5
$P -d bkp -At -c "select 'season ' || (select status from public.seasons where id=1) || ' | late credit saved = ' || (select count(*) from public.rank_ledger where payment_ref='IN-FLIGHT') || ' | frozen #1 = member ' || (select a.n from public.season_results r join audit_ids a on a.id=r.member_id where r.season_id=1 and r.level='city' and r.final_rank=1) || ' | live board #1 = member ' || (select a.n from public.ranked_board_at(1,'city','surat',null,now()) b join audit_ids a on a.id=b.member_id where b.rank=1) || ' | reigns still open after close = ' || (select count(*) from public.throne_reigns where season_id=1 and ended_at is null)"

echo "PERF 20,000 members, 60,000 ledger rows"
$P -d bkp -f supabase/tests/audit/perf.sql 2>&1 | grep -E "^==|Time:"
