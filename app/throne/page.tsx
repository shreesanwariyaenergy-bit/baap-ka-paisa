import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import type { ReignView } from '@/lib/data/types';
import { CITIES, LEVELS, LEVEL_LABEL, cityById, parseScope, scopeName } from '@/lib/geo';
import { Crown, PastChampionMark } from '@/components/Crown';
import { BoardFilters } from '@/components/BoardFilters';

export const metadata: Metadata = { title: 'Throne History' };

const fmt = (d: Date) => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const dur = (h: number) => (h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`);
const nm = (r: ReignView) => (r.member.masked ? r.member.publicLabel : r.member.displayName ?? r.member.username);

export default async function ThronePage({ searchParams }: { searchParams: Promise<{ level?: string; city?: string; locality?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  const scope = parseScope(sp, viewer?.member.cityId, viewer?.member.locality);
  const city = cityById(scope.cityId)!;
  const name = scopeName(scope);
  const reigns = await ds.throneHistory({ scope, limit: 100 });
  const href = (l: string) => `/throne?level=${l}&city=${scope.cityId}${l === 'locality' ? `&locality=${encodeURIComponent(scope.locality)}` : ''}`;
  const longest = [...reigns].sort((a, b) => b.hours - a.hours)[0];
  const counts = new Map<string, { r: ReignView; n: number }>();
  reigns.forEach((r) => { const k = r.member.username; counts.set(k, { r, n: (counts.get(k)?.n ?? 0) + 1 }); });
  const most = [...counts.values()].sort((a, b) => b.n - a.n)[0];

  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">Throne history / {LEVEL_LABEL[scope.level]}</div><h1>Who held<br />the crown.</h1></div>
        <p>Every #01 on the {name} board, when they took it, how long they held it and how it ended. The gold crown marks only the current holder.{ds.availability === 'demo' ? ' Simulated history.' : ''}</p>
      </section>
      <div className="filterbar">
        <span role="group" aria-label="Board level" style={{ display: 'contents' }}>
          {LEVELS.map((l) => <Link key={l} href={href(l)} aria-current={scope.level === l ? 'true' : undefined}>{LEVEL_LABEL[l]}</Link>)}
        </span>
        <BoardFilters view="none" basePath="/throne" level={scope.level} cityId={scope.cityId} locality={scope.locality} query=""
          cities={CITIES.map((c) => ({ id: c.id, name: c.name }))} localities={city.localities} />
      </div>
      <div className="board-layout">
        <div className="board-panel">
          <div className="panel-head"><h3 data-testid="throne-title">{name} / {LEVEL_LABEL[scope.level]} throne</h3><span>{reigns.length} {reigns.length === 1 ? 'reign' : 'reigns'}</span></div>
          {reigns.length === 0 ? (
            <div className="state-box" data-testid="throne-empty"><h4>{rankingsOpen(ds) ? `No one has held ${name} yet.` : 'No throne history yet.'}</h4><p>The first member to reach #01 on this board starts its history.</p></div>
          ) : reigns.map((r) => (
            <div className={`reign${r.current ? ' current' : ''}`} key={`${r.member.username}-${r.from.getTime()}`} data-testid="reign">
              <span className="mark">{r.current ? <><Crown variant="compact" /><span className="sr-only">Current number-one holder</span></> : <PastChampionMark label={r.seasonLabel.replace('Season ', 'S')} />}</span>
              <div style={{ minWidth: 0 }}>
                <h4><Link href={`/u/${encodeURIComponent(r.member.username)}`}>{nm(r)}</Link></h4>
                <p>{r.seasonLabel} · from {fmt(r.from)} {r.to ? `to ${fmt(r.to)}` : '· holding now'} · {r.endReason === 'overtaken' ? 'overtaken' : r.endReason === 'season-end' ? 'season ended' : 'current'}</p>
                {r.untouchable && <span className="chip">Untouchable</span>}
                {r.revenge && <span className="chip warm">Revenge Taken</span>}
              </div>
              <div className="dur">{dur(r.hours)}<small>{r.current ? 'so far' : 'held'}</small></div>
            </div>
          ))}
        </div>
        <aside className="board-aside" aria-label="Throne records">
          <div className="eyebrow">Records on this board</div>
          <h3 style={{ marginTop: 18 }}>Longest reign</h3>
          <p>{longest ? `${nm(longest)}, ${dur(longest.hours)} (${longest.seasonLabel})` : 'No reigns yet.'}</p>
          <h3>Most reigns</h3>
          <p>{most ? `${nm(most.r)}, ${most.n} ${most.n === 1 ? 'reign' : 'reigns'}` : 'No reigns yet.'}</p>
          <div className="aside-stat"><span>Untouchable</span><b>72h straight at city #01</b></div>
          <div className="aside-stat"><span>Revenge Taken</span><b>Retook #01 within 24h</b></div>
          <Link className="btn block" href={`/board?level=${scope.level}&city=${scope.cityId}${scope.level === 'locality' ? `&locality=${encodeURIComponent(scope.locality)}` : ''}`}>Open this board <span className="arrow" aria-hidden="true">↗</span></Link>
        </aside>
      </div>
    </>
  );
}
