#!/usr/bin/env node
/**
 * README media capture (roadmap 7.3) — reproducible screenshots + hero-GIF
 * frames against a running local stack (web on :3000, gateway on :4100).
 *
 * Expects the demo scene from docs/ROADMAP.md 7.3 notes: demo users
 * mila_watches / kenji_dev (Password123!) and a room named "Blender Movie
 * Night" with a real video playing.
 *
 *   node scripts/media/capture-screens.mjs [outDir=docs/media]
 * Then compose the GIF:
 *   cd <outDir>/frames && for i in $(seq -w 0 11); do convert frame-a-$i.png frame-b-$i.png +append pair-$i.png; done
 *   convert -delay 70 -loop 0 pair-*.png -layers optimize ../hero.gif
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'docs/media';
mkdirSync(`${OUT}/frames`, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(page, email, password) {
  await page.goto(WEB);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.getByText(email.split('@')[0].slice(0, 6), { exact: false }).first().waitFor();
}

const browser = await chromium.launch();
const still = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

// ── two viewers in the demo room ─────────────────────────────────────────
const ctxA = await browser.newContext(still);
const ctxB = await browser.newContext(still);
const a = await ctxA.newPage();
const b = await ctxB.newPage();
await signIn(a, 'mila_watches@demo.lilochat.dev', 'Password123!');
await signIn(b, 'kenji_dev@demo.lilochat.dev', 'Password123!');

const roomCard = a.getByText('Blender Movie Night').first();
await roomCard.waitFor();
await roomCard.click();
await a.waitForURL(/room/);
const roomUrl = a.url();
await b.goto(roomUrl);
await sleep(4000); // player boot + presence settle

const chat = [
  [a, 'big buck bunny night!! 🐰'],
  [b, 'the classic. perfect pick'],
  [a, 'wait for the squirrel scene lol'],
  [b, 'queued Sintel for after this'],
  [a, 'ok this 4k60 holds up SO well'],
];
for (const [page, text] of chat) {
  await page.getByPlaceholder(/message/i).fill(text);
  await page.keyboard.press('Enter');
  await sleep(900);
}
await sleep(1500);

console.log('capturing room.png');
await b.screenshot({ path: `${OUT}/room.png` });

// ── home with a live, hovered card ───────────────────────────────────────
console.log('capturing home.png');
const home = await ctxB.newPage();
await home.goto(WEB);
await home.getByText('Blender Movie Night').first().waitFor();
await home.getByText('Blender Movie Night').first().hover();
await sleep(1600); // ticking timestamp + progress bar appear
await home.screenshot({ path: `${OUT}/home.png` });
await home.close();

// ── leaderboard (own row pinned) ─────────────────────────────────────────
console.log('capturing leaderboard.png');
const lb = await ctxB.newPage();
await lb.goto(`${WEB}/leaderboard`);
await lb.getByText('mila_watches').first().waitFor();
await sleep(800);
await lb.screenshot({ path: `${OUT}/leaderboard.png` });
await lb.close();

// ── auth modal with live avatar preview ──────────────────────────────────
console.log('capturing auth.png');
const ctxC = await browser.newContext(still);
const c = await ctxC.newPage();
await c.goto(WEB);
await c.getByRole('button', { name: 'Sign in' }).click();
await c.getByText('Create an account').click();
await c.getByLabel(/nickname/i).fill('space_cadet');
await sleep(1600); // debounce → avatar preview
await c.screenshot({ path: `${OUT}/auth.png` });
await ctxC.close();

// ── hero GIF frames: both viewers side by side ───────────────────────────
// Fresh contexts at deviceScaleFactor 1 (the stills use 2× — clipping those
// would force a downscale and make the tickers unreadable). Desktop-width
// viewport (narrow ones wrap the header), clipped to the player zone: the
// pair reads as two players with matching tickers, at native resolution.
console.log('capturing hero frames');
const hero = { viewport: { width: 1150, height: 820 }, deviceScaleFactor: 1 };
const clip = { x: 16, y: 88, width: 716, height: 492 };
const ctxHa = await browser.newContext(hero);
const ctxHb = await browser.newContext(hero);
const ha = await ctxHa.newPage();
const hb = await ctxHb.newPage();
await signIn(ha, 'mila_watches@demo.lilochat.dev', 'Password123!');
await signIn(hb, 'kenji_dev@demo.lilochat.dev', 'Password123!');
await ha.goto(roomUrl);
await hb.goto(roomUrl);
await sleep(9000); // player boot + YouTube's own overlay chrome fades (~4s)
await ha.mouse.move(10, 810); // park the cursor away from the player —
await hb.mouse.move(10, 810); // hovering re-summons the iframe overlay
await sleep(1500);
for (let i = 0; i < 12; i += 1) {
  const n = String(i).padStart(2, '0');
  await Promise.all([
    ha.screenshot({ path: `${OUT}/frames/frame-a-${n}.png`, clip }),
    hb.screenshot({ path: `${OUT}/frames/frame-b-${n}.png`, clip }),
  ]);
  await sleep(700);
}

await browser.close();
console.log(`done → ${OUT}`);
