import { expect, test } from '@playwright/test';

// No data source connected: every page must show honest empty states and invent nothing.
test('home shows an empty leader and no demo notice', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('leader-feature')).toContainText('No one rules Surat yet.');
  await expect(page.locator('body')).not.toContainText('Demo data');
  await expect(page.locator('svg.crown')).toHaveCount(0);
  await page.screenshot({ path: `tests/e2e/screens/${test.info().project.name}-scene-1440.png`, fullPage: true });
});
test('board says rankings are not open', async ({ page }) => {
  await page.goto('/board');
  await expect(page.getByTestId('board-empty')).toContainText('Rankings are not open yet.');
});
test('The Seal asks for sign-in instead of showing a fake member', async ({ page }) => {
  await page.goto('/seal');
  await expect(page.getByTestId('seal-signed-out')).toBeVisible();
  await expect(page.getByTestId('seal')).toHaveCount(0);
});
test('archive and cities stay honest', async ({ page }) => {
  await page.goto('/archive');
  await expect(page.locator('body')).toContainText('No finished seasons yet.');
  await page.goto('/cities');
  await expect(page.locator('.city-card')).toHaveCount(5);
  await expect(page.locator('body')).not.toContainText(/on the board/);
});
test('Rank Up and Hall of Fame stay closed', async ({ page }) => {
  await page.goto('/rank-up');
  await expect(page.getByTestId('rankup-closed')).toBeVisible();
  await page.goto('/board?view=hall');
  await expect(page.getByTestId('board-empty')).toBeVisible();
});
test('profile editing and social actions wait for sign-in; simulator still works', async ({ page }) => {
  await page.goto('/me');
  await expect(page.getByTestId('me-signed-out')).toBeVisible();
  await page.goto('/throne');
  await expect(page.getByTestId('throne-empty')).toBeVisible();
  await page.goto('/simulator?step=1');
  await expect(page.locator('.rank-row.first')).toHaveAttribute('data-member', 'sim.riya');
});

test('The Gazette is honest with no data: the throne has never been held', async ({ page }) => {
  await page.goto('/gazette');
  await expect(page.getByTestId('gazette-lead')).toContainText('HAS NEVER BEEN HELD');
  await expect(page.getByTestId('gazette-notice')).toHaveCount(0);
});
