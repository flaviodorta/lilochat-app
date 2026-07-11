# ADR-004: Server-Authoritative No-Pause Timeline with playbackRate Drift Correction

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

Synchronized playback is the product core, and the predecessor app failed at it: playback
authority was a client-side elected room "king" (trivially forgeable), sync happened only on
discrete events with a magic `setTimeout(600)`, and there was no drift correction, so clients
diverged until the next event. The rewrite's product rule — nobody can pause, seek, or play; the
room advances like a broadcast channel — is also an architectural gift: per-room playback state
collapses to a single tuple `{itemId, videoId, durationMs, startedAtMs}` on the server clock, and
any client can compute the current position as `clamp(now - startedAtMs, 0, durationMs)`.

## Decision Drivers

- Sync drift is the product-defining SLI: p95 of |client position - server timeline| < 2 s.
- Authority must be unforgeable and must survive client refresh and reconnect.
- Corrections must be imperceptible; visible seeks feel broken to users.
- Reconnects must land in a resynced state within 5 s (SLO).

## Considered Options

1. **Client authority / leader election** (the legacy model) — no server timeline; one client is
   the source of truth. Forgeable, race-prone, and it dies with the leader's tab. Rejected on
   direct evidence from the predecessor.
2. **Server position ticks** — the server broadcasts the current position every few seconds and
   clients snap to it. Simple, but generates constant fan-out traffic, and snapping produces
   visible seeks instead of smooth correction.
3. **Server-authoritative timeline + client clock sync + continuous drift policy** — the server
   stores only the start-time tuple; clients estimate their clock offset NTP-style over the
   WebSocket (ping/pong, offset smoothed with an EWMA over the last 5 samples, re-sampled every
   30 s) and correct themselves continuously.

## Decision

Option 3. Auto-advance is a BullMQ delayed job firing at `startedAtMs + durationMs + 1500 ms`
grace, keyed by roomId so there is a single writer per room and no distributed locking. The
client-side drift policy: |drift| < 1 s is ignored; 1–3 s triggers a soft correction via
`playbackRate = 1.05` (or `0.95`) until caught up; > 3 s, or any post-buffering state, triggers a
hard `seekTo(position)`. Clients report sampled drift measurements to feed the SLI.

## Consequences

### Positive

- A page reload rejoins in sync by construction: REST snapshot, compute position locally, start
  the player at the right second — no round-trip to any "authority" client.
- Zero steady-state sync traffic; the same tuple powers the home page's ticking hover timestamps
  for free.
- Timeline math and the drift policy are pure functions — exhaustively unit-testable.

### Negative

- The no-pause rule is load-bearing: adding pause/seek later would force a redesign of the state
  model, not a feature flag.
- Browsers block unmuted autoplay, so joining starts muted behind a "tap to unmute" overlay — a
  deliberate, documented UX compromise.
- The drift SLI depends on sampled client telemetry, adding a client reporting path that must be
  built and trusted.
