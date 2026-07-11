const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the 11-char videoId from every YouTube URL shape we accept:
 * watch?v=, youtu.be/, /shorts/, /embed/, /live/, music./m. subdomains.
 * Returns null for anything else — the edge already allowlisted the host.
 */
export function parseYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const candidate = (() => {
    if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0];
    if (host.endsWith('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      const pathMatch = /^\/(shorts|embed|live)\/([^/?]+)/.exec(url.pathname);
      if (pathMatch) return pathMatch[2];
    }
    return null;
  })();

  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/** Parses ISO-8601 durations as YouTube emits them (PT1H2M3S, PT45S, P1DT2H…). */
export function parseIsoDurationToSeconds(iso: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;
  return (
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}
