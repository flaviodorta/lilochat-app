import { describe, expect, it } from 'vitest';
import { createRoomBodySchema, listRoomsQuerySchema, youtubeUrlSchema } from './rooms.js';

describe('youtubeUrlSchema', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=abc12345678',
    'https://music.youtube.com/watch?v=abc12345678',
    'https://www.youtube.com/shorts/abc12345678',
  ])('accepts %s', (url) => {
    expect(youtubeUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    'https://vimeo.com/12345',
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=x',
    'not a url',
    'ftp://youtube.com/watch',
  ])('rejects %s', (url) => {
    expect(youtubeUrlSchema.safeParse(url).success).toBe(false);
  });
});

describe('createRoomBodySchema', () => {
  it('trims and bounds the room name', () => {
    const parsed = createRoomBodySchema.parse({
      name: '  Lofi & Chill  ',
      firstVideoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(parsed.name).toBe('Lofi & Chill');

    expect(
      createRoomBodySchema.safeParse({ name: 'ab', firstVideoUrl: 'https://youtu.be/x1y2z3w4v5' })
        .success,
    ).toBe(false);
  });
});

describe('listRoomsQuerySchema', () => {
  it('defaults and coerces limit; caps at 50', () => {
    expect(listRoomsQuerySchema.parse({}).limit).toBe(20);
    expect(listRoomsQuerySchema.parse({ limit: '35' }).limit).toBe(35);
    expect(listRoomsQuerySchema.safeParse({ limit: '99' }).success).toBe(false);
  });
});
