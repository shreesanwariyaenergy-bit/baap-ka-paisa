import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { amountToPass, projectedRank, validTopUp } from '@/lib/data/ranking';
import type { Board } from '@/lib/data/types';
import { LEVEL_LABEL, LEVELS, cityById, scopeName } from '@/lib/geo';
import { inr, pad2 } from '@/lib/format';

export const metadata: Metadata = { title: 'Rank Up' };

export default async function RankUpPage({ searchParams }: { searchParams: Promise<{ target?: string; add?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const season = ds.season();
  const viewer = await ds.viewer();
  const intro = (
    <section className="page-intro">
      <div><div className="eyebrow">Rank Up / preview</div><h1>Rank up.</h1></div>
      <p>See exactly what a move would cost and how all four of your boards would change, before anything happens. Payments are not open, so nothing can be bought here yet.</p>
    </section>
  );
  if (!viewer || !rankingsOpen(ds)) {
    return (<>{intro}<div className="board-panel" style={{ margin: '26px 0 70px' }}><div className="state-box" data-testid="rankup-closed">
      <h4>{!rankingsOpen(ds) ? 'Rankings are not open yet.' : 'Sign-in is not open yet.'}</h4>
      <p>Rank Up previews appear here once the season is open and you are signed in. You can still browse <Link href="/board" style={{ textDecoration: 'underline' }}>the boards</Link>.</p></div></div></>);
  }
  const me = viewer.member;
  const city = cityById(me.cityId)!;
  const boards = Object.fromEntries(await Promise.all(LEVELS.map(async (l) => [l, await ds.board({ level: l, cityId: me.cityId, locality: me.locality }, { limit: 100 })] as const))) as Record<(typeof LEVELS)[number], Board>;
  const my = me.seasonScore;
  const locTop = boards.locality.rows[0];
  const cityTop = boards.city.rows[0];
  const city10 = boards.city.rows[9];
  const targets = [
    locTop && locTop.member.username !== me.username ? { id: 'loc1', label: `Take #1 in ${me.locality}`, add: amountToPass(my, locTop.member.seasonScore) } : null,
    city10 && (boards.city.viewerRow?.rank ?? 999) > 10 ? { id: 'top10', label: `Enter the top 10 in ${city.name}`, add: amountToPass(my, city10.member.seasonScore) } : null,
    cityTop && cityTop.member.username !== me.username ? { id: 'city1', label: `Take #1 in ${city.name}`, add: amountToPass(my, cityTop.member.seasonScore) } : null,
  ].filter(Boolean) as { id: string; label: string; add: number }[];
  const chosen = targets.find((t) => t.id === sp.target);
  const customAdd = sp.target === 'custom' ? Number(sp.add) : NaN;
  const add = chosen ? chosen.add : Number.isFinite(customAdd) ? customAdd : null;
  const error = add !== null ? validTopUp(my, add) : null;
  const after = add !== null && !error ? my + add : null;

  return (
    <>
      {intro}
      <div className="board-layout" style={{ marginTop: 26 }}>
        <div className="board-panel">
          <div className="panel-head"><h3>Choose a target</h3><span>{season.label} · you are at {inr(my)}</span></div>
          <div className="state-box" style={{ paddingTop: 20 }}>
            <div className="filterbar" style={{ margin: 0 }} role="group" aria-label="Rank Up targets">
              {targets.map((t) => <Link key={t.id} href={`/rank-up?target=${t.id}`} aria-current={sp.target === t.id ? 'true' : undefined}>{t.label} · {inr(t.add)}</Link>)}
            </div>
            <form action="/rank-up" method="get" className="filterbar" style={{ marginTop: 14 }}>
              <input type="hidden" name="target" value="custom" />
              <input id="add" name="add" type="number" inputMode="numeric" min={500} step={500} aria-label="Custom amount in rupees, in steps of ₹500" defaultValue={sp.target === 'custom' ? sp.add : ''} placeholder="Custom amount (₹500 steps)" style={{ minWidth: 260 }} />
              <button type="submit">Preview</button>
            </form>
            {error && <p role="alert" style={{ color: 'var(--orange-ink)', marginTop: 8 }}>{error}</p>}
          </div>
          {after !== null && (
            <div data-testid="rankup-preview">
              <div className="panel-head" style={{ borderTop: '1px solid var(--line)' }}><h3>Before and after</h3><span>Preview, not a purchase</span></div>
              {LEVELS.map((l) => {
                const b = boards[l];
                const before = b.viewerRow?.rank ?? null;
                const others = b.rows.map((r) => ({ username: r.member.username, score: r.member.seasonScore }));
                const next = projectedRank(others, me.username, after);
                return (
                  <div className="history-row" key={l} style={{ padding: '14px 19px', gridTemplateColumns: '1fr auto auto' }}>
                    <span>{l === 'india' ? 'India / National' : `${scopeName(b.scope)} / ${LEVEL_LABEL[l]}`}</span>
                    <small>{before ? `#${pad2(before)}` : '—'} → </small>
                    <b>{next > 100 ? '100+' : `#${pad2(next)}`}</b>
                  </div>
                );
              })}
              <div className="state-box" style={{ paddingTop: 10 }}>
                <p>Season Score {inr(my)} → <b>{inr(after)}</b>. You would pay {inr(add!)} (GST-inclusive amount; final tax treatment pending CA confirmation). Passing someone takes nothing from them, and there are no prizes or cash-outs.</p>
                <button className="btn" type="button" disabled aria-disabled="true" style={{ marginTop: 16 }} data-testid="rankup-confirm">Payments are not open</button>
              </div>
            </div>
          )}
        </div>
        <aside className="board-aside" aria-label="How Rank Up works">
          <div className="eyebrow">How it works</div>
          <h3 style={{ marginTop: 18 }}>You only pay<br />the difference.</h3>
          <p>To pass someone, your Season Score must reach their score plus ₹500. Entry to a season starts at ₹1,000; after that, steps of ₹500.</p>
          <div className="aside-stat"><span>Boards changed</span><b>All four</b></div>
          <div className="aside-stat"><span>Refunds</span><b>Failed or duplicate payments only</b></div>
          <div className="aside-stat"><span>Payments</span><b>Not open</b></div>
        </aside>
      </div>
    </>
  );
}
