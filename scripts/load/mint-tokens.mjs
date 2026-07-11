#!/usr/bin/env node
/**
 * Load-test setup: mints N RS256 access tokens with the LOCAL dev keypair
 * (same claims identity issues — sub, nickname, iss, aud) plus the fake room
 * ids the scenario joins. Zero npm deps: JWT RS256 is just two base64url
 * segments and an RSASSA-PKCS1-v1_5/SHA-256 signature.
 *
 *   node scripts/load/mint-tokens.mjs [users=1000] [rooms=50]
 */
import { createSign, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const users = Number(process.argv[2] ?? 1000);
const rooms = Number(process.argv[3] ?? 50);

const envFile = readFileSync(join(repo, 'apps/services/identity/.env'), 'utf8');
const keyB64 = /^JWT_PRIVATE_KEY=(.+)$/m.exec(envFile)?.[1]?.trim();
if (!keyB64) throw new Error('JWT_PRIVATE_KEY not found in apps/services/identity/.env');
const privateKey = Buffer.from(keyB64, 'base64').toString('utf8');

const b64url = (data) => Buffer.from(data).toString('base64url');
const now = Math.floor(Date.now() / 1000);

function sign(payload) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey, 'base64url')}`;
}

const tokens = Array.from({ length: users }, (_, i) =>
  sign({
    sub: randomUUID(),
    nickname: `load${String(i).padStart(4, '0')}`,
    iss: 'lilochat-identity',
    aud: 'lilochat',
    iat: now,
    exp: now + 4 * 3600,
  }),
);
const roomIds = Array.from({ length: rooms }, () => randomUUID());

mkdirSync(join(here, 'generated'), { recursive: true });
writeFileSync(
  join(here, 'generated', 'load-data.json'),
  JSON.stringify({ mintedAt: new Date().toISOString(), tokens, roomIds }),
);
console.log(`minted ${users} tokens + ${rooms} roomIds → scripts/load/generated/load-data.json`);
