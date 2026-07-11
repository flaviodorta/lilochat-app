import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';
import {
  chatMessagePersistedEvent,
  chatSendPayloadSchema,
  CHAT_SOCKET_EVENTS,
  queueUpdatedEvent,
  roomJoinPayloadSchema,
  SOCKET_EVENTS,
  syncPingSchema,
  videoStartedEvent,
} from '@lilochat/contracts';
import {
  bindConsumer,
  EVENT_BUS,
  LOGGER,
  makeDomainEvent,
  RedisIdempotencyStore,
  TokenBucket,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { RTG_CONFIG, type RtgConfig } from './config.js';
import { PresenceStore, type PresenceSession } from './gateway/presence-store.js';
import { createRoomNamespace, roomKey, type SocketUser } from './gateway/room-namespace.js';

/** 1 msg/s sustained with a small burst (CLAUDE.md §3.5). */
const CHAT_BUCKET = { capacity: 3, refillPerSec: 1 };

interface RoomSocketData {
  user: SocketUser;
  roomId?: string;
  session?: PresenceSession;
}

/**
 * Composition root shared by main.ts and the integration tests: socket
 * handlers (join/presence/chat/clock-sync) + the domain-event consumers that
 * fan out to room broadcasts (§5.3, §6.3, §6.5).
 */
export async function setupRealtime(app: INestApplication): Promise<Server> {
  const config = app.get<RtgConfig>(RTG_CONFIG);
  const logger = app.get<Logger>(LOGGER);
  const bus = app.get<RabbitMqBus>(EVENT_BUS);

  const { io, rooms } = createRoomNamespace({ httpServer: app.getHttpServer(), config, logger });

  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
  const idempotency = new RedisIdempotencyStore(redis, { prefix: 'rtg' });
  const presence = new PresenceStore(redis, config.PRESENCE_TTL_MS);
  const chatBucket = new TokenBucket(redis);

  const publishLeft = (roomId: string, session: PresenceSession, at: Date): void => {
    bus.publish(
      makeDomainEvent(
        'presence.user.left',
        {
          roomId,
          userId: session.userId,
          sessionId: session.sessionId,
          at: at.toISOString(),
          durationS: Math.max(0, Math.round((at.getTime() - session.joinedAtMs) / 1000)),
        },
        at,
      ),
    );
    rooms.to(roomKey(roomId)).emit(CHAT_SOCKET_EVENTS.presenceLeft, { userId: session.userId });
  };

  rooms.on('connection', (socket: Socket) => {
    const data = socket.data as RoomSocketData;

    socket.on(SOCKET_EVENTS.roomJoin, (payload: unknown, ack?: (r: unknown) => void) => {
      void (async () => {
        const parsed = roomJoinPayloadSchema.safeParse(payload);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });
        const { roomId } = parsed.data;

        const occupants = await rooms.in(roomKey(roomId)).fetchSockets();
        if (occupants.length >= config.MAX_ROOM_JOINS) {
          return ack?.({ ok: false, error: 'room_full' });
        }

        const now = new Date();
        const session: PresenceSession = {
          sessionId: randomUUID(),
          userId: data.user.id,
          nickname: data.user.nickname,
          joinedAtMs: now.getTime(),
        };
        data.roomId = roomId;
        data.session = session;

        await socket.join(roomKey(roomId));
        await presence.join(roomId, session, now.getTime());
        bus.publish(
          makeDomainEvent(
            'presence.user.joined',
            { roomId, userId: session.userId, sessionId: session.sessionId, at: now.toISOString() },
            now,
          ),
        );
        socket.to(roomKey(roomId)).emit(CHAT_SOCKET_EVENTS.presenceJoined, {
          userId: session.userId,
          nickname: session.nickname,
        });
        socket.emit(CHAT_SOCKET_EVENTS.presenceState, {
          roomId,
          users: await presence.list(roomId, now.getTime()),
        });
        ack?.({ ok: true });
      })();
    });

    // NTP-style clock sync (§6.2) — presence heartbeat piggybacks on it (§6.5)
    socket.on(SOCKET_EVENTS.syncPing, (payload: unknown) => {
      const parsed = syncPingSchema.safeParse(payload);
      if (!parsed.success) return;
      socket.emit(SOCKET_EVENTS.syncPong, {
        clientSentAt: parsed.data.clientSentAt,
        serverNow: Date.now(),
      });
      if (data.roomId && data.session) {
        void presence.refresh(data.roomId, data.session, Date.now());
      }
    });

    // chat write path (§6.3): validate → rate limit → optimistic broadcast → event
    socket.on(CHAT_SOCKET_EVENTS.chatSend, (payload: unknown, ack?: (r: unknown) => void) => {
      void (async () => {
        const parsed = chatSendPayloadSchema.safeParse(payload);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });
        if (!data.roomId) return ack?.({ ok: false, error: 'not_in_a_room' });

        const allowed = await chatBucket
          .consume(`chat:${data.user.id}`, CHAT_BUCKET)
          .catch(() => true); // Redis down → fail-open, same call as the gateway
        if (!allowed) return ack?.({ ok: false, error: 'rate_limited' });

        const now = new Date();
        const message = {
          tempId: parsed.data.tempId,
          roomId: data.roomId,
          userId: data.user.id,
          nickname: data.user.nickname,
          content: parsed.data.content,
          sentAt: now.toISOString(),
        };
        rooms.to(roomKey(data.roomId)).emit(CHAT_SOCKET_EVENTS.chatNew, message);
        bus.publish(makeDomainEvent('chat.message.submitted', message, now));
        ack?.({ ok: true });
      })();
    });

    socket.on('disconnect', () => {
      if (data.roomId && data.session) {
        void presence.leave(data.roomId, data.session);
        publishLeft(data.roomId, data.session, new Date());
      }
    });
  });

  // ── ghost sweeper (§6.5): sessions that stopped heartbeating leave anyway ──
  const sweeper = setInterval(() => {
    void presence
      .sweepExpired(Date.now())
      .then((reaped) => {
        for (const { roomId, session } of reaped) publishLeft(roomId, session, new Date());
      })
      .catch((error) => logger.warn({ err: error }, 'presence sweep failed'));
  }, config.PRESENCE_SWEEP_MS);
  io.on('close', () => clearInterval(sweeper));

  // ── domain events → room broadcasts (competing consumers + adapter fan-out) ──
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

  await bindConsumer(bus, {
    queue: `${config.RTG_CONSUMER_QUEUE}.persisted`,
    bindings: ['chat.message.persisted'],
    schema: chatMessagePersistedEvent,
    handler: async (event) => {
      rooms.to(roomKey(event.payload.roomId)).emit(CHAT_SOCKET_EVENTS.chatAck, {
        tempId: event.payload.tempId,
        messageId: event.payload.messageId,
        createdAt: event.payload.createdAt,
      });
    },
    idempotency,
    logger,
  });

  return io;
}
