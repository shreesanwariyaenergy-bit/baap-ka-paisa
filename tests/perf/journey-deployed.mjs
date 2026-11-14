// Public journey on a DEPLOYED site by real link clicks: Home → India → Cities → City board → Gazette → Seal → Hall of Fame → Home.
// Records click→content per step, full-load timings, console/page errors, HTTP errors and (with --mobile) sideways overflow.
// Usage: node tests/perf/journey-deployed.mjs <base-url> [rounds] [--mobile] [--member]  (member: BKP_STAGING_PASSWORD, staging only)
import { chromium, devices } from 'playwright';
const B = process.argv[2], MOBILE = process.argv.includes('--mobile'), MEMBER = process.argv.includes('--member'), ROUNDS = Number(process.argv[3] ?? 3);
const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await b.newContext({ ...(MOBILE ? devices['iPhone 13'] : {}), ignoreHTTPSErrors: true });
const p = await ctx.newPage();
const errors = [], failed = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(`${p.url().replace(B, '')}: ${m.text().slice(0, 160)}`); });
p.on('pageerror', (e) => errors.push(`${p.url().replace(B, '')}: PAGEERROR ${String(e).slice(0, 160)}`));
p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) failed.push(`${r.status()} ${r.url().replace(B, '').slice(0, 90)}`); });
if (MEMBER) { await p.goto(B + '/signin'); await p.locator('input[type=email]').fill('stg-fan@test.invalid'); await p.locator('input[type=password]').fill(process.env.BKP_STAGING_PASSWORD); await p.getByTestId('signin-submit').click(); await p.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30000 }); }
const settle = async (test) => { await p.waitForURL((u) => test(u), { timeout: 30000 }); await p.waitForFunction(() => !document.querySelector('[data-loading]') && (document.querySelector('main')?.innerText.trim().length ?? 0) > 0, null, { timeout: 30000, polling: 10 }); };
const overflow = async () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const openMenu = async () => { if (!MOBILE) return; const t = p.locator('nav.main-nav'); if (!(await t.isVisible())) { const btn = p.locator('[aria-label*="enu" i], button.menu-toggle').first(); if (await btn.count()) await btn.click(); } };
const clickNav = async (href) => { await openMenu(); await p.locator(`nav.main-nav a[href="${href}"]`).first().click(); };
const STEPS = [
  ['Home → India', () => clickNav('/india'), (u) => u.pathname === '/india'],
  ['India → Cities', () => clickNav('/cities'), (u) => u.pathname === '/cities'],
  ['Cities → City board', () => p.locator('a[href^="/board?"][href*="city="]').first().click(), (u) => u.pathname === '/board'],
  ['City board → Gazette', () => clickNav('/gazette'), (u) => u.pathname === '/gazette'],
  ['Gazette → Seal', () => clickNav('/seal'), (u) => u.pathname === '/seal'],
  ['Seal → Hall of Fame', async () => { await clickNav('/board'); await settle((u) => u.pathname === '/board'); await p.locator('a[href*="view=hall"]').first().click(); }, (u) => u.searchParams.get('view') === 'hall'],
  ['Hall of Fame → Home', () => clickNav('/'), (u) => u.pathname === '/'],
];
const res = Object.fromEntries(STEPS.map(([n]) => [n, []])); const loads = []; const ov = {};
for (let r = 0; r < ROUNDS; r++) {
  const t0 = Date.now(); await p.goto(B + '/', { waitUntil: 'commit' }); await settle((u) => u.pathname === '/');
  const nt = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null }; });
  loads.push({ ...nt, content: Date.now() - t0 });
  for (const [name, act, test] of STEPS) {
    await p.waitForTimeout(400);
    const t = Date.now();
    try { await act(); await settle(test); res[name].push(Date.now() - t); } catch (e) { res[name].push(null); errors.push(`${name}: STEP FAILED ${String(e).split('\n')[0].slice(0, 140)}`); }
    if (MOBILE) { const o = await overflow(); if (o > 2) ov[p.url().replace(B, '')] = o; }
  }
}
await b.close();
const pct = (a, q) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 'fail'; };
console.log(`${MOBILE ? 'iPhone 13 viewport' : 'desktop'} ${MEMBER ? 'signed in' : 'signed out'} rounds=${ROUNDS}`);
console.log(`Home full load: TTFB ${pct(loads.map((x) => x.ttfb), 0.5)} ms, first paint ${pct(loads.map((x) => x.fcp), 0.5)} ms, DOM ready ${pct(loads.map((x) => x.dcl), 0.5)} ms, load ${pct(loads.map((x) => x.load), 0.5)} ms, content ${pct(loads.map((x) => x.content), 0.5)} ms (p50)`);
for (const [n] of STEPS) console.log(`  ${n.padEnd(24)} click→content p50 ${pct(res[n], 0.5)} ms  p95 ${pct(res[n], 0.95)} ms  ${res[n].includes(null) ? 'FAILED ' + res[n].filter((x) => x == null).length + 'x' : ''}`);
console.log('console/page errors:', errors.length ? '\n   ' + [...new Set(errors)].join('\n   ') : 'none');
console.log('HTTP errors:', failed.length ? [...new Set(failed)].join(' | ') : 'none');
if (MOBILE) console.log('horizontal overflow (px):', Object.keys(ov).length ? JSON.stringify(ov) : 'none');
