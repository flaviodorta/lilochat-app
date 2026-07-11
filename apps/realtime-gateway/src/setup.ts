import type { INestApplication } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { queueUpdatedEvent, videoStartedEvent, SOCKET_EVENTS } from '@lilochat/contracts';
import {
  bindConsumer,
  EVENT_BUS,
  LOGGER,
  RedisIdempotencyStore,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { RTG_CONFIG, type RtgConfig } from './config.js';
import { createRoomNamespace, roomKey } from './gateway/room-namespace.js';

/**
 * Composition root shared by main.ts and the integration tests: attaches
 * Socket.io to the Nest HTTP server and wires the domain-event consumers
 * that translate `playback.*` into room broadcasts (CLAUDE.md §5.3).
 */
export async function setupRealtime(app: INestApplication): Promise<Server> {
  const config = app.get<RtgConfig>(RTG_CONFIG);
  const logger = app.get<Logger>(LOGGER);
  const bus = app.get<RabbitMqBus>(EVENT_BUS);

  const { io, rooms } = createRoomNamespace({
    httpServer: app.getHttpServer(),
    config,
    logger,
  });

  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
  const idempotency = new RedisIdempotencyStore(redis, { prefix: 'rtg' });

  // Competing consumers across RTG instances is CORRECT here: the Redis
  // adapter fans the broadcast out to sockets held by every other instance.
  await bindConsumer(bus, {
    queue: `${config.RTG_CONSUMER_QUEUE}.started`,
    bindings: ['playback.video.started'],
    schema: videoStartedEvent,
    handler: async (event) => {
      rooms.to(roomKey(event.payload.roomId)).emit(SOCKET_EVENTS.playbackStarted, {
        roomId: event.payload.roomId,
        itemId: event.payload.itemId,
        videoId: event.payload.videoId,
        title: event.payload.title,
        durationS: event.payload.durationS,
        thumbUrl: event.payload.thumbUrl,
        startedAt: event.payload.startedAt,
      });
    },
    idempotency,
    logger,
  });

  await bindConsumer(bus, {
    queue: `${config.RTG_CONSUMER_QUEUE}.queue`,
    bindings: ['playback.queue.updated'],
    schema: queueUpdatedEvent,
    handler: async (event) => {
      rooms.to(roomKey(event.payload.roomId)).emit(SOCKET_EVENTS.queueUpdated, event.payload);
    },
    idempotency,
    logger,
  });

  return io;
}
