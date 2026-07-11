import 'reflect-metadata';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOM = randomUUID();
const OWNER = randomUUID();
const ITEM = randomUUID();

/** Records calls; replies with canned rooms/playback responses. */
function createServicesStub() {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: string) => (raw += chunk));
    req.on('end', () => {
      calls.push({
        method: req.method ?? '',
        url: req.url ?? '',
        body: raw ? JSON.parse(raw) : undefined,
      });
      const respond = (status: number, payload?: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(payload === undefined ? undefined : JSON.stringify(payload));
      };

      const { url = '', method } = req;
      if (url === '/rooms' && method === 'POST') return respond(201, { id: ROOM, name: 'Lofi' });
      if (url.startsWith('/rooms?') || url === '/rooms') {
        return respond(200, { items: [], nextCursor: null, serverNow: new Date().toISOString() });
      }
      if (url === `/rooms/${ROOM}` && method === 'GET') {
        return respond(200, {
          id: ROOM,
          name: 'Lofi',
          ownerId: OWNER,
          status: 'ACTIVE',
          card: { id: ROOM, name: 'Lofi', viewers: 3, video: null },
        });
      }
      if (url === `/internal/rooms/${ROOM}/state` && method === 'GET') {
        return respond(200, {
          playback: {
            itemId: ITEM,
            videoId: 'dQw4w9WgXcQ',
            title: 'Video',
            thumbUrl: 'https://i.ytimg.com/x.jpg',
            durationS: 212,
            startedAt: new Date().toISOString(),
          },
          queue: [],
          serverNow: new Date().toISOString(),
        });
      }
      if (url === `/internal/rooms/${ROOM}/queue` && method === 'POST') {
        return respond(201, {
          itemId: randomUUID(),
          videoId: 'dQw4w9WgXcQ',
          title: 'Video',
          durationS: 212,
          thumbUrl: 'https://i.ytimg.com/x.jpg',
          addedById: (JSON.parse(raw) as { addedById: string }).addedById,
          addedByNickname: 'it_user',
          status: 'pending',
        });
      }
      if (url.startsWith(`/internal/rooms/${ROOM}/queue/`) && method === 'DELETE') {
        return respond(204);
      }
      respond(404, { statusCode: 404, message: `stub: no route for ${method} ${url}` });
    });
  });
  return { server, calls };
}

let app: INestApplication;
let stub: ReturnType<typeof createServicesStub>;
let privateKeyPem: string;

beforeAll(async () => {
  stub = createServicesStub();
  await new Promise<void>((resolve) => stub.server.listen(0, resolve));
  const port = (stub.server.address() as AddressInfo).port;

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  privateKeyPem = privateKey;

  process.env.IDENTITY_SERVICE_URL = `http://127.0.0.1:${port}`;
  process.env.ROOMS_SERVICE_URL = `http://127.0.0.1:${port}`;
  process.env.PLAYBACK_SERVICE_URL = `http://127.0.0.1:${port}`;
  process.env.CHAT_SERVICE_URL = `http://127.0.0.1:${port}`;
  process.env.REDIS_URL = 'redis://localhost:6380/6';
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_ANON_CAPACITY = '1000';
  process.env.RATE_LIMIT_ANON_REFILL_PER_SEC = '100';
  process.env.RATE_LIMIT_AUTH_CAPACITY = '1000';
  process.env.RATE_LIMIT_AUTH_REFILL_PER_SEC = '100';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
});

const token = (sub: string) =>
  jwt.sign({ nickname: 'it_user' }, privateKeyPem, {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: 900,
    issuer: 'lilochat-identity',
    audience: 'lilochat',
  });

describe('gateway rooms API (composition over stubbed services)', () => {
  it('GET /rooms is public and passes through', async () => {
    const res = await request(app.getHttpServer()).get('/rooms?limit=10').expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('mutations require auth', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .send({ name: 'Lofi', firstVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/rooms/${ROOM}/queue`)
      .send({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
      .expect(401);
  });

  it('POST /rooms composes: create room, then enqueue first video with the JWT identity', async () => {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token(OWNER)}`)
      .send({ name: 'Lofi', firstVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
      .expect(201);
    expect(res.body).toEqual({ id: ROOM, name: 'Lofi' });

    const createCall = stub.calls.find((c) => c.method === 'POST' && c.url === '/rooms');
    expect(createCall?.body).toEqual({ name: 'Lofi', ownerId: OWNER });

    const enqueueCall = stub.calls.find(
      (c) => c.method === 'POST' && c.url === `/internal/rooms/${ROOM}/queue`,
    );
    expect(enqueueCall?.body).toMatchObject({ addedById: OWNER, addedByNickname: 'it_user' });
  });

  it('GET /rooms/:id merges room meta + playback state into RoomDetail', async () => {
    const res = await request(app.getHttpServer()).get(`/rooms/${ROOM}`).expect(200);
    expect(res.body).toMatchObject({
      id: ROOM,
      name: 'Lofi',
      ownerId: OWNER,
      viewers: 3, // from the rooms card
      playback: { videoId: 'dQw4w9WgXcQ' }, // from playback state
      queue: [],
    });
    expect(new Date(res.body.serverNow).getTime()).toBeGreaterThan(0);
  });

  it('DELETE queue item resolves ownership server-side (owner ≠ requester)', async () => {
    const requester = randomUUID(); // NOT the owner
    await request(app.getHttpServer())
      .delete(`/rooms/${ROOM}/queue/${ITEM}`)
      .set('Authorization', `Bearer ${token(requester)}`)
      .expect(204);

    const del = stub.calls.find((c) => c.method === 'DELETE');
    expect(del?.url).toContain(`requesterId=${requester}`);
    expect(del?.url).toContain('isRoomOwner=false');

    await request(app.getHttpServer())
      .delete(`/rooms/${ROOM}/queue/${ITEM}`)
      .set('Authorization', `Bearer ${token(OWNER)}`)
      .expect(204);
    const del2 = stub.calls.filter((c) => c.method === 'DELETE').at(-1);
    expect(del2?.url).toContain('isRoomOwner=true');
  });
});
