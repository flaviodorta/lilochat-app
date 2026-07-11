import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { Server, type Namespace } from 'socket.io';
import { ROOM_NAMESPACE } from '@lilochat/contracts';
import type { Logger } from '@lilochat/nest-shared';
import type { RtgConfig } from '../config.js';

export interface SocketUser {
  id: string;
  nickname: string;
}

export const roomKey = (roomId: string): string => `room:${roomId}`;

/**
 * Creates the Socket.io server + `/room` namespace shell: Redis adapter,
 * RS256 handshake auth, connection-level load shedding. Event handlers are
 * registered by the composition root (setup.ts) where their deps live.
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

  logger.info({ namespace: ROOM_NAMESPACE }, 'room namespace ready');
  return { io, rooms };
}
