# LiloChat — LinkedIn post & interview prep

> Two artifacts in one file: the launch post for LinkedIn and a mock technical
> interview (international, English) where I defend every major decision.
> Numbers come from the evidence docs — update the post with the live URL when
> the deploy lands.

---

## Part 1 — The LinkedIn post

> Attach `docs/media/hero.gif` as the post media — the two-browsers-in-sync
> GIF _is_ the pitch. Post the repo link in the first comment (LinkedIn
> downranks posts with external links in the body — decide based on current
> algorithm folklore).

---

I spent the last months rebuilding a side project from scratch, and I built it
twice on purpose.

The first version of **LiloChat** — a "watch YouTube together" app — worked,
mostly. It also had a client elected as the "source of truth" for playback
(trivially forgeable), two sources of truth for presence (hello, ghost users),
and an API key committed to the repo. I learned more from what was wrong with
it than from what worked.

So I rewrote it the way I'd want to build systems professionally. LiloChat is
public rooms where everyone watches YouTube **in perfect sync** — chat, shared
queue, vote-to-skip. Nobody can pause. The room is the channel; the people are
the curators.

What it does:

🎬 Rooms with a broadcast-style timeline — join late, land at the exact right
second, no "wait, where are you?"
💬 Live chat with optimistic delivery (p95 of 11 ms under load) and durable
history
📋 A shared queue anyone can build; the room auto-advances like a playlist
🗳️ Skip votes with a live quorum — leavers don't inflate the denominator
🏆 Watch-time leaderboards (only _qualified_ time counts: room actually
playing)

The engineering decisions I'm most proud of — and why:

▸ **Video bytes never touch my infrastructure.** YouTube streams to each
browser; I synchronize _time_, not video. Because nobody can pause, playback
state per room collapses to one tuple, and every client's position is pure
arithmetic. That single product rule deleted an entire class of distributed
state problems.

▸ **The server is the only authority.** Clients estimate the server clock
NTP-style over WebSocket and self-correct: small drift is absorbed by nudging
playbackRate 5% (invisible), big drift hard-seeks. A page refresh rejoins in
sync _by construction_.

▸ **Honest architecture.** It's 6 microservices with database-per-service,
event choreography over RabbitMQ, transactional outbox, CQRS read models. At
this scale a modular monolith would be cheaper — and the first ADR in the repo
says exactly that. I chose the distributed version deliberately, to practice
and demonstrate these patterns with real trade-offs, and capped the service
count so it wouldn't become architecture cosplay.

▸ **Evidence over claims.** The repo has a load-test report (1,000 concurrent
sockets, chat storm at 50× the design spec, every SLO green), chaos drills
(killing RabbitMQ under traffic: zero message loss — killing Redis: crashed my
gateway on the first run, and the fix is documented), a rehearsed database
restore with WAL replay, and a security pass with the known gaps stated out
loud.

▸ **Observability from day one, self-hosted.** OpenTelemetry everywhere, trace
context riding through HTTP _and_ RabbitMQ headers, Grafana/Prometheus/Loki/
Tempo, an SLO dashboard where the product-defining metric — playback sync
drift — has its own panel and alert.

The flagship test is a Playwright spec that boots the whole backend, opens two
real browsers in one room, and asserts they stay within a 2-second sync budget
through an auto-advance. The GIF below is that, running for real.

Everything is documented so it can be defended, not just shipped: 11 ADRs,
runbooks, a phase-by-phase roadmap with verified definitions of done.

Repo in the comments. Feedback very welcome — especially the critical kind.

#distributedsystems #typescript #nodejs #nestjs #nextjs #softwarearchitecture
#backend #websockets

---

## Part 2 — Mock technical interview

> How I'd walk an interviewer through the decisions. Spoken register, first
> person, with the numbers memorized. The honest answers ARE the strategy:
> every "here's what went wrong" story lands better than a perfect-world claim.

### The 30-second pitch (when they say "tell me about a project")

"LiloChat is a watch-together platform — public rooms where everyone watches
YouTube in perfect sync, with chat, a shared queue and skip votes. The
interesting constraint is that nobody can pause: each room runs a
server-authoritative timeline, like a TV channel. I built it as six NestJS
microservices behind two gateways — REST and WebSocket — with event
choreography over RabbitMQ, database-per-service on Postgres, Redis for hot
state, and a Next.js front end. And I load-tested, chaos-drilled and
documented the whole thing — every major decision has an ADR, and every
claim in the README links to evidence."

---

**Interviewer: Microservices for a hobby-scale app? Isn't that
over-engineering?**

Me: "Yes — and that's literally the first ADR in the repo. At launch scale a
modular monolith would be cheaper and simpler; I wrote that down before
writing any code. I chose microservices deliberately because demonstrating
distributed-systems patterns _was_ a first-class goal of the project, next to
shipping it. What I did to keep it honest: I capped the count at six services,
each with a boundary I can defend — identity has a different security posture,
playback owns the hard invariants, chat is a write-heavy append-only workload,
engagement is a pure event consumer that's allowed to lag. If a boundary
didn't have a reason like that, it didn't get to exist. Over-engineering is
choosing complexity you can't justify; I can justify every seam, including
the decision to accept the overhead."

---

**Interviewer: Walk me through how the video sync actually works.**

Me: "The key insight is a product decision, not a technical one: nobody can
pause. Once you remove pause, seek and play, the playback state of a room
collapses to a single tuple — video id, duration, and the server timestamp
when it started. Any client's correct position is just `now minus startedAt`,
clamped. No state machine, no reconciliation protocol.

So the server never streams anything and never even ticks — it only decides
_when a video starts_. Clients estimate the server clock NTP-style: ping over
the WebSocket, measure round-trip, offset is server-time minus midpoint,
smoothed with an EWMA over five samples. Then a drift loop compares the
player's actual position with the computed one, once a second. Under one
second of drift we do nothing — imperceptible. Between one and three seconds,
we set playbackRate to 1.05 or 0.95 until it catches up — users can't perceive
a 5% speed change, so correction is invisible. Past three seconds, or after a
rebuffer, we hard-seek.

My favorite property: a page refresh rejoins in sync _by construction_. The
REST snapshot has `startedAt`, the client computes the position and starts the
player there. There's nobody to ask 'where are we?' — the arithmetic is the
answer. The first version of this app had a 'king' client that others asked
for the current time. That king was elected client-side. This rewrite exists
partly because of that design."

---

**Interviewer: Why RabbitMQ and not Kafka?**

Me: "Because I don't have a replay or streaming requirement, and I do have a
work-distribution requirement. My events are commands-ish domain facts —
'video started', 'message submitted' — consumed by competing consumers with
retries and dead-letter queues. RabbitMQ gives me per-queue DLQs, per-message
acks, and topic routing with basically zero ceremony. Kafka would give me
partitioned logs and replay, which I don't need, at the cost of consumer
groups, offset management and a much heavier operational footprint. The ADR
keeps the door open: if I ever need event replay — say, rebuilding a read
model from history — that's the trigger to revisit. Choosing tech by the
requirement you actually have, and writing down the trigger that would change
the answer, is the whole game."

---

**Interviewer: How do you make sure events aren't lost or processed twice?**

Me: "Two patterns working as a pair. On the publish side, a transactional
outbox: the domain write and the event row commit in the same database
transaction, and a relay polls and publishes. So a service can crash at any
point and the event still exists — at-least-once by design. I have an
integration test that kills the relay between publishing and marking: you get
a hundred duplicates and zero losses.

Duplicates are then the consumer's problem, which is the second pattern: every
consumer claims the event id in Redis before processing — SETNX — and releases
the claim if the handler ultimately fails, so a dead-letter replay can
reprocess it. At-least-once delivery plus idempotent handling is
effectively-once processing, without distributed transactions.

One subtlety I like to mention: message ids double as idempotency keys further
down. Chat messages use the submitted event's id as the database primary key —
so even if everything else failed, the unique constraint is the last line of
defense against double-persisting."

---

**Interviewer: What happens if RabbitMQ goes down? Walk me through the blast
radius.**

Me: "I can answer with data, because I killed it on purpose under chat
traffic. The design principle is that the broker is not on the user's critical
path: chat broadcasts are optimistic — the gateway fans out over the socket
first and publishes for persistence second — and playback is client-side
arithmetic off a Redis tuple. So while the broker was down: rooms stayed
watchable, chat kept flowing, and the gateway buffered the publishes in a
bounded in-memory queue. When the broker came back, the bus reconnected,
re-asserted the topology, re-bound every consumer and flushed the buffer —
persistence caught up. In the drill: 79 messages sent during the window, 79
delivered live, 79 eventually persisted, zero errors.

The honest part: none of that reconnect machinery existed before the drill.
amqplib doesn't auto-reconnect, so the first version of the drill would have
left every service deaf until a redeploy. The drill is _why_ the reconnect
loop, the backoff with jitter and the publish buffer exist. That's my main
takeaway about resilience work: you don't know your failure behavior until
you've caused the failure."

---

**Interviewer: And Redis?**

Me: "Even better story — the first Redis drill _crashed my WebSocket gateway_.
An ioredis client without an error listener plus a library-internal promise
rejection took the whole process down. That found three real fixes: a single
factory for Redis clients that always attaches error handling and fails fast;
process-level guards — unhandled rejections get logged and survived, uncaught
exceptions log and exit so the orchestrator restarts us; and consumers that
pause and requeue when the idempotency store is unreachable instead of dying.

Re-run after the fixes: thirty seconds of full Redis outage, zero user-visible
impact — rate limits and feature flags fail open, presence heartbeats skip
silently and the TTL sweep recovers, joins fail with a retryable error.
Everything degraded is documented, including what _doesn't_ work during the
outage. I'd rather tell you what breaks than pretend nothing does."

---

**Interviewer: How do you know the system performs? Give me numbers.**

Me: "The SLOs were defined before the code — availability 99.5%, chat delivery
p95 under 500 ms, and the product-defining one: playback sync drift p95 under
2 seconds, sampled from real clients. Then I load-tested against them: a
thousand concurrent WebSocket connections across fifty rooms, with a hot room
of 150 people chatting at fifty times the sustained design spec. Chat delivery
p95 came in at 11 milliseconds against the 500 budget, connect success was
100%, and the gateway sat at ten percent of one core. I doubled it to two
thousand sockets — still green, latencies roughly doubled but two orders of
magnitude inside the SLO, so no knee in the curve. And I report the caveats
with the numbers: localhost, no TLS, no WAN RTT — the absolute milliseconds
are a floor, the flat shape under load is the finding.

Two bugs came out of the load test, both in my test harness, not the system —
and I kept them in the report, because finding harness bugs is what tells you
the harness is actually measuring something."

---

**Interviewer: Why choreography instead of a saga orchestrator?**

Me: "Because every cross-service flow in this system is short and
compensation-free. 'User joined → count viewers → credit watch time' doesn't
need a coordinator; each service reacts to facts and owns its own state. An
orchestrator earns its complexity when you have long-lived flows with
compensating actions — bookings, payments. I don't. The cost of choreography
is that the flow is implicit — nobody owns the big picture — and I paid that
cost down with observability instead of orchestration: trace context
propagates through the RabbitMQ message headers, so one trace in Tempo shows
the whole chain across services and the bus."

---

**Interviewer: You mentioned CQRS. Where, and why bother?**

Me: "One place, with a concrete reason — the home page. It's a directory of
room cards: name, current video, viewer count, playback position. Naively
that's a fan-out to three services per page load. Instead, the rooms service
maintains a `room_cards` read model, updated by events from playback and
presence at _write_ time. So the hottest read in the product is one indexed
query with keyset pagination. The staleness budget is explicit — cards can be
ten seconds behind — and a tiny denormalization detail I enjoy: the viewer
count updates use a floor-at-zero clamp so replayed presence events can't
drive it negative. CQRS everywhere is a disease; CQRS on the one read path
that deserves it is just engineering."

---

**Interviewer: How does auth work, and why those choices?**

Me: "Password hashing is argon2id. Tokens are RS256 — asymmetric on purpose:
identity holds the private key and signs; the gateways only hold the public
key and verify. No shared secret fanned out across services, and a compromised
gateway can't mint tokens. Access tokens live fifteen minutes; refresh tokens
are opaque random values hashed in the database, thirty days, rotating on
every use, with family revocation — if a stolen refresh token gets replayed
after rotation, the whole family dies.

The design choice that paid off unexpectedly: because refresh tokens are
database rows and not JWTs, rotating the signing keypair is nearly free. I
rehearsed it live — swap the keys, old access tokens get a 401, every session
silently recovers through one refresh call. No forced logout. Key rotation
being cheap is a property you design for, not something you get by accident."

---

**Interviewer: What would break first if this got 100× the traffic?**

Me: "First, the WebSocket gateway — it's the stateful component. It sheds at
five thousand connections per instance by design, and it scales horizontally
behind sticky sessions with the Redis adapter doing cross-instance fan-out, so
the path is more instances, and the load test says each one has headroom to
its cap. Second, the chat table — append-only and indexed by room and time; at
100× I'd partition it monthly, which is written down as an evolution point
rather than built prematurely. Third, Postgres — it's database-per-service on
one physical instance today, deliberately, but nothing crosses schemas, so
splitting is a connection-string change, not a migration. The general answer:
the bottlenecks are named in the capacity plan with their mitigations, and the
scaling story is written as a plan — k3s, HPA on the gateways, canary by
Traefik weights — not built before it's needed. Building it now would be the
same mistake as the microservices, except without the learning justification."

---

**Interviewer: What's the ugliest thing in the codebase?**

Me: "A few honest ones. The persisted-ack path for chat is bounded by the
outbox polling interval — about half a second median — which is a
durability-versus-latency knob I've documented rather than tuned, because the
SLO'd metric is the optimistic delivery, which is at 11 milliseconds. There's
a known race after a WebSocket reconnect where buffered sends can arrive
before the room re-join completes and get rejected — the drill found it, it's
on the polish list with a clear fix. And the CSP still allows unsafe-inline
scripts because of Next.js hydration; nonce-based CSP needs per-request
middleware and it's tracked as hardening, not done. I keep a list of these in
the repo on purpose — 'known and accepted, with reasons' beats a false clean
sheet."

---

**Interviewer: If you started over, what would you change?**

Me: "Honestly? For a product-first project I'd build the modular monolith and
keep the same _internal_ boundaries — the hexagonal seams, the outbox, the
contracts package — so extraction stays cheap if it's ever earned. What I
wouldn't change: writing SLOs before code, ADRs for every decision that hurt
to make, and doing the destructive testing early. The drills and the load test
changed the code more than any refactor — reconnect logic, process guards,
fail-open policies all exist because something broke on purpose in a terminal
where I could watch it happen."

---

> **Prep notes**
>
> - Numbers to have loaded: 11 ms chat p95 (SLO 500), 1k/2k sockets green,
>   ~10% of one core, 79/79/79 broker drill, 1500/1500 rows in the restore
>   drill (500 from WAL replay), drift budget 2 s, 5-min RPO via
>   `archive_timeout`, 6 services, 11 ADRs.
> - Every answer has a doc behind it: ADRs, `docs/load-test-report.md`,
>   `docs/degradation-drills.md`, `docs/runbooks/*`, `docs/security-pass.md` —
>   offer to screen-share the repo when an answer lands.
> - The meta-move: whenever possible, answer "why X" with the alternative you
>   rejected, the trigger that would change the decision, and where that's
>   written down.
