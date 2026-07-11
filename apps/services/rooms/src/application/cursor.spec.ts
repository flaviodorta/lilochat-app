import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('directory cursor codec', () => {
  it('round-trips', () => {
    const cursor = {
      createdAt: new Date('2026-07-10T12:34:56.789Z'),
      roomId: '00000000-0000-4000-8000-000000000001',
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('returns null for garbage instead of throwing', () => {
    expect(decodeCursor('not-base64!!')).toBeNull();
    expect(decodeCursor(Buffer.from('no-pipe-here').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('not-a-date|id').toString('base64url'))).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });
});
