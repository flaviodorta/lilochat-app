import { expect, test } from '@playwright/test';

/**
 * Phase-1 flagship E2E (roadmap 1.9): a stranger registers through the modal,
 * the session survives a reload (httpOnly cookie + silent refresh), sign-out
 * works, and signing back in works. Runs against the REAL local stack.
 */

// unique per run — the dev database persists between runs
const RUN = Date.now().toString(36);
const NICKNAME = `e2e_${RUN}`;
const EMAIL = `e2e_${RUN}@lilochat.app`;
const PASSWORD = 'supersecret1';

test('sign up via the modal, resume session on reload, sign out, sign back in', async ({
  page,
  context,
}) => {
  await page.goto('/');

  // shell renders
  await expect(page.getByRole('heading', { name: /watch youtube/i })).toBeVisible();

  // ── register ────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Welcome back')).toBeVisible();

  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByText('Join LiloChat')).toBeVisible();

  await page.getByLabel('Nickname').fill(NICKNAME);
  // live avatar preview follows the (debounced) nickname
  await expect(page.locator(`img[src*="${NICKNAME}"]`)).toBeVisible();

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // modal closes, header shows the signed-in chip
  await expect(page.getByText('Join LiloChat')).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(NICKNAME) })).toBeVisible();

  // refresh token cookie: httpOnly, scoped to /auth — never visible to JS
  const cookie = (await context.cookies()).find((c) => c.name === 'lilo_rt');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.path).toBe('/auth');

  // ── session resumes on reload (silent refresh) ──────────────────────────
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(NICKNAME) })).toBeVisible();

  // ── sign out ────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: new RegExp(NICKNAME) }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  // signed-out state survives a reload too (family revoked server-side)
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  // ── sign back in ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('button', { name: new RegExp(NICKNAME) })).toBeVisible();
});

test('wrong password shows a friendly error inside the modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByText('Wrong email or password.')).toBeVisible();
});
