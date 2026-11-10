import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  { path: '/', heading: /who owns/i, nav: 'The scene' },
  { path: '/board', heading: /the board/i, nav: 'The board' },
  { path: '/cities', heading: /find your/i, nav: 'Cities' },
  { path: '/india', heading: /big country/i, nav: 'India' },
  { path: '/seal', heading: /the seal/i, nav: 'The Seal' },
  { path: '/archive', heading: /the ones/i, nav: 'Archive' },
];

async function crownedRows(page: Page, scope = page.locator('body')) {
  return scope.locator('.rank-row:has(.rank-no.is-crowned)');
}

test.describe('navigation', () => {
  for (const p of PAGES) {
    test(`${p.path} loads with its heading and active nav item`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(p.heading);
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: p.nav })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('demo-flag')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('"My Card" does not exist anywhere; The Seal is in the main navigation', async ({ page }) => {
    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(page.locator('body')).not.toContainText(/my card/i);
    }
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'The Seal' }).click();
    await expect(page).toHaveURL(/\/seal$/);
  });
});

test.describe('the crown on #01', () => {
  for (const level of ['locality', 'city', 'state', 'india']) {
    test(`board ${level}: exactly one crown, attached to the rank 1 row`, async ({ page }) => {
      await page.goto(`/board?level=${level}&city=surat&locality=Vesu`);
      const rows = page.getByTestId('board-rows').locator('.rank-row');
      await expect(rows.first()).toHaveAttribute('data-rank', '1');
      const crowned = await crownedRows(page, page.getByTestId('board-rows'));
      await expect(crowned).toHaveCount(1);
      await expect(crowned).toHaveAttribute('data-rank', '1');
      await expect(crowned.locator('svg.crown')).toBeVisible();
      await expect(crowned.locator('.rank-number')).toHaveText('01');
      await expect(page.getByTestId('viewer-row').locator('.is-crowned')).toHaveCount(0);
    });
  }

  test('crown moves to the #01 of the selected board and city', async ({ page }) => {
    const holder = async (url: string) => { await page.goto(url); return (await crownedRows(page, page.getByTestId('board-rows'))).getAttribute('data-username'); };
    const surat = await holder('/board?level=city&city=surat');
    const mumbai = await holder('/board?level=city&city=mumbai');
    const india = await holder('/board?level=india');
    const vesu = await holder('/board?level=locality&city=surat&locality=Vesu');
    // Different boards, different holders. (Demo Mumbai's #01 is also India's #01, as real data could be.)
    expect(new Set([surat, mumbai, vesu]).size).toBe(3);
    expect(india).toBe(mumbai);
    expect(india).not.toBe(surat);
  });

  test('city select switches the board on the server', async ({ page }) => {
    await page.goto('/board?level=city&city=surat');
    await page.getByTestId('city-select').selectOption('delhi');
    await expect(page).toHaveURL(/city=delhi/);
    await expect(page.getByTestId('board-title')).toHaveText('Delhi / City board');
    await expect(await crownedRows(page, page.getByTestId('board-rows'))).toHaveCount(1);
  });

  test('home board tabs move the crown to each level’s #01', async ({ page }) => {
    await page.goto('/');
    for (const tab of ['Locality', 'City', 'State', 'India']) {
      await page.getByRole('tab', { name: tab }).click();
      const crowned = await crownedRows(page, page.locator('#home-board'));
      await expect(crowned).toHaveCount(1);
      await expect(crowned).toHaveAttribute('data-rank', '1');
    }
    await expect(page.getByTestId('leader-feature').locator('svg.crown')).toBeVisible();
  });

  test('archive champions use the outline mark, never the gold crown', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.locator('.archive-list svg.crown')).toHaveCount(0);
    await expect(page.locator('.archive-list .past-mark').first()).toBeVisible();
    await page.locator('.archive-item summary').first().click();
    await expect(page.locator('.archive-detail').first()).toBeVisible();
  });
});

test.describe('boards', () => {
  test('empty locality shows an honest empty state', async ({ page }) => {
    await page.goto('/board?level=locality&city=surat&locality=Althan');
    await expect(page.getByTestId('board-empty')).toContainText('No one rules Althan yet.');
  });
  test('search narrows rows but keeps the honest total', async ({ page }) => {
    await page.goto('/board?level=city&city=surat');
    await page.getByRole('searchbox', { name: 'Find a member on this board' }).fill('vesu');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/q=vesu/);
    await expect(page.locator('.board-foot')).toContainText('of 16 matching');
  });
  test('Mystery mode member opens without a name', async ({ page }) => {
    await page.goto('/board?level=city&city=surat');
    await page.locator('.rank-row[data-username="ANON-07"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('ANON-07');
    await expect(dialog).toContainText('Mystery mode');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  });
  test('cities filter and sort work and open a board', async ({ page }) => {
    await page.goto('/cities');
    await page.getByRole('button', { name: 'North India' }).click();
    await expect(page.locator('.city-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'All cities' }).click();
    await expect(page.locator('.city-card')).toHaveCount(5);
    await page.getByTestId('city-pune').click();
    await expect(page.getByTestId('board-title')).toHaveText('Pune / City board');
  });
});

test.describe('The Seal', () => {
  test('flips with mouse and keyboard and exposes its state', async ({ page }) => {
    await page.goto('/seal');
    const seal = page.getByTestId('seal');
    await expect(seal).toHaveAttribute('aria-pressed', 'false');
    await seal.click();
    await expect(seal).toHaveAttribute('aria-pressed', 'true');
    await seal.focus();
    await page.keyboard.press('Enter');
    await expect(seal).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await expect(seal).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('flip-seal').click();
    await expect(seal).toHaveAttribute('aria-pressed', 'false');
  });
  test('flips on touch', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/seal');
    await page.getByTestId('seal').tap();
    await expect(page.getByTestId('seal')).toHaveAttribute('aria-pressed', 'true');
    await ctx.close();
  });
  test('share renders a real 1080 × 1920 image and offers download', async ({ page, request }) => {
    const res = await request.get('/api/seal-card/ishaan.m');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect((await request.get('/api/seal-card/not-a-member')).status()).toBe(404);
    await page.goto('/seal');
    await page.getByTestId('share-seal').click();
    const img = page.locator('img.share-preview');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1080);
    await expect(page.getByTestId('download-seal')).toHaveAttribute('href', '/api/seal-card/ishaan.m');
    await expect(page.locator('body')).not.toContainText(/QR/);
  });
  test('reduced motion removes the flip animation', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/seal');
    expect(await page.getByTestId('seal').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    await ctx.close();
  });
});

test.describe('board views', () => {
  test("Today's Movers shows only climbers; crown stays on the real #01", async ({ page }) => {
    await page.goto('/board?level=city&city=surat&view=movers');
    await expect(page.locator('.view-tabs [data-view="movers"]')).toHaveAttribute('aria-current', 'true');
    const rows = page.getByTestId('board-rows').locator('.rank-row');
    expect(await rows.count()).toBeGreaterThan(0);
    const crowned = page.getByTestId('board-rows').locator('.rank-row:has(.rank-no.is-crowned)');
    expect(await crowned.count()).toBeLessThanOrEqual(1);
    if (await crowned.count()) await expect(crowned).toHaveAttribute('data-rank', '1');
  });
  test('Hall of Fame has no gold crown and keeps the level and city', async ({ page }) => {
    await page.goto('/board?level=state&city=mumbai&view=hall');
    await expect(page.getByTestId('board-title')).toHaveText('Maharashtra / State board');
    await expect(page.getByTestId('board-rows').locator('svg.crown')).toHaveCount(0);
    await expect(page.getByTestId('board-rows').locator('.rank-row').first()).toHaveClass(/first-past/);
    await page.locator('[data-level="india"]').click();
    await expect(page).toHaveURL(/level=india.*view=hall/);
  });
});

test.describe('Rank Up preview', () => {
  test('shows the exact amount and four-board preview, confirmation disabled', async ({ page }) => {
    await page.goto('/rank-up');
    await page.getByRole('link', { name: /Take #1 in Vesu/ }).click();
    const preview = page.getByTestId('rankup-preview');
    await expect(preview.locator('.history-row')).toHaveCount(4);
    await expect(page.getByTestId('rankup-confirm')).toBeDisabled();
    await expect(page.getByTestId('rankup-confirm')).toHaveText('Payments are not open');
  });
  test('rejects amounts that are not steps of ₹500', async ({ page }) => {
    await page.goto('/rank-up?target=custom&add=700');
    await expect(page.getByRole('alert').filter({ hasText: 'steps' })).toContainText('₹500');
    await expect(page.getByTestId('rankup-preview')).toHaveCount(0);
  });
});

test.describe('policy pages', () => {
  for (const slug of ['terms', 'privacy', 'refunds', 'grievance', 'community']) {
    test(`${slug} is marked as a draft`, async ({ page }) => {
      await page.goto(`/legal/${slug}`);
      await expect(page.getByTestId('legal-draft')).toContainText('DRAFT — LEGAL REVIEW REQUIRED');
    });
  }
  test('footer links reach the policies', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Policies' }).getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/legal\/privacy$/);
  });
});

test.describe('responsive layout and screenshots', () => {
  for (const w of [320, 390, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${w}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      for (const p of [...PAGES.map((x) => x.path), '/u/kinjal.adajan', '/board?level=india', '/board?view=hall', '/board?view=movers', '/rank-up?target=loc1', '/legal/terms']) {
        await page.goto(p);
        await page.evaluate(() => document.fonts.ready);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${p} overflows at ${w}px`).toBeLessThanOrEqual(0);
        const name = (p === '/' ? 'scene' : p.replace(/[/?=&]+/g, '-').replace(/^-/, ''));
        await page.screenshot({ path: `tests/e2e/screens/${name}-${w}.png`, fullPage: true });
      }
      await ctx.close();
    });
  }
});
