/**
 * THE product core (CLAUDE.md §6.2, ADR-004). Because nobody can pause,
 * a room's playback state collapses to { startedAtMs, durationMs } and every
 * question about "where is the room now" is pure arithmetic on the server clock.
 */
export interface TimelineTuple {
  startedAtMs: number;
  durationMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Current position within the video: 0 ≤ position ≤ duration. */
export function positionMs(nowMs: number, tuple: TimelineTuple): number {
  return clamp(nowMs - tuple.startedAtMs, 0, tuple.durationMs);
}

/** True once the video has fully played out (grace not included). */
export function isFinished(nowMs: number, tuple: TimelineTuple): boolean {
  return nowMs - tuple.startedAtMs >= tuple.durationMs;
}

/** When the auto-advance job must fire: end of video + grace for buffering tails. */
export function advanceAtMs(tuple: TimelineTuple, graceMs: number): number {
  return tuple.startedAtMs + tuple.durationMs + graceMs;
}

/** Milliseconds of video left (0 when finished; full duration before start). */
export function remainingMs(nowMs: number, tuple: TimelineTuple): number {
  return tuple.durationMs - positionMs(nowMs, tuple);
}
