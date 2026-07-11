import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeDomainEvent, LILOCHAT_EXCHANGE, RabbitMqBus } from '@lilochat/nest-shared';

const TEST_DB_URL =
  process.env.ROOMS_TEST_DATABASE_URL ??
  'postgresql://lilochat:lilochat@localhost:5440/lilochat_rooms_test';
const ADMIN_DB_URL = TEST_DB_URL.replace(/\/[^/]+$/, '/lilochat_rooms');
const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUN = Date.now().toString(36);

let app: INestApplication;
let bus: RabbitMqBus; // test-side bus: publishes fake playback events, observes room.created

const OWNER = randomUUID();

async function createRoom(name: string): Promise<{ id: string; name: string }> {
  const res = await request(app.getHttpServer())
    .post('/rooms')
    .send({ name, ownerId: OWNER })
    .expect(201);
  return res.body as { id: string; name: string };
}

async function wipeTables(): Promise<void> {
  const { PrismaService } = await import('../src/infrastructure/prisma/prisma.service.js');
  const prisma = app.get(PrismaService);
  await prisma.outboxEvent.deleteMany();
  await prisma.roomCard.deleteMany();
  await prisma.room.deleteMany();
}

beforeAll(async () => {
  const { PrismaClient } = await import('../generated/client/index.js');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  await admin.$executeRawUnsafe('CREATE DATABASE lilochat_rooms_test').catch(() => undefined);
  await admin.$disconnect();

  execSync('pnpm exec prisma migrate deploy', {
    cwd: APP_ROOT,
    env: { ...process.env, ROOMS_DATABASE_URL: TEST_DB_URL },
    stdio: 'ignore',
  });

  process.env.ROOMS_DATABASE_URL = TEST_DB_URL;
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.REDIS_URL = 'redis://localhost:6380/4';
  process.env.ROOMS_CONSUMER_QUEUE = `it.${RUN}.rooms.playback-events`;
  process.env.ROOMS_PRESENCE_QUEUE = `it.${RUN}.rooms.presence-events`;
  process.env.NODE_ENV = 'test';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await wipeTables();

  bus = await RabbitMqBus.connect(RABBITMQ_URL);
});

afterAll(async () => {
  await bus?.close();
  await app?.close();
});

describe('rooms service (real Postgres + RabbitMQ + Redis)', () => {
  it('creates a room and the outbox relay publishes room.created to the bus', async () => {
    // observe the exchange BEFORE acting
    const observeQueue = `it.${RUN}.observe-room-created`;
    // NOTE: RabbitMQ 4 forbids transient non-exclusive queues — exclusive is the blessed combo
    await bus.channel.assertQueue(observeQueue, { exclusive: true });
    await bus.channel.bindQueue(observeQueue, LILOCHAT_EXCHANGE, 'room.created');

    const room = await createRoom('Lofi & Chill');
    expect(room.name).toBe('Lofi & Chill');

    // relay polls every 500ms — wait for the event to land
    let published: { name: string; payload: { roomId: string } } | undefined;
    const deadline = Date.now() + 8_000;
    while (!published && Date.now() < deadline) {
      const message = await bus.channel.get(observeQueue, { noAck: true });
      if (message) published = JSON.parse(message.content.toString('utf8'));
      else await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(published?.name).toBe('room.created');
    expect(published?.payload.roomId).toBe(room.id);
  });

  it('rejects invalid names and unknown rooms', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .send({ name: 'ab', ownerId: OWNER })
      .expect(400);
    await request(app.getHttpServer()).get(`/rooms/${randomUUID()}`).expect(404);
  });

  it('keyset pagination: stable pages, no overlaps, correct end', async () => {
    await wipeTables();
    for (let i = 1; i <= 25; i += 1) await createRoom(`Room number ${i}`);

    const seen = new Set<string>();
    let cursor: string | null = null;
    const pageSizes: number[] = [];

    do {
      const url = `/rooms?limit=10${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await request(app.getHttpServer()).get(url).expect(200);
      const { items, nextCursor, serverNow } = res.body as {
        items: Array<{ id: string }>;
        nextCursor: string | null;
        serverNow: string;
      };
      expect(new Date(serverNow).getTime()).toBeGreaterThan(0);
      pageSizes.push(items.length);
      for (const item of items) {
        expect(seen.has(item.id)).toBe(false); // no duplicates across pages
        seen.add(item.id);
      }
      cursor = nextCursor;
    } while (cursor);

    expect(pageSizes).toEqual([10, 10, 5]);
    expect(seen.size).toBe(25);
  });

  it('search: trigram-backed ILIKE, case-insensitive', async () => {
    await wipeTables();
    await createRoom('Lofi Beats 24/7');
    await createRoom('Rock Arena');
    await createRoom('deep lofi zone');

    const res = await request(app.getHttpServer()).get('/rooms?q=LOFI').expect(200);
    const names = (res.body.items as Array<{ name: string }>).map((item) => item.name).sort();
    expect(names).toEqual(['Lofi Beats 24/7', 'deep lofi zone']);
  });

  it('consumes presence events into durable viewer counts (clamped at zero)', async () => {
    await wipeTables();
    const room = await createRoom('Presence room');
    const joined = (userId: string) =>
      makeDomainEvent('presence.user.joined', {
        roomId: room.id,
        userId,
        sessionId: randomUUID(),
        at: new Date().toISOString(),
      });

    const event = joined(randomUUID());
    bus.publish(event);
    bus.publish(event); // duplicate — idempotency must hold the count at 1
    bus.publish(joined(randomUUID()));

    const deadline = Date.now() + 8_000;
    let viewers = 0;
    while (viewers !== 2 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const res = await request(app.getHttpServer()).get(`/rooms/${room.id}`).expect(200);
      viewers = res.body.card.viewers;
    }
    expect(viewers).toBe(2);

    // three lefts (one spurious) → clamped at zero, never negative
    for (let i = 0; i < 3; i += 1) {
      bus.publish(
        makeDomainEvent('presence.user.left', {
          roomId: room.id,
          userId: randomUUID(),
          sessionId: randomUUID(),
          at: new Date().toISOString(),
          durationS: 10,
        }),
      );
    }
    const zeroDeadline = Date.now() + 8_000;
    while (viewers !== 0 && Date.now() < zeroDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const res = await request(app.getHttpServer()).get(`/rooms/${room.id}`).expect(200);
      viewers = res.body.card.viewers;
    }
    expect(viewers).toBe(0);
  });

  it('consumes playback.video.started and updates the card read model', async () => {
    await wipeTables();
    const room = await createRoom('Watch party');

    // card starts idle
    const before = await request(app.getHttpServer()).get(`/rooms/${room.id}`).expect(200);
    expect(before.body.card.video).toBeNull();

    bus.publish(
      makeDomainEvent('playback.video.started', {
        roomId: room.id,
        itemId: randomUUID(),
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        durationS: 212,
        thumbUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        startedAt: new Date().toISOString(),
      }),
    );

    // poll until the consumer applies it
    const deadline = Date.now() + 8_000;
    let video: { videoId: string; title: string } | null = null;
    while (!video && Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/rooms/${room.id}`).expect(200);
      video = res.body.card.video;
      if (!video) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(video?.videoId).toBe('dQw4w9WgXcQ');
    expect(video?.title).toBe('Never Gonna Give You Up');
  });
});
