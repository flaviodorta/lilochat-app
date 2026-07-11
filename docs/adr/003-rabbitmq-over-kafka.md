# ADR-003: RabbitMQ over Kafka for Domain Events

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

Choreography (ADR-002) needs a message broker. Event volume is modest — peak chat throughput is
2,000 messages/minute globally, everything else far lower — and events fall into two shapes:
must-not-lose events routed through the outbox (chat persistence, watch-time sessions, read-model
updates) and fire-and-forget notifications. Consumers need per-message acknowledgement, automatic
retry with backoff, and a dead-letter path with an operational replay story. The whole system runs
on a single VPS next to Postgres and Redis.

## Decision Drivers

- Delivery semantics: per-message ack/nack with requeue matches idempotent-consumer processing.
- DLQ ergonomics: dead-lettering must be built in, per queue, with a simple replay runbook.
- Routing: routing keys should map one-to-one onto the event naming scheme (`playback.*`,
  `presence.user.*`).
- Operational footprint: must run comfortably on shared hardware, operated by one person.

## Considered Options

1. **RabbitMQ** — classic broker: topic exchanges, per-message acks, native dead-letter
   exchanges, a useful management UI. No built-in event replay or long-term retention.
2. **Kafka** — log-based streaming: replayable history, very high throughput, consumer groups.
   Heavier to operate (or paid when managed), no native per-message DLQ (dead-lettering is a
   pattern you build yourself), and its strengths — throughput, replay, stream processing — are
   unused at this scale. Choosing it here would be resume-driven engineering, which is exactly
   the failure mode this repository tries to avoid.
3. **Redis Streams** — already in the stack, and consumer groups exist. But routing is manual,
   the DLQ story is do-it-yourself, and it would conflate the durability-critical event backbone
   with the ephemeral hot-state store, coupling two failure domains.

## Decision

Option 1: RabbitMQ 3 with a single topic exchange `lilochat.events`, routing key equal to the
event name, one queue per consumer with a paired dead-letter queue, and a documented replay
runbook in `docs/runbooks/`.

## Consequences

### Positive

- Delivery, retry, and dead-lettering semantics fit the idempotent-consumer design with almost no
  custom code.
- Small, well-understood operational footprint; the management UI helps local development.
- Topic routing keeps producers ignorant of consumers, as choreography requires.

### Negative

- No native event replay: rebuilding a read model from history means re-emitting from
  source-of-truth tables, not replaying the broker.
- One more stateful component to back up conceptually (definitions) and monitor (queue depth,
  DLQ depth).
- Documented revisit trigger: if event sourcing, stream analytics, or replay-driven rebuilds
  become requirements, Kafka re-enters the conversation.
