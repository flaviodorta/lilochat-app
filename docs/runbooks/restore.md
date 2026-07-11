# Runbook — Postgres restore (RPO 5 min / RTO 1 h, §4.2)

**When:** data loss, corrupted volume, dead VPS.
**You need:** the latest base backup (pg-backup sidecar volume `pgbackups`, or
the rclone off-site copy) and the WAL archive (`walarchive` volume / off-site).

## How the pieces fit

- `postgres` runs with `archive_mode=on, archive_timeout=300` → every WAL
  segment lands in `/wal-archive` at most 5 minutes after the writes it
  contains. **That 5-minute window is the RPO.**
- The `pg-backup` sidecar takes a nightly `pg_basebackup` (keeps 7) — a
  restore = newest base backup + replay of every archived WAL after it.

## Procedure

1. **Stop writers** so nothing writes to a half-restored DB:
   `docker compose -f docker/compose.prod.yml stop identity rooms playback chat engagement api-gateway realtime-gateway`
2. **Fetch backups** (skip if volumes survived):
   `rclone copy b2:lilochat-backups /srv/lilochat/restore`
3. **Unpack the newest base backup** into a fresh data dir:
   ```bash
   mkdir -p /srv/lilochat/restore/data && cd /srv/lilochat/restore
   tar xzf base-<newest>/base.tar.gz -C data
   mkdir -p data/pg_wal && tar xzf base-<newest>/pg_wal.tar.gz -C data/pg_wal
   ```
4. **Arm recovery** (replay to the latest archived WAL):
   ```bash
   touch data/recovery.signal
   echo "restore_command = 'cp /wal-archive/%f %p'" >> data/postgresql.auto.conf
   ```
5. **Swap the volume and start postgres only.** Point `pgdata` at the restored
   dir (or copy into the named volume), keep the `walarchive` mount, then
   `docker compose up -d postgres`. Postgres replays WAL, promotes itself
   (`pg_is_in_recovery()` returns `f`), and serves.
6. **Verify before opening the doors** — row counts in each of the 5 DBs,
   newest `created_at` in `chat.messages` vs the incident time (gap must be
   ≤ 5 min), then start the services from step 1.
7. **Redis/RabbitMQ are NOT restored** by design: presence/playback tuples are
   hot state the services rebuild; leaderboards rehydrate from
   `engagement_db`; queues refill from outboxes. See §4.2.

## Rehearsal evidence (repeat quarterly: `scripts/backup/dr-rehearsal.sh`)

2026-07-11, local drill with the exact prod flags and sidecar commands:

```
rows recovered        : 1500 / 1500 expected
post-backup rows (WAL): 500 / 500 expected  ← writes made AFTER the base backup
still in recovery?    : f (promoted, serving)
restore wall-clock    : 1 s  (RTO budget: 3600 s)
```

The 1 s is a toy-dataset floor; the procedure — not the milliseconds — is what
was validated. At real sizes the clock is dominated by fetching backups from
object storage + WAL replay volume; re-time on the VPS after first deploy and
update this block.
