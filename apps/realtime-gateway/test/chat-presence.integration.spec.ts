import 'reflect-metadata';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeDomainEvent, LILOCHAT_EXCHANGE, RabbitMqBus } from '@lilochat/nest-shared';

const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const REDIS_URL = 'redis://localhost:6380/9';
const RUN = Date.now().toString(36);

let app: INestApplication;
let bus: RabbitMqBus;
let redis: Redis;
let baseUrl: string;
let privateKeyPem: string;
const clients: ClientSocket[] = [];

const token = (sub: string, nickname: string) =>
  jwt.sign({ nickname }, privateKeyPem, {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: 900,
    issuer: 'lilochat-identity',
    audience: 'lilochat',
  });

function connect(sub: string, nickname: string): ClientSocket {
  const socket = connectClient(`${baseUrl}/room`, {
    auth: { token: token(sub, nickname) },
    transports: ['websocket'],
    reconnection: false,
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

const joinRoom = (socket: ClientSocket, roomId: string): Promise<{ ok: boolean }> =>
  new Promise((resolve) => socket.emit('room:join', { roomId }, resolve));

const sendChat = (
  socket: ClientSocket,
  tempId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> =>
  new Promise((resolve) => socket.emit('chat:send', { tempId, content }, resolve));

async function observeExchange(routingKey: string) {
  const queue = `it.${RUN}.obs.${routingKey}.${Math.random().toString(36).slice(2, 7)}`;
  await bus.channel.assertQueue(queue, { exclusive: true });
  await bus.channel.bindQueue(queue, LILOCHAT_EXCHANGE, routingKey);
  return async (timeoutMs = 6_000): Promise<Array<{ payload: Record<string, unknown> }>> => {
    const deadline = Date.now() + timeoutMs;
    const events: Array<{ payload: Record<string, unknown> }> = [];
    while (events.length === 0 && Date.now() < deadline) {
      const message = await bus.channel.get(queue, { noAck: true });
      if (message) events.push(JSON.parse(message.content.toString('utf8')));
      else await new Promise((resolve) => setTimeout(resolve, 100));
    }
    let more = await bus.channel.get(queue, { noAck: true });
    while (more) {
      events.push(JSON.parse(more.content.toString('utf8')));
      more = await bus.channel.get(queue, { noAck: true });
    }
    return events;
  };
}

beforeAll(async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  privateKeyPem = privateKey;

  process.env.REDIS_URL = REDIS_URL;
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');
  process.env.RTG_CONSUMER_QUEUE = `it.${RUN}.rtg`;
  process.env.PRESENCE_SWEEP_MS = '400'; // fast ghost reaping for the test
  process.env.NODE_ENV = 'test';

  const { AppModule } = await import('../src/app.module.js');
  const { setupRealtime } = await import('../src/setup.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await setupRealtime(app);
  await app.listen(0);
  baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

  bus = await RabbitMqBus.connect(RABBITMQ_URL);
  redis = new Redis(REDIS_URL);
  await redis.flushdb();
});

afterAll(async () => {
  for (const socket of clients) socket.disconnect();
  await bus?.close();
  await redis?.quit();
  await app?.close();
});

describe('RTG chat relay + presence (§6.3, §6.5)', () => {
  it('chat: optimistic broadcast to the room, submitted on the bus, ack fans back', async () => {
    const room = randomUUID();
    const alice = connect(randomUUID(), 'alice');
    const bob = connect(randomUUID(), 'bob');
    await waitEvent(alice, 'connect');
    await waitEvent(bob, 'connect');
    await joinRoom(alice, room);
    await joinRoom(bob, room);

    const drainSubmitted = await observeExchange('chat.message.submitted');
    const bobSees = waitEvent<{ tempId: string; content: string; nickname: string }>(
      bob,
      'chat:new',
    );

    await expect(sendChat(alice, 'tmp-1', 'hello from alice')).resolves.toEqual({ ok: true });

    const optimistic = await bobSees; // bob sees it instantly, before persistence
    expect(optimistic).toMatchObject({
      tempId: 'tmp-1',
      content: 'hello from alice',
      nickname: 'alice',
    });

    const submitted = await drainSubmitted();
    expect(submitted[0]?.payload).toMatchObject({ tempId: 'tmp-1', roomId: room });

    // chat-service is simulated: publish the persisted event → both get the ack
    const aliceAck = waitEvent<{ tempId: string; messageId: string }>(alice, 'chat:ack');
    bus.publish(
      makeDomainEvent('chat.message.persisted', {
        messageId: randomUUID(),
        tempId: 'tmp-1',
        roomId: room,
        userId: optimistic ? (submitted[0]?.payload.userId as string) : '',
        nickname: 'alice',
        content: 'hello from alice',
        createdAt: new Date().toISOString(),
      }),
    );
    expect((await aliceAck).tempId).toBe('tmp-1');
  });

  it('chat: token bucket rejects the burst overflow with rate_limited', async () => {
    const room = randomUUID();
    const spammer = connect(randomUUID(), 'spammer');
    await waitEvent(spammer, 'connect');
    await joinRoom(spammer, room);

    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await sendChat(spammer, `tmp-${i}`, `spam ${i}`));
    expect(results.slice(0, 3).every((r) => r.ok)).toBe(true); // burst capacity 3
    expect(results.some((r) => r.error === 'rate_limited')).toBe(true);
  });

  it('presence: state on join, joined/left broadcasts, session events on the bus', async () => {
    const room = randomUUID();
    const drainJoined = await observeExchange('presence.user.joined');
    const drainLeft = await observeExchange('presence.user.left');

    const alice = connect(randomUUID(), 'p_alice');
    await waitEvent(alice, 'connect');
    const aliceState = waitEvent<{ users: Array<{ nickname: string }> }>(alice, 'presence:state');
    await joinRoom(alice, room);
    expect((await aliceState).users.map((u) => u.nickname)).toEqual(['p_alice']);

    const seesBob = waitEvent<{ nickname: string }>(alice, 'presence:joined');
    const bob = connect(randomUUID(), 'p_bob');
    await waitEvent(bob, 'connect');
    const bobState = waitEvent<{ users: Array<{ nickname: string }> }>(bob, 'presence:state');
    await joinRoom(bob, room);
    expect((await seesBob).nickname).toBe('p_bob');
    expect((await bobState).users.map((u) => u.nickname).sort()).toEqual(['p_alice', 'p_bob']);
    expect((await drainJoined()).length).toBeGreaterThanOrEqual(2);

    const seesLeave = waitEvent<{ userId: string }>(alice, 'presence:left');
    bob.disconnect();
    await seesLeave;
    const lefts = await drainLeft();
    expect(lefts[0]?.payload).toMatchObject({ roomId: room });
    expect(Number(lefts[0]?.payload.durationS)).toBeGreaterThanOrEqual(0);
  });

  it('ghost sweep: an expired session leaves within the sweep window (no client goodwill)', async () => {
    const room = randomUUID();
    const watcher = connect(randomUUID(), 'watcher');
    await waitEvent(watcher, 'connect');
    await joinRoom(watcher, room);

    const drainLeft = await observeExchange('presence.user.left');
    const seesGhostLeave = waitEvent<{ userId: string }>(watcher, 'presence:left', 6_000);

    // plant a ghost: a session whose heartbeat "stopped" (already expired score)
    const ghostUser = randomUUID();
    await redis.zadd(
      `presence:${room}`,
      Date.now() - 1_000,
      `${randomUUID()}|${ghostUser}|ghosty|${Date.now() - 60_000}`,
    );
    await redis.sadd('presence:rooms', room);

    expect((await seesGhostLeave).userId).toBe(ghostUser); // reaped by the sweeper
    const lefts = await drainLeft();
    expect(lefts.some((e) => e.payload.userId === ghostUser)).toBe(true);
  });
});
