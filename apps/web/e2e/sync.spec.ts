import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * THE FLAGSHIP (roadmap 2.12, CLAUDE.md §13.3): two browsers in one room stay
 * within the 2s sync budget, and when a video ends, BOTH advance together.
 *
 * The probe is the offset-corrected position ticker ([data-position-s]) — the
 * exact same server-authoritative arithmetic the drift engine steers the real
 * player toward (§6.2). Real-YouTube playback is verified manually/nightly:
 * headless Chromium lacks the proprietary codecs YouTube needs.
 */

const GATEWAY = 'http://localhost:4110';
const RUN = Date.now().toString(36);

async function signUpViaApi(context: BrowserContext, nick: string): Promise<string> {
  // context.request shares the browser's cookie jar: the httpOnly refresh
  // cookie lands in the context, and the app's silent refresh signs the
  // page in on first load — no UI hoops for fixtures.
  const response = await context.request.post(`${GATEWAY}/auth/register`, {
    data: { email: `${nick}@e2e.lilochat.app`, password: 'supersecret1', nickname: nick },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

interface Probe {
  videoId: string;
  position: number;
}

async function readProbe(page: Page): Promise<Probe> {
  // resilient: an idle room unmounts the ticker — report empty instead of hanging
  const el = page.getByTestId('sync-position');
  try {
    return {
      videoId: (await el.getAttribute('data-videoid', { timeout: 2_000 })) ?? '',
      position: Number(await el.getAttribute('data-position-s', { timeout: 2_000 })),
    };
  } catch {
    return { videoId: '', position: Number.NaN };
  }
}

test('two browsers watch the same room within the 2s sync budget and advance together 🏆', async ({
  browser,
}) => {
  // ── two real users in two isolated browsers ────────────────────────────
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const tokenA = await signUpViaApi(contextA, `syncA_${RUN}`);
  await signUpViaApi(contextB, `syncB_${RUN}`);

  // warm next-dev's cold compile of /room/[id] BEFORE the clock starts ticking:
  // the first video starts the moment the room is created (idle-room autostart)
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await Promise.all([pageA.goto('/room/00000000-0000-4000-8000-000000000000'), pageB.goto('/')]);

  // room + two 8s videos, via the public API (same path the UI takes)
  const createRes = await contextA.request.post(`${GATEWAY}/rooms`, {
    headers: { authorization: `Bearer ${tokenA}` },
    data: { name: `Sync Arena ${RUN}`, firstVideoUrl: 'https://youtu.be/e2evideo001' },
  });
  expect(createRes.status()).toBe(201);
  const { id: roomId } = (await createRes.json()) as { id: string };

  const addRes = await contextA.request.post(`${GATEWAY}/rooms/${roomId}/queue`, {
    headers: { authorization: `Bearer ${tokenA}` },
    data: { videoUrl: 'https://youtu.be/e2evideo002' },
  });
  expect(addRes.status()).toBe(201);

  // ── both join the room ─────────────────────────────────────────────────
  await Promise.all([pageA.goto(`/room/${roomId}`), pageB.goto(`/room/${roomId}`)]);
  await expect(pageA.getByTestId('sync-position')).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByTestId('sync-position')).toBeVisible({ timeout: 15_000 });

  // ── sync budget: sampled repeatedly while video 1 plays ────────────────
  const firstVideo = (await readProbe(pageA)).videoId;
  for (let sample = 0; sample < 2; sample += 1) {
    const [a, b] = await Promise.all([readProbe(pageA), readProbe(pageB)]);
    expect(a.videoId).toBe(b.videoId);
    expect(Math.abs(a.position - b.position)).toBeLessThan(2); // the §4.1 SLO
    await pageA.waitForTimeout(1_000);
  }

  // ── the room advances ITSELF, on both browsers, still in sync ──────────
  await expect
    .poll(async () => (await readProbe(pageA)).videoId, { timeout: 20_000 })
    .not.toBe(firstVideo);
  await expect
    .poll(async () => (await readProbe(pageB)).videoId, { timeout: 20_000 })
    .not.toBe(firstVideo);

  const [a, b] = await Promise.all([readProbe(pageA), readProbe(pageB)]);
  expect(a.videoId).toBe(b.videoId); // same next video
  expect(Math.abs(a.position - b.position)).toBeLessThan(2); // still inside the budget

  // ── a page reload lands back in sync by construction (§6.2) ────────────
  await pageA.reload();
  await expect(pageA.getByTestId('sync-position')).toBeVisible({ timeout: 15_000 });
  const [a2, b2] = await Promise.all([readProbe(pageA), readProbe(pageB)]);
  expect(a2.videoId).toBe(b2.videoId);
  expect(Math.abs(a2.position - b2.position)).toBeLessThan(2);

  await contextA.close();
  await contextB.close();
});
