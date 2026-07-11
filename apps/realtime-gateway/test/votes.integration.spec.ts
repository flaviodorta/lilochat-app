import 'reflect-metadata';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import http from 'node:http';
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
const VOTE = randomUUID();

/** Playback stub: records vote calls, returns canned snapshots/errors. */
function createPlaybackStub() {
  const calls: Array<{ url: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: string) => (raw += chunk));
    req.on('end', () => {
      calls.push({ url: req.url ?? '', body: raw ? JSON.parse(raw) : undefined });
      const respond = (status: number, payload: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.url?.endsWith('/votes')) {
        const { startedBy } = JSON.parse(raw) as { startedBy: string };
        if (startedBy.endsWith('0000')) {
          return respond(409, { statusCode: 409, code: 'VOTE_ALREADY_OPEN' });
        }
        return respond(201, {
          voteId: VOTE,
          itemId: randomUUID(),
          endsAt: new Date(Date.now() + 45_000).toISOString(),
          yes: 1,
          needed: 2,
        });
      }
      if (req.url?.includes('/cast')) {
        return respond(200, { voteId: VOTE, yes: 2, needed: 2 });
      }
      respond(404, { statusCode: 404 });
    });
  });
  return { server, calls };
}

let app: INestApplication;
let bus: RabbitMqBus;
let stub: ReturnType<typeof createPlaybackStub>;
let baseUrl: string;
let privateKeyPem: string;
const clients: ClientSocket[] = [];

const token = (sub: string) =>
  jwt.sign({ nickname: 'voter' }, privateKeyPem, {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: 900,
    issuer: 'lilochat-identity',
    audience: 'lilochat',
  });

function connect(sub: string): ClientSocket {
  const socket = connectClient(`${baseUrl}/room`, {
    auth: { token: token(sub) },
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

const emitAck = <T>(socket: ClientSocket, event: string, payload?: unknown): Promise<T> =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

beforeAll(async () => {
  stub = createPlaybackStub();
  await new Promise<void>((resolve) => stub.server.listen(0, resolve));

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  privateKeyPem = privateKey;

  process.env.REDIS_URL = 'redis://localhost:6380/10';
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');
  process.env.RTG_CONSUMER_QUEUE = `it.${RUN}.rtg`;
  process.env.PLAYBACK_SERVICE_URL = `http://127.0.0.1:${(stub.server.address() as AddressInfo).port}`;
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
});

afterAll(async () => {
  for (const socket of clients) socket.disconnect();
  await bus?.close();
  await app?.close();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
});

describe('RTG vote relay (3 sockets, §6.4)', () => {
  it('vote:start relays to playback with the JWT identity; everyone gets vote:started; casts are relayed; finished fans out', async () => {
    const [a, b, c] = [connect(randomUUID()), connect(randomUUID()), connect(randomUUID())];
    for (const socket of [a, b, c]) await waitEvent(socket, 'connect');
    for (const socket of [a, b, c]) await emitAck(socket, 'room:join', { roomId: ROOM });

    // start: playback stub answers a snapshot; ack carries it
    const startAck = await emitAck<{ ok: boolean; voteId: string; needed: number }>(
      a,
      'vote:start',
    );
    expect(startAck).toMatchObject({ ok: true, voteId: VOTE, needed: 2 });
    expect(stub.calls.at(0)?.url).toBe(`/internal/rooms/${ROOM}/votes`);

    // the vote.started EVENT (from playback's outbox, simulated here) reaches all 3
    const bSees = waitEvent<{ voteId: string }>(b, 'vote:started');
    const cSees = waitEvent<{ voteId: string }>(c, 'vote:started');
    bus.publish(
      makeDomainEvent('playback.vote.started', {
        roomId: ROOM,
        voteId: VOTE,
        itemId: randomUUID(),
        startedBy: randomUUID(),
        endsAt: new Date(Date.now() + 45_000).toISOString(),
        needed: 2,
        yes: 1,
      }),
    );
    expect((await bSees).voteId).toBe(VOTE);
    expect((await cSees).voteId).toBe(VOTE);

    // cast relays with the caster's identity
    const castAck = await emitAck<{ ok: boolean; yes: number }>(b, 'vote:cast', { voteId: VOTE });
    expect(castAck).toMatchObject({ ok: true, yes: 2 });
    expect(stub.calls.at(-1)?.url).toContain(`/votes/${VOTE}/cast`);

    // finished fans out to the room
    const aFinished = waitEvent<{ passed: boolean }>(a, 'vote:finished');
    bus.publish(
      makeDomainEvent('playback.vote.finished', {
        roomId: ROOM,
        voteId: VOTE,
        passed: true,
        yes: 2,
        needed: 2,
      }),
    );
    expect((await aFinished).passed).toBe(true);
  });

  it('playback domain errors surface in the ack (VOTE_ALREADY_OPEN)', async () => {
    const rigged = connect('00000000-0000-4000-8000-000000000000'); // stub 409s this sub
    await waitEvent(rigged, 'connect');
    await emitAck(rigged, 'room:join', { roomId: ROOM });
    const ack = await emitAck<{ ok: boolean; error: string }>(rigged, 'vote:start');
    expect(ack).toEqual({ ok: false, error: 'VOTE_ALREADY_OPEN' });
  });
});
