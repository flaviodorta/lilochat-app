#!/usr/bin/env node
/**
 * DLQ replay tool (runbook: docs/runbooks/dlq-replay.md).
 *
 * Shovels messages from a dead-letter queue back onto the `lilochat.events`
 * exchange so the (now fixed) consumer reprocesses them. Routing key comes
 * from the message's own x-death record (what it was originally routed with),
 * falling back to the event's `name`. Consumer idempotency (dedup by eventId)
 * makes replays safe even if some other consumer already handled the event.
 *
 *   node scripts/ops/dlq-replay.mjs <queue>.dlq [--limit N] [--dry-run]
 *     RABBITMQ_URL   (default amqp://lilochat:lilochat@localhost:5672)
 */
import { createRequire } from 'node:module';

// resolve amqplib through nest-shared's dependency tree (script has no package.json)
const require = createRequire(new URL('../../packages/nest-shared/package.json', import.meta.url));
const amqp = require('amqplib');

const [dlq, ...flags] = process.argv.slice(2);
if (!dlq || !dlq.endsWith('.dlq')) {
  console.error('usage: node scripts/ops/dlq-replay.mjs <queue>.dlq [--limit N] [--dry-run]');
  process.exit(1);
}
const dryRun = flags.includes('--dry-run');
const limitIdx = flags.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(flags[limitIdx + 1]) : Infinity;
const url = process.env.RABBITMQ_URL ?? 'amqp://lilochat:lilochat@localhost:5672';

const connection = await amqp.connect(url);
const channel = await connection.createChannel();
await channel.checkQueue(dlq); // fail fast on typos — never declare ops-side

let replayed = 0;
for (; replayed < limit;) {
  const message = await channel.get(dlq, { noAck: false });
  if (!message) break;

  const body = JSON.parse(message.content.toString('utf8'));
  const death = message.properties.headers?.['x-death']?.[0];
  const routingKey = death?.['routing-keys']?.[0] ?? body.name;

  if (dryRun) {
    console.log(
      `[dry-run] would replay eventId=${body.eventId} name=${body.name} rk=${routingKey}`,
    );
    channel.nack(message, false, true); // put it back
    break; // requeue+get would loop the same message forever — one peek is enough
  }

  channel.publish('lilochat.events', routingKey, message.content, {
    persistent: true,
    contentType: 'application/json',
    messageId: body.eventId,
    headers: { 'x-replayed-from': dlq, 'x-replayed-at': new Date().toISOString() },
  });
  channel.ack(message);
  replayed += 1;
  console.log(`replayed eventId=${body.eventId} name=${body.name} rk=${routingKey}`);
}

console.log(dryRun ? 'dry-run complete' : `done — ${replayed} message(s) replayed from ${dlq}`);
await channel.close();
await connection.close();
