import 'reflect-metadata';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeDomainEvent, RabbitMqBus } from '@lilochat/nest-shared';

const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const RUN = Date.now().toString(36);
const ROOM = randomUUID();

let app: INestApplication;
let bus: RabbitMqBus;
let baseUrl: string;
let privateKeyPem: string;
const clients: ClientSocket[] = [];

function token(sub: string): string {
  return jwt.sign({ nickname: 'it_user' }, privateKeyPem, {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: 900,
    issuer: 'lilochat-identity',
    audience: 'lilochat',
  });
}

function connect(auth?: object): ClientSocket {
  const socket = connectClient(`${baseUrl}/room`, {
    auth,
    transports: ['websocket'],
    reconnection: false,
    timeout: 4_000,
  });
  clients.push(socket);
  return socket;
}

const waitEvent = <T>(socket: ClientSocket, event: string, timeoutMs = 8_000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const joinRoom = (socket: ClientSocket, roomId: string): Promise<{ ok: boolean; error?: string }> =>
  new Promise((resolve) => socket.emit('room:join', { roomId }, resolve));

beforeAll(async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  privateKeyPem = privateKey;

  process.env.REDIS_URL = 'redis://localhost:6380/7';
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');
  process.env.RTG_CONSUMER_QUEUE = `it.${RUN}.rtg`;
  process.env.MAX_ROOM_JOINS = '2'; // makes the shed test cheap
  process.env.NODE_ENV = 'test';

  const { AppModule } = await import('../src/app.module.js');
  const { setupRealtime } = await import('../src/setup.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await setupRealtime(app);
  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  bus = await RabbitMqBus.connect(RABBITMQ_URL);
});

afterAll(async () => {
  for (const socket of clients) socket.disconnect();
  await bus?.close();
  await app?.close();
});

describe('realtime gateway (/room namespace)', () => {
  it('rejects handshakes without a valid RS256 token', async () => {
    const noToken = connect();
    const badToken = connect({ token: 'forged.token.here' });
    await expect(waitEvent(noToken, 'connect_error')).resolves.toMatchObject({
      message: 'unauthorized',
    });
    await expect(waitEvent(badToken, 'connect_error')).resolves.toMatchObject({
      message: 'unauthorized',
    });
  });

  it('sync:ping → sync:pong echoes clientSentAt with a sane serverNow', async () => {
    const socket = connect({ token: token(randomUUID()) });
    await waitEvent(socket, 'connect');

    const sentAt = Date.now();
    socket.emit('sync:ping', { clientSentAt: sentAt });
    const pong = await waitEvent<{ clientSentAt: number; serverNow: number }>(socket, 'sync:pong');
    expect(pong.clientSentAt).toBe(sentAt);
    expect(Math.abs(pong.serverNow - Date.now())).toBeLessThan(2_000);
  });

  it('joined sockets receive playback:started and queue:updated from bus events', async () => {
    const inRoom = connect({ token: token(randomUUID()) });
    const outOfRoom = connect({ token: token(randomUUID()) });
    await waitEvent(inRoom, 'connect');
    await waitEvent(outOfRoom, 'connect');
    await expect(joinRoom(inRoom, ROOM)).resolves.toEqual({ ok: true });

    let leaked = false;
    outOfRoom.on('playback:started', () => (leaked = true));

    const startedPromise = waitEvent<{ videoId: string; startedAt: string }>(
      inRoom,
      'playback:started',
    );
    bus.publish(
      makeDomainEvent('playback.video.started', {
        roomId: ROOM,
        itemId: randomUUID(),
        videoId: 'dQw4w9WgXcQ',
        title: 'Video',
        durationS: 212,
        thumbUrl: 'https://i.ytimg.com/x.jpg',
        startedAt: new Date().toISOString(),
      }),
    );
    const started = await startedPromise;
    expect(started.videoId).toBe('dQw4w9WgXcQ');

    const queuePromise = waitEvent<{ roomId: string; queue: unknown[] }>(inRoom, 'queue:updated');
    bus.publish(makeDomainEvent('playback.queue.updated', { roomId: ROOM, queue: [] }));
    const queueUpdate = await queuePromise;
    expect(queueUpdate.roomId).toBe(ROOM);

    expect(leaked).toBe(false); // room-scoped broadcast, no cross-room leaks
  });

  it('sheds joins beyond MAX_ROOM_JOINS with a clear error', async () => {
    const room = randomUUID();
    const first = connect({ token: token(randomUUID()) });
    const second = connect({ token: token(randomUUID()) });
    const third = connect({ token: token(randomUUID()) });
    for (const socket of [first, second, third]) await waitEvent(socket, 'connect');

    await expect(joinRoom(first, room)).resolves.toEqual({ ok: true });
    await expect(joinRoom(second, room)).resolves.toEqual({ ok: true });
    await expect(joinRoom(third, room)).resolves.toEqual({ ok: false, error: 'room_full' });
  });
});
