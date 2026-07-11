import 'reflect-metadata';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Minimal identity-service stub: canned responses, records what it received. */
function createIdentityStub() {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const userId = randomUUID();
  const session = (refreshToken: string) => ({
    user: {
      id: userId,
      email: 'it@lilochat.app',
      nickname: 'it_user',
      createdAt: new Date().toISOString(),
    },
    accessToken: 'stub-access-token',
    accessTokenExpiresIn: 900,
    refreshToken,
  });

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: string) => (raw += chunk));
    req.on('end', () => {
      const body: unknown = raw ? JSON.parse(raw) : undefined;
      calls.push({ method: req.method ?? '', url: req.url ?? '', body });

      const respond = (status: number, payload?: unknown): void => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(payload === undefined ? undefined : JSON.stringify(payload));
      };

      if (req.url === '/auth/register' && req.method === 'POST') {
        return respond(201, session('rt-registered'));
      }
      if (req.url === '/auth/login' && req.method === 'POST') {
        const creds = body as { password: string };
        if (creds.password === 'wrong-password') {
          return respond(401, {
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }
        return respond(200, session('rt-logged-in'));
      }
      if (req.url === '/auth/refresh' && req.method === 'POST') {
        const { refreshToken } = body as { refreshToken: string };
        if (refreshToken === 'rt-logged-in') return respond(200, session('rt-rotated'));
        return respond(401, {
          statusCode: 401,
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }
      if (req.url === '/auth/logout' && req.method === 'POST') return respond(204);
      if (req.url?.startsWith('/users/') && req.method === 'GET') {
        return respond(200, session('x').user);
      }
      if (req.url?.endsWith('/nickname') && req.method === 'PATCH') {
        return respond(200, {
          ...session('x').user,
          nickname: (body as { nickname: string }).nickname,
        });
      }
      respond(404, { statusCode: 404, message: 'not found' });
    });
  });

  return { server, calls, userId };
}

let app: INestApplication;
let stub: ReturnType<typeof createIdentityStub>;
let privateKeyPem: string;

beforeAll(async () => {
  stub = createIdentityStub();
  await new Promise<void>((resolve) => stub.server.listen(0, resolve));
  const stubPort = (stub.server.address() as AddressInfo).port;

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  privateKeyPem = privateKey;

  process.env.IDENTITY_SERVICE_URL = `http://127.0.0.1:${stubPort}`;
  process.env.ROOMS_SERVICE_URL = `http://127.0.0.1:${stubPort}`;
  process.env.PLAYBACK_SERVICE_URL = `http://127.0.0.1:${stubPort}`;
  process.env.REDIS_URL = 'redis://localhost:6380/1'; // db 1: isolated from dev data
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');
  process.env.NODE_ENV = 'test';
  // tight anon bucket so the 429 test is fast; auth bucket left roomy
  process.env.RATE_LIMIT_ANON_CAPACITY = '15';
  process.env.RATE_LIMIT_ANON_REFILL_PER_SEC = '0.1';
  process.env.RATE_LIMIT_AUTH_CAPACITY = '100';
  process.env.RATE_LIMIT_AUTH_REFILL_PER_SEC = '10';

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.use(cookieParser());
  await app.init();

  const { REDIS } = await import('../src/redis/redis.module.js');
  const redis = app.get<Redis>(REDIS);
  await redis.flushdb(); // fresh buckets per run
});

afterAll(async () => {
  await app?.close();
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
});

function signAccessToken(sub: string): string {
  return jwt.sign({ nickname: 'it_user' }, privateKeyPem, {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: 900,
    issuer: 'lilochat-identity',
    audience: 'lilochat',
  });
}

describe('api-gateway (real Redis, stubbed identity)', () => {
  it('register: sets httpOnly refresh cookie and never exposes refreshToken in the body', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'it@lilochat.app', password: 'supersecret', nickname: 'it_user' })
      .expect(201);

    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.accessToken).toBe('stub-access-token');

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('lilo_rt=rt-registered');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/auth');
  });

  it('validates at the edge: invalid body → 400 before ever reaching identity', async () => {
    const callsBefore = stub.calls.length;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'nope', password: 'x', nickname: 'a' })
      .expect(400);
    expect(res.body.issues.length).toBeGreaterThan(0);
    expect(stub.calls.length).toBe(callsBefore); // identity untouched
  });

  it('login: passes identity domain errors through untouched', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'it@lilochat.app', password: 'wrong-password' })
      .expect(401)
      .expect((res) => expect(res.body.code).toBe('INVALID_CREDENTIALS'));
  });

  it('refresh: reads the cookie, rotates it; failure clears the cookie', async () => {
    const rotated = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'lilo_rt=rt-logged-in')
      .expect(200);
    expect(rotated.headers['set-cookie']?.[0]).toContain('lilo_rt=rt-rotated');

    const failed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'lilo_rt=rt-dead')
      .expect(401);
    expect(failed.headers['set-cookie']?.[0]).toContain('lilo_rt=;'); // cleared
  });

  it('refresh without any token → 401 MISSING_REFRESH_TOKEN', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .expect(401)
      .expect((res) => expect(res.body.code).toBe('MISSING_REFRESH_TOKEN'));
  });

  it('/users/me: 401 without token, 401 with a forged token, 200 with a valid RS256 token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer forged.token.here')
      .expect(401);

    const token = signAccessToken(stub.userId);
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.nickname).toBe('it_user');
    // gateway resolved `me` -> the JWT's sub when calling identity
    expect(stub.calls.at(-1)?.url).toBe(`/users/${stub.userId}`);
  });

  it('PATCH /users/me proxies the nickname update', async () => {
    const token = signAccessToken(stub.userId);
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: 'renamed' })
      .expect(200);
    expect(res.body.nickname).toBe('renamed');
    expect(stub.calls.at(-1)?.url).toBe(`/users/${stub.userId}/nickname`);
  });

  it('rate limits anonymous traffic: token bucket eventually answers 429', async () => {
    const agent = request(app.getHttpServer());
    let limited = false;
    for (let i = 0; i < 20 && !limited; i += 1) {
      const res = await agent.post('/auth/login').send({ email: 'a@b.com', password: 'x' });
      limited = res.status === 429 && res.body.code === 'RATE_LIMITED';
    }
    expect(limited).toBe(true);
  });

  it('health endpoints skip rate limiting', async () => {
    // the anon bucket is exhausted by the previous test — health must still answer
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });
});
