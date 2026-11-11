import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { BOARD_VIEWS, VIEW_LABEL, movers, parseView } from '@/lib/data/views';
import { CITIES, LEVELS, LEVEL_LABEL, cityById, parseScope, scopeName } from '@/lib/geo';
import { timeLeft } from '@/lib/season';
import { inr, pad2 } from '@/lib/format';
import { BoardList } from '@/components/BoardList';
import { BoardFilters } from '@/components/BoardFilters';
import { CITY_NAMES } from '@/components/cityNames';

export const metadata: Metadata = { title: 'The Board' };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ level?: string; city?: string; locality?: string; q?: string; view?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  const scope = parseScope(sp, viewer?.member.cityId, viewer?.member.locality);
  const view = parseView(sp.view);
  const query = view === 'season' ? (sp.q ?? '').slice(0, 60) : '';
  const seasonBoard = await ds.board(scope, { limit: 100, query });
  const board = view === 'hall' ? await ds.hallOfFame(scope, { limit: 100 }) : view === 'respect' ? await ds.respectBoard(scope, { limit: 100 }) : view === 'movers' ? movers(seasonBoard) : seasonBoard;
  const city = cityById(scope.cityId)!;
  const name = scopeName(scope);
  const season = ds.season();
  const left = timeLeft(season, ds.now());
  const href = (l: string, vw: string) => `/board?level=${l}&city=${scope.cityId}${l === 'locality' ? `&locality=${encodeURIComponent(scope.locality)}` : ''}${vw !== 'season' ? `&view=${vw}` : ''}`;
  const levelHref = (l: string) => href(l, view);
  const v = seasonBoard.viewerRow;
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
        <BoardFilters view={view} level={scope.level} cityId={scope.cityId} locality={scope.locality} query={query}
          cities={CITIES.map((c) => ({ id: c.id, name: c.name }))} localities={city.localities} />
      </div>
      <nav className="view-tabs" aria-label="Board view">
        {BOARD_VIEWS.map((vw) => <Link key={vw} href={href(scope.level, vw)} aria-current={view === vw ? 'true' : undefined} data-view={vw}>{VIEW_LABEL[vw]}</Link>)}
      </nav>
      <p className="view-note">{view === 'season' ? `Season Score, ${season.label}. Resets when the season ends.` : view === 'movers' ? 'Members who climbed or entered this board in the last 24 hours, biggest climb first. Numbers are their current season rank.' : view === 'respect' ? 'Free Respect received this season. One Respect per profile per day. No money involved, so no gold crown.' : 'Lifetime Score across every season. Never resets. The gold crown belongs only to the current season #01.'}</p>
      <div className="board-layout">
        <div className="board-panel">
          <div className="panel-head">
            <h3 data-testid="board-title">{name} / {LEVEL_LABEL[scope.level]} board</h3>
            <span>{VIEW_LABEL[view]}{board.total > 0 ? ` · ${board.total} on this board` : ''}{ds.availability === 'demo' ? ' · Demo data' : ''}</span>
          </div>
          <BoardList board={board} scopeLabel={name} metaMode={scope.level === 'state' || scope.level === 'india' ? 'city' : 'flex'} cityNames={CITY_NAMES}
            crownLive={view === 'season' || view === 'movers'} valueLabel={view === 'hall' ? 'lifetime' : 'season'}
            emptyTitle={unavailable ? 'Rankings are not open yet.' : view === 'respect' ? `No Respect given in ${name} yet.` : view === 'hall' ? `No lifetime record in ${name} yet.` : `No one rules ${name} yet.`}
            emptyText={unavailable ? 'This board will fill as soon as the first season opens. Nothing here is hidden; there is simply no one ranked yet.'
              : view === 'movers' ? `Nobody climbed or entered the ${name} board in the last 24 hours.`
              : view === 'hall' ? 'The Hall of Fame lists Lifetime Score from every season once members have ranked.'
              : view === 'respect' ? `Nobody in ${name} has received Respect this season yet.`
              : `Be the first. The first ranked member in ${name} earns the Pioneer of ${name} flag.`} />
          {board.rows.length > 0 && <div className="board-foot">{view === 'movers' ? `${board.rows.length} ${board.rows.length === 1 ? 'mover' : 'movers'} of ${board.total} on this board` : `Showing ${board.rows.length} of ${board.total}`}{query ? ` matching “${query}”` : ''}. Select a row to open the profile.</div>}
        </div>
        <aside className="board-aside" aria-label="Your place on this board">
          <div className="eyebrow">Your season place in {name}</div>
          {v ? (
            <>
              <div className="big">#{pad2(v.rank)}</div>
              <h3>{v.rank === 1 ? <>You hold<br />the crown.</> : <>On the board.<br />Not yet on top.</>}</h3>
              <p>You are listed at {inr(v.member.seasonScore)} this season, #{v.rank} of {seasonBoard.total} in {name}.</p>
            </>
          ) : (
            <>
              <div className="big">—</div>
              <h3>{viewer ? <>Not on<br />this board.</> : <>Not on the<br />register yet.</>}</h3>
              <p>{viewer ? `Your boards are ${viewer.member.locality}, ${CITY_NAMES[viewer.member.cityId]}, and their state and India boards.` : 'Create a profile to see your own row here.'}</p>
            </>
          )}
          <div className="aside-stat"><span>Season</span><b>{season.label}</b></div>
          <div className="aside-stat"><span>Scheduled close</span><b>{!rankingsOpen(ds) ? 'Not open' : left.closed ? 'Closed' : `${left.days} days`}</b></div>
          <div className="aside-stat"><span>Rank up</span><b>Not open</b></div>
          <p style={{ marginBottom: 0 }}>Rank purchases stay switched off until legal and payment-provider approval is in place.</p>
          <Link className="btn light block" href={`/throne?level=${scope.level}&city=${scope.cityId}${scope.level === 'locality' ? `&locality=${encodeURIComponent(scope.locality)}` : ''}`} style={{ marginBottom: 10 }}>Throne history <span className="arrow" aria-hidden="true">↗</span></Link>
          <Link className="btn block" href="/rank-up">Preview Rank Up <span className="arrow" aria-hidden="true">↗</span></Link>
          <Link className="btn light block" href="/seal" style={{ marginTop: 10 }}>View The Seal <span className="arrow" aria-hidden="true">↗</span></Link>
        </aside>
      </div>
    </>
  );
}
