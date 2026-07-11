# ADR-006: CQRS Read Model for the Room Directory

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

The home page is the storefront: an infinite-scroll grid of room cards, each showing the room
name, the current video (title, thumbnail, duration, and `startedAt` for the ticking hover
timestamp), and a live viewer count. That data is owned by three different places — rooms (name),
playback (current video and timeline), and presence (viewers). `GET /rooms` is the hottest read
endpoint and its first page is server-side rendered, so its latency budget is tight (it sits
inside the p95 < 300 ms read SLO).

## Decision Drivers

- Read latency and fan-out cost on the highest-traffic endpoint.
- Database-per-service (ADR-009) forbids cross-service joins.
- Staleness is explicitly tolerable here: room cards may lag reality by up to 10 s.
- Listing and search must be a single indexed, keyset-paginated query.

## Considered Options

1. **API composition at read time** — the gateway fans out to rooms, playback, and presence on
   every page load and merges the results. Always fresh, but three network hops on the hot path,
   latency coupled to the slowest service, and browsing breaks whenever any one of them is down.
2. **CQRS read model, composed at write time** — the rooms service maintains a denormalized
   `room_cards` table by consuming `playback.video.started` and `presence.user.joined/left`
   events. Reads are one indexed query; staleness is bounded by event propagation.
3. **Shared database view** — a cross-schema view joining the three sources. Fast, but it breaks
   database-per-service ownership and welds the services together at the schema level.

## Decision

Option 2. `room_cards(room_id, name, viewers, video_id, video_title, thumb_url, duration_s,
started_at, updated_at)` lives in `rooms_db`, maintained by idempotent event consumers
(ADR-005). `GET /rooms?cursor=&q=` becomes a single keyset-paginated query feeding the web app's
infinite scroll, and the lobby socket namespace broadcasts `room:summary` updates throttled to
one per 10 s per room. The aggregation cost moves from read time to write time.

## Consequences

### Positive

- The storefront reads from one table with one index — fast, cheap, and SSR-friendly.
- Browsing keeps working even if playback or presence is down; cards merely go stale.
- The composition cost is paid once per state change instead of once per page view.

### Negative

- Cards are eventually consistent (<= 10 s budget): viewer counts and "now playing" can briefly
  lie, which is accepted and documented.
- Denormalized state can drift if events are lost or mishandled — prevented by the outbox and
  idempotent consumers, with a documented reseed path as the backstop.
- Every new card field means touching the event contracts and the projection, not just a query.
