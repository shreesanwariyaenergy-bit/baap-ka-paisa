// Measures a DEPLOYED site in a real browser (Chromium), signed out and optionally signed in.
//
//   node tests/perf/deployed.mjs <base-url> [rounds] [--member]
//
// Two measurements per section:
//   1. Full page load (new tab): time to first byte and time until the page's main content is in place.
//      A not-found page on the same deployment is measured in between as the baseline. It runs a function too,
//      but reads no data, so "page minus baseline" is the time the server spends on the page's data and render.
//   2. In-app navigation (click, as a visitor would): time until the new page's content is in place. Every
//      network request made during the click is recorded with its own duration, so a waterfall
//      (requests one after another) or a repeated fetch shows up.
//
// Members: set BKP_STAGING_PASSWORD (staging test accounts only) and pass --member.
import { chromium } from 'playwright';

const B = process.argv[2]; if (!B) { console.error('usage: node tests/perf/deployed.mjs <base-url> [rounds] [--member]'); process.exit(2); }
const ROUNDS = Number(process.argv[3] ?? 7);
const MEMBER = process.argv.includes('--member');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;

const SECTIONS = [
  ['Home', '/'], ['Gazette', '/gazette'], ['Cities', '/cities'], ['India', '/india'], ['City board', '/board'],
  ['Locality board', '/board?level=locality&city=surat&locality=Vesu'], ['Hall of Fame', '/board?view=hall&level=city&city=surat'],
  ['Profile', '/u/stg.king'], ['The Bill', '/bill/stg.king'], ['Seal', '/seal'], ['Archive', '/archive'],
];
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const fmt = (a) => a.length ? `${pct(a, 0.5)} / ${pct(a, 0.95)}` : '-';

const browser = await chromium.launch({ proxy });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });   // the workspace proxy re-signs TLS; measurement only
const page = await ctx.newPage();
if (MEMBER) {
  await page.goto(B + '/signin'); await page.locator('input[type=email]').fill('stg-fan@test.invalid');
  await page.locator('input[type=password]').fill(process.env.BKP_STAGING_PASSWORD ?? '');
  await page.getByTestId('signin-submit').click(); await page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30000 });
}

// The page is "in place" when the URL matches and no loading state or progress bar is showing.
const settled = async (path) => {
  const want = new URL(B + path); await page.waitForURL((u) => u.pathname === want.pathname && u.search === want.search, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('[data-loading]') && document.querySelector('main')?.innerText.trim().length > 0, null, { timeout: 30000, polling: 10 });
};

// 1. Full loads
const load = Object.fromEntries(SECTIONS.map(([n]) => [n, { ttfb: [], content: [], server: [] }])); const base = [];
for (let r = 0; r < ROUNDS; r++) for (const [name, path] of SECTIONS) {
  const b0 = Date.now(); const br = await page.goto(B + '/__bkp-baseline-404', { waitUntil: 'commit' }); const bt = (await br.request().timing()).responseStart; base.push(Math.round(bt)); void b0;
  const t0 = Date.now(); const res = await page.goto(B + path, { waitUntil: 'commit' });
  const ttfb = Math.round((await res.request().timing()).responseStart); await settled(path);
  load[name].ttfb.push(ttfb); load[name].content.push(Date.now() - t0); load[name].server.push(Math.max(0, ttfb - Math.round(bt)));
}

// 2. In-app navigation with a request log per click. One permanent listener; each click keeps the requests that
// started after it. Link prefetches (the router fetching pages the visitor might open next) are counted apart.
const nav = Object.fromEntries(SECTIONS.map(([n]) => [n, { done: [], reqs: [], prefetch: [], serial: [], dup: 0 }]));
const all = [];
page.on('requestfinished', (req) => { const t = req.timing(); const h = req.headers();
  all.push({ url: req.url().replace(B, ''), start: t.startTime, end: t.startTime + t.responseEnd, ms: Math.round(t.responseEnd), prefetch: h['next-router-prefetch'] === '1' || h['purpose'] === 'prefetch' }); });
await page.goto(B + '/'); await settled('/');
for (let r = 0; r < ROUNDS; r++) for (const [name, path] of SECTIONS) {
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.evaluate((href) => { window.dispatchEvent(new Event('bkp:navstart')); window.next.router.push(href); }, path);
  await settled(path); const done = Date.now() - t0;
  await page.waitForTimeout(200);
  const mine = all.filter((x) => x.start >= t0 - 5 && x.start <= t0 + done && !/\/_next\/static\/|\/fonts\//.test(x.url));
  const data = mine.filter((x) => !x.prefetch), pre = mine.filter((x) => x.prefetch);
  let serial = 0; for (const x of data) if (data.some((y) => y !== x && y.end <= x.start)) serial++;
  const seen = new Set(); for (const x of data) { if (seen.has(x.url)) nav[name].dup++; seen.add(x.url); }
  nav[name].done.push(done); nav[name].reqs.push(data.length); nav[name].prefetch.push(pre.length); nav[name].serial.push(serial);
  if (r === 0) nav[name].sample = data.map((x) => `${x.ms}ms ${x.url.replace(/[?&]_rsc=[^&]*/, '').slice(0, 70)}`);
}
await browser.close();

console.log(`\n${B}  ${MEMBER ? 'signed in (stg.fan)' : 'signed out'}  rounds=${ROUNDS}  baseline (404, no data) TTFB p50/p95 = ${fmt(base)} ms\n`);
console.log('Section          | load TTFB p50/p95 | server work p50/p95 | content p50/p95 | click→content p50/p95 | requests/click | prefetches | sequential | repeated');
for (const [name] of SECTIONS) {
  const l = load[name], n = nav[name];
  console.log(`${name.padEnd(16)} | ${fmt(l.ttfb).padEnd(17)} | ${fmt(l.server).padEnd(19)} | ${fmt(l.content).padEnd(15)} | ${fmt(n.done).padEnd(21)} | ${String(pct(n.reqs, 0.5)).padEnd(14)} | ${String(pct(n.prefetch, 0.5)).padEnd(10)} | ${String(pct(n.serial, 0.5)).padEnd(10)} | ${n.dup}`);
}
console.log('\nRequests during the first click on each section:');
for (const [name] of SECTIONS) console.log(`  ${name}: ${nav[name].sample.join(' | ')}`);
