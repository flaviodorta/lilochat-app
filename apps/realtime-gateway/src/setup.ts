import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { context as otelContext, metrics, SpanKind, trace } from '@opentelemetry/api';
import type { Server, Socket } from 'socket.io';
import {
  chatMessagePersistedEvent,
  voteCastPayloadSchema,
  voteFinishedEvent,
  voteProgressEvent,
  voteStartedEvent,
  VOTE_SOCKET_EVENTS,
  chatSendPayloadSchema,
  CHAT_SOCKET_EVENTS,
  LOBBY_EVENTS,
  LOBBY_NAMESPACE,
  queueUpdatedEvent,
  roomJoinPayloadSchema,
  SOCKET_EVENTS,
  syncDriftReportSchema,
  syncPingSchema,
  videoStartedEvent,
} from '@lilochat/contracts';
import {
  createRedisClient,
  bindConsumer,
  EVENT_BUS,
  FeatureFlags,
  FLAGS,
  injectTraceHeaders,
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
  lastCheckpointMs?: number;
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

  // ── product metrics (§10): drift SLI histogram + live gauges ─────────────
  const meter = metrics.getMeter('realtime-gateway');
  const driftHistogram = meter.createHistogram('lilochat.sync.drift', {
    unit: 'ms',
    description: 'Client-reported |player position − server timeline| (§4.1 SLI)',
  });
  const chatMessages = meter.createCounter('lilochat.chat.messages', {
    description: 'Chat messages accepted by the relay',
  });
  meter
    .createObservableGauge('lilochat.ws.connections', {
      description: 'Sockets connected to the /room namespace on this instance',
    })
    .addCallback((observable) => observable.observe(rooms.sockets.size));
  meter
    .createObservableGauge('lilochat.rooms.active', {
      description: 'Rooms with at least one connected viewer on this instance',
    })
    .addCallback((observable) => {
      const active = new Set<string>();
      for (const socket of rooms.sockets.values()) {
        const roomId = (socket.data as RoomSocketData).roomId;
        if (roomId) active.add(roomId);
      }
      observable.observe(active.size);
    });

  const redis = createRedisClient(config.REDIS_URL, 'rtg-redis');
  const idempotency = new RedisIdempotencyStore(redis, { prefix: 'rtg' });
  const presence = new PresenceStore(redis, config.PRESENCE_TTL_MS);
  const chatBucket = new TokenBucket(redis);
  const flags = new FeatureFlags(redis); // kill switches (§13.4)

  /** Thin call into playback's vote API — domain errors pass through to the ack. */
  const playbackVotes = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
    const response = await fetch(`${config.PLAYBACK_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: injectTraceHeaders({ 'content-type': 'application/json' }) as Record<string, string>,
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok)
      throw Object.assign(new Error(String(data.code ?? response.status)), { data });
    return data;
  };

  // ── /lobby: public live viewer counts for the home directory (§7.2) ──────
  // Throttled per room (§4.3 bottleneck #1): leading emit + trailing coalesce.
  const lobby = io.of(LOBBY_NAMESPACE);
  const lobbyCooldown = new Map<string, { timer: NodeJS.Timeout; dirty: boolean }>();
  const emitLobbySummary = (roomId: string): void => {
    void presence
      .list(roomId, Date.now())
      .then((users) => {
        lobby.emit(LOBBY_EVENTS.roomSummary, { roomId, viewers: users.length });
      })
      .catch(() => undefined); // Redis away → the lobby just goes quiet
  };
  const scheduleLobbySummary = (roomId: string): void => {
    const pending = lobbyCooldown.get(roomId);
    if (pending) {
      pending.dirty = true;
      return;
    }
    emitLobbySummary(roomId);
    const entry = {
      dirty: false,
      timer: setTimeout(() => {
        const current = lobbyCooldown.get(roomId);
        lobbyCooldown.delete(roomId);
        if (current?.dirty) scheduleLobbySummary(roomId);
      }, config.LOBBY_THROTTLE_MS),
    };
    lobbyCooldown.set(roomId, entry);
  };
  io.on('close', () => {
    for (const { timer } of lobbyCooldown.values()) clearTimeout(timer);
  });

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
    scheduleLobbySummary(roomId);
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
        data.lastCheckpointMs = now.getTime();

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
        scheduleLobbySummary(roomId);
        ack?.({ ok: true });
      })().catch((error) => {
        // Redis down: joins fail loudly to the caller, the process survives
        logger.warn({ err: error }, 'room:join failed');
        ack?.({ ok: false, error: 'join_unavailable' });
      });
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
        void presence.refresh(data.roomId, data.session, Date.now()).catch(() => undefined);
      }
    });

    // sampled drift telemetry (§4.1) → the SLO dashboard's defining histogram
    socket.on(SOCKET_EVENTS.syncDrift, (payload: unknown) => {
      const parsed = syncDriftReportSchema.safeParse(payload);
      if (!parsed.success) return;
      driftHistogram.record(Math.abs(parsed.data.driftMs));
    });

    // chat write path (§6.3): validate → rate limit → optimistic broadcast → event.
    // Runs inside a span so the submitted event carries traceparent (§10) and
    // chat-service's consume span joins the SAME trace across the bus.
    socket.on(CHAT_SOCKET_EVENTS.chatSend, (payload: unknown, ack?: (r: unknown) => void) => {
      const span = trace
        .getTracer('realtime-gateway')
        .startSpan('ws chat:send', { kind: SpanKind.SERVER });
      void otelContext
        .with(trace.setSpan(otelContext.active(), span), async () => {
          const parsed = chatSendPayloadSchema.safeParse(payload);
          if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });
          if (!data.roomId) return ack?.({ ok: false, error: 'not_in_a_room' });

          if (!(await flags.isEnabled(FLAGS.chat))) {
            return ack?.({ ok: false, error: 'chat_disabled' });
          }
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
          chatMessages.add(1);
          ack?.({ ok: true });
        })
        .catch((error) => {
          logger.warn({ err: error }, 'chat:send failed');
          ack?.({ ok: false, error: 'chat_unavailable' });
        })
        .finally(() => span.end());
    });

    // skip voting (§6.4): RTG relays; playback owns the rules
    socket.on(VOTE_SOCKET_EVENTS.voteStart, (_: unknown, ack?: (r: unknown) => void) => {
      void (async () => {
        if (!data.roomId) return ack?.({ ok: false, error: 'not_in_a_room' });
        if (!(await flags.isEnabled(FLAGS.votes))) {
          return ack?.({ ok: false, error: 'votes_disabled' });
        }
        try {
          const snapshot = await playbackVotes(`/internal/rooms/${data.roomId}/votes`, {
            startedBy: data.user.id,
          });
          ack?.({ ok: true, ...snapshot });
        } catch (error) {
          ack?.({ ok: false, error: (error as Error).message });
        }
      })();
    });

    socket.on(VOTE_SOCKET_EVENTS.voteCast, (payload: unknown, ack?: (r: unknown) => void) => {
      void (async () => {
        const parsed = voteCastPayloadSchema.safeParse(payload);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });
        if (!data.roomId) return ack?.({ ok: false, error: 'not_in_a_room' });
        try {
          const snapshot = await playbackVotes(
            `/internal/rooms/${data.roomId}/votes/${parsed.data.voteId}/cast`,
            { userId: data.user.id },
          );
          ack?.({ ok: true, ...snapshot });
        } catch (error) {
          ack?.({ ok: false, error: (error as Error).message });
        }
      })();
    });

    socket.on('disconnect', () => {
      if (data.roomId && data.session) {
        void presence.leave(data.roomId, data.session).catch(() => undefined);
        publishLeft(data.roomId, data.session, new Date()); // TTL sweep is the backstop
      }
    });
  });

  // ── watch-time checkpoints (§6.5): credit every open session each window ──
  const checkpointer = setInterval(() => {
    const nowMs = Date.now();
    const entries: Array<{ sessionId: string; roomId: string; userId: string; seconds: number }> =
      [];
    for (const socket of rooms.sockets.values()) {
      const socketData = socket.data as RoomSocketData;
      if (!socketData.roomId || !socketData.session) continue;
      const since = socketData.lastCheckpointMs ?? socketData.session.joinedAtMs;
      const seconds = Math.floor((nowMs - since) / 1000);
      if (seconds <= 0) continue;
      entries.push({
        sessionId: socketData.session.sessionId,
        roomId: socketData.roomId,
        userId: socketData.user.id,
        seconds,
      });
      socketData.lastCheckpointMs = nowMs;
    }
    if (entries.length > 0) {
      bus.publish(makeDomainEvent('presence.checkpoint', { entries }, new Date(nowMs)));
    }
  }, config.CHECKPOINT_MS);
  io.on('close', () => clearInterval(checkpointer));

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

  for (const [suffix, schema, event] of [
    ['vote-started', voteStartedEvent, VOTE_SOCKET_EVENTS.voteStarted],
    ['vote-progress', voteProgressEvent, VOTE_SOCKET_EVENTS.voteProgress],
    ['vote-finished', voteFinishedEvent, VOTE_SOCKET_EVENTS.voteFinished],
  ] as const) {
    await bindConsumer(bus, {
      queue: `${config.RTG_CONSUMER_QUEUE}.${suffix}`,
      bindings: [schema.shape.name.value],
      schema,
      handler: async (incoming) => {
        rooms.to(roomKey(incoming.payload.roomId)).emit(event, incoming.payload);
      },
      idempotency,
      logger,
    });
  }

  return io;
}
