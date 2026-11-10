import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { CITIES, LEVELS, LEVEL_LABEL, cityById, parseScope, scopeName } from '@/lib/geo';
import { timeLeft } from '@/lib/season';
import { inr, pad2 } from '@/lib/format';
import { BoardList } from '@/components/BoardList';
import { BoardFilters } from '@/components/BoardFilters';
import { CITY_NAMES } from '@/components/cityNames';

export const metadata: Metadata = { title: 'The Board' };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ level?: string; city?: string; locality?: string; q?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  const scope = parseScope(sp, viewer?.member.cityId, viewer?.member.locality);
  const query = (sp.q ?? '').slice(0, 60);
  const board = await ds.board(scope, { limit: 100, query });
  const city = cityById(scope.cityId)!;
  const name = scopeName(scope);
  const season = ds.season();
  const left = timeLeft(season, ds.now());
  const levelHref = (l: string) => `/board?level=${l}&city=${scope.cityId}${l === 'locality' ? `&locality=${encodeURIComponent(scope.locality)}` : ''}`;
  const v = board.viewerRow;
  const unavailable = !rankingsOpen(ds);

  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">The public record / 01</div><h1>The board.</h1></div>
        <p>One city. Four territories. Ranked by Season Score; ties go to whoever reached the score first. {ds.availability === 'demo' ? `This is ${name}'s demo board for ${season.label}.` : ''}</p>
      </section>
      <div className="filterbar">
        <span role="group" aria-label="Board level" style={{ display: 'contents' }}>
          {LEVELS.map((l) => <Link key={l} href={levelHref(l)} aria-current={scope.level === l ? 'true' : undefined} data-level={l}>{LEVEL_LABEL[l]}</Link>)}
        </span>
        <BoardFilters level={scope.level} cityId={scope.cityId} locality={scope.locality} query={query}
          cities={CITIES.map((c) => ({ id: c.id, name: c.name }))} localities={city.localities} />
      </div>
      <div className="board-layout">
        <div className="board-panel">
          <div className="panel-head">
            <h3 data-testid="board-title">{name} / {LEVEL_LABEL[scope.level]} board</h3>
            <span>{board.total > 0 ? `${board.total} on this board · ${season.label}` : season.label}{ds.availability === 'demo' ? ' · Demo data' : ''}</span>
          </div>
          <BoardList board={board} scopeLabel={name} metaMode={scope.level === 'state' || scope.level === 'india' ? 'city' : 'flex'} cityNames={CITY_NAMES}
            emptyTitle={unavailable ? 'Rankings are not open yet.' : `No one rules ${name} yet.`}
            emptyText={unavailable ? 'This board will fill as soon as the first season opens. Nothing here is hidden; there is simply no one ranked yet.' : `Be the first. The first ranked member in ${name} earns the Pioneer of ${name} flag.`} />
          {board.total > 0 && <div className="board-foot">Showing {board.rows.length} of {board.total}{query ? ` matching “${query}”` : ''}. Select a row to open the profile.</div>}
        </div>
        <aside className="board-aside" aria-label="Your place on this board">
          <div className="eyebrow">Your place in {name}</div>
          {v ? (
            <>
              <div className="big">#{pad2(v.rank)}</div>
              <h3>{v.rank === 1 ? <>You hold<br />the crown.</> : <>On the board.<br />Not yet on top.</>}</h3>
              <p>You are listed at {inr(v.member.seasonScore)} this season, #{v.rank} of {board.total} in {name}.</p>
            </>
          ) : (
            <>
              <div className="big">—</div>
              <h3>{viewer ? <>Not on<br />this board.</> : <>Sign-in is<br />not open yet.</>}</h3>
              <p>{viewer ? `Your boards are ${viewer.member.locality}, ${CITY_NAMES[viewer.member.cityId]}, and their state and India boards.` : 'Your own row appears here once you are signed in and ranked.'}</p>
            </>
          )}
          <div className="aside-stat"><span>Season</span><b>{season.label}</b></div>
          <div className="aside-stat"><span>Scheduled close</span><b>{!rankingsOpen(ds) ? 'Not open' : left.closed ? 'Closed' : `${left.days} days`}</b></div>
          <div className="aside-stat"><span>Rank up</span><b>Not open</b></div>
          <p style={{ marginBottom: 0 }}>Rank purchases stay switched off until legal and payment-provider approval is in place.</p>
          <Link className="btn block" href="/seal">View The Seal <span className="arrow" aria-hidden="true">↗</span></Link>
        </aside>
      </div>
    </>
  );
}
