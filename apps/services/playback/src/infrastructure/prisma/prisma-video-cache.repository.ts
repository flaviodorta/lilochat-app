import type { VideoCacheRepository, VideoMetadata } from '../../domain/ports.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaVideoCacheRepository implements VideoCacheRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(videoId: string): Promise<VideoMetadata | null> {
    const row = await this.prisma.video.findUnique({ where: { videoId } });
    return row
      ? {
          videoId: row.videoId,
          title: row.title,
          durationS: row.durationS,
          thumbUrl: row.thumbUrl,
          embeddable: row.embeddable,
        }
      : null;
  }

  async save(metadata: VideoMetadata, fetchedAt: Date): Promise<void> {
    await this.prisma.video.upsert({
      where: { videoId: metadata.videoId },
      create: { ...metadata, fetchedAt },
      update: {}, // metadata is immutable — first write wins
    });
  }
}
