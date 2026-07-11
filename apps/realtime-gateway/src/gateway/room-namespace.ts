import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { Server, type Namespace, type Socket } from 'socket.io';
import {
  ROOM_NAMESPACE,
  SOCKET_EVENTS,
  roomJoinPayloadSchema,
  syncPingSchema,
} from '@lilochat/contracts';
import type { Logger } from '@lilochat/nest-shared';
import type { RtgConfig } from '../config.js';

export interface SocketUser {
  id: string;
  nickname: string;
}

export const roomKey = (roomId: string): string => `room:${roomId}`;

/**
 * The `/room` namespace (CLAUDE.md §7.2): JWT on handshake, explicit join,
 * NTP-style clock sync, load-shedding caps. Scaled horizontally via the Redis
 * adapter — broadcasts reach sockets on every instance.
 */
export function createRoomNamespace(input: {
  httpServer: HttpServer;
  config: RtgConfig;
  logger: Logger;
}): { io: Server; rooms: Namespace } {
  const { httpServer, config, logger } = input;

  const pubClient = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
  const subClient = pubClient.duplicate();

  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
  });
  io.on('close', () => {
    pubClient.disconnect();
    subClient.disconnect();
  });

  const publicKeyPem = Buffer.from(config.JWT_PUBLIC_KEY, 'base64').toString('utf8');
  const rooms = io.of(ROOM_NAMESPACE);

  // auth + connection-level load shedding, BEFORE the socket is accepted
  rooms.use((socket, next) => {
    if (rooms.sockets.size >= config.MAX_CONNECTIONS) {
      return next(new Error('server_full')); // clear shed signal (§9.1)
    }
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const claims = jwt.verify(token, publicKeyPem, {
        algorithms: ['RS256'],
        issuer: 'lilochat-identity',
        audience: 'lilochat',
      }) as jwt.JwtPayload;
      (socket.data as { user: SocketUser }).user = {
        id: claims.sub as string,
        nickname: claims.nickname as string,
      };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  rooms.on('connection', (socket: Socket) => {
    socket.on(SOCKET_EVENTS.roomJoin, (payload: unknown, ack?: (r: unknown) => void) => {
      void (async () => {
        const parsed = roomJoinPayloadSchema.safeParse(payload);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

        const key = roomKey(parsed.data.roomId);
        // adapter-wide occupancy (covers every instance), shed hot rooms early
        const occupants = await rooms.in(key).fetchSockets();
        if (occupants.length >= config.MAX_ROOM_JOINS) {
          return ack?.({ ok: false, error: 'room_full' });
        }

        await socket.join(key);
        ack?.({ ok: true });
        // presence events land here in Phase 3 (roadmap 3.4)
      })();
    });

    // NTP-style clock sync (§6.2): client computes offset ≈ serverNow − (sent + rtt/2)
    socket.on(SOCKET_EVENTS.syncPing, (payload: unknown) => {
      const parsed = syncPingSchema.safeParse(payload);
      if (!parsed.success) return;
      socket.emit(SOCKET_EVENTS.syncPong, {
        clientSentAt: parsed.data.clientSentAt,
        serverNow: Date.now(),
      });
    });
  });

  logger.info({ namespace: ROOM_NAMESPACE }, 'room namespace ready');
  return { io, rooms };
}
