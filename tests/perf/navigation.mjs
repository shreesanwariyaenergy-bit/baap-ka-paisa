// Browser-side navigation timing. Clicks through the main sections like a member would and records, per click:
if (!process.env.BKP_STAGING_PASSWORD && process.env.BKP_MEMBER !== '0') console.warn('BKP_STAGING_PASSWORD not set: member runs will fail to sign in.');
//   feedback  - time until the screen visibly responds (loading state or new page)
//   complete  - time until the new page's content is in place
//   reload    - whether the click caused a full page reload (it should not)
// Usage: node tests/perf/navigation.mjs <base-url> [rounds] [--member]   (base defaults to http://localhost:3300)
import { chromium } from 'playwright';
const B = process.argv[2] ?? 'http://localhost:3300';
const ROUNDS = Number(process.argv[3] ?? 5);
const MEMBER = process.argv.includes('--member');
const ROUTE = [
  ['Gazette', 'nav', /\/gazette/, '/gazette'], ['Cities', 'nav', /\/cities/, '/cities'], ['India', 'nav', /\/india/, '/india'], ['The board', 'nav', /\/board/, '/board'],
  ['Locality board', 'url', '/board?level=locality&city=surat&locality=Vesu'], ['Hall of Fame', 'url', '/board?view=hall&level=city&city=surat'],
  ['Profile', 'url', '/u/stg.king'], ['The Bill', 'url', '/bill/stg.king'], ['The Seal', 'nav', /\/seal/, '/seal'], ['The scene', 'nav', /^\/$/, '/'],
];
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
if (MEMBER) { await p.goto(B + '/signin'); await p.locator('input[type=email]').fill('stg-fan@test.invalid'); await p.locator('input[type=password]').fill(process.env.BKP_STAGING_PASSWORD); await p.getByTestId('signin-submit').click(); await p.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30000 }); }
await p.goto(B + '/'); await p.waitForLoadState('networkidle');
const res = Object.fromEntries(ROUTE.map(([n]) => [n, { fb: [], done: [], reloads: 0 }]));
for (let r = 0; r < ROUNDS; r++) for (const [name, kind, target, href] of ROUTE) {
  await p.evaluate(() => { window.__bkpMark = Math.random(); });
  const beforeMain = await p.locator('main').innerHTML().catch(() => '');
  const t0 = Date.now();
  if (kind === 'nav') await p.locator(`nav.main-nav a[href="${href}"]`).first().click();
  else {   // a link the member would click: emulate with a client-side link so it uses the same router
    await p.evaluate((href) => { window.dispatchEvent(new Event('bkp:navstart')); window.next.router.push(href); }, target);   // same client router and feedback as the site's links
  }
  // feedback: main content changed (skeleton or page) or a loading indicator appeared
  let fb = null; const end = Date.now() + 20000;
  while (Date.now() < end) {
    const changed = await p.evaluate((prev) => { const m = document.querySelector('main'); return !!document.querySelector('[data-loading]') || (m && m.innerHTML !== prev); }, beforeMain).catch(() => true);
    if (changed) { fb = Date.now() - t0; break; } await new Promise((x) => setTimeout(x, 10));
  }
  const wantPath = kind === 'url' ? new URL(B + target).pathname : null;
  await p.waitForURL((u) => (wantPath ? u.pathname === wantPath : target.test(u.pathname + u.search)), { timeout: 30000 });
  await p.waitForFunction(() => !document.querySelector('[data-loading]'), null, { timeout: 30000, polling: 10 });
  const done = Date.now() - t0;
  const reloaded = await p.evaluate(() => window.__bkpMark === undefined);
  res[name].fb.push(fb ?? done); res[name].done.push(done); if (reloaded) res[name].reloads++;
}
await b.close();
const q = (a, pct) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((pct / 100) * s.length) - 1)]; };
console.log(`\nNavigation (${MEMBER ? 'signed-in member' : 'visitor'}, ${ROUNDS} rounds) — milliseconds from click`);
console.log('section            feedback p50/p95     complete p50/p95/p99    full reloads');
for (const [n] of ROUTE) { const x = res[n]; console.log(`${n.padEnd(18)} ${String(q(x.fb, 50)).padStart(6)} / ${String(q(x.fb, 95)).padEnd(8)}  ${String(q(x.done, 50)).padStart(6)} / ${String(q(x.done, 95)).padStart(5)} / ${String(q(x.done, 99)).padEnd(6)}  ${x.reloads}`); }
