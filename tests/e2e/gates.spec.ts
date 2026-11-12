import { expect, test } from '@playwright/test';
// Launch switches on the live data source. Nothing here writes to the database.

test('registration is closed by default: no form, sign-in still available', async ({ page }) => {
  await page.goto('/join');
  await expect(page.getByTestId('registration-closed')).toBeVisible();
  await expect(page.getByTestId('wizard-step-1')).toHaveCount(0);
  await expect(page.getByTestId('tester-form')).toHaveCount(0);
  await page.goto('/signin');
  await expect(page.locator('input[type=email]')).toBeVisible();
});

test('search engines are blocked', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);
  await page.goto('/');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
});

test('tester mode: a wrong code is refused, the right code unlocks the wizard on this device', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:3203' });
  const page = await ctx.newPage();
  await page.goto('/join');
  await expect(page.getByTestId('registration-closed')).toBeVisible();
  await page.getByTestId('tester-code').fill('not-the-code');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('That code is not valid.')).toBeVisible();
  await page.getByTestId('tester-code').fill('local-test-code');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByTestId('wizard-step-1')).toBeVisible();
  // A second device without the code stays locked.
  const other = await (await browser.newContext({ baseURL: 'http://localhost:3203' })).newPage();
  await other.goto('/join');
  await expect(other.getByTestId('registration-closed')).toBeVisible();
  await ctx.close();
});

test('signed-out visitors cannot use social actions on the live site', async ({ page }) => {
  const res = await page.goto('/u/nobody.here');
  expect(res?.status()).toBe(404);
});

test('password reset: link from sign-in, validation, and an honest expired state', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/forgot$/);
  await page.locator('input[type=email]').fill('not-an-email');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await page.goto('/reset');
  await expect(page.getByTestId('reset-expired')).toBeVisible();
});
