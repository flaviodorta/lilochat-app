import { describe, expect, it } from 'vitest';
import { parseIsoDurationToSeconds, parseYoutubeVideoId } from './video-url.js';

const ID = 'dQw4w9WgXcQ';

describe('parseYoutubeVideoId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://youtube.com/watch?v=${ID}&list=PL123&index=2`, ID],
    [`https://m.youtube.com/watch?v=${ID}`, ID],
    [`https://music.youtube.com/watch?v=${ID}&si=abc`, ID],
    [`https://youtu.be/${ID}`, ID],
    [`https://youtu.be/${ID}?t=42`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
    [`https://www.youtube.com/shorts/${ID}?feature=share`, ID],
    [`https://www.youtube.com/embed/${ID}`, ID],
    [`https://www.youtube.com/live/${ID}?feature=share`, ID],
  ])('extracts from %s', (url, expected) => {
    expect(parseYoutubeVideoId(url)).toBe(expected);
  });

  it.each([
    'https://www.youtube.com/watch', // no v param
    'https://www.youtube.com/watch?v=too-short',
    'https://www.youtube.com/playlist?list=PL123', // playlist, not a video
    'https://youtu.be/', // empty path
    `https://vimeo.com/${ID}`, // wrong host (edge already blocks, defense in depth)
    'not a url',
    `https://www.youtube.com/channel/${ID}`, // unsupported path shape
  ])('returns null for %s', (url) => {
    expect(parseYoutubeVideoId(url)).toBeNull();
  });
});

describe('parseIsoDurationToSeconds', () => {
  it.each([
    ['PT3M32S', 212],
    ['PT45S', 45],
    ['PT1H', 3600],
    ['PT1H2M3S', 3723],
    ['PT4H1S', 14401],
    ['P1DT2H', 93600],
    ['PT2M', 120],
  ])('parses %s → %d s', (iso, expected) => {
    expect(parseIsoDurationToSeconds(iso)).toBe(expected);
  });

  it.each(['P', 'PT', '3m32s', '', 'PTXS'])('returns null for %s', (iso) => {
    expect(parseIsoDurationToSeconds(iso)).toBeNull();
  });
});
