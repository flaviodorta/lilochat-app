# ADR-010: Single-Region Deployment; Multi-AZ Deferred

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

Production v1 targets one Hetzner CX32-class VPS running Docker Compose behind Traefik (TLS
termination, load balancing across two realtime-gateway replicas with sticky sessions). The
availability SLO is deliberately set at 99.5% monthly (error budget of roughly 3.6 hours) — a
number chosen to be honest about what a single host can deliver, then actually met. Multi-AZ or
multi-region topologies would multiply cost (multiple hosts, managed databases, external load
balancers) and operational complexity for a product operated by one person on a hobby-scale
budget.

## Decision Drivers

- Cost ceiling: infrastructure must fit a personal budget indefinitely.
- SLO honesty: promise only what the topology can deliver, and meet it.
- DR discipline as portfolio material: a rehearsed restore is worth more than theoretical
  redundancy.
- Solo operability: every additional host is a permanent tax on a single operator.

## Considered Options

1. **Single VPS, single region, rehearsed disaster recovery** — WAL archiving to object storage
   (RPO 5 min for Postgres; <= 60 s for watch-time counters via checkpoints), daily base backups,
   and a documented, rehearsed restore runbook targeting an RTO of 1 hour.
2. **Multi-AZ managed cloud (Kubernetes plus managed Postgres)** — genuinely higher availability,
   but several times the cost, and it outsources exactly the operational work this project wants
   to demonstrate. Kept as the documented prod-v2 evolution (k3s, HPA, canary via Traefik
   weights) if scale ever demands it.
3. **Two VPSs, active-passive** — halves some risk but doubles cost and adds failover machinery
   (replication, promotion, DNS or IP swings) that is easy to get subtly wrong solo — a
   worst-of-both-worlds middle ground.

## Decision

Option 1. Single region, single host, with disaster recovery treated as a first-class, rehearsed
practice: restore drills on a scratch VPS validate the RTO, and the runbooks live in
`docs/runbooks/`. The Kubernetes evolution is written as a plan and deliberately not built
prematurely.

## Consequences

### Positive

- Infrastructure cost stays inside a personal budget with no scaling cliff.
- RTO and RPO are tested numbers, not aspirations — the rehearsal itself is a portfolio artifact.
- The entire production topology fits in one compose file a reviewer can read in minutes.

### Negative

- A host or region outage takes the whole product down for up to the RTO (1 hour).
- Worst case loses up to 5 minutes of Postgres writes and 60 seconds of watch-time progress.
- There is no zero-downtime story for host-level failures in v1; the error budget absorbs this
  by design.
