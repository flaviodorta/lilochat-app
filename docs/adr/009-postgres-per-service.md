# ADR-009: Database-per-Service on a Single Physical Postgres Instance

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

Database-per-service is a rule of engagement in this architecture: services never touch each
other's databases, and each of the five services owns its schema and migrations, versioned
in-repo (a direct correction of the predecessor, whose schema lived unversioned in a dashboard).
Taken literally, the pattern implies five Postgres deployments — but production v1 is a single
Hetzner-class VPS, and five instances (or five managed databases) would burn memory and money to
enforce a property that logical isolation already provides.

## Decision Drivers

- Ownership isolation: no shared tables, no cross-service queries — ever.
- Cost and memory footprint on a single VPS that also runs seven application containers, Redis,
  RabbitMQ, and the observability stack.
- Split-readiness: moving a service to its own instance later must be a configuration change,
  not a refactor.
- Blast-radius honesty: what a shared instance failure means must be documented, not hidden.

## Considered Options

1. **One shared database and schema** — the cheapest option, but it couples every service at the
   schema level and silently invites cross-service joins; it abandons the very pattern the
   project exists to demonstrate.
2. **Five physical instances/containers** — maximal isolation (crashes, resources, tuning per
   service), but roughly five times the baseline memory and operational surface, on hardware that
   has none to spare.
3. **One Postgres 16 instance with five logical databases** — per-service database, credentials,
   and migrations; nothing crosses database boundaries, so a later split is a connection-string
   change. A shared _server_, never a shared _schema_ — the distinction is deliberate and
   documented.

## Decision

Option 3. `identity_db`, `rooms_db`, `playback_db`, `chat_db`, and `engagement_db` run on one
instance; each service connects with its own role, owns its migrations, and cannot see sibling
databases. WAL archiving to object storage plus a daily base backup (RPO 5 min) cover the
instance as a whole.

## Consequences

### Positive

- Database-per-service semantics at monolith-hosting cost; the split path is proven by
  construction, not by promise.
- One backup and restore pipeline to operate and rehearse instead of five.
- Per-service credentials keep the ownership boundary real even on shared hardware.

### Negative

- Shared blast radius: the instance going down degrades every service at once.
- Noisy neighbors: chat's append-heavy write volume shares buffers, I/O, and vacuum capacity
  with everything else; per-service tuning is limited.
- Point-in-time recovery is instance-wide; restoring a single service's database to a different
  moment is awkward by design.
