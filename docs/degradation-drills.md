# Degradation Drills — roadmap 6.5 (2026-07-11)

Kill switches + chaos-lite, executed against real services on isolated drill
infra (dedicated RabbitMQ :5673 / Redis :6381 containers). Driver:
`scripts/drills/chat-degradation-drill.mjs` — two real socket.io clients in a
room, 1 msg/s, tracking sent / delivered (optimistic broadcast) / persisted
(full durability loop) while infrastructure is broken on purpose. Re-run any
drill by starting the driver and stopping the matching container.

## Kill switches (§13.4)

`FeatureFlags` in nest-shared: Redis key per flag, in-process cache 5 s,
**fail-open** (the brake must never become the outage; Redis down keeps the
last known value). Gates: `room_creation` (gateway POST /rooms → 503
FEATURE_DISABLED), `chat` + `votes` (RTG acks `chat_disabled`/`votes_disabled`).
Ops: `node scripts/ops/feature-flag.mjs list | on <flag> | off <flag>`.

**Drill 1 — flip `chat` under traffic:** 34 sent; exactly the ~10 s off-window
rejected with `chat_disabled` (10 sends); everything outside it delivered AND
persisted. Propagation ≤ 5 s, no deploy, no restart. ✅

## Drill 2 — RabbitMQ dies under chat (30 s outage)

> §9.1 promise: "RabbitMQ down → chat broadcasts continue, playback tuple in
> Redis keeps rooms watchable."

**Result: 79 sent / 79 delivered / 79 persisted / 0 errors.** Delivery never
stalled (optimistic broadcast precedes the publish); 39 publishes buffered in
the bus and flushed on reconnect (attempt 9); chat-service reconnected and
persisted everything. ✅

What made it pass (built for this drill): **amqplib does not auto-reconnect**
— one broker restart used to mean every service silently lost the bus until
redeploy. `RabbitMqBus` now: reconnect loop (expo backoff + jitter),
re-asserts exchanges, replays every registered `ChannelSetup` (consumers
re-bind), and buffers publishes (bounded 5k, drop-oldest logged) while away.

## Drill 3 — Redis dies under chat (30 s outage)

**First run: the RTG process DIED** — ioredis clients had no 'error'
listeners, and a library-internal promise rejected with
`MaxRetriesPerRequestError` → unhandled rejection → crash. The drill paying
for itself.

Fixes: `createRedisClient` factory (error listener + fail-fast, all 8 call
sites swept), `installProcessGuards` in every service (unhandledRejection →
log + survive; uncaughtException → log + exit for the orchestrator), consumer
idempotency failures → pause + requeue instead of crashing.

**Re-run: 79 / 79 / 79, zero errors, both processes alive.** During the
outage: 26 library rejections absorbed and logged (RTG), 129 pause+requeue
cycles (chat consumer, until claims worked again), rate-limit/flags failed
open, same-instance broadcasts unaffected, presence heartbeats silently
skipped (TTL sweep recovers ghosts). ioredis reconnected + resubscribed by
itself. ✅

Documented residual behavior while Redis is down: **new joins fail** with
`join_unavailable` (retryable), presence counts freeze, leaderboard reads 503.
Watching, chatting and playback (client-side arithmetic) continue.

## Drill 4 — service restarts under traffic

Chat-service restart at t=15 s, RTG restart at t=40 s, driver running
throughout: 69 sent → **64 persisted + 5 rejected = 69 accounted, zero
durable loss**. Both clients auto-reconnected (2 reconnects) and re-joined.

- Chat-service window: submitted events queued in RabbitMQ (durable queue),
  drained on boot — persistence catches up, nothing lost.
- RTG window: the 5 rejections are `not_in_a_room` — socket.io-client flushes
  buffered sends after reconnect but _before_ the room:join ack lands. The
  web client's equivalent: those sends error → optimistic message times out →
  user retries. Client-side send-queue-until-joined is on the Phase-7 polish
  list. 2 messages persisted-but-not-rebroadcast land via history refetch on
  rejoin (the documented §6.2 resync path).

## Follow-ups

- Phase 7: web composer queues sends until the rejoin ack (kills the
  `not_in_a_room` race); surface `chat_disabled` as a friendly banner.
- Re-run all four on the VPS topology after deploy (2× RTG, Traefik sticky).
