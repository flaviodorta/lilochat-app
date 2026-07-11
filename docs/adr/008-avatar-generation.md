# ADR-008: Avatar Generation — Multiavatar HTTP API vs Official npm Library

- **Status:** Proposed (final call pending with the product owner)
- **Date:** 2026-07-10

## Context

Profiles use deterministic avatars generated from the user's nickname via Multiavatar — there are
no file uploads in v1. Avatars appear on hot paths everywhere: chat messages at 28 px, presence
stacks, the leaderboard podium, and the sign-up page's live nickname preview. Generation therefore
must be fast, cacheable, and reliable. The product owner has requested integrating the hosted
Multiavatar HTTP API. Engineering reviewed the integration and notes that Multiavatar also ships
an official npm package that produces identical SVGs from the same seed, entirely in-process.

## Decision Drivers

- Determinism: the same nickname must yield the same avatar, everywhere, forever.
- Reliability: a third-party outage should not degrade chat rendering or the sign-up preview.
- Rate limits: the hosted API is rate-limited; the npm library has no such ceiling.
- Operational simplicity: fewer external dependencies means less resilience machinery to build
  and maintain.

## Considered Options

1. **Multiavatar HTTP API via server proxy** (product owner's request) — `GET /avatars/:seed.svg`
   proxies to the hosted API with Redis cache-aside (30-day TTL), a circuit breaker, and a locally
   generated fallback avatar while the circuit is open. Works, but imports an external failure
   mode and a rate limit for output the library can produce identically offline.
2. **Official Multiavatar npm library, generated server-side** (engineering recommendation) — the
   same endpoint generates SVGs in-process, cached identically. Identical avatars, zero external
   dependency, no rate limits, no circuit breaker needed; the generator version is pinned in the
   lockfile.
3. **Client-side generation in the web app** — no endpoint at all, but it ships the generator in
   the client bundle, repeats work on every client, and complicates shared caching and future
   OG-image reuse.

## Decision

Pending. Engineering recommends option 2: identical output with strictly fewer failure modes and
no external quota. The product owner's request (option 1) stands until they make the final call.
Importantly, the public contract — `GET /avatars/:seed.svg` behind Redis cache-aside — is the same
in both options, so dependent work (auth pages, chat UI) proceeds against the endpoint regardless
of the outcome.

## Consequences

### Positive (either option)

- One canonical, cached avatar per seed served from our edge; deterministic across the product.
- The endpoint seam isolates the choice: swapping generation strategy touches a single module.

### Negative

- Option 1 carries a permanent external dependency, rate-limit exposure, and breaker/fallback
  code — all for output the library produces identically.
- Option 2 ties avatar style and upgrades to the npm package's release cadence.
- Until decided, the resilience scope of the Phase 1 avatar task (breaker or no breaker) stays
  ambiguous and both paths must be kept open.
