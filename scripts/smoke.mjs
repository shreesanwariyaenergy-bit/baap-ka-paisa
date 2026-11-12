// Read-only smoke test of a deployed site. Loads pages and follows links; never submits a form,
// signs in, or writes anything.   Usage: node scripts/smoke.mjs https://baap-ka-paisa.vercel.app
import { chromium } from 'playwright';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) { console.error('Usage: node scripts/smoke.mjs <site address>'); process.exit(2); }
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 160)}`); });
page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: ${String(e).slice(0, 160)}`));

const results = [];
const check = async (path, expectStatus, what, fn) => {
  let status = 0, ok = false, note = '';
  try {
    const res = await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = res?.status() ?? 0;
    ok = status === expectStatus && (fn ? await fn(res) : true) !== false;
  } catch (e) { note = String(e).split('\n')[0].slice(0, 120); }
  results.push({ ok, status, url: base + path, what, note });
};
const has = (sel) => async () => (await page.locator(sel).count()) > 0;
const text = (re) => async () => re.test(await page.locator('body').innerText());
const all = (...fns) => async (r) => { for (const f of fns) if ((await f(r)) === false) return false; return true; };
const noDemo = async () => (await page.getByTestId('demo-flag').count()) === 0;
const noindex = async () => /noindex/.test((await page.locator('meta[name=robots]').getAttribute('content')) ?? '');

await check('/', 200, 'Homepage: hero, header actions, no demo data, noindex', all(text(/who owns/i), has('[data-testid=auth-actions]'), has('[data-testid=leader-feature]'), noDemo, noindex));
await check('/board', 200, 'The Board', all(has('nav.main-nav'), noDemo));
await check('/board?view=hall', 200, 'Board: Hall of Fame view');
await check('/board?view=respect', 200, 'Board: Most Respected view');
await check('/cities', 200, 'Cities', text(/surat/i));
await check('/india', 200, 'India');
await check('/archive', 200, 'Archive');
await check('/gazette', 200, 'The Gazette: honest front page with no invented news', all(has('[data-testid=gazette-lead]'), noDemo));
await check('/throne', 200, 'Throne history');
await check('/simulator', 200, 'Season simulator', text(/simulat/i));
await check('/rank-up', 200, 'Rank Up preview: no enabled purchase button', async () => (await page.locator('main button:not([disabled])', { hasText: /pay|confirm|buy/i }).count()) === 0);
await check('/seal', 200, 'The Seal (signed out)', text(/sign in|create/i));
await check('/me', 200, 'Profile (signed out)', text(/sign in/i));
await check('/invite', 200, 'Invite');
await check('/signin', 200, 'Sign in: form present', all(has('input[type=email]'), has('input[type=password]'), has('a[href="/forgot"]')));
await check('/forgot', 200, 'Forgot password: form present', has('input[type=email]'));
await check('/reset', 200, 'Reset password: expired-link state when signed out', has('[data-testid=reset-expired]'));
await check('/join', 200, 'Registration gate: closed, no sign-up form', all(has('[data-testid=registration-closed]'), async () => (await page.getByTestId('wizard-step-1').count()) === 0));
await check('/join?ref=someone', 200, 'Registration gate holds with an invite link', has('[data-testid=registration-closed]'));
await check('/auth/callback', 200, 'Auth callback without a code lands on sign-in', async () => /\/signin\?confirmed=check$/.test(page.url()));
for (const s of ['terms', 'privacy', 'refunds', 'community', 'grievance']) await check(`/legal/${s}`, 200, `Policy draft: ${s}`, text(/draft/i));
await check('/u/no.such.member', 404, 'Unknown member: 404 page');
await check('/vs/no.one/no.two', 404, 'Unknown head-to-head: 404 page');
await check('/api/seal-card/no.such.member', 404, 'Share image for unknown member: 404');
await check('/declare/d402', 404, 'Declarations are not switched on for real members: 404');
await check('/robots.txt', 200, 'robots.txt blocks every crawler', async (r) => /User-Agent: \*\s+Disallow: \/\s*$/i.test(await r.text()));
{ const r = await ctx.request.get(base + '/fonts/barlow-condensed-latin-900-normal.woff2');
  results.push({ ok: r.status() === 200 && /font|woff/.test(r.headers()['content-type'] ?? ''), status: r.status(), url: r.url(), what: 'Bundled font is served', note: '' }); }

// Navigation: every header link works by clicking.
await page.goto(base + '/');
for (const [name, path] of [['The board', '/board'], ['Cities', '/cities'], ['India', '/india'], ['Gazette', '/gazette'], ['The Seal', '/seal'], ['The scene', '/']]) {
  let ok = false, note = '';
  try { await page.locator('nav.main-nav a', { hasText: new RegExp(name, 'i') }).first().click(); await page.waitForURL((u) => u.pathname === path, { timeout: 15000 }); ok = true; } catch (e) { note = String(e).split('\n')[0].slice(0, 100); }
  results.push({ ok, status: 200, url: base + path, what: `Navigation click: ${name}`, note });
}
// Header actions and phone width.
await page.goto(base + '/');
await page.getByTestId('create-profile').click(); await page.waitForURL(/\/join$/);
results.push({ ok: (await page.getByTestId('registration-closed').count()) === 1, status: 200, url: base + '/join', what: 'Header "Create profile" leads to the closed gate', note: '' });
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, ...(proxy ? {} : {}) })).newPage();
for (const p of ['/', '/board', '/seal', '/join', '/signin']) {
  await phone.goto(base + p, { waitUntil: 'load' });
  const over = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  results.push({ ok: over <= 1, status: 200, url: base + p, what: 'No sideways scroll at 390 px', note: over > 1 ? `${over}px over` : '' });
}
const cookies = await ctx.cookies();
results.push({ ok: !cookies.some((c) => /^sb-|bkp_tester/.test(c.name)), status: 0, url: base, what: 'No session or tester cookie was set by browsing', note: '' });
results.push({ ok: consoleErrors.length === 0, status: 0, url: base, what: 'No browser console errors', note: consoleErrors.slice(0, 3).join(' | ') });

await browser.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.status || '---'}  ${r.url}  —  ${r.what}${r.note ? `  [${r.note}]` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
