import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Logger } from '@lilochat/nest-shared';
import type { AdvanceScheduler } from '../../domain/ports.js';

/** BullMQ opens its own connections (it needs blocking ones anyway); pnpm gives
 *  bullmq a private ioredis copy, so passing our instance trips type identity. */
function connectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: url.pathname ? Number(url.pathname.slice(1) || 0) : 0,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Delayed auto-advance jobs (§6.2). jobId = roomId ⇒ BullMQ dedupes per room:
 * one pending advance per room, no distributed locks. A skip/removal
 * cancels + reschedules. The worker runs in-process (bulkhead: scheduler
 * concurrency is isolated from the HTTP request path by BullMQ's own worker).
 */
export class BullMqAdvanceScheduler implements AdvanceScheduler {
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(
    private readonly options: {
      queueName: string;
      redisUrl: string;
      logger: Logger;
    },
  ) {
    this.queue = new Queue(options.queueName, {
      connection: connectionFromUrl(options.redisUrl),
    });
  }

  async schedule(input: { roomId: string; itemId: string; fireAt: Date }): Promise<void> {
    const delay = Math.max(0, input.fireAt.getTime() - Date.now());
    await this.queue.add(
      'advance',
      { roomId: input.roomId },
      { jobId: `adv-${input.itemId}`, delay, removeOnComplete: true, removeOnFail: true },
    );
  }

  async cancel(itemId: string): Promise<void> {
    await this.queue.remove(`adv-${itemId}`).catch(() => undefined);
  }

  /** Wire the handler once the PlaybackManager exists (composition root). */
  startWorker(handler: (roomId: string) => Promise<void>): void {
    this.worker = new Worker(
      this.options.queueName,
      async (job) => handler((job.data as { roomId: string }).roomId),
      {
        connection: connectionFromUrl(this.options.redisUrl),
        concurrency: 8,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.options.logger.error({ err: error, roomId: job?.data?.roomId }, 'advance job failed');
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
