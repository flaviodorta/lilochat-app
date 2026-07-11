import { CircuitBreaker } from '@lilochat/nest-shared';
import type { VideoMetadata, VideoMetadataProvider } from '../../domain/ports.js';
import { parseIsoDurationToSeconds } from '../../domain/video-url.js';

interface YoutubeVideoResource {
  id: string;
  snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
}

/**
 * YouTube Data API v3 `videos.list` — 1 quota unit per NEW video only, because
 * results are cached permanently (§4.3). Breaker: closed/open/half-open.
 */
export class YoutubeMetadataProvider implements VideoMetadataProvider {
  private readonly breaker = new CircuitBreaker({ failureThreshold: 3, openMs: 30_000 });

  constructor(private readonly options: { apiUrl: string; apiKey: string }) {}

  fetch(videoId: string): Promise<VideoMetadata | null> {
    return this.breaker.execute(async () => {
      const url =
        `${this.options.apiUrl}/videos?part=snippet,contentDetails,status` +
        `&id=${encodeURIComponent(videoId)}&key=${this.options.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`YouTube API responded ${response.status}`);

      const data = (await response.json()) as { items?: YoutubeVideoResource[] };
      const item = data.items?.[0];
      if (!item) return null; // unknown video — a definitive answer, not a failure

      const durationS = parseIsoDurationToSeconds(item.contentDetails?.duration ?? '');
      const thumbs = item.snippet?.thumbnails ?? {};
      const thumbUrl =
        thumbs.maxres?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url;
      if (!item.snippet?.title || durationS === null || !thumbUrl) {
        throw new Error('YouTube API returned an incomplete video resource');
      }

      return {
        videoId,
        title: item.snippet.title,
        durationS,
        thumbUrl,
        embeddable: item.status?.embeddable ?? false,
      };
    });
  }
}
