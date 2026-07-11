# ADR-001: Adopt Microservices Deliberately, Capped at Six Services

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

LiloChat is a real-time "watch together" platform with two explicit, equally weighted goals:
(1) a real deployed product operated with production discipline, and (2) a portfolio piece that
demonstrates senior-level distributed-systems architecture. At the design target of 5,000
concurrent users and 500 rooms, the workload fits comfortably in a single process; any honest
capacity analysis says a modular monolith would be cheaper to build, deploy, and operate.

However, demonstrating distributed-systems patterns — database-per-service, event-driven
choreography, transactional outbox, CQRS read models, resilience patterns — is a primary goal of
the project, not a side effect. That capability cannot be demonstrated convincingly in a monolith.

## Decision Drivers

- Portfolio value: show real, defensible distributed-systems work, not toy examples.
- Production reality: the system must stay operable by one person on one VPS.
- Avoid over-engineering beyond what the demonstration goal requires.
- Keep the hardest domain logic (the playback timeline) isolated and testable.

## Considered Options

1. **Modular monolith** — a single NestJS app with enforced module boundaries. Cheapest to run
   and simplest to reason about; the correct choice on scale alone. Fails the portfolio goal:
   no service boundaries, no cross-service consistency problems to solve, none of the patterns
   above exercised for real.
2. **Microservices with boundaries drawn freely** — one service per subdomain as they emerge.
   Maximum pattern surface, but invites accidental complexity (10+ deployables) that a solo
   operator cannot run with discipline; over-engineering becomes the story instead of the skill.
3. **Microservices with a hard cap of six** — identity, rooms, playback, chat, engagement, plus
   two thin edge gateways (REST and WebSocket). Each boundary is justified by a distinct workload
   shape or security posture (CLAUDE.md §5.4).

## Decision

Option 3. We deliberately choose microservices while stating on the record that the scale does
not require them, and we cap the count at six to keep operational overhead proportional to the
goal. Every boundary must justify itself — no service exists just to inflate the diagram. This
trade-off awareness is itself the portfolio point.

## Consequences

### Positive

- The repository exercises database-per-service, choreography, outbox, CQRS, and resilience
  patterns in a real deployed system — the core portfolio claim.
- The realtime gateway acts as a bulkhead: a socket storm cannot take down the REST path.
- Playback, the domain core, is isolated and independently testable and scalable.

### Negative

- Materially higher operational overhead than the scale demands: five databases, a message
  broker, seven deployables, distributed debugging.
- Eventual consistency across services introduces failure modes a monolith would not have.
- The framing must stay honest: this ADR exists so the choice reads as judgment, not naivety.
