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
  await expect(page.locator('.city-card')).toHaveCount(45);
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

test('Backing is not switched on outside the demo', async ({ page }) => {
  await page.goto('/seal');
  await expect(page.getByTestId('pick-card')).toHaveCount(0);
});

test('Declarations are not switched on outside the demo', async ({ page }) => {
  expect((await page.goto('/declare/d402'))?.status()).toBe(404);
});

test('The Bill prototype is not reachable outside the demo', async ({ page }) => {
  expect((await page.goto('/bill/anyone'))?.status()).toBe(404);
});

test('Before Season 1: one competition message on the home page, no empty panels or locality list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No one rules Surat yet.')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('Rank movement');
  await expect(page.locator('body')).not.toContainText('Ghod Dod Road');   // localities live in the city experience
  await expect(page.getByTestId('gazette-strip')).toHaveCount(0);
  await expect(page.getByTestId('season-band')).not.toContainText('Not open');
  await expect(page.getByTestId('featured-cities').locator('.terr')).toHaveCount(6);
});
test('Before Season 1: the board keeps levels and city choice, one panel, season views wait', async ({ page }) => {
  await page.goto('/board?level=city&city=jaipur');
  await expect(page.locator('a[data-level]')).toHaveCount(4);
  await expect(page.getByTestId('city-select')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Board view' })).toHaveCount(0);
  await expect(page.getByRole('search')).toHaveCount(0);
  await expect(page.getByTestId('board-empty').getByRole('link', { name: /Create your profile/ })).toBeVisible();
  await page.goto('/board?view=respect');            // season view addresses still answer
  await expect(page.getByTestId('board-empty')).toContainText('Rankings are not open yet.');
});
test('Before Season 1: cities say when they open, India is one section, history pages are one panel', async ({ page }) => {
  await page.goto('/cities');
  await expect(page.getByTestId('city-surat')).toContainText('Opens with Season 1');
  await expect(page.locator('body')).not.toContainText('Season open');
  await page.goto('/india');
  await expect(page.getByTestId('india-prelaunch')).toContainText('The national table opens with Season 1.');
  await expect(page.locator('.national-card')).toHaveCount(1);
  await page.goto('/throne');
  await expect(page.getByTestId('throne-empty')).toBeVisible();
  await expect(page.locator('.filterbar')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Longest reign');
  await page.goto('/archive');
  await expect(page.getByTestId('archive-empty')).toBeVisible();
  await expect(page.locator('.filterbar')).toHaveCount(0);
  await page.goto('/seal');
  await expect(page.getByTestId('seal-signed-out')).toContainText('Your Seal is waiting.');
  await expect(page.locator('main')).toContainText('not an official identity document');
});

