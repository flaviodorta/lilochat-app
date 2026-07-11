import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DB_URL =
  process.env.IDENTITY_TEST_DATABASE_URL ??
  'postgresql://lilochat:lilochat@localhost:5440/lilochat_identity_test';
// Any existing database on the same server works as the maintenance connection:
const ADMIN_DB_URL = TEST_DB_URL.replace(/\/[^/]+$/, '/lilochat_identity');
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));

let app: INestApplication;
let publicKeyPem: string;

const CREDS = { email: 'it@lilochat.app', password: 'supersecret', nickname: 'it_user' };

beforeAll(async () => {
  // 1. ensure the dedicated test database exists (idempotent)
  const { PrismaClient } = await import('../generated/client/index.js');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  await admin.$executeRawUnsafe('CREATE DATABASE lilochat_identity_test').catch(() => undefined);
  await admin.$disconnect();

  // 2. apply migrations to the test database
  execSync('pnpm exec prisma migrate deploy', {
    cwd: APP_ROOT,
    env: { ...process.env, IDENTITY_DATABASE_URL: TEST_DB_URL },
    stdio: 'ignore',
  });

  // 3. runtime env for the app under test (fresh keypair per run)
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  publicKeyPem = publicKey;
  process.env.IDENTITY_DATABASE_URL = TEST_DB_URL;
  process.env.JWT_PRIVATE_KEY = Buffer.from(privateKey).toString('base64');
  process.env.NODE_ENV = 'test';

  // 4. boot the real AppModule and wipe state
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  const { PrismaService } = await import('../src/infrastructure/prisma/prisma.service.js');
  const prisma = app.get(PrismaService);
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await app?.close();
});

describe('identity HTTP API (real Postgres + argon2 + RS256)', () => {
  it('registers a user and returns a verifiable RS256 access token', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send(CREDS).expect(201);

    expect(res.body.user).toMatchObject({ email: CREDS.email, nickname: CREDS.nickname });
    expect(res.body.refreshToken).toBeTruthy();

    const claims = jwt.verify(res.body.accessToken, publicKeyPem, {
      algorithms: ['RS256'],
      issuer: 'lilochat-identity',
      audience: 'lilochat',
    }) as jwt.JwtPayload;
    expect(claims.sub).toBe(res.body.user.id);
    expect(claims.nickname).toBe(CREDS.nickname);
  });

  it('rejects duplicates with 409 and bad payloads with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...CREDS, nickname: 'someone_else' })
      .expect(409)
      .expect((res) => expect(res.body.code).toBe('EMAIL_ALREADY_IN_USE'));

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'x', nickname: 'a' })
      .expect(400)
      .expect((res) => expect(res.body.issues.length).toBeGreaterThan(0));
  });

  it('logs in with correct credentials, 401s wrong ones', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CREDS.email, password: 'wrong-password' })
      .expect(401);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CREDS.email.toUpperCase(), password: CREDS.password })
      .expect(200);
    expect(res.body.user.nickname).toBe(CREDS.nickname);
  });

  it('serves and updates profiles', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send(CREDS).expect(200);
    const userId = login.body.user.id as string;

    await request(app.getHttpServer()).get(`/users/${userId}`).expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/users/${userId}/nickname`)
      .send({ nickname: 'it_user2' })
      .expect(200);
    expect(updated.body.nickname).toBe('it_user2');
  });

  it('rotates refresh tokens and kills the whole family on reuse', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send(CREDS).expect(200);
    const first = login.body.refreshToken as string;

    // rotate: first -> second
    const rotated = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    const second = rotated.body.refreshToken as string;
    expect(second).not.toBe(first);

    // reuse of the rotated token → 401 + family revoked
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first })
      .expect(401)
      .expect((res) => expect(res.body.code).toBe('REFRESH_TOKEN_REUSED'));

    // even the newest token of the family is now dead
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: second })
      .expect(401)
      .expect((res) => expect(res.body.code).toBe('INVALID_REFRESH_TOKEN'));
  });

  it('logout revokes the session; refresh afterwards fails', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send(CREDS).expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });
});
