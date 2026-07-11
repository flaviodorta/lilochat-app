# LiloChat — Execution Roadmap

> Step-by-step build plan. Architecture and rationale live in [CLAUDE.md](../CLAUDE.md) — this file
> is the _order of work_. Each step is small, verifiable, and ends with a Definition of Done (DoD).
> Check boxes as steps complete; never start a phase before the previous phase's DoD is green.
> Macro rule: **vertical slices** — every phase ends deployed and demoable.
> Micro rule: within a slice, build back → front.

Effort guide (solo, part-time): P0 ≈ 5%, P1 ≈ 15%, **P2 ≈ 30%**, P3 ≈ 15%, P4 ≈ 10%, P5 ≈ 10%,
P6 ≈ 10%, P7 ≈ 5%. Phase 2 is the hardest and most valuable — protect time for it.

---

## Phase 0 — Foundation (repo, infra, CI)

- [x] **0.1 Repo & workspace.** `git init`; pnpm workspaces + Turborepo; root `package.json`,
      `turbo.json`, `.gitignore` (includes `.env*`, keeps `.env.example`), `.editorconfig`.
      DoD: `pnpm install` clean; empty `turbo build` passes.
- [x] **0.2 Tooling package.** `packages/tooling`: shared `tsconfig` bases (strict), ESLint flat
      config, Prettier. DoD: `turbo lint typecheck` wired and green.
- [x] **0.3 Contracts package (skeleton).** `packages/contracts`: zod + folder layout
      (`dto/`, `events/domain/`, `events/socket/`) + the `DomainEvent<T>` envelope. Start with
      auth DTOs only — contracts grow per phase, never speculatively.
      DoD: package builds, importable from a scratch file.
- [x] **0.4 Dev infra.** `docker/compose.dev.yml`: Postgres 16 (init script creating the 5 logical
      DBs), Redis 7, RabbitMQ 4 (+ management UI). Observability containers (Collector, Grafana,
      Prometheus, Loki, Tempo) behind `--profile obs` so daily dev stays light.
      Host ports 5440 (pg) / 6380 (redis) — defaults are taken by other local projects.
      DoD: `docker compose up` healthy; can connect to all three from host. ✅ 5 DBs verified.
- [x] **0.5 nest-shared package (skeleton).** `packages/nest-shared`: zod-validated config module,
      pino logger module, health module (`/health/live|ready`). (Outbox/consumer come in P2 when
      first needed.) DoD: unit tests pass. ✅ 6 tests green.
- [ ] **0.6 CI.** GitHub repo + Actions: lint → typecheck → test → build, Turborepo remote/actions
      cache, affected-only. DoD: badge green on main.
      ⚠ Workflow written (`.github/workflows/ci.yml`); pending: create the GitHub repo + first push.
- [x] **0.7 ADRs.** `docs/adr/` with MADR template + ADR-001..011 written from the CLAUDE.md index.
      DoD: files exist; index links resolve. (ADR-008 avatars: status Proposed — owner call pending.)
- [x] **0.8 README skeleton.** Name, one-liner, logo, "under construction", link to CLAUDE.md.

**Phase DoD:** fresh clone → `pnpm i && docker compose up -d && turbo build test` all green, in CI too.

---

## Phase 1 — Identity (auth end-to-end + design system seed)

Backend first:

- [x] **1.1 Identity service scaffold.** `apps/services/identity` (NestJS, hexagonal-lite:
      `domain/ application/ infrastructure/`). Prisma + first migration: `users`,
      `refresh_tokens`. DoD: service boots, `/health/*` OK, migration applies.
      ✅ /health/ready verifies Postgres for real (`SELECT 1`); port 4101.
- [x] **1.2 Domain & use cases.** User entity (nickname rules: 3–20 chars, unique, url-safe),
      argon2id hashing; use cases: `Register`, `Login`, `Refresh` (rotation + reuse detection →
      revoke family), `Logout`, `GetProfile`, `UpdateNickname`. Pure unit tests — no framework.
      DoD: ≥ 90% coverage on domain/application. ✅ 99% stmts / 96% branches, 23 unit tests.
- [x] **1.3 Tokens.** RS256 keypair generation script (`scripts/gen-keys.mjs`, keys via env);
      access 15 min / refresh 30 d. DoD: integration test: full register→login→refresh→reuse-detect.
      ✅ 6 integration tests vs real Postgres/argon2/RS256 (`pnpm test:int`); reuse kills the family.
- [x] **1.4 API Gateway scaffold.** `apps/api-gateway`: global zod validation pipe (contracts),
      helmet, strict CORS, Redis token-bucket rate limit (per-IP anon, per-user authed), auth guard
      (RS256 public key), internal HTTP routing to identity, `/auth/*` + `/users/me*` exposed.
      DoD: supertest E2E through the gateway.
- [x] **1.5 Avatar endpoint.** `GET /avatars/:seed.svg` per ADR-008: Multiavatar + Redis
      cache-aside (30 d TTL) + circuit breaker + local-lib fallback. DoD: cold/warm/breaker-open
      paths tested.

Frontend:

- [x] **1.6 Web scaffold + design tokens.** `apps/web`: Next.js App Router, Tailwind v4 tokens from
      CLAUDE.md §12 (zinc scale, purple brand, semantic colors), Inter via `next/font`,
      Luckiest Guy loaded **only** for the wordmark component, copied-in Tailwind primitives
      (no component libraries), framer-motion, TanStack Query provider, dark default.
      DoD: styleguide route (`/dev/ui`) rendering tokens + core components. ✅ verified live.
- [x] **1.7 Header + shell.** Glassy sticky header: logo + wordmark, search (disabled stub),
      "Create room" CTA (stub), auth slot. DoD: responsive, matches §12.2.
- [x] **1.8 Auth modal.** Dialog from header CTA + gated actions (no auth pages — owner call):
      animated slide between Sign in / Create account panels, react-hook-form + zod (same
      contracts), **live Multiavatar preview** on nickname typing (debounced), error states,
      session handling: refresh in httpOnly cookie, access in memory w/ silent refresh.
      DoD: full flow against local stack. ✅ API flow verified end-to-end (register→refresh→
      me→logout vs live stack); in-browser click-through becomes the first Playwright case (1.9).
      ⏳ "resume gated action after auth" deferred to Phase 2 (first real gated action = join room).
- [ ] **1.9 E2E + deploy.** Playwright: register→login→profile. VPS setup: Docker + Traefik (TLS),
      compose.prod v0 (gateway, identity, web, pg, redis), GH Actions deploy job (GHCR + SSH),
      domain + HTTPS. DoD: auth works on the public URL.
      ✅ done locally: Playwright E2E (2 tests, full journey incl. cookie flags + session resume);
      Dockerfiles (turbo prune) for identity/gateway/web; Next standalone; compose.prod with
      Traefik + Let's Encrypt; all 3 images built and smoke-tested (register works containerized).
      ⏳ owner decisions (2026-07-10): GitHub repo will be created manually by the owner (URL
      pending → then: remote, push, CI green closes 0.6). VPS/domain deliberately deferred —
      **Phase 2 first**, deploy when the sync core is demoable. Public-URL DoD moves with it.

**Phase DoD:** a stranger can sign up on the internet and see their avatar. CI deploys on merge.

---

## Phase 2 — The Core (rooms + playback + realtime + sync) ⭐

Contracts first:

- [x] **2.1 Contracts.** Room/playback DTOs; domain events (`room.*`, `playback.*`); socket events
      (`/room` namespace, `sync:ping/pong`). DoD: reviewed against CLAUDE.md §6.1/§7.2.

Messaging backbone (first real use → build it now):

- [x] **2.2 nest-shared: messaging.** RabbitMQ publisher (topic exchange `lilochat.events`),
      `bindConsumer` with: zod-parse, **idempotency** (Redis SETNX by eventId, claim released on
      failure), retry (3× expo backoff + full jitter), DLQ per queue. DoD: integration tests.
      ✅ 4 integration tests vs real RabbitMQ+Redis (repo pattern: compose infra, not
      Testcontainers — same guarantee, one less moving part; revisit for CI in 0.6).
- [x] **2.3 nest-shared: transactional outbox.** Outbox table convention (Prisma model in the
      relay's docblock) + `outboxRowFrom` helper + generic `OutboxRelay` (poll 500ms, batch 100,
      overlap-guarded; services adapt their PrismaClient in ~5 lines).
      DoD: kill-the-relay test proves no loss. ✅ crash between publish and mark ⇒ 100 duplicates,
      0 losses, all rows eventually marked — consumer idempotency collapses the dupes.

Services:

- [x] **2.4 Rooms service.** `rooms` + `room_cards` tables; `CreateRoom` (name 3–50 chars),
      keyset-paginated `ListRooms` (+ `q` search via trigram index), consume
      `playback.video.started` → update card. Publishes `room.created` (outbox).
      DoD: pagination/search integration tests. ✅ 5 integration tests: outbox→bus publish,
      keyset pages 10/10/5 without dupes, trigram ILIKE search, consumer→card update.
      Note: room+card+outbox created in ONE transaction (card born with the room);
      RabbitMQ 4 gotcha documented (transient non-exclusive queues are forbidden).
- [x] **2.5 Playback service — metadata.** YouTube Data API client (server-side key), URL→videoId
      parser (all YT URL shapes), `videos` cache table (cache-aside, permanent), circuit breaker,
      **reject videos > 4 h or non-embeddable**. DoD: unit tests incl. breaker-open degrade.
      ✅ 37 unit tests (timeline math, URL/ISO-duration parsers); breaker moved to nest-shared;
      integration proves cache-aside (1 API call per videoId) + 404/422 validations.
- [x] **2.6 Playback service — timeline.** Queue CRUD (`AddVideo` w/ dup check, positions);
      Redis tuple `room:{id}:playback`; BullMQ **auto-advance scheduler** (delayed job at
      `startedAt+duration+grace`, jobId = roomId for per-room serialization; reschedule on skip);
      consume `room.created` → start first video when added. Publishes `playback.video.added/
started/skipped`, `playback.queue.updated` (outbox). DoD: integration test — add 2 short
      videos, watch auto-advance fire; **timeline math unit-tested exhaustively**.
      ✅ 6 integration tests: idle-room autostart, THE auto-advance (video2 starts by itself),
      queue-drained→idle, remove permissions. Design notes: no room.created consumer needed
      (AddVideo starts idle rooms); BullMQ jobId = itemId, NOT roomId — rescheduling from
      inside the active job dedupes silently (and ':' is forbidden in custom ids).
- [x] **2.7 Gateway routes.** `GET /rooms` (cards), `POST /rooms`, `GET /rooms/:id` (composed:
      card + queue + tuple), `POST /rooms/:id/queue`, `DELETE /rooms/:id/queue/:itemId`.
      DoD: E2E via supertest. ✅ 5 composition tests (stubbed services): create composes
      rooms→playback with JWT identity; detail merges card+state; DELETE resolves ownership
      server-side; reads public, mutations authed. First-video failure → room starts idle (logged).

Realtime:

- [x] **2.8 Realtime gateway.** Socket.io + Redis adapter, `/room` namespace, JWT handshake,
      `room:join` (membership check), consume `playback.*` → broadcast to room,
      `sync:ping`→`sync:pong` (serverNow). Load-shedding caps (5k/instance, 200/room).
      DoD: socket.io-client integration test receives `playback:started` after REST queue add.
      ✅ 4 integration tests: unauthorized handshakes rejected, clock sync, bus event →
      room-scoped broadcast (no cross-room leak asserted), room_full shedding. Note:
      competing consumers across instances is CORRECT — the Redis adapter fans out.
      Room occupancy via fetchSockets() (adapter-wide). Port 4110.

Frontend (the payoff):

- [x] **2.9 Home v1.** Card grid + `useInfiniteQuery` (keyset cursor) + IntersectionObserver +
      skeletons; **hover: ticking exact time** `mm:ss / mm:ss` + progress bar computed from
      `startedAt` (1 s interval while hovered); create-room modal (name + first URL → navigate).
      DoD: matches §12.2 home spec.
- [x] **2.10 Player + sync engine.** YouTube IFrame API wrapper (controls hidden, personal
      volume/mute UI, "tap to unmute" overlay); clock-offset estimator (EWMA of 5 ping samples,
      resample 30 s); **drift loop**: <1 s ignore · 1–3 s playbackRate 1.05/0.95 · >3 s hard seek;
      resync after buffer/reconnect (REST snapshot → subscribe → apply). DoD: manual 2-browser
      test visually in sync; drift telemetry event wired (sampled 1/min).
- [x] **2.11 Room page v1.** Player zone + queue tab (playing item glow, add-video modal with
      paste→preview) per §12.2. Chat panel placeholder. DoD: full loop create→add→watch→auto-advance.
- [x] **2.12 Flagship test + deploy.** Playwright **two-context sync test**: both clients within
      2 s of server position; auto-advance moves both. Add rooms/playback/realtime + rabbitmq to
      prod compose; Traefik sticky sessions for WS. DoD: flagship test in CI (headed YT iframe —
      if flaky in CI, run against a local deterministic player stub + keep real-YT variant nightly).

✅ 2.12 note: flagship green (15s run) — full stack booted by Playwright (identity, rooms,
playback w/ stubbed YouTube API, RTG, gateway, web): 2s sync budget sampled across two browsers,
auto-advance lands on BOTH, reload rejoins in sync. Probe = offset-corrected position ticker
(the same §6.2 arithmetic the drift engine steers the real player toward); real-YouTube playback
verified manually (headless Chromium lacks the codecs). Deploy half still deferred (owner call).

**Phase DoD:** two strangers on the internet watch the same video in sync. 🎬 Record the demo GIF now.

---

## Phase 3 — Chat + Presence

- [x] **3.1 Contracts.** `chat.*`, `presence.*` domain events; `chat:*`, `presence:*` socket events.
      ✅ + tempId threaded through submitted→persisted so acks reconcile optimistic messages;
      nickname denormalized at the source (§8).
- [x] **3.2 Chat service.** `messages` table (idx `room_id, created_at desc`); consume
      `chat.message.submitted` → persist → publish `chat.message.persisted` (outbox);
      `GET /rooms/:id/messages?cursor=` keyset. DoD: pipeline integration test.
      ✅ 3 integration tests: submit→persist→ack (tempId round-trip), exactly-once on
      redelivery (messageId = submitted eventId: the PK is the second idempotency belt),
      pagination 50/50/20 no dupes. Port 4104.
- [x] **3.3 RTG: chat relay.** `chat:send`: token bucket (1 msg/s), ≤500 chars, optimistic
      broadcast (`chat:new` pending + tempId) → publish; consume persisted → `chat:ack`;
      DLQ path → `chat:retract`. DoD: integration test incl. rate-limit rejection.
      ✅ 2 integration tests. Deviation: no DLQ-watcher retraction — the client times out
      unacked pending messages instead (simpler, same UX; revisit if it ever matters).
      TokenBucket promoted to nest-shared (3rd consumer).
- [x] **3.4 RTG: presence.** TTL keys (75 s) + 30 s heartbeat, `presence.user.joined/left`
      (sessionId, TTL-sweep for ghosts), `presence:state` on join, joined/left broadcasts.
      DoD: kill a socket ungracefully → `left` fires ≤ 75 s.
      ✅ 2 integration tests: full join/leave flow + a PLANTED expired session reaped by the
      sweeper (the true ghost-killer path). Design: ZSET score = expiry (not key TTL — the
      sweep needs to know WHO expired to publish left); heartbeat piggybacks on sync:ping.
- [ ] **3.5 Rooms: viewer counts + lobby.** Consume presence → `room_cards.viewers`; RTG `/lobby`
      namespace broadcasting `room:summary` throttled 1/10 s/room. DoD: two tabs — home count
      updates live.
- [ ] **3.6 Web: chat panel.** Virtualized list, upward infinite scroll (`useInfiniteQuery`),
      avatars + deterministic nickname colors, day dividers, system-message chips, composer
      (Enter sends, grows to 4 lines, char counter), presence avatar stack. DoD: §12.2 chat spec;
      2-browser chat E2E; deploy.

**Phase DoD:** rooms feel alive — chat, join/leave, live counts everywhere, zero ghost users.

---

## Phase 4 — Queue UX + Skip Votes

- [ ] **4.1 Vote engine (playback).** Redis vote state (TTL 45 s), rules: one open vote/room,
      90 s cooldown after fail, quorum `floor(present/2)+1` **recomputed at resolution**, resolve
      on quorum-hit or timeout; skip → cancel/reschedule BullMQ job. Publishes `playback.vote.*`.
      DoD: unit tests for every rule + quorum-shrink edge case (voters leaving mid-vote).
- [ ] **4.2 RTG relay.** `vote:start`/`vote:cast` (idempotent per user) in; `vote:started/
progress/finished` out. DoD: integration test 3 sockets.
- [ ] **4.3 Web: vote overlay.** Floating card (spring-in), countdown ring, `4/7` progress, result
      toast; "Vote skip" button states (available/cooldown/open). DoD: §12.2 overlay spec.
- [ ] **4.4 Queue polish.** Remove item (adder/owner, hover affordance), system messages for
      added/skipped/vote events, empty-queue idle state ("Be the first — add a video").
- [ ] **4.5 E2E + deploy.** Playwright 3-context vote: 2/3 vote yes → both players jump to next
      video together.

**Phase DoD:** the full social loop — add, watch, vote, skip — works in production.

---

## Phase 5 — Engagement (ranking)

- [ ] **5.1 Engagement service.** Consume `presence.user.joined/left` + `presence.checkpoint`
      (RTG publishes batched 60 s) + `playback.video.started/skipped`; accumulate **qualified
      time** (only while room playing); `watch_sessions` + `user_totals`; Redis ZSETs
      `leaderboard:{alltime|YYYY-MM|YYYY-Www}`. DoD: replay-safe (idempotent) integration tests;
      crash loses ≤ 60 s (checkpoint RPO).
- [ ] **5.2 Gateway.** `GET /leaderboard?period&cursor`, `GET /users/me/stats`. DoD: E2E.
- [ ] **5.3 Web: leaderboard + stats.** Period tabs, top-3 podium (gold/silver/bronze glow),
      ranked rows, own row pinned; watch-time card on profile; People tab shows session time.
      DoD: §12.2 leaderboard spec; deploy.

**Phase DoD:** watching time visibly climbs the leaderboard within a minute.

---

## Phase 6 — Production Hardening

- [ ] **6.1 Observability.** OTel SDK all services (HTTP + RabbitMQ header propagation),
      Collector in prod compose, Grafana stack live; **SLO dashboard** (§4.1 incl. sync-drift
      histogram from client telemetry), per-service dashboards; alerts: burn-rate, DLQ>0 5 min,
      outbox lag>30 s, drift p95, cert expiry. Datadog exporter block documented (off).
      DoD: one click from alert → trace → logs.
- [ ] **6.2 Load test.** k6 WS scenario (1k sockets across 50 rooms + chat storm in one hot room);
      fix what breaks; write `docs/load-test-report.md` (portfolio artifact).
- [ ] **6.3 Backups & DR.** WAL archiving to object storage + nightly base backup; **restore
      rehearsal on a scratch VPS** (timed → validates RTO 1 h); runbooks: deploy, restore,
      DLQ replay.
- [ ] **6.4 Security pass.** Full checklist: headers/CSP, CORS exact origins, chat sanitization,
      `pnpm audit` + Renovate, rate-limit review, secrets rotation drill, dependency pinning.
- [ ] **6.5 Feature flags + graceful degradation drills.** Redis kill switches (chat, votes,
      room creation); chaos-lite: stop RabbitMQ (rooms stay watchable), stop Redis (documented
      behavior), restart each service under traffic (graceful drain verified).

**Phase DoD:** you'd sleep fine the night of a launch spike.

---

## Phase 7 — Polish & Launch

- [ ] **7.1 Design pass.** Motion audit (150–250 ms, reduced-motion), empty/error/loading states
      everywhere, onboarding hints (first visit → "join a room, add a video"), 404/500 pages
      with brand.
- [ ] **7.2 SEO & sharing.** Metadata, OG images per room (current video thumb + name), sitemap,
      favicons from logo.
- [ ] **7.3 README = portfolio front door.** Hero GIF (two browsers in sync), C4 diagrams,
      "architecture highlights" section linking CLAUDE.md + ADRs + load-test report, local-dev
      quickstart, screenshots.
- [ ] **7.4 Analytics + launch.** Self-hosted Umami/Plausible; final domain, share (LinkedIn post
      is part of the portfolio plan — write it from the demo GIF).

**Phase DoD:** a recruiter landing on the repo understands the system in 3 minutes and can click
into a live deployment.

---

## Working agreement

- Sessions start by reading this file; work the first unchecked box top-down unless agreed otherwise.
- A box is checked only with its DoD verified (test run, deploy checked — not "should work").
- Scope changes → update CLAUDE.md (+ ADR if architectural) before code.
- Weekly: quick retro — anything learned that changes later phases? Update this file.
