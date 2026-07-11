# Runbook — Deploy (prod v1: single VPS, Compose + Traefik, ADR-010)

> Status note: the first VPS deploy is deliberately deferred (roadmap 1.9).
> This runbook is written and rehearsable now so going live is an execution
> step, not a design step.

## Normal deploy (rolling, per service)

CI (`.github/workflows/`) builds and pushes `ghcr.io/<org>/lilochat/<svc>:<sha>`
on merge to main. On the VPS:

1. **Pre-flight:** SLO dashboard green, no firing alerts, error budget not
   exhausted (if it is: freeze features, ship only fixes).
2. **Pull + roll one service at a time** — order: services → gateways → web:
   ```bash
   cd /srv/lilochat/app
   export TAG=<sha>
   docker compose -f docker/compose.prod.yml pull identity
   docker compose -f docker/compose.prod.yml up -d identity
   curl -fsS http://localhost:<port>/health/ready   # via compose exec if not exposed
   ```
   Two versions coexist during the roll — events are versioned (`version: 1`)
   and consumers tolerant, per §13.4. Do NOT deploy a consumer break and its
   producer in the same roll.
3. **Migrations** run in each service's container command before the app
   starts (`prisma migrate deploy`). Forward-compatible-only rule: never drop
   a column in the same release that stops writing it.
4. **realtime-gateway:** `docker compose up -d --no-deps realtime-gateway`
   drains via graceful shutdown; clients reconnect and resync by construction
   (§6.2 — reload lands in-sync). Roll it LAST during quiet hours if possible.
5. **Post-deploy:** watch the SLO dashboard 10 min — 5xx ratio, drift p95,
   DLQ depth, outbox lag. Alerts are the rollback trigger.

## Rollback

Images are immutable and tagged by sha:

```bash
export TAG=<previous-sha>
docker compose -f docker/compose.prod.yml up -d <service>
```

Migrations are the constraint: only additive migrations can roll back freely.
If a destructive migration shipped (it shouldn't — see step 3), restore per
[restore.md](restore.md) instead.

## First-time VPS provision (checklist)

1. Hetzner CX32-class, Debian stable, SSH keys only, ufw allow 22/80/443.
2. Install Docker + compose plugin; create `/srv/lilochat/{app,.env.prod}`.
3. Clone the repo (compose + configs), write `.env.prod` (see header of
   `docker/compose.prod.yml`; secrets NEVER committed — legacy lesson §1).
4. DNS: `A @` and `A api` → VPS IP; Traefik gets Let's Encrypt on first hit.
5. `docker compose -f docker/compose.prod.yml --env-file .env.prod up -d`
6. Verify: register a user on the public URL, watch the backup sidecar produce
   `base-*` in the `pgbackups` volume, configure `RCLONE_REMOTE` for off-site,
   then run a timed [restore rehearsal](restore.md) against real data sizes.
