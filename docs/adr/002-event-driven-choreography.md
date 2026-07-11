# ADR-002: Event-Driven Choreography over Orchestration

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

With six services and database-per-service (ADR-001, ADR-009), every cross-service state change
needs a coordination style. LiloChat's inter-service flows are short and simple: a chat message is
submitted, persisted, and acknowledged; a presence change updates viewer counts and watch time; a
video start updates the room-card read model. No flow spans more than two or three steps, none
holds long-lived state, and none requires compensation logic — there are no payments or
multi-step reservations anywhere in the domain.

## Decision Drivers

- Flow length: all flows are short-lived — the standard criterion for choosing choreography over
  saga orchestration.
- Coupling: producers should not need to know their consumers (engagement is a pure consumer).
- Operational budget: no room for an extra orchestrator or workflow engine on a single VPS.
- Observability: distributed flows must remain debuggable end to end.

## Considered Options

1. **Choreography** — services publish domain events to a RabbitMQ topic exchange; interested
   services subscribe. No central coordinator. Flow logic is distributed, which hurts end-to-end
   visibility unless tracing is first-class.
2. **Orchestration (saga coordinator / workflow engine)** — a coordinator drives each flow.
   Explicit, inspectable flows and built-in compensation — a heavyweight answer for flows that
   never need compensation, plus one more stateful system to operate.
3. **Synchronous REST between services** — the simplest mental model, but it creates temporal
   coupling (a chat-persistence outage would block message delivery) and defeats the isolation
   the service split exists to demonstrate.

## Decision

Option 1: event-driven choreography over the `lilochat.events` topic exchange, routing key equal
to the event name. Every consumer is idempotent (deduplication by `eventId`), events that must not
be lost go through the transactional outbox (ADR-005), and W3C trace context propagates through
message headers (ADR-011) so choreographed flows remain traceable.

## Consequences

### Positive

- Loose coupling: new consumers (e.g., engagement) attach without touching producers.
- Failure isolation: a downstream outage queues events instead of failing the user-facing path.
- No orchestrator to build, operate, or explain away.

### Negative

- End-to-end flow logic lives in no single place; understanding a flow requires the event catalog
  (CLAUDE.md §6.1) plus correlated traces.
- Implicit coupling risk: event schema changes can break unseen consumers — mitigated by
  versioned, zod-validated event contracts in `packages/contracts`.
- If a genuinely long-lived flow requiring compensation ever appears, this decision must be
  revisited rather than stretched.
