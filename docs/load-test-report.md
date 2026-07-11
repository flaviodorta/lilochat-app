# Load Test Report — WebSocket fan-out & chat pipeline (roadmap 6.2)

**Date:** 2026-07-11 · **Tool:** k6 (dockerized, raw-WS speaking engine.io/socket.io v4) ·
**Target:** realtime-gateway + chat + engagement (dedicated instances) sharing the dev
infra (Postgres 16, Redis 7, RabbitMQ 4) with the regular dev stack running as
competing consumers — i.e. the production topology of §5.3, on one machine.

## 1. Goal & scenario (from §4.3 capacity targets)

Design targets under test: **1,000 concurrent sockets across 50 rooms** with a
**chat storm in one hot room**, measuring the §4.1 SLIs the socket path owns:

| Scenario   | VUs | Behavior                                                              |
| ---------- | --- | --------------------------------------------------------------------- |
| `steady`   | 850 | spread over 49 rooms (~17/room): join → heartbeat 15 s → chat 1/45 s  |
| `hot_room` | 150 | ONE room: join → heartbeat 15 s → **chat every 3 s** (~50 msg/s room) |

The hot room runs at **3,000 msg/min — 50× the §4.3 "hot room sustained" spec**
(60 msg/min); per-user rate stays under the 1 msg/s token bucket on purpose:
this tests fan-out, not the limiter. Every message fans out to 150 sockets
twice (`chat:new` broadcast + `chat:ack` after persistence), so the gateway
sustains ~14k socket emits/s.

Auth is real (RS256 handshake, tokens minted with the dev keypair — same
claims identity issues). The chat path is the full §6.3 pipeline: optimistic
broadcast → `chat.message.submitted` → chat-service persist (outbox) →
`chat.message.persisted` → `chat:ack` broadcast.

## 2. Results — 1,000 sockets (45 s ramp, 3 m sustain)

| SLI                            | SLO (§4.1)    | Measured (p95)         | Verdict |
| ------------------------------ | ------------- | ---------------------- | ------- |
| WS connect success             | 99.5%         | **100%** (1000/1000)   | ✅      |
| Chat delivery (send→broadcast) | < 500 ms      | **11 ms** (avg 2.8 ms) | ✅      |
| Chat persisted ack (full loop) | — (not SLO'd) | 506 ms (avg 292 ms)    | see §4  |
| Clock-sync RTT (`sync:ping`)   | —             | 15 ms                  | ✅      |
| Room join (`room:join` ack)    | —             | 4 ms                   | ✅      |

Throughput: **15,287 messages sent (~59/s global), 3.6 M socket messages
received (13.8k/s)**, 677 MB pushed to clients over 4.5 min.

Server side (from the 6.1 observability pipeline — gauges/counters on the SLO
dashboard): `lilochat_ws_connections` peaked at exactly 1,000,
`lilochat_rooms_active` at 50, **zero DLQ messages, zero handler retries**
(26,240 events consumed, 100% outcome=handled), outbox lag peaked at 0.52 s
(= its own 500 ms poll interval, not backlog), **zero errors/warnings** in any
service log. Chat durability: 99.7% of sent messages persisted; the delta is
rate-limited sends rejected synchronously by the bucket (harness artifact,
§5.2 — never enqueued, not message loss).

**realtime-gateway peaked at 10.4% of one core / 168 MB RSS.**

## 3. Stretch — 2,000 sockets (2× target, 90 s sustain)

All thresholds still green: 2000/2000 connects, chat delivery p95 **22 ms**,
join p95 4 ms, 14.5k socket msgs/s, RTG at **12.3% CPU / 186 MB**. Latencies
roughly doubled from 1k→2k while staying two orders of magnitude inside the
SLO — no knee in sight. Extrapolating CPU/RSS linearly, one instance has
comfortable headroom to its **5,000-connection shed cap (§9.1)**, which is the
designed per-instance ceiling, validating the 2-instance plan for the 5k
§4.3 target.

## 4. Findings

1. **Nothing broke.** No sheds, no DLQ, no retries, no error logs, no memory
   growth across runs. The §4.3 bottleneck mitigations (per-user chat bucket,
   lobby throttle, minimal payloads) did their job — the fan-out is the cheap
   part of the system at this scale.
2. **The persisted-ack path is outbox-poll-bound, not load-bound.** The
   send→ack distribution (median 292 ms, p95 ~510 ms) is exactly the uniform
   0–500 ms wait for the relay's poll tick plus ~10 ms of real work, identical
   at 30, 1,000 and 2,000 sockets. If snappier "sent ✓" ticks ever matter,
   the knob is the relay interval (500 → 250 ms doubles DB polling for -250 ms
   p95) — a deliberate durability-vs-latency trade, not a defect. The SLO'd
   metric (optimistic delivery) is unaffected (11 ms).
3. **The per-user token bucket holds under concurrency** — including the
   same account sending from two connections at once (it shares one bucket,
   as designed; discovered via the harness bug in §5.2).
4. **Competing consumers behaved correctly under load**: the dev RTG instance
   shared the persisted-events queue with the load instance and broadcasts
   still reached every socket via the Redis adapter — the §2.8 scaling story
   works while messages are flowing at full rate.

## 5. Harness notes (bugs found in the TEST, kept for honesty)

1. `43/room,1`-prefix matching also matched chat ack ids `101+`, misfiling
   chat acks as join acks (reported 16 s "joins" and 92% connect success on
   the first smoke). Fixed by parsing the ack id exactly.
2. Steady and hot-room VUs drew overlapping token ranges, so a few VUs shared
   a userId — and therefore a chat bucket — producing ~0.7% `rate_limited`
   acks. Mitigated with disjoint pools; residual collisions inside the hot
   pool remain possible because k6 VU ids are global across scenarios
   (documented, immaterial: rate-limited sends are counted and excluded from
   latency Trends).

## 6. Limitations (read before quoting numbers)

- Localhost loopback: no WAN RTT, no TLS handshake cost, no Traefik hop.
  Latency numbers are floor values; the _shape_ (flat under load) is the
  finding, not the absolute milliseconds.
- Client and servers shared one 12-core machine; k6 itself consumed several
  cores. Server CPU numbers are still honest (per-process sampling).
- Single RTG instance; the 2-instance sticky-session topology ships with the
  deferred VPS deploy and should re-run this scenario there (tracked in 6.3+).

## 7. Reproduce

```bash
docker compose -f docker/compose.dev.yml --profile obs up -d
node scripts/load/mint-tokens.mjs 2000 50
# boot dedicated instances (any free ports; OTEL on to watch the SLO dashboard)
OTEL_ENABLED=1 PORT=4215 pnpm --filter @lilochat/realtime-gateway exec tsx src/main.ts &
OTEL_ENABLED=1 PORT=4216 pnpm --filter @lilochat/chat exec tsx src/main.ts &
OTEL_ENABLED=1 PORT=4205 pnpm --filter @lilochat/engagement exec tsx src/main.ts &
docker run --rm --network host -v "$PWD/scripts/load:/load" grafana/k6 run \
  -e RTG_URL=ws://localhost:4215 -e STEADY_VUS=850 -e HOT_VUS=150 -e SUSTAIN=3m \
  /load/ws-scenario.js
```
