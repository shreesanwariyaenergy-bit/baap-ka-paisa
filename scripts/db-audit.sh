#!/usr/bin/env bash
# Reproduces the integrity and performance findings in docs/AUDIT.md on a throwaway local Postgres.
# Uses real concurrent connections. Never touches the Supabase project.
set -uo pipefail
cd "$(dirname "$0")/.."
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}; D=$(mktemp -d /var/tmp/bkp-audit.XXXXXX); PORT=${PG_TEST_PORT:-5546}
run() { if [ "$(id -u)" = 0 ]; then chown -R postgres "$D"; su postgres -c "$*"; else bash -c "$*"; fi; }
run "$BIN/initdb -D $D -U postgres -A trust >/dev/null && $BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $D -m immediate stop >/dev/null"; rm -rf "$D"' EXIT
P="psql -q -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1"
$P -c "create database bkp"; $P -d bkp -f supabase/tests/platform_stub.sql
for f in supabase/migrations/*.sql supabase/pending/*.sql; do [ -e "$f" ] && $P -d bkp -f "$f" >/dev/null; done
$P -d bkp -f supabase/tests/audit/setup.sql >/dev/null
credit() { echo "select outcome from public.record_credit((select id from audit_ids where n=$1), $2, '$3', ${4:-clock_timestamp()}, 'audit')"; }
q() { $P -d bkp -At -c "$1"; }
scores() { echo "  running totals vs ledger after $1: $(q "select coalesce(string_agg(problem || ' ' || detail, '; '), 'identical') from public.score_invariants()")"; }
state() { $P -d bkp -At -c "select 'board #1 = member ' || (select a.n from public.ranked_board_at(1,'city','surat',null,now()) b join audit_ids a on a.id=b.member_id where b.rank=1) || ' | open reign = member ' || coalesce((select string_agg(a.n::text, ',') from public.throne_reigns t join audit_ids a on a.id=t.member_id where t.level='city' and t.ended_at is null), 'none') || ' | reigns ending before they start = ' || (select count(*) from public.throne_reigns where ended_at < started_at)"; }

echo "SOC Concurrent social actions as one signed-in member (separate connections)"
as1() { echo "set request.jwt.claim.sub = '$($P -d bkp -At -c "select id from audit_ids where n=1")'; set request.jwt.claim.role = 'authenticated'; set role authenticated; select * from public.social_action('$1', 'aud.$2');"; }
for t in 2 3 4 5; do $P -d bkp -c "$(as1 rival $t)" >/dev/null; done
for t in 6 7 8 9; do ( $P -d bkp -c "$(as1 rival $t)" >/dev/null 2>&1 & ); done
for i in 1 2 3 4 5 6; do ( $P -d bkp -c "$(as1 respect 2)" >/dev/null 2>&1 & ); done
for i in 1 2 3 4; do ( $P -d bkp -c "$(as1 follow 3)" >/dev/null 2>&1 & ); done
sleep 2
$P -d bkp -At -c "select 'rivals after 4 + 4 simultaneous requests = ' || (select count(*) from public.rivals r join audit_ids a on a.id = r.member_id where a.n = 1) || ' (limit 5) | Respect rows after 6 simultaneous requests = ' || (select count(*) from public.respects) || ' (limit 1) | follow rows after 4 simultaneous requests = ' || (select count(*) from public.follows) || ' (expected 1)'"
$P -d bkp -c "$(as1 respect 2)" 2>&1 | head -1
$P -d bkp -c "$(as1 unrival 2)" | tail -2 | head -1; $P -d bkp -c "$(as1 unfollow 3)" | tail -2 | head -1

echo "S1  Two members overtake the same holder at the same moment"
$P -d bkp -c "$(credit 1 500000 H)"
( $P -d bkp -c "begin; $(credit 2 600000 A); select pg_sleep(1.5); commit;" >/dev/null & ); sleep 0.4
$P -d bkp -c "$(credit 3 700000 B)"; sleep 2; state

echo "S1b A request that started first finishes last"
( $P -d bkp -c "begin; select now(); select pg_sleep(1.2); $(credit 4 800000 C); commit;" >/dev/null & ); sleep 0.5
$P -d bkp -c "$(credit 5 900000 D)"; sleep 1.5; state

scores "concurrent overtakes"
echo "S2  The same payment reference again (retry), then reused with a different amount"
echo "retry -> $(q "$(credit 2 600000 A)")"; $P -d bkp -c "$(credit 2 50000 A)" 2>&1 | head -1
( q "$(credit 7 100000 TWIN)" & q "$(credit 7 100000 TWIN)" & wait ) | sort | tr '\n' ' '; echo "<- two identical webhooks at the same instant | rows saved = $(q "select count(*) from public.rank_ledger where payment_ref='TWIN'")"

scores "duplicate webhooks"
echo "S3  The bell, the settling window and the close (window shortened to 3 seconds for the test)"
$P -d bkp -c "alter table public.seasons drop constraint if exists seasons_check1; update public.engine_settings set settle_seconds = 3; with t as (select clock_timestamp() + interval '2 seconds' as e) update public.seasons set scheduled_end = t.e, ends_at = t.e from t where id = 1"
PAID_FIRST=$(q "select quote_literal(clock_timestamp()) || '::timestamptz'"); sleep 0.4
BEFORE_BELL=$(q "select quote_literal(clock_timestamp()) || '::timestamptz'")
sleep 2.0
echo "paid SECOND before the bell, webhook arrives FIRST -> $(q "$(credit 8 100000 LATE-OK "$BEFORE_BELL")")"
echo "paid FIRST before the bell, webhook arrives SECOND -> $(q "$(credit 9 100000 LATE-EARLIER "$PAID_FIRST")")"
echo "  order on the board (same score): $(q "select string_agg('member ' || a.n, ' above ' order by b.rank) from public.ranked_board_at(1,'india',null,null,'infinity') b join audit_ids a on a.id = b.member_id where a.n in (8,9)")"
echo "paid after the bell                              -> $(q "$(credit 9 100000 TOO-LATE)")"
echo "forged capture time one hour in the future       -> $($P -d bkp -c "$(credit 9 100000 FORGED "clock_timestamp() + interval '1 hour'")" 2>&1 | head -1)"
echo "direct ledger insert with a back-dated created_at -> created_at kept by caller? $(q "insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, payment_ref, actor, created_at, captured_at) select id, 1, 'credit', 100000, 'BACKDATE', 'audit', now() - interval '5 days', $BEFORE_BELL from audit_ids where n=5 returning (created_at < now() - interval '1 day')" | head -1)"
( $P -d bkp -c "begin; $(credit 5 50000 IN-FLIGHT "$BEFORE_BELL"); select pg_sleep(2.2); commit;" >/dev/null 2>&1 & ); sleep 0.3
echo "season after the bell, inside the window          -> $(q "select public.season_clock(); select status from public.seasons where id=1" | tail -1)"
sleep 2.6; q "select public.season_clock()" >/dev/null     # this tick must wait for the in-flight credit, then close
echo "paid before the bell, webhook after the close    -> $(q "$(credit 8 100000 AFTER-CLOSE "$BEFORE_BELL")")"
echo "retry of a quarantined payment                   -> $(q "$(credit 8 100000 AFTER-CLOSE "$BEFORE_BELL")")"
q "select 'season ' || (select status from public.seasons where id=1) || ' | late credits counted in the frozen results = ' || (select count(*) from public.season_results r join public.rank_ledger x on x.member_id = r.member_id and x.payment_ref in ('LATE-OK','LATE-EARLIER','IN-FLIGHT','BACKDATE') where r.season_id=1 and r.level='india') || ' of 4 rows | their ledger times before the bell = ' || (select bool_and(x.created_at < s.ends_at) from public.rank_ledger x join public.seasons s on s.id = x.season_id where x.payment_ref in ('LATE-OK','LATE-EARLIER','IN-FLIGHT','BACKDATE')) || ' | quarantined = ' || (select string_agg(payment_ref || ':' || reason, ', ' order by payment_ref) from public.late_payments) || ' | extensions = ' || (select count(*) from public.season_extensions where season_id = 1)"

scores "late payments and season closure"
echo "S4  A late webhook that is an overtake in the last 15 minutes"
q "select public.schedule_season(2, clock_timestamp(), clock_timestamp() + interval '3 seconds')" >/dev/null; sleep 0.1; q "select public.season_clock()" >/dev/null
q "$(credit 1 500000 S4-H)" >/dev/null; q "$(credit 2 300000 S4-C)" >/dev/null
BEFORE_BELL=$(q "select quote_literal(clock_timestamp()) || '::timestamptz'"); sleep 3.3
echo "overtake paid before the bell, webhook after it  -> $(q "$(credit 2 250000 S4-TAKE "$BEFORE_BELL")")"
q "select 'season ' || status || ' | extended by ' || extract(epoch from ends_at - scheduled_end) / 60 || ' min | #01 = member ' || (select a.n from public.ranked_board_at(2,'city','surat',null,clock_timestamp()) b join audit_ids a on a.id=b.member_id where b.rank=1) from public.seasons where id = 2"
echo "a normal credit during the extension             -> $(q "$(credit 1 100000 S4-REPLY)")"

scores "late overtake and extension"
echo "S4b A refund: the holder's payment is reversed with a compensating row"
q "insert into public.rank_ledger (member_id, season_id, kind, rank_credit_paise, reason, actor) select id, 2, 'reversal', -250000, 'refund of S4-TAKE', 'audit' from audit_ids where n=2" >/dev/null
q "select '#01 after the refund = member ' || (select a.n from public.ranked_board_at(2,'city','surat',null,clock_timestamp()) b join audit_ids a on a.id=b.member_id where b.rank=1) || ' | open reign = member ' || (select a.n from public.throne_reigns t join audit_ids a on a.id=t.member_id where t.season_id=2 and t.level='city' and t.ended_at is null) || ' | member 2 score now = ' || (select score_paise/100 from public.season_scores s join audit_ids a on a.id=s.member_id where s.season_id=2 and a.n=2) || ' | original row untouched = ' || (select count(*) from public.rank_ledger where payment_ref='S4-TAKE' and rank_credit_paise=250000)"
scores "a refund"
echo "S5  Two payments for the same score, delivered in reverse order (season still running)"
PAID_FIRST=$(q "select quote_literal(clock_timestamp()) || '::timestamptz'"); sleep 0.3; PAID_SECOND=$(q "select quote_literal(clock_timestamp()) || '::timestamptz'")
echo "member 4 paid second, webhook first -> $(q "$(credit 4 650000 S5-B "$PAID_SECOND")") | member 3 paid first, webhook second -> $(q "$(credit 3 650000 S5-A "$PAID_FIRST")")"
q "select '#01 = member ' || (select a.n from public.ranked_board_at(2,'city','surat',null,clock_timestamp()) b join audit_ids a on a.id=b.member_id where b.rank=1) || ' | #02 = member ' || (select a.n from public.ranked_board_at(2,'city','surat',null,clock_timestamp()) b join audit_ids a on a.id=b.member_id where b.rank=2) || ' | throne changes in this season = ' || (select count(*) from public.crown_events where season_id=2 and level='city') || ' | season extended by ' || round(extract(epoch from ends_at - scheduled_end) / 60) || ' min' from public.seasons where id = 2"
q "update public.engine_settings set settle_seconds = 0; select public.season_clock((select ends_at + interval '1 second' from public.seasons where id = 2))" >/dev/null

q "select public.schedule_season(3, clock_timestamp(), clock_timestamp() + interval '1 day')" >/dev/null; sleep 0.1; q "select public.season_clock()" >/dev/null
echo "STRESS 60 credits from 12 connections in random start and finish order, plus retries of the same references"
for w in 1 2 3 4 5 6 7 8 9 10 11 12; do (
  for k in 1 2 3 4 5; do
    n=$(( (RANDOM % 9) + 1 )); ref="st-$w-$k"; amt=$(( ((RANDOM % 6) + 2) * 50000 ))
    $P -d bkp -c "begin; select pg_sleep(random() * 0.3); select 1 from public.record_credit((select id from audit_ids where n=$n), $amt, '$ref', clock_timestamp(), 'stress'); select pg_sleep(random() * 0.3); commit;" >/dev/null 2>&1
    $P -d bkp -c "select 1 from public.record_credit((select id from audit_ids where n=$n), $amt, '$ref', clock_timestamp(), 'stress')" >/dev/null 2>&1
  done ) & done; wait
$P -d bkp -At -c "select 'stress credits saved = ' || (select count(*) from public.rank_ledger where actor = 'stress') || ' (expected 60) | out-of-order timestamps = ' || (select count(*) from (select created_at, lag(created_at) over (order by id) as prev from public.rank_ledger where season_id = 3 and actor = 'stress') q where created_at < prev) "
q "update public.engine_settings set settle_seconds = 0; select public.season_clock((select ends_at + interval '1 second' from public.seasons where id = 3))" >/dev/null

scores "stress and second closure"
echo "INV Consistency check over all three seasons and all four board levels (none = consistent)"
$P -d bkp -At -c "select coalesce(string_agg(problem || ': ' || detail, ' | '), 'no violations') from public.ledger_invariants()"

echo "INV-SELFTEST Deliberate damage at each level (local copy only) must be detected"
q "begin;
   update public.throne_reigns set member_id = (select id from audit_ids where n = 9) where id = (select min(id) from public.throne_reigns where season_id = 2 and level = 'locality' and ended_at is not null);
   alter table public.season_results disable trigger all;
   update public.season_results set final_rank = final_rank + 50 where season_id = 1 and level = 'state' and final_rank = 1;
   delete from public.season_results where season_id = 1 and level = 'india' and final_rank = 2;
   update public.throne_reigns set ended_at = null, end_reason = null where id = (select max(id) from public.throne_reigns where season_id = 1 and level = 'city');
   select string_agg(distinct problem, ' | ' order by problem) from public.ledger_invariants();
   rollback;" | tail -1

echo "PERF 20,000 members, 60,000 ledger rows"
$P -d bkp -f supabase/tests/audit/perf.sql 2>&1 | grep -E "^==|Time:"

