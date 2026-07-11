import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Phase-3 E2E (roadmap 3.6): two browsers chat live in a room — optimistic
 * delivery, durable ack, presence stack, and history surviving a reload.
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

test('two browsers chat live: optimistic delivery, ack, presence, durable history', async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const tokenA = await signUp(contextA, `chatA_${RUN}`);
  await signUp(contextB, `chatB_${RUN}`);

  const createRes = await contextA.request.post(`${GATEWAY}/rooms`, {
    headers: { authorization: `Bearer ${tokenA}` },
    data: { name: `Chat Arena ${RUN}`, firstVideoUrl: 'https://youtu.be/e2evideo001' },
  });
  const { id: roomId } = (await createRes.json()) as { id: string };

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await Promise.all([pageA.goto(`/room/${roomId}`), pageB.goto(`/room/${roomId}`)]);

  // presence: both stacks converge on 2
  await expect(pageA.getByTestId('presence-stack')).toHaveAttribute('data-count', '2', {
    timeout: 15_000,
  });
  await expect(pageB.getByTestId('presence-stack')).toHaveAttribute('data-count', '2');

  // A sends → B sees it live (optimistic broadcast)
  await pageA.getByTestId('chat-input').fill('hello from A! 👋');
  await pageA.getByTestId('chat-input').press('Enter');
  await expect(pageB.getByTestId('chat-messages')).toContainText('hello from A! 👋', {
    timeout: 8_000,
  });

  // the ack lands: A's message flips from pending to sent (durable)
  await expect(
    pageA.locator('[data-testid="chat-messages"] [data-status="sent"]', {
      hasText: 'hello from A!',
    }),
  ).toBeVisible({ timeout: 8_000 });

  // B replies
  await pageB.getByTestId('chat-input').fill('hey A, in sync? 🎬');
  await pageB.getByTestId('chat-input').press('Enter');
  await expect(pageA.getByTestId('chat-messages')).toContainText('hey A, in sync?');

  // reload: history is served from the chat service (persisted, not memory)
  await pageA.reload();
  await expect(pageA.getByTestId('chat-messages')).toContainText('hello from A! 👋', {
    timeout: 15_000,
  });
  await expect(pageA.getByTestId('chat-messages')).toContainText('hey A, in sync?');

  // B leaves → A's presence stack drops to 1
  await pageB.close();
  await expect(pageA.getByTestId('presence-stack')).toHaveAttribute('data-count', '1', {
    timeout: 10_000,
  });

  await contextA.close();
  await contextB.close();
});
