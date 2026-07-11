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
  process.env.CHAT_TEST_DATABASE_URL ??
  'postgresql://lilochat:lilochat@localhost:5440/lilochat_chat_test';
const ADMIN_DB_URL = TEST_DB_URL.replace(/\/[^/]+$/, '/lilochat_chat');
const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUN = Date.now().toString(36);

let app: INestApplication;
let bus: RabbitMqBus;
const ROOM = randomUUID();
const USER = randomUUID();

const submitted = (content: string, sentAt = new Date()) =>
  makeDomainEvent('chat.message.submitted', {
    roomId: ROOM,
    tempId: `tmp-${Math.random().toString(36).slice(2, 8)}`,
    userId: USER,
    nickname: 'it_user',
    content,
    sentAt: sentAt.toISOString(),
  });

async function listMessages(cursor?: string) {
  const url = `/internal/rooms/${ROOM}/messages${cursor ? `?cursor=${cursor}` : ''}`;
  const res = await request(app.getHttpServer()).get(url).expect(200);
  return res.body as { items: Array<{ id: string; content: string }>; nextCursor: string | null };
}

beforeAll(async () => {
  const { PrismaClient } = await import('../generated/client/index.js');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  await admin.$executeRawUnsafe('CREATE DATABASE lilochat_chat_test').catch(() => undefined);
  await admin.$disconnect();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: APP_ROOT,
    env: { ...process.env, CHAT_DATABASE_URL: TEST_DB_URL },
    stdio: 'ignore',
  });

  process.env.CHAT_DATABASE_URL = TEST_DB_URL;
  process.env.RABBITMQ_URL = RABBITMQ_URL;
  process.env.REDIS_URL = 'redis://localhost:6380/8';
  process.env.CHAT_CONSUMER_QUEUE = `it.${RUN}.chat`;
  process.env.NODE_ENV = 'test';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  const { PrismaService } = await import('../src/infrastructure/prisma/prisma.service.js');
  const prisma = app.get(PrismaService);
  await prisma.outboxEvent.deleteMany();
  await prisma.message.deleteMany();

  bus = await RabbitMqBus.connect(RABBITMQ_URL);
});

afterAll(async () => {
  await bus?.close();
  await app?.close();
});

describe('chat service (real Postgres + RabbitMQ + Redis)', () => {
  it('persists a submitted message and publishes chat.message.persisted with the tempId', async () => {
    const observe = `it.${RUN}.observe-persisted`;
    await bus.channel.assertQueue(observe, { exclusive: true });
    await bus.channel.bindQueue(observe, LILOCHAT_EXCHANGE, 'chat.message.persisted');

    const event = submitted('hello room!');
    bus.publish(event);

    // consumer persists -> REST sees it
    const deadline = Date.now() + 8_000;
    let items: Array<{ id: string; content: string }> = [];
    while (items.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      items = (await listMessages()).items;
    }
    expect(items[0]?.content).toBe('hello room!');
    expect(items[0]?.id).toBe(event.eventId); // messageId = submitted eventId

    // outbox relay publishes the ack event carrying the SAME tempId
    let persisted: { payload: { tempId: string; messageId: string } } | undefined;
    const ackDeadline = Date.now() + 8_000;
    while (!persisted && Date.now() < ackDeadline) {
      const message = await bus.channel.get(observe, { noAck: true });
      if (message) persisted = JSON.parse(message.content.toString('utf8'));
      else await new Promise((resolve) => setTimeout(resolve, 150));
    }
    expect(persisted?.payload.tempId).toBe(event.payload.tempId);
    expect(persisted?.payload.messageId).toBe(event.eventId);
  });

  it('redelivered submitted event persists exactly once', async () => {
    const event = submitted('only once');
    bus.publish(event);
    bus.publish(event); // duplicate delivery

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const { items } = await listMessages();
    expect(items.filter((m) => m.content === 'only once')).toHaveLength(1);
  });

  it('keyset pagination walks history backwards without dupes (120 msgs -> 50/50/20)', async () => {
    const { PrismaService } = await import('../src/infrastructure/prisma/prisma.service.js');
    const prisma = app.get(PrismaService);
    await prisma.message.deleteMany();
    const base = Date.now() - 200_000;
    await prisma.message.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        id: randomUUID(),
        roomId: ROOM,
        userId: USER,
        nickname: 'it_user',
        content: `msg ${i}`,
        createdAt: new Date(base + i * 1000),
      })),
    });

    const seen = new Set<string>();
    const pageSizes: number[] = [];
    let cursor: string | undefined;
    do {
      const page = await listMessages(cursor);
      pageSizes.push(page.items.length);
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(pageSizes).toEqual([50, 50, 20]);
    expect(seen.size).toBe(120);
  });
});
