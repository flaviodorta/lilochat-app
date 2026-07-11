import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeDomainEvent, RabbitMqBus } from '@lilochat/nest-shared';

const TEST_DB_URL =
  process.env.ENGAGEMENT_TEST_DATABASE_URL ??
  'postgresql://lilochat:lilochat@localhost:5440/lilochat_engagement_test';
const ADMIN_DB_URL = TEST_DB_URL.replace(/\/[^/]+$/, '/lilochat_engagement');
const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUN = Date.now().toString(36);

let app: INestApplication;
let bus: RabbitMqBus;

const ROOM = randomUUID();
const USER = randomUUID();
const SESSION = randomUUID();
const T0 = Date.now();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function alltimeSeconds(): Promise<number> {
  const res = await request(app.getHttpServer()).get(`/internal/users/${USER}/stats`).expect(200);
  return res.body.periods.alltime.seconds as number;
}

/** poll until the expectation holds (consumers are async). */
async function eventually(expected: number, timeoutMs = 8_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let value = -1;
  while (value !== expected && Date.now() < deadline) {
    await sleep(150);
    value = await alltimeSeconds();
  }
  return value;
}

beforeAll(async () => {
  const { PrismaClient } = await import('../generated/client/index.js');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  await admin.$executeRawUnsafe('CREATE DATABASE lilochat_engagement_test').catch(() => undefined);
  await admin.$disconnect();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: APP_ROOT,
    env: { ...process.env, ENGAGEMENT_DATABASE_URL: TEST_DB_URL },
    stdio: 'ignore',
  });

  process.env.ENGAGEMENT_DATABASE_URL = TEST_DB_URL;
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.REDIS_URL = 'redis://localhost:6380/11';
  process.env.ENGAGEMENT_QUEUE_PREFIX = `it.${RUN}.engagement`;
  process.env.NODE_ENV = 'test';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  const { PrismaService } = await import('../src/infrastructure/prisma/prisma.service.js');
  const prisma = app.get(PrismaService);
  await prisma.watchSession.deleteMany();
  await prisma.userTotal.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.roomState.deleteMany();
  const { Redis } = await import('ioredis');
  const redis = new Redis('redis://localhost:6380/11');
  await redis.flushdb();
  await redis.quit();

  bus = await RabbitMqBus.connect(RABBITMQ_URL);
});

afterAll(async () => {
  await bus?.close();
  await app?.close();
});

describe('engagement — qualified watch time (§3.6/§6.5)', () => {
  it('accumulates checkpoint seconds only while the room is playing, replay-safe', async () => {
    // nickname read model
    bus.publish(makeDomainEvent('identity.user.registered', { userId: USER, nickname: 'binger' }));

    // the room starts playing; a session opens
    bus.publish(
      makeDomainEvent('playback.video.started', {
        roomId: ROOM,
        itemId: randomUUID(),
        videoId: 'engage00001',
        title: 'Video',
        durationS: 3600,
        thumbUrl: 'https://i.ytimg.com/x.jpg',
        startedAt: new Date(T0).toISOString(),
      }),
    );
    bus.publish(
      makeDomainEvent('presence.user.joined', {
        roomId: ROOM,
        userId: USER,
        sessionId: SESSION,
        at: new Date(T0).toISOString(),
      }),
    );
    await sleep(600);

    // checkpoint: +60 qualified seconds
    const checkpoint = makeDomainEvent(
      'presence.checkpoint',
      { entries: [{ sessionId: SESSION, roomId: ROOM, userId: USER, seconds: 60 }] },
      new Date(T0 + 60_000),
    );
    bus.publish(checkpoint);
    expect(await eventually(60)).toBe(60);

    // REPLAY the same checkpoint (same eventId) → still 60
    bus.publish(checkpoint);
    await sleep(800);
    expect(await alltimeSeconds()).toBe(60);

    // room goes idle → the next checkpoint credits NOTHING
    bus.publish(
      makeDomainEvent('playback.video.skipped', {
        roomId: ROOM,
        itemId: randomUUID(),
        reason: 'empty',
      }),
    );
    await sleep(500);
    bus.publish(
      makeDomainEvent(
        'presence.checkpoint',
        { entries: [{ sessionId: SESSION, roomId: ROOM, userId: USER, seconds: 60 }] },
        new Date(T0 + 120_000),
      ),
    );
    await sleep(800);
    expect(await alltimeSeconds()).toBe(60); // idle time is unqualified

    // playing again → leaving credits the residue since the last checkpoint (30 s)
    bus.publish(
      makeDomainEvent('playback.video.started', {
        roomId: ROOM,
        itemId: randomUUID(),
        videoId: 'engage00002',
        title: 'Video 2',
        durationS: 3600,
        thumbUrl: 'https://i.ytimg.com/x.jpg',
        startedAt: new Date(T0 + 120_000).toISOString(),
      }),
    );
    await sleep(400);
    bus.publish(
      makeDomainEvent('presence.user.left', {
        roomId: ROOM,
        userId: USER,
        sessionId: SESSION,
        at: new Date(T0 + 150_000).toISOString(), // 30 s after the last checkpoint marker
        durationS: 150,
      }),
    );
    expect(await eventually(90)).toBe(90);

    // a left replay / late checkpoint for the ENDED session credits nothing
    bus.publish(
      makeDomainEvent(
        'presence.checkpoint',
        { entries: [{ sessionId: SESSION, roomId: ROOM, userId: USER, seconds: 60 }] },
        new Date(T0 + 180_000),
      ),
    );
    await sleep(800);
    expect(await alltimeSeconds()).toBe(90);
  });

  it('serves the leaderboard with nicknames and per-period stats with ranks', async () => {
    const res = await request(app.getHttpServer())
      .get('/internal/leaderboard?period=alltime&limit=10')
      .expect(200);
    expect(res.body.rows[0]).toMatchObject({
      rank: 1,
      userId: USER,
      nickname: 'binger',
      seconds: 90,
    });

    const stats = await request(app.getHttpServer())
      .get(`/internal/users/${USER}/stats`)
      .expect(200);
    expect(stats.body.periods.alltime).toEqual({ seconds: 90, rank: 1 });
    expect(stats.body.periods.weekly.seconds).toBe(90);

    const ghost = await request(app.getHttpServer())
      .get(`/internal/users/${randomUUID()}/stats`)
      .expect(200);
    expect(ghost.body.periods.alltime).toEqual({ seconds: 0, rank: null });
  });
});
