# ADR-005: Transactional Outbox with Idempotent Consumers

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

Choreography (ADR-002) means services persist local state and publish events that other services
depend on: chat persistence acknowledgements, watch-time sessions, and the room-card read model
are all event-fed. Writing to the database and publishing to RabbitMQ are two separate systems —
the classic dual-write problem. If a service commits and then crashes before publishing (or the
broker is briefly down), the event is silently lost and downstream state drifts with no error
surfaced anywhere.

## Decision Drivers

- Events that feed durable state (chat, watch time, read models) must be delivered at least once —
  never lost.
- No distributed transactions: two-phase commit across Postgres and RabbitMQ is off the table.
- At-least-once delivery implies duplicates, so consumer idempotency must be systematic, not
  ad hoc per consumer.
- Must be implementable as a small shared library (`packages/nest-shared`), not new
  infrastructure.

## Considered Options

1. **Publish after commit (best effort)** — the simplest code; loses events on a crash between
   commit and publish and during broker outages. Silent data loss is unacceptable for the flows
   above.
2. **Transactional outbox + polling relay** — the event row is written in the same ACID
   transaction as the state change; a relay polls the outbox (batch 100) and publishes with
   at-least-once semantics.
3. **Change data capture (Debezium)** — tails the WAL and publishes changes; the strongest
   guarantees with no polling, but it drags in Kafka-Connect-class infrastructure —
   disproportionate on a single VPS.

## Decision

Option 2. Identity, playback, chat, and engagement each own an outbox table
(`event_id, name, payload, created_at, published_at`); a per-service relay polls and publishes to
RabbitMQ, marking rows as published. Every consumer deduplicates by `eventId` (UUID v7) using a
processed-events table or Redis `SETNX` with TTL, so at-least-once delivery plus retries
(3 attempts, exponential backoff with jitter) are safe end to end.

## Consequences

### Positive

- No lost events: a crash or broker outage delays publication instead of dropping it.
- Retries and DLQ replays become safe everywhere by construction.
- One shared implementation in `nest-shared` keeps the semantics uniform across services.

### Negative

- Added publication latency from the poll interval — acceptable inside the stated eventual-
  consistency budgets (room cards <= 10 s, leaderboard <= 60 s).
- Outbox lag is a new failure mode requiring its own metric and alert (lag > 30 s).
- Outbox tables grow and need pruning, and consumers carry deduplication bookkeeping forever.
