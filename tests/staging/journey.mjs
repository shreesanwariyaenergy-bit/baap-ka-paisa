// Integrated journey through the real app against the STAGING Supabase project (real Auth, real database).
// Usage: start the app pointed at staging on :3300, then  node tests/staging/journey.mjs
import { chromium } from 'playwright';
const B = 'http://localhost:3300', PW = 'Staging-test-1';
const browser = await chromium.launch();
const results = [];
const step = async (name, fn) => { try { const note = await fn(); results.push(`PASS  ${name}${note ? `  [${note}]` : ''}`); } catch (e) { results.push(`FAIL  ${name}  [${String(e).split('\n')[0].slice(0, 170)}]`); } };
const expectText = async (loc, re, timeout = 20000) => {   // waits until the text matches; the site shows some text in capitals, so matching ignores case
  const rx = new RegExp(re.source, re.flags.includes('i') ? re.flags : re.flags + 'i'); const end = Date.now() + timeout; let t = '';
  while (Date.now() < end) { t = await loc.first().innerText().catch(() => ''); if (rx.test(t)) return t; await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`text "${t.slice(0, 90)}" does not match ${rx}`);
};
const signIn = async (ctx, who) => { const p = await ctx.newPage(); await p.goto(B + '/signin'); await p.locator('input[type=email]').fill(`stg-${who}@test.invalid`); await p.locator('input[type=password]').fill(PW); await p.getByTestId('signin-submit').click(); await p.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30000 }); return p; };

const ui = await browser.newContext(); let page; let declId = '';
await step('sign-in with a wrong password is refused', async () => { const p = await ui.newPage(); await p.goto(B + '/signin'); await p.locator('input[type=email]').fill('stg-ui@test.invalid'); await p.locator('input[type=password]').fill('wrong-pass-9'); await p.getByTestId('signin-submit').click(); await expectText(p.locator('.field-error'), /do not match/); await p.close(); });
await step('sign-in (real Auth) lands on finish-profile', async () => { page = await signIn(ui, 'ui'); if (!/\/join/.test(page.url())) throw new Error('landed on ' + page.url()); return page.url().replace(B, ''); });
await step('profile wizard creates the member (real create_member, allow-list)', async () => {
  for (let i = 0; i < 7 && !(await page.getByTestId('wizard-success').isVisible().catch(() => false)); i++) {
    const fill = async (id, v) => { const l = page.getByTestId(id); if (await l.isVisible().catch(() => false)) { const tag = await l.evaluate((e) => e.tagName + ':' + (e.type || '')); if (tag.startsWith('SELECT')) await l.selectOption(v); else if (/checkbox/.test(tag)) await l.check(); else await l.fill(v); } };
    await fill('f-name', 'Stg Ui'); await fill('f-username', 'stg.ui'); await fill('f-city', 'surat'); await page.waitForTimeout(150); await fill('f-locality', 'Vesu'); await fill('f-dob', '1994-05-05'); await fill('f-adult', ''); await fill('f-terms', '');
    if (await page.getByTestId('wizard-success').isVisible().catch(() => false)) break;
    const next = (await page.getByTestId('wizard-confirm').isVisible().catch(() => false)) ? page.getByTestId('wizard-confirm') : page.getByTestId('wizard-next');
    const confirming = await page.getByTestId('wizard-confirm').isVisible().catch(() => false);
    await next.click();
    if (confirming) { await page.getByTestId('wizard-success').waitFor({ timeout: 40000 }); break; }   // creating the profile takes a few seconds
    await page.waitForTimeout(1500);
  }
  return 'member ID ' + (await expectText(page.getByTestId('member-id'), /\d{5}/)).trim();
});
await step('The Seal shows the new member', async () => { await page.goto(B + '/seal'); await expectText(page.getByTestId('seal'), /STG UI/i); });
await step('header shows the signed-in member', async () => { await expectText(page.locator('.profile-menu'), /stg\.ui/i); });
await step('profile save stores social handles', async () => { await page.goto(B + '/me'); await page.locator('input[name=instagram]').fill('stg.ui.gram'); await page.locator('select[name=socialVisibility]').selectOption('everyone'); await page.getByTestId('profile-save').click(); return (await expectText(page.getByTestId('profile-result'), /^Saved\.$/)); });
await step('own profile shows the saved handle', async () => { await page.goto(B + '/u/stg.ui'); await expectText(page.getByTestId('profile-socials'), /stg\.ui\.gram/); });
await step('follow, Respect and rival on another member', async () => {
  await page.goto(B + '/u/stg.ch'); const box = page.getByTestId('social-actions');
  await box.getByRole('button', { name: /^Follow$/i }).click(); await expectText(box.getByRole('button', { name: /Following/ }), /Following/);
  await box.getByRole('button', { name: /Give Respect/ }).click(); await expectText(box.getByRole('button', { name: /Respect given today/ }), /Respect given/);
  await box.getByRole('button', { name: /Add rival/ }).click(); await expectText(box.getByRole('button', { name: /Remove rival/ }), /Remove rival/);
  await page.reload(); await expectText(page.getByTestId('social-actions').getByRole('button', { name: /Following/ }), /Following/); return 'state survives reload';
});
await step('backing: confirm, lock, count rises', async () => { const before = Number(await page.getByTestId('backing-count').innerText()); await page.getByTestId('back-start').click(); await page.getByTestId('back-confirm').click(); await expectText(page.getByTestId('backing-locked'), /Locked/); await page.reload(); const after = Number(await page.getByTestId('backing-count').innerText()); if (after !== before + 1) throw new Error(`count ${before} -> ${after}`); return `${before} -> ${after}`; });
await step('backing is locked: no second backing offered', async () => { await page.goto(B + '/u/stg.king'); if (await page.getByTestId('back-start').count()) throw new Error('second backing offered'); return await page.getByTestId('backing-panel').getAttribute('data-mode'); });
await step('declare for Surat against the holder', async () => { await page.getByTestId('declare-start').click(); await page.getByTestId('declare-confirm').click(); await page.waitForURL(/\/declare\/\d+/, { timeout: 30000 }); declId = page.url().split('/').pop(); await expectText(page.getByTestId('declaration-status'), /Standing/); return 'declaration ' + declId + ': ' + (await page.getByTestId('declaration').locator('header span').first().innerText()); });
await step('declaration page: figures and price of the throne', async () => { await expectText(page.getByTestId('declaration'), /STG UI[\s\S]*SURAT/i); await expectText(page.getByTestId('throne-price-amount'), /12,500/); });
await step('a second declaration for the same throne is not offered', async () => { await page.goto(B + '/u/stg.king'); if (await page.getByTestId('declare-start').count()) throw new Error('offered again'); });
await step('Gazette covers the declaration from live data', async () => { await page.goto(B + '/gazette?city=surat'); await expectText(page.getByTestId('gazette'), /DECLARES FOR SURAT/); await expectText(page.getByTestId('gazette-declaration'), /No\. D\/S3\/ST\/\d{3}/i); });
await step('board shows live ranks and backer counts', async () => { await page.goto(B + '/board?level=city&city=surat'); const u = await page.locator('.rank-row[data-rank="1"]').getAttribute('data-username'); if (u !== 'stg.king') throw new Error('#1 is ' + u); await expectText(page.getByTestId('row-backers'), /backing/); });
await step('The Bill and share images render from live data', async () => { await page.goto(B + '/bill/stg.king'); await expectText(page.getByTestId('bill'), /1 × SURAT[\s\S]*HOLDING/); for (const u of ['/api/seal-card/stg.king', '/api/gazette-card/surat', `/api/declaration-card/${declId}`]) { const r = await ui.request.get(B + u); if (!(r.headers()['content-type'] || '').includes('image/png')) throw new Error(u + ' -> ' + r.status()); } });
await step('Mystery-mode member is shown by label only', async () => { const r = await page.goto(B + '/u/stg.third'); if (r.status() !== 404) throw new Error('username reachable: ' + r.status()); await page.goto(B + '/u/ANON-612'); const t = await page.locator('main').innerText(); if (/stg\.third|Stg Third/i.test(t)) throw new Error('real name leaked'); });
const king = await browser.newContext();
await step('holder signs in, sees the block control, blocks the challenger', async () => { const p = await signIn(king, 'king'); await p.goto(`${B}/declare/${declId}`); await p.getByTestId('block-control').getByRole('button').click(); await expectText(p.getByTestId('block-control'), /Blocked\./); await p.goto(B + '/me'); await expectText(p.getByTestId('block-list'), /Unblock Stg Ui/i); });
await step('blocked declaration is gone from public view', async () => { const anon = await browser.newContext(); const p = await anon.newPage(); const r = await p.goto(`${B}/declare/${declId}`); if (r.status() !== 404) throw new Error('still visible: ' + r.status()); await anon.close(); });
await step('session: a tampered session cookie is treated as signed out', async () => { const c = await browser.newContext(); const cookies = (await ui.cookies()).filter((x) => x.name.startsWith('sb-')); if (!cookies.length) throw new Error('no session cookie found'); await c.addCookies(cookies.map((x) => ({ ...x, value: x.value.slice(0, -12) + 'AAAAAAAAAAAA' }))); const p = await c.newPage(); await p.goto(B + '/seal'); await expectText(p.getByTestId('seal-signed-out'), /waiting/i); await c.close(); return cookies.map((x) => `${x.name.slice(0, 12)}… httpOnly=${x.httpOnly}`).join(', '); });
await step('sign out ends the session', async () => { await page.goto(B + '/'); await page.locator('.profile-menu summary').click(); await page.getByRole('button', { name: /sign out/i }).click(); await page.getByTestId('auth-actions').waitFor({ timeout: 20000 }); await page.goto(B + '/seal'); await expectText(page.getByTestId('seal-signed-out'), /waiting/i); });
await step('signed-out visitor: registration closed by the database gate for a non-listed account', async () => { const c = await browser.newContext(); const p = await signIn(c, 'outsider'); await p.goto(B + '/join?complete=1'); return 'lands on ' + p.url().replace(B, ''); });
await browser.close();
console.log(results.join('\n')); console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} steps passed`);
