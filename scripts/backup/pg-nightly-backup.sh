#!/bin/sh
# Nightly base backup sidecar (compose.prod `pg-backup` service, §4.2).
# Loop: base backup now, then every 24 h; keep the last $RETAIN (default 7).
# WAL segments are archived continuously by postgres itself (archive_command,
# archive_timeout=300 → the 5-minute RPO); this base backup bounds how much
# WAL a restore has to replay.
#
# Off-site (object storage): set RCLONE_REMOTE (e.g. "b2:lilochat-backups")
# and mount an rclone.conf — each cycle then syncs /backups off the box.
# A backup that lives only on the VPS it protects is not a backup.
set -eu

: "${PGHOST:=postgres}"
: "${PGUSER:=lilochat}"
: "${RETAIN:=7}"
: "${BACKUP_DIR:=/backups}"

while true; do
  stamp=$(date +%Y%m%d-%H%M%S)
  dest="$BACKUP_DIR/base-$stamp"
  echo "[pg-backup] base backup → $dest"
  mkdir -p "$dest"
  # -Ft -z: tar.gz per tablespace; -X stream: WAL needed for consistency rides along
  pg_basebackup -h "$PGHOST" -U "$PGUSER" -D "$dest" -Ft -z -X stream -c fast
  echo "[pg-backup] done: $(du -sh "$dest" | cut -f1)"

  # retention: keep the newest $RETAIN base backups
  ls -1dt "$BACKUP_DIR"/base-* 2>/dev/null | tail -n "+$((RETAIN + 1))" | while read -r old; do
    echo "[pg-backup] pruning $old"
    rm -rf "$old"
  done

  if [ -n "${RCLONE_REMOTE:-}" ]; then
    echo "[pg-backup] rclone sync → $RCLONE_REMOTE"
    rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --transfers 4 || echo "[pg-backup] rclone FAILED (kept local)"
  fi

  sleep 86400
done
