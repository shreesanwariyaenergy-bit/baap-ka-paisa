// Server-side page timing against a running app (default http://localhost:3300) pointed at STAGING, with
if (!process.env.BKP_STAGING_PASSWORD && process.env.BKP_MEMBER !== '0') console.warn('BKP_STAGING_PASSWORD not set: member runs will fail to sign in.');
// BKP_TRACE=1 so the server log records every database/auth call. Prints, per page: median server time and
// the calls the page made. Usage: node tests/perf/baseline.mjs <server-log-file> [label]
import { readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';
const B = process.env.BKP_BASE ?? 'http://localhost:3300';
const LOG = process.argv[2]; const LABEL = process.argv[3] ?? 'run';
const PAGES = ['/', '/board?level=city&city=surat', '/board?level=india', '/gazette?city=surat', '/cities', '/throne?level=city&city=surat', '/u/stg.king', '/bill/stg.king', '/archive', '/closing', '/signin'];
const SIGNED_IN = ['/', '/seal', '/me', '/u/stg.king', '/board?level=city&city=surat'];

async function cookieFor(who) {
  const b = await chromium.launch(); const c = await b.newContext(); const p = await c.newPage();
  await p.goto(B + '/signin'); await p.locator('input[type=email]').fill(`stg-${who}@test.invalid`); await p.locator('input[type=password]').fill(process.env.BKP_STAGING_PASSWORD);
  await p.getByTestId('signin-submit').click(); await p.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30000 });
  const ck = (await c.cookies()).map((x) => `${x.name}=${x.value}`).join('; '); await b.close(); return ck;
}
const logSize = () => statSync(LOG).size;
const callsSince = (pos) => readFileSync(LOG, 'utf8').slice(pos).split('\n').filter((l) => l.startsWith('[bkp-trace]')).map((l) => { const [, ms, what] = l.split(' '); return { ms: Number(ms), what }; });
async function time(path, cookie) {
  const runs = [];
  for (let i = 0; i < 4; i++) {
    const pos = logSize(); const t0 = performance.now();
    const r = await fetch(B + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' }); await r.text();
    const ms = performance.now() - t0; await new Promise((x) => setTimeout(x, 60));
    runs.push({ ms, status: r.status, calls: callsSince(pos) });
  }
  const warm = runs.slice(1).sort((a, b) => a.ms - b.ms); const med = warm[1];
  return { path, status: med.status, cold: Math.round(runs[0].ms), median: Math.round(med.ms), calls: med.calls.length, dbms: med.calls.reduce((a, c) => a + c.ms, 0), list: med.calls };
}
const out = [];
for (const p of PAGES) out.push({ who: 'visitor', ...(await time(p)) });
const ck = await cookieFor('fan');
for (const p of SIGNED_IN) out.push({ who: 'member', ...(await time(p, ck)) });
console.log(`\n== ${LABEL}: server time per page (ms; median of 3 warm requests), and outbound calls in that request`);
console.log('who      page                               status  cold  median  calls  sum-of-call-ms');
for (const r of out) console.log(`${r.who.padEnd(8)} ${r.path.padEnd(34)} ${String(r.status).padEnd(7)} ${String(r.cold).padStart(5)} ${String(r.median).padStart(7)} ${String(r.calls).padStart(6)} ${String(r.dbms).padStart(9)}`);
console.log('\n== call breakdown (median run)');
for (const r of out) console.log(`${r.who} ${r.path}: ${r.list.map((c) => `${c.what}=${c.ms}`).join(' ')}`);
