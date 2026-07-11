#!/usr/bin/env node
/**
 * Degradation drill driver (roadmap 6.5, runbook: docs/degradation-drills.md).
 *
 * Two real socket.io clients in one room; the sender ships 1 msg/s while YOU
 * break things (stop RabbitMQ, stop Redis, restart services). Reconnects
 * re-join automatically — the same behavior the web client has. Prints a
 * status line every 5 s and a JSON summary at the end:
 *
 *   sent       chat:send emitted
 *   delivered  chat:new received by the OTHER client (optimistic broadcast)
 *   persisted  chat:ack received (full durability loop)
 *   sendErrors ack {ok:false} (rate_limited / chat_disabled / chat_unavailable)
 *   reconnects socket-level reconnections observed
 *
 *   RTG_URL=http://localhost:4215 DURATION_S=90 node scripts/drills/chat-degradation-drill.mjs
 */
import { createSign, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(new URL('../../apps/realtime-gateway/package.json', import.meta.url));
const { io } = require('socket.io-client');

const RTG_URL = process.env.RTG_URL ?? 'http://localhost:4215';
const DURATION_S = Number(process.env.DURATION_S ?? 90);
const ROOM = process.env.ROOM_ID ?? randomUUID();

// mint two tokens with the dev keypair (same claims identity issues)
const envFile = readFileSync(new URL('../../apps/services/identity/.env', import.meta.url), 'utf8');
const privateKey = Buffer.from(
  /^JWT_PRIVATE_KEY=(.+)$/m.exec(envFile)[1].trim(),
  'base64',
).toString('utf8');
const b64url = (data) => Buffer.from(data).toString('base64url');
const mint = (nickname) => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      sub: randomUUID(),
      nickname,
      iss: 'lilochat-identity',
      aud: 'lilochat',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey, 'base64url')}`;
};

const stats = { sent: 0, delivered: 0, persisted: 0, sendErrors: 0, reconnects: 0, joinErrors: 0 };
const errors = new Map(); // error code → count

function client(nickname) {
  const socket = io(`${RTG_URL}/room`, {
    auth: { token: mint(nickname) },
    transports: ['websocket'],
  });
  const join = () =>
    socket.emit('room:join', { roomId: ROOM }, (ack) => {
      if (!ack?.ok) {
        stats.joinErrors += 1;
        setTimeout(join, 1000); // keep trying — outages end
      }
    });
  socket.on('connect', join);
  socket.io.on('reconnect', () => (stats.reconnects += 1));
  return socket;
}

const sender = client('drill-sender');
const receiver = client('drill-receiver');

receiver.on('chat:new', (msg) => {
  if (msg.nickname === 'drill-sender') stats.delivered += 1;
});
sender.on('chat:ack', () => (stats.persisted += 1));

const ticker = setInterval(() => {
  stats.sent += 1;
  sender.emit(
    'chat:send',
    { tempId: `drill-${stats.sent}`, content: `drill message ${stats.sent}` },
    (ack) => {
      if (!ack?.ok) {
        stats.sendErrors += 1;
        errors.set(ack?.error ?? 'no_ack', (errors.get(ack?.error ?? 'no_ack') ?? 0) + 1);
      }
    },
  );
}, 1000);

const status = setInterval(() => {
  console.log(
    `[drill] sent=${stats.sent} delivered=${stats.delivered} persisted=${stats.persisted} ` +
      `errors=${stats.sendErrors} reconnects=${stats.reconnects}`,
  );
}, 5000);

setTimeout(() => {
  clearInterval(ticker);
  // grace: let buffered publishes / queued persistence drain before judging
  setTimeout(() => {
    clearInterval(status);
    sender.close();
    receiver.close();
    console.log('══════════ DRILL SUMMARY ══════════');
    console.log(
      JSON.stringify({ ...stats, errorCodes: Object.fromEntries(errors), roomId: ROOM }, null, 2),
    );
  }, 10_000);
}, DURATION_S * 1000);
