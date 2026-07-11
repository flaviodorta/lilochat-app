import 'reflect-metadata';
import { generateKeyPairSync } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Multiavatar API stub with a switchable failure mode. */
function createMultiavatarStub() {
  const state = { mode: 'ok' as 'ok' | 'fail', calls: 0 };
  const server = http.createServer((req, res) => {
    state.calls += 1;
    if (state.mode === 'fail') {
      res.writeHead(500);
      return res.end('boom');
    }
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(
      `<svg xmlns="http://www.w3.org/2000/svg" data-source="remote"><!-- ${req.url} --></svg>`,
    );
  });
  return { server, state };
}

let app: INestApplication;
let stub: ReturnType<typeof createMultiavatarStub>;

/** supertest treats image/svg+xml as binary — body arrives as a Buffer, not .text */
function svgOf(res: request.Response): string {
  if (typeof res.text === 'string' && res.text.length > 0) return res.text;
  return Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.body);
}

beforeAll(async () => {
  stub = createMultiavatarStub();
  await new Promise<void>((resolve) => stub.server.listen(0, resolve));
  const stubPort = (stub.server.address() as AddressInfo).port;

  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  process.env.IDENTITY_SERVICE_URL = 'http://127.0.0.1:9'; // unused here
  process.env.REDIS_URL = 'redis://localhost:6380/2'; // db 2: isolated avatar cache
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');
  process.env.NODE_ENV = 'test';
  process.env.MULTIAVATAR_API_URL = `http://127.0.0.1:${stubPort}`;
  process.env.RATE_LIMIT_ANON_CAPACITY = '1000';
  process.env.RATE_LIMIT_ANON_REFILL_PER_SEC = '100';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  const { REDIS } = await import('../src/redis/redis.module.js');
  const redis = app.get<Redis>(REDIS);
  await redis.flushdb();
});

afterAll(async () => {
  await app?.close();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
});

describe('GET /avatars/:seed.svg (real Redis, stubbed Multiavatar API)', () => {
  it('cold: fetches from the API, serves SVG with immutable cache headers', async () => {
    const res = await request(app.getHttpServer()).get('/avatars/flavio.svg').expect(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(svgOf(res)).toContain('data-source="remote"');
    expect(stub.state.calls).toBe(1);
  });

  it('warm: second request is served from Redis — the API is not called again', async () => {
    const before = stub.state.calls;
    const res = await request(app.getHttpServer()).get('/avatars/flavio.svg').expect(200);
    expect(svgOf(res)).toContain('data-source="remote"');
    expect(stub.state.calls).toBe(before);
  });

  it('breaker: API failures degrade to identical local generation, then fail fast', async () => {
    stub.state.mode = 'fail';

    // 3 consecutive failures trip the breaker — every response still a valid SVG (local)
    for (const seed of ['a_1', 'a_2', 'a_3']) {
      const res = await request(app.getHttpServer()).get(`/avatars/${seed}.svg`).expect(200);
      expect(svgOf(res).trimStart().startsWith('<svg')).toBe(true);
      expect(svgOf(res)).not.toContain('data-source="remote"');
    }

    // breaker now open: new seed served locally WITHOUT touching the API
    const callsBefore = stub.state.calls;
    await request(app.getHttpServer()).get('/avatars/a_4.svg').expect(200);
    expect(stub.state.calls).toBe(callsBefore);
  });

  it('locally generated avatars are cached too', async () => {
    const first = await request(app.getHttpServer()).get('/avatars/a_4.svg').expect(200);
    const second = await request(app.getHttpServer()).get('/avatars/a_4.svg').expect(200);
    expect(svgOf(first).length).toBeGreaterThan(0);
    expect(svgOf(second)).toBe(svgOf(first));
  });

  it('rejects malformed seeds', async () => {
    await request(app.getHttpServer()).get('/avatars/has%20space.svg').expect(400);
    await request(app.getHttpServer()).get('/avatars/no-extension').expect(400);
  });
});
