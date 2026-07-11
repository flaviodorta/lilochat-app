import { describe, expect, it } from 'vitest';
import { advanceAtMs, isFinished, positionMs, remainingMs } from './timeline.js';

const tuple = { startedAtMs: 1_000_000, durationMs: 212_000 }; // 3m32s video

describe('positionMs', () => {
  it('is 0 before the start (clock skew tolerance)', () => {
    expect(positionMs(999_999, tuple)).toBe(0);
    expect(positionMs(0, tuple)).toBe(0);
  });

  it('tracks elapsed time during playback', () => {
    expect(positionMs(1_000_000, tuple)).toBe(0);
    expect(positionMs(1_000_001, tuple)).toBe(1);
    expect(positionMs(1_106_000, tuple)).toBe(106_000); // halfway
    expect(positionMs(1_211_999, tuple)).toBe(211_999); // last ms
  });

  it('clamps at the duration after the video ends', () => {
    expect(positionMs(1_212_000, tuple)).toBe(212_000);
    expect(positionMs(9_999_999, tuple)).toBe(212_000);
  });

  it('handles a zero-duration tuple without going negative', () => {
    const zero = { startedAtMs: 1_000, durationMs: 0 };
    expect(positionMs(500, zero)).toBe(0);
    expect(positionMs(5_000, zero)).toBe(0);
  });
});

describe('isFinished', () => {
  it('flips exactly at startedAt + duration', () => {
    expect(isFinished(1_211_999, tuple)).toBe(false);
    expect(isFinished(1_212_000, tuple)).toBe(true);
    expect(isFinished(1_212_001, tuple)).toBe(true);
  });

  it('is false before the start', () => {
    expect(isFinished(0, tuple)).toBe(false);
  });
});

describe('advanceAtMs', () => {
  it('is end-of-video plus the buffering grace', () => {
    expect(advanceAtMs(tuple, 1_500)).toBe(1_213_500);
    expect(advanceAtMs(tuple, 0)).toBe(1_212_000);
  });
});

describe('remainingMs', () => {
  it('full duration before start, decreasing during, 0 after', () => {
    expect(remainingMs(0, tuple)).toBe(212_000);
    expect(remainingMs(1_106_000, tuple)).toBe(106_000);
    expect(remainingMs(1_212_000, tuple)).toBe(0);
    expect(remainingMs(9_999_999, tuple)).toBe(0);
  });
});
