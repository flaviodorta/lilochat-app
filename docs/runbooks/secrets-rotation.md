# Runbook — Secrets rotation

**Cadence:** yearly, or IMMEDIATELY on suspected exposure (a key that appeared
in a log, a screen-share, a commit — rotate first, investigate later).

## JWT signing keypair (RS256)

Why rotation is cheap here: **refresh tokens are opaque hashes in
`identity_db`, not JWTs.** Rotating the keypair only invalidates _access_
tokens (15-min lifetime); every live session recovers through one silent
refresh. No forced logout.

1. `node scripts/gen-keys.mjs` → new pair.
2. Update secrets: `JWT_PRIVATE_KEY` (identity only) and `JWT_PUBLIC_KEY`
   (api-gateway + realtime-gateway) in `.env.prod`.
3. Roll identity first, then both gateways
   (`docker compose up -d identity api-gateway realtime-gateway`).
4. Verify: an old access token → 401; `POST /auth/refresh` with the session
   cookie → 200 with a fresh token; new token → 200.
5. In-flight WS sessions keep working (the JWT was checked at handshake);
   reconnects go through the refresh path.

**Compromised REFRESH tokens** are a different playbook: revoke server-side —
`DELETE FROM refresh_tokens WHERE user_id = …` (one user) or `TRUNCATE
refresh_tokens` (everyone re-logs, the nuclear option). Reuse detection
(§9.2) already revokes a stolen-and-replayed family automatically.

Drill evidence (2026-07-11, local): key A session → rotate to key B → old
access 401, refresh 200, new access 200. Exactly one silent round-trip of
user impact.

## YouTube Data API key

Lives ONLY in playback-service env (§9.2 — legacy lesson: the old app shipped
it in `NEXT_PUBLIC_`). Rotate in Google Cloud Console (create B → deploy →
delete A); the `videos` metadata cache means a brief key outage degrades to
"metadata pending" via the circuit breaker, nothing user-facing breaks.
⚠ The LEGACY app's key was publicly exposed — if not already done, delete
that key in the old Google Cloud project.

## Postgres password

1. `ALTER USER lilochat WITH PASSWORD '<new>'` on the running instance.
2. Update `POSTGRES_PASSWORD` in `.env.prod`, roll all services (they read it
   into their DATABASE_URLs) + the pg-backup sidecar.
3. Old connections keep working until the roll completes (postgres only
   checks at connect time) — no downtime if rolled promptly.

## Grafana / RabbitMQ admin credentials

Config-level (compose env). Change env → `docker compose up -d <svc>`. These
guard operator UIs, not user data; still rotate on team changes.
