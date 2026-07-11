#!/usr/bin/env node
/**
 * Kill-switch control (CLAUDE.md §13.4). Flips propagate in ≤ 5 s (services
 * cache flag reads in-process).
 *
 *   node scripts/ops/feature-flag.mjs list
 *   node scripts/ops/feature-flag.mjs off chat      # throw the brake
 *   node scripts/ops/feature-flag.mjs on chat       # release it
 *     REDIS_URL (default redis://localhost:6380)
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../packages/nest-shared/package.json', import.meta.url));
const { Redis } = require('ioredis');

const KNOWN = ['chat', 'votes', 'room_creation'];
const [command, name] = process.argv.slice(2);
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');

if (command === 'list') {
  for (const flag of KNOWN) {
    const raw = await redis.get(`flags:${flag}`);
    const off = raw === '0' || raw === 'off' || raw === 'false';
    console.log(`${flag.padEnd(14)} ${off ? '🔴 OFF' : '🟢 on'}`);
  }
} else if ((command === 'on' || command === 'off') && name) {
  if (!KNOWN.includes(name))
    console.warn(`warning: '${name}' is not a known flag (${KNOWN.join(', ')})`);
  if (command === 'off') await redis.set(`flags:${name}`, '0');
  else await redis.del(`flags:${name}`); // on = absence (default-on semantics)
  console.log(`${name} → ${command} (propagates within ~5 s)`);
} else {
  console.error('usage: feature-flag.mjs list | on <flag> | off <flag>');
  process.exitCode = 1;
}
await redis.quit();
