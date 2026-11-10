#!/bin/bash
# Uji perilaku database pada klaster PostgreSQL SEMENTARA (bukan Supabase sungguhan).
# Membutuhkan biner PostgreSQL 16 (initdb, pg_ctl, psql) dan TIDAK boleh dijalankan sebagai root.
# Skema auth/storage Supabase disimulasikan oleh local_supabase_stub.sql.
# Pemakaian: bash supabase/tests/run_local.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../migrations"
T="$(mktemp -d)"
export PATH="$(ls -d /usr/lib/postgresql/*/bin | tail -1):$PATH"
cleanup() { pg_ctl -D "$T/data" -m fast stop >/dev/null 2>&1; rm -rf "$T"; }
trap cleanup EXIT
initdb -D "$T/data" -A trust -U postgres >/dev/null
pg_ctl -D "$T/data" -o "-p 54329 -k $T -c listen_addresses=" -l "$T/pg.log" -w start >/dev/null
P="psql -h $T -p 54329 -U postgres"
$P -q -c 'create database t'
for f in "$HERE/local_supabase_stub.sql" "$MIG"/0{0{1,2,3,4,5,6,7,8,9},10,11,12,13,14,15,16,17,18,19,20,21,22}_*.sql; do
  echo "== $(basename "$f")"; $P -d t -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | head -15
done
echo "== UJI PERILAKU"
$P -d t -q -f "$HERE/behavior_test.sql" 2>&1 | grep -E "PASS|FAIL|INFO|ERROR" | sed -e 's/^psql:[^ ]* //' -e 's/NOTICE:  //' | tee "$T/out.txt"
echo "PASS: $(grep -c '^PASS' "$T/out.txt")  FAIL: $(grep -c '^FAIL' "$T/out.txt")"