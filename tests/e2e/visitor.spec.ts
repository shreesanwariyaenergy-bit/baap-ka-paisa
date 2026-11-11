import { expect, test } from '@playwright/test';

// A first-time visitor on the demo site: signed out, no sample member shown as real.
test('header shows Sign in and Create profile; no sample member or "your row"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/who owns\s*your city\?/i);
  await expect(page.getByTestId('auth-actions').getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByTestId('create-profile')).toBeVisible();
  await expect(page.getByTestId('profile-menu')).toHaveCount(0);
  await expect(page.getByTestId('viewer-row')).toHaveCount(0);
  await expect(page.getByTestId('crown-moment')).toBeHidden();
  await expect(page.getByTestId('hero-primary')).toHaveText(/create your profile/i);
  await expect(page.getByTestId('hero-secondary')).toHaveText(/explore the board/i);
  await expect(page.locator('body')).not.toContainText(/passport|stake|bounty|liquidat|pincode|operator/i);
});

for (const w of [360, 390]) {
  test(`Create profile stays visible in the mobile header at ${w}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 780 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByTestId('create-profile')).toBeInViewport();
    await expect(page.getByTestId('hero-primary')).toBeInViewport();
    await ctx.close();
  });
}

test('crown sits on top of 01 in the board row and on the throne', async ({ page }) => {
  await page.goto('/');
  const row = page.locator('#home-board .rank-row.first .rank-no');
  const crown = await row.locator('svg.crown').boundingBox(); const num = await row.locator('.rank-number').boundingBox();
  // directly above the numerals, horizontally centred on them, touching distance
  expect(crown && num && crown.y + crown.height <= num.y + 6 && num.y - (crown.y + crown.height) < 8 && Math.abs((crown.x + crown.width / 2) - (num.x + num.width / 2)) < 4).toBeTruthy();
  const t = page.getByTestId('leader-feature'); const tc = await t.locator('svg.crown').boundingBox(); const tn = await t.locator('.big01 b').boundingBox();
  expect(tc && tn && tc.y + tc.height <= tn.y + 12 && Math.abs((tc.x + tc.width / 2) - (tn.x + tn.width / 2)) < 6).toBeTruthy();
  await expect(page.getByTestId('leader-feature').locator('svg.crown')).toBeVisible();
});

test('registration: five steps, server-side errors, preview, test-mode success (no account created)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('hero-primary').click();
  await expect(page.getByTestId('wizard-step-1')).toBeVisible();
  await page.getByTestId('wizard-next').click();
  await expect(page.locator('.field-error').first()).toContainText('valid email');
  await page.getByTestId('f-email').fill('riya@example.com');
  await page.getByTestId('f-password').fill('short');
  await page.getByTestId('wizard-next').click();
  await expect(page.locator('.field-error').first()).toContainText('8 characters');
  await page.getByTestId('f-password').fill('strongpass1'); await page.getByTestId('f-confirm').fill('different1');
  await page.getByTestId('wizard-next').click();
  await expect(page.locator('.field-error').first()).toContainText('do not match');
  await page.getByTestId('f-confirm').fill('strongpass1');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-step-2')).toBeVisible();
  await page.getByTestId('f-name').fill('Riya Shah'); await page.getByTestId('f-username').fill('ishaan.m');
  await page.getByTestId('f-locality').selectOption('Vesu');
  await page.getByTestId('wizard-next').click();
  await expect(page.locator('.field-error').first()).toContainText('taken');
  await page.getByTestId('f-username').fill('riya.vesu');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-step-3')).toBeVisible();
  await page.getByTestId('f-dob').fill('2012-01-01'); await page.getByTestId('f-adult').check(); await page.getByTestId('f-terms').check();
  await page.getByTestId('wizard-next').click();
  await expect(page.locator('.field-error').first()).toContainText('18');
  await page.getByTestId('f-dob').fill('1996-03-14');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('member-preview')).toContainText('Riya Shah');
  await expect(page.getByTestId('member-preview')).toContainText('Vesu, Surat');
  await page.getByTestId('wizard-confirm').click();
  await expect(page.getByTestId('wizard-success')).toContainText('Test mode');
  await expect(page.getByTestId('member-id')).toHaveCount(0);
});

test('sign in as the demo member, see the profile menu, sign out', async ({ page }) => {
  await page.goto('/signin');
  await page.getByTestId('signin-submit').click();
  await expect(page).toHaveURL(/\/seal$/);
  await expect(page.getByTestId('profile-menu')).toContainText('No. 04812');
  await page.getByTestId('profile-menu').locator('summary').click();
  await page.getByTestId('sign-out').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('create-profile')).toBeVisible();
});

test('head-to-head page and invite link work', async ({ page, context }) => {
  await page.goto('/vs/kinjal.adajan/vesu.vikram');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kinjal Shah');
  await expect(page.getByTestId('vs-row').first()).toContainText('#01');
  await context.addCookies([{ name: 'bkp_demo_viewer', value: '1', domain: 'localhost', path: '/' }]);
  await page.goto('/invite');
  await expect(page.getByTestId('copy-link-input')).toHaveValue(/\/join\?ref=ishaan\.m$/);
  await expect(page.getByTestId('whatsapp-share')).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
  await page.goto('/join?ref=ishaan.m');
  await expect(page.locator('body')).toContainText('Invited by @ishaan.m');
});
