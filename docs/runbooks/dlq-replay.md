# Runbook — DLQ replay

**Trigger:** Grafana alert `DLQ depth > 0` (fires after 5 min of any
`<queue>.dlq` holding messages).

A message reaches a DLQ for exactly two reasons (see `bindConsumer`,
`packages/nest-shared/src/messaging/consumer.ts`):

1. **Invalid payload** — zod parse failed. A producer is publishing garbage or
   an incompatible schema version. Replaying without a fix loops it right back.
2. **Handler exhausted retries** (3× backoff). Usually a downstream outage
   (DB/Redis down) or a bug. The idempotency claim was RELEASED on
   dead-letter, so a replay will be reprocessed, not deduped away.

## Procedure

1. **Find the queue** — SLO dashboard "DLQ depth" panel, or:
   `rabbitmqadmin -u lilochat list queues name messages | grep dlq`
2. **Look at a message without consuming it:**
   ```bash
   node scripts/ops/dlq-replay.mjs <queue>.dlq --dry-run
   ```
   It prints eventId/name/routing-key and requeues the message untouched.
3. **Diagnose.** Correlate the eventId with Loki
   (`{service_name="<consumer>"} |= "<eventId>"`) — the dead-letter log line
   carries the error and, inside a span, the trace id → Tempo.
4. **Fix the cause first** — deploy the handler fix / restore the dependency /
   (for invalid payloads) fix the producer. A replay is the LAST step.
5. **Replay:**
   ```bash
   node scripts/ops/dlq-replay.mjs <queue>.dlq            # everything
   node scripts/ops/dlq-replay.mjs <queue>.dlq --limit 10 # canary first
   ```
   Messages are republished to `lilochat.events` with their original routing
   key (from `x-death`) plus `x-replayed-from/at` audit headers. Consumer
   idempotency makes over-replay safe.
6. **Verify** the alert clears and `lilochat_events_consumed_total{outcome="handled"}`
   ticks up for the consumer.

**Invalid-payload caveat:** replaying a schema-invalid message dead-letters it
again by design. If the payload is legitimately unprocessable (poison), drain
it to a file for the postmortem and purge:
`rabbitmqadmin -u lilochat get queue=<queue>.dlq ackmode=ack_requeue_false`.

Drill (verified 2026-07-11): plant → dry-run → replay → message re-routed
through the exchange to the main queue, DLQ empty, audit headers present.
