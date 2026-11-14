// Browser-side cost of each page on a mid-range phone profile (CPU slowed 4x via Chrome DevTools), so frontend
// time can be separated from network and server time. Usage: node tests/perf/frontend.mjs <base-url>
import { chromium } from 'playwright';
const B = process.argv[2] ?? 'http://localhost:3100';
const PAGES = ['/cities', '/', '/gazette?city=surat', '/cities', '/india', '/board?level=locality&city=surat&locality=Vesu', '/board?view=hall&level=city&city=surat', '/u/kinjal.adajan', '/bill/kinjal.adajan', '/seal'];
const b = await chromium.launch();
console.log('page                                           server  first-paint  scripts(ms)  long-tasks(ms)  JS kB  img kB');
for (const path of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable');
  await p.addInitScript(() => { window.__lt = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ type: 'longtask', buffered: true }); });
  await p.goto(B + path, { waitUntil: 'load' }); await p.waitForTimeout(800);
  const m = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fp = performance.getEntriesByName('first-contentful-paint')[0];
    const res = performance.getEntriesByType('resource'); const kb = (re) => Math.round(res.filter((r) => re.test(r.name)).reduce((a, r) => a + (r.transferSize || r.encodedBodySize), 0) / 1024);
    return { ttfb: Math.round(n.responseStart - n.requestStart), fcp: Math.round(fp?.startTime ?? 0), lt: Math.round(window.__lt), js: kb(/\.js(\?|$)/), img: kb(/\.(png|jpe?g|webp|avif|svg)(\?|$)|\/api\//) }; });
  const pm = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  console.log(`${path.padEnd(46)} ${String(m.ttfb).padStart(6)} ${String(m.fcp).padStart(11)} ${String(Math.round(pm.ScriptDuration * 1000)).padStart(12)} ${String(m.lt).padStart(15)} ${String(m.js).padStart(6)} ${String(m.img).padStart(7)}`);
  await ctx.close();
}
await b.close();
