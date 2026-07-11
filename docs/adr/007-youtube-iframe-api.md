# ADR-007: YouTube IFrame Player API Directly, Not react-player

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

The sync engine (ADR-004) makes unusual demands on the player: soft drift correction sets
`playbackRate` to 1.05 or 0.95 until the client catches up, hard correction needs precise
`seekTo`, the drift loop must react to buffering-state transitions, and the product hides every
native control (no pause, no seek — only personal volume, mute, and quality). React wrapper
libraries such as react-player target the common case — declarative play/pause across many
providers — and expose advanced, provider-specific calls unevenly, often only through escape
hatches into the underlying player instance.

## Decision Drivers

- First-class access to `playbackRate`, `seekTo`, and player state events (buffering drives the
  drift policy's hard-correction branch).
- Full control over chrome: all native controls hidden, custom overlay UI on top.
- Dependency risk: a wrapper that lags YouTube API changes would sit in the middle of the
  product-defining feature.
- YouTube is the only provider in v1; multi-provider support is explicitly out of scope.

## Considered Options

1. **react-player** — quick start, a friendly declarative surface, and multi-provider flexibility
   we do not need. Advanced control means reaching through the abstraction to the raw YouTube
   player anyway, so we would own the hard parts while still carrying the dependency.
2. **Official YouTube IFrame Player API with a thin in-house wrapper** — a small React wrapper
   owning script loading, the API-ready lifecycle, and a typed event/command surface tailored to
   the sync engine. Full capability, no intermediary.
3. **Plain iframe embed without the JS API** — no programmatic control at all; incompatible with
   drift correction. Listed for completeness.

## Decision

Option 2: a thin wrapper over the official YouTube IFrame Player API in `apps/web`, exposing
exactly what the sync engine and room UI need — load/cue, `playbackRate`, `seekTo`, mute/volume,
and state-change events — and nothing else.

## Consequences

### Positive

- The drift loop talks to the real player API with no abstraction tax or feature gaps.
- One fewer third-party dependency in the most critical client path; only YouTube's own API
  cadence to track.
- The wrapper is small, typed, and testable against a deterministic player stub — which the CI
  variant of the flagship two-browser sync test also uses.

### Negative

- We own boilerplate a library would provide: script injection, ready/error lifecycle, and
  cross-browser iframe quirks.
- A less community-tested surface: player edge cases are ours to diagnose.
- The wrapper is YouTube-specific by design; a second provider would require a new adapter
  (accepted — out of scope for v1).
