#!/usr/bin/env bash
# Disaster-recovery rehearsal (roadmap 6.3, §4.2: RPO 5 min / RTO 1 h).
# Self-contained and repeatable — run it quarterly and paste the timing block
# into docs/runbooks/restore.md.
#
# The drill, using the SAME mechanisms compose.prod ships:
#   1. postgres with archive_mode=on (same flags as prod) + seed 1,000 rows
#   2. base backup with pg_basebackup            (what the pg-backup sidecar runs)
#   3. write 500 MORE rows — they exist ONLY in archived WAL, not the backup
#   4. 💥 disaster: container AND data volume destroyed
#   5. restore: untar base backup → recovery.signal + restore_command → start
#   6. verify: all 1,500 rows back (the 500 post-backup rows prove WAL replay,
#      i.e. the RPO story); wall-clock of step 5 is the RTO evidence
set -euo pipefail

NAME=lilo-dr-rehearsal
WORK=$(mktemp -d /tmp/lilo-dr.XXXXXX)
PGPASS=drill
# cleanup via a root container: the restored data dir gets chowned to uid 70
trap 'docker rm -f $NAME >/dev/null 2>&1 || true; docker run --rm -v "$WORK":/work alpine sh -c "rm -rf /work/restore /work/wal /work/base" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

say() { printf '\n\033[1;35m[dr] %s\033[0m\n' "$*"; }
psqlc() { docker exec -u postgres $NAME psql -tA -d drill -c "$1"; }

mkdir -p "$WORK/wal" "$WORK/base"
chmod 777 "$WORK" "$WORK/wal" "$WORK/base"

say "1/6 postgres up with prod archive flags (archive_timeout=300 → 5-min RPO)"
docker run -d --name $NAME \
  -e POSTGRES_PASSWORD=$PGPASS -e POSTGRES_DB=drill \
  -v "$WORK/wal":/wal-archive \
  postgres:16-alpine \
  postgres -c wal_level=replica -c archive_mode=on -c archive_timeout=300 \
           -c archive_command='test ! -f /wal-archive/%f && cp %p /wal-archive/%f' >/dev/null
until docker exec $NAME pg_isready -q -U postgres 2>/dev/null; do sleep 0.5; done
psqlc "CREATE TABLE messages(id serial primary key, body text not null, created_at timestamptz default now())" >/dev/null
psqlc "INSERT INTO messages(body) SELECT 'pre-backup row ' || g FROM generate_series(1,1000) g" >/dev/null
say "   seeded $(psqlc 'SELECT count(*) FROM messages') rows"

say "2/6 base backup (pg_basebackup -Ft -z -X stream — the sidecar's exact call)"
docker exec -u postgres $NAME pg_basebackup -D /tmp/base -Ft -z -X stream -c fast
docker cp $NAME:/tmp/base/. "$WORK/base/" >/dev/null

say "3/6 500 post-backup rows (live ONLY in WAL) + forced segment switch"
psqlc "INSERT INTO messages(body) SELECT 'post-backup row ' || g FROM generate_series(1,500) g" >/dev/null
psqlc "SELECT pg_switch_wal()" >/dev/null
sleep 2 # give the archiver a beat
say "   $(psqlc 'SELECT count(*) FROM messages') rows total, $(ls "$WORK/wal" | wc -l) WAL files archived"

say "4/6 💥 DISASTER — container and data volume gone"
docker rm -f $NAME >/dev/null
T0=$(date +%s)

say "5/6 restore: base backup + WAL replay (recovery_target = latest)"
RESTORE="$WORK/restore"
mkdir -p "$RESTORE"
tar xzf "$WORK/base/base.tar.gz" -C "$RESTORE"
mkdir -p "$RESTORE/pg_wal"
tar xzf "$WORK/base/pg_wal.tar.gz" -C "$RESTORE/pg_wal"
touch "$RESTORE/recovery.signal"
cat >> "$RESTORE/postgresql.auto.conf" <<CONF
restore_command = 'cp /wal-archive/%f %p'
CONF
# WAL files stay uid 70 (postgres) from the first container's archiver —
# the restored container runs as the same uid, so no chmod needed.
chmod -R 700 "$RESTORE"
docker run -d --name $NAME \
  -e POSTGRES_PASSWORD=$PGPASS \
  -v "$RESTORE":/var/lib/postgresql/data \
  -v "$WORK/wal":/wal-archive \
  postgres:16-alpine >/dev/null
until docker exec $NAME pg_isready -q -U postgres 2>/dev/null; do sleep 0.5; done
T1=$(date +%s)

say "6/6 verify"
TOTAL=$(psqlc "SELECT count(*) FROM messages")
POST=$(psqlc "SELECT count(*) FROM messages WHERE body LIKE 'post-backup%'")
RECOVERY=$(psqlc "SELECT pg_is_in_recovery()")
echo
echo "══════════════════ DR REHEARSAL RESULT ══════════════════"
echo " rows recovered        : $TOTAL / 1500 expected"
echo " post-backup rows (WAL): $POST / 500 expected  ← the RPO proof"
echo " still in recovery?    : $RECOVERY (f = promoted, serving)"
echo " restore wall-clock    : $((T1 - T0)) s  (RTO budget: 3600 s)"
echo "══════════════════════════════════════════════════════════"
[ "$TOTAL" = "1500" ] && [ "$POST" = "500" ] || { echo 'DR REHEARSAL FAILED'; exit 1; }
echo 'DR REHEARSAL PASSED'
