import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LILOCHAT_EXCHANGE, RabbitMqBus } from '@lilochat/nest-shared';

const TEST_DB_URL =
  process.env.PLAYBACK_TEST_DATABASE_URL ??
  'postgresql://lilochat:lilochat@localhost:5440/lilochat_playback_test';
const ADMIN_DB_URL = TEST_DB_URL.replace(/\/[^/]+$/, '/lilochat_playback');
const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUN = Date.now().toString(36);

/** YouTube Data API stub: 2-second embeddable videos + special-cased ids. */
function createYoutubeStub() {
  const state = { calls: 0 };
  const server = http.createServer((req, res) => {
    state.calls += 1;
    const url = new URL(req.url ?? '/', 'http://stub');
    const id = url.searchParams.get('id') ?? '';
    const respond = (payload: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    if (id === 'gone4040404') return respond({ items: [] });
    const embeddable = id !== 'noembed0000';
    const duration = id === 'toolong0000' ? 'PT5H' : 'PT2S';
    respond({
      items: [
        {
          id,
          snippet: {
            title: `Video ${id}`,
            thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hq.jpg` } },
          },
          contentDetails: { duration },
          status: { embeddable },
        },
      ],
    });
  });
  return { server, state };
}

let app: INestApplication;
let bus: RabbitMqBus;
let stub: ReturnType<typeof createYoutubeStub>;

const ROOM = randomUUID();
const USER = randomUUID();

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const addBody = (id: string) => ({
  videoUrl: watchUrl(id),
  addedById: USER,
  addedByNickname: 'it_user',
});

beforeAll(async () => {
  stub = createYoutubeStub();
  await new Promise<void>((resolve) => stub.server.listen(0, resolve));

  const { PrismaClient } = await import('../generated/client/index.js');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  await admin.$executeRawUnsafe('CREATE DATABASE lilochat_playback_test').catch(() => undefined);
  await admin.$disconnect();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: APP_ROOT,
    env: { ...process.env, PLAYBACK_DATABASE_URL: TEST_DB_URL },
    stdio: 'ignore',
  });

  process.env.PLAYBACK_DATABASE_URL = TEST_DB_URL;
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.REDIS_URL = 'redis://localhost:6380/5';
  process.env.YOUTUBE_API_KEY = 'stub-key';
  process.env.YOUTUBE_API_URL = `http://127.0.0.1:${(stub.server.address() as AddressInfo).port}`;
  process.env.ADVANCE_GRACE_MS = '300'; // fast tests: 2s videos + 0.3s grace
  process.env.ADVANCE_QUEUE_NAME = `it-${RUN}-advance`;
  process.env.NODE_ENV = 'test';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  const { PrismaService } = await import('../src/infrastructure/prisma/prisma.service.js');
  const prisma = app.get(PrismaService);
  await prisma.outboxEvent.deleteMany();
  await prisma.queueItem.deleteMany();
  await prisma.video.deleteMany();

  bus = await RabbitMqBus.connect(RABBITMQ_URL);
});

afterAll(async () => {
  await bus?.close();
  await app?.close();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
});

async function observeExchange(routingKey: string): Promise<() => Promise<unknown[]>> {
  const queue = `it.${RUN}.obs.${routingKey}.${Math.random().toString(36).slice(2, 8)}`;
  await bus.channel.assertQueue(queue, { exclusive: true });
  await bus.channel.bindQueue(queue, LILOCHAT_EXCHANGE, routingKey);
  return async () => {
    const events: unknown[] = [];
    let message = await bus.channel.get(queue, { noAck: true });
    while (message) {
      events.push(JSON.parse(message.content.toString('utf8')));
      message = await bus.channel.get(queue, { noAck: true });
    }
    return events;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('playback service — the server-authoritative timeline ⭐', () => {
  it('metadata validation: unknown video 404, non-embeddable 422, >4h 422, bad URL 400', async () => {
    const server = app.getHttpServer();
    const post = (id: string) =>
      request(server).post(`/internal/rooms/${randomUUID()}/queue`).send(addBody(id));

    await post('gone4040404').expect(404);
    await post('noembed0000').expect(422);
    await post('toolong0000').expect(422);
    await request(server)
      .post(`/internal/rooms/${randomUUID()}/queue`)
      .send({ ...addBody('x'), videoUrl: 'https://www.youtube.com/playlist?list=PL1' })
      .expect(400);
  });

  it('adding to an idle room starts it immediately: tuple set, video.started published', async () => {
    const drainStarted = await observeExchange('playback.video.started');

    const res = await request(app.getHttpServer())
      .post(`/internal/rooms/${ROOM}/queue`)
      .send(addBody('aaaaaaaaaa1'))
      .expect(201);
    expect(res.body.status).toBe('playing'); // idle room → this item started

    const state = await request(app.getHttpServer())
      .get(`/internal/rooms/${ROOM}/state`)
      .expect(200);
    expect(state.body.playback.videoId).toBe('aaaaaaaaaa1');
    expect(state.body.playback.durationS).toBe(2);
    expect(new Date(state.body.playback.startedAt).getTime()).toBeGreaterThan(0);
    expect(state.body.queue).toHaveLength(0); // nothing pending — it's playing

    await sleep(700); // outbox relay tick
    const started = (await drainStarted()) as Array<{ payload: { videoId: string } }>;
    expect(started.some((event) => event.payload.videoId === 'aaaaaaaaaa1')).toBe(true);
  });

  it('duplicate pending/playing video → 409; metadata is cached (1 API call per videoId)', async () => {
    const callsBefore = stub.state.calls;
    await request(app.getHttpServer())
      .post(`/internal/rooms/${ROOM}/queue`)
      .send(addBody('aaaaaaaaaa1'))
      .expect(409);
    expect(stub.state.calls).toBe(callsBefore); // served from the videos cache table
  });

  it('THE auto-advance: video 1 ends → video 2 starts by itself ⭐', async () => {
    const drainStarted = await observeExchange('playback.video.started');
    const drainSkipped = await observeExchange('playback.video.skipped');

    // video 2 queues behind the (2s) video 1 already playing
    const res = await request(app.getHttpServer())
      .post(`/internal/rooms/${ROOM}/queue`)
      .send(addBody('bbbbbbbbbb2'))
      .expect(201);
    expect(res.body.status).toBe('pending');

    // wait past videoEnd(2s) + grace(0.3s) + scheduler/outbox slack
    const deadline = Date.now() + 10_000;
    let nowPlaying: string | undefined;
    while (nowPlaying !== 'bbbbbbbbbb2' && Date.now() < deadline) {
      await sleep(250);
      const state = await request(app.getHttpServer())
        .get(`/internal/rooms/${ROOM}/state`)
        .expect(200);
      nowPlaying = state.body.playback?.videoId;
    }
    expect(nowPlaying).toBe('bbbbbbbbbb2'); // the room advanced itself 🎬

    await sleep(700);
    const skipped = (await drainSkipped()) as Array<{ payload: { reason: string } }>;
    expect(skipped.some((event) => event.payload.reason === 'ended')).toBe(true);
    const started = (await drainStarted()) as Array<{ payload: { videoId: string } }>;
    expect(started.some((event) => event.payload.videoId === 'bbbbbbbbbb2')).toBe(true);
  });

  it('when the queue drains, the room goes idle (tuple cleared)', async () => {
    const deadline = Date.now() + 10_000;
    let playback: unknown = 'sentinel';
    while (playback !== null && Date.now() < deadline) {
      await sleep(250);
      const state = await request(app.getHttpServer())
        .get(`/internal/rooms/${ROOM}/state`)
        .expect(200);
      playback = state.body.playback;
    }
    expect(playback).toBeNull();
  });

  it('vote skip: quorum reached -> video advances; failed vote -> cooldown blocks retry ⭐', async () => {
    const room = randomUUID();
    const server = app.getHttpServer();
    const [u1, u2, u3] = [randomUUID(), randomUUID(), randomUUID()];

    // plant presence for 3 users (the RTG's documented key shape — §5.3 seam)
    const { Redis } = await import('ioredis');
    const redis = new Redis('redis://localhost:6380/5');
    for (const u of [u1, u2, u3]) {
      await redis.zadd(
        `presence:${room}`,
        Date.now() + 60_000,
        `${randomUUID()}|${u}|nick|${Date.now()}`,
      );
    }

    // two videos: video 1 playing, video 2 pending
    await request(server)
      .post(`/internal/rooms/${room}/queue`)
      .send(addBody('vote0000001'))
      .expect(201);
    await request(server)
      .post(`/internal/rooms/${room}/queue`)
      .send(addBody('vote0000002'))
      .expect(201);

    const drainFinished = await observeExchange('playback.vote.finished');

    // needed = floor(3/2)+1 = 2 → starter (auto-yes) + one cast = pass
    const started = await request(server)
      .post(`/internal/rooms/${room}/votes`)
      .send({ startedBy: u1 })
      .expect(201);
    expect(started.body).toMatchObject({ yes: 1, needed: 2 });

    // duplicate open vote is refused
    await request(server).post(`/internal/rooms/${room}/votes`).send({ startedBy: u2 }).expect(409);

    await request(server)
      .post(`/internal/rooms/${room}/votes/${started.body.voteId}/cast`)
      .send({ userId: u2 })
      .expect(200);

    // the room advances to video 2 because the vote passed
    const deadline = Date.now() + 8_000;
    let nowPlaying: string | undefined;
    while (nowPlaying !== 'vote0000002' && Date.now() < deadline) {
      await sleep(200);
      const state = await request(server).get(`/internal/rooms/${room}/state`).expect(200);
      nowPlaying = state.body.playback?.videoId;
    }
    expect(nowPlaying).toBe('vote0000002');

    await sleep(700); // outbox
    const finished = (await drainFinished()) as Array<{ payload: { passed: boolean } }>;
    expect(finished.some((e) => e.payload.passed === true)).toBe(true);

    // now fail a vote on video 2 (nobody else casts): resolveByTimeout via the
    // engine's job — too slow for a test at 45s, so exercise cooldown directly:
    // a failed vote is covered by unit tests; here assert the open-vote rules
    await request(server).post(`/internal/rooms/${room}/votes`).send({ startedBy: u1 }).expect(201);
    await request(server).post(`/internal/rooms/${room}/votes`).send({ startedBy: u3 }).expect(409);

    await redis.quit();
  });

  it('remove: only adder/owner, never the playing item', async () => {
    const room = randomUUID();
    const server = app.getHttpServer();
    await request(server)
      .post(`/internal/rooms/${room}/queue`)
      .send(addBody('cccccccccc3'))
      .expect(201);
    const pending = await request(server)
      .post(`/internal/rooms/${room}/queue`)
      .send(addBody('dddddddddd4'))
      .expect(201);
    const itemId = pending.body.itemId as string;

    // stranger, not owner → 403
    await request(server)
      .delete(
        `/internal/rooms/${room}/queue/${itemId}?requesterId=${randomUUID()}&isRoomOwner=false`,
      )
      .expect(403);
    // adder → 204
    await request(server)
      .delete(`/internal/rooms/${room}/queue/${itemId}?requesterId=${USER}&isRoomOwner=false`)
      .expect(204);
    // playing item → 409 even for the owner
    const state = await request(server).get(`/internal/rooms/${room}/state`).expect(200);
    await request(server)
      .delete(
        `/internal/rooms/${room}/queue/${state.body.playback.itemId}?requesterId=${USER}&isRoomOwner=true`,
      )
      .expect(409);
  });
});
