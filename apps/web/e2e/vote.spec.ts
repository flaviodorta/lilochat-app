import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Phase-4 E2E (roadmap 4.5): three browsers in a room — one starts a skip
 * vote, overlays appear everywhere, a second yes reaches quorum (2 of 3),
 * and EVERY player advances to the next video together.
 */
const GATEWAY = 'http://localhost:4120';
const RUN = Date.now().toString(36);

async function signUp(context: BrowserContext, nick: string): Promise<string> {
  const response = await context.request.post(`${GATEWAY}/auth/register`, {
    data: { email: `${nick}@e2e.lilochat.app`, password: 'supersecret1', nickname: nick },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

const videoIdOf = (page: Page) =>
  page.getByTestId('sync-position').getAttribute('data-videoid', { timeout: 2_000 });

test('3 browsers: skip vote reaches quorum and every player advances together 🗳️', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [ctxA, ctxB, ctxC] = contexts as [BrowserContext, BrowserContext, BrowserContext];
  const tokenA = await signUp(ctxA, `voteA_${RUN}`);
  await signUp(ctxB, `voteB_${RUN}`);
  await signUp(ctxC, `voteC_${RUN}`);

  // warm the room route before the clock starts (idle-room autostart)
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [pageA, pageB, pageC] = pages as [Page, Page, Page];
  await pageA.goto('/room/00000000-0000-4000-8000-000000000000');

  const createRes = await ctxA.request.post(`${GATEWAY}/rooms`, {
    headers: { authorization: `Bearer ${tokenA}` },
    data: { name: `Vote Arena ${RUN}`, firstVideoUrl: 'https://youtu.be/e2evideo001' },
  });
  const { id: roomId } = (await createRes.json()) as { id: string };
  await ctxA.request.post(`${GATEWAY}/rooms/${roomId}/queue`, {
    headers: { authorization: `Bearer ${tokenA}` },
    data: { videoUrl: 'https://youtu.be/e2evideo002' },
  });

  await Promise.all(pages.map((page) => page.goto(`/room/${roomId}`)));
  for (const page of pages) {
    await expect(page.getByTestId('sync-position')).toBeVisible({ timeout: 15_000 });
  }
  const firstVideo = await videoIdOf(pageA);

  // ── A starts the vote (auto-yes) — overlays pop on B and C ──────────────
  await pageA.getByTestId('vote-skip-btn').click();
  await expect(pageB.getByTestId('vote-overlay')).toBeVisible({ timeout: 8_000 });
  await expect(pageC.getByTestId('vote-overlay')).toBeVisible();
  await expect(pageB.getByTestId('vote-yes-count')).toHaveText('1/2'); // 3 present → needed 2

  // the vote-skip trigger locks while a vote is open
  await expect(pageB.getByTestId('vote-skip-btn')).toBeDisabled();

  // ── B casts the second yes → quorum → everyone advances ────────────────
  await pageB.getByTestId('vote-cast-btn').click();

  for (const page of pages) {
    await expect
      .poll(async () => videoIdOf(page).catch(() => null), { timeout: 15_000 })
      .not.toBe(firstVideo);
  }

  // result toast + system chip in the chat
  await expect(pageC.getByTestId('vote-result')).toContainText('Vote passed', {
    timeout: 8_000,
  });
  await expect(pageA.getByTestId('chat-messages')).toContainText('Vote passed — skipping');

  for (const context of contexts) await context.close();
});
