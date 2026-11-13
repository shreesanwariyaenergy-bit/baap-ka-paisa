#!/usr/bin/env bash
# Loads every migration (applied and pending) into a throwaway local Postgres and runs the lifecycle test.
# Needs a local Postgres 16 install; never touches the Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}; D=$(mktemp -d /var/tmp/bkp-pg.XXXXXX); PORT=${PG_TEST_PORT:-5545}
run() { if [ "$(id -u)" = 0 ]; then chown -R postgres "$D"; su postgres -c "$*"; else bash -c "$*"; fi; }
run "$BIN/initdb -D $D -A trust >/dev/null && $BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $D -m immediate stop >/dev/null"; rm -rf "$D"' EXIT
P="psql -q -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1"
$P -c "create database bkp"
$P -d bkp -f supabase/tests/platform_stub.sql
for f in supabase/migrations/*.sql supabase/pending/*.sql; do [ -e "$f" ] && $P -d bkp -f "$f" >/dev/null; done
$P -d bkp -f supabase/tests/lifecycle.sql 2>&1 | grep -E "NOTICE|ERROR|ASSERT|CONTEXT|EXECUTE" || true
echo "--- registration gate, role by role"
$P -d bkp -f supabase/tests/gate_roles.sql 2>&1 | grep -vE "^$|^SET|^INSERT|^UPDATE|^CREATE"
echo "--- ledger permissions, role by role"
$P -d bkp -f supabase/tests/ledger_roles.sql 2>&1 | grep -vE "^$|^SET|^INSERT|^UPDATE|^CREATE"
echo "--- declarations and backing (fresh database)"
$P -c "create database bkp2"; $P -d bkp2 -f supabase/tests/platform_stub.sql 2>/dev/null | grep -v "already exists" || true
for f in supabase/migrations/*.sql supabase/pending/*.sql; do [ -e "$f" ] && $P -d bkp2 -f "$f" >/dev/null; done
$P -d bkp2 -f supabase/tests/mechanics.sql 2>&1 | grep -E "NOTICE|ERROR|CONTEXT"
