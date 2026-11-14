import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { cityById, DEFAULT_CITY_ID } from '@/lib/geo';
import { inrShort, pad2 } from '@/lib/format';
import { BoardList } from '@/components/BoardList';
import { CITY_NAMES } from '@/components/cityNames';

export const metadata: Metadata = { title: 'India' };

export default async function IndiaPage() {
  const ds = await getDataSource();
  const season = ds.season();
  // The India board is the same for everyone (the city only labels it), so it is read alongside the rest.
  const def = cityById(DEFAULT_CITY_ID)!;
  const [summaries, viewer, national] = await Promise.all([ds.cities(), ds.viewer(), ds.board({ level: 'india', cityId: def.id, locality: def.localities[0] }, { limit: 5 })]);
  const homeCity = cityById(viewer?.member.cityId) ?? def;
  const mine = summaries.find((s) => s.cityId === homeCity.id);
  const movers = summaries.filter((s) => s.previousRank !== null && s.previousRank !== s.rank);
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">The national register / 03</div><h1>Big country.<br />Big egos.</h1></div>
        <p>Zoom out. See how the cities compare on combined Season Score, who leads the national table, and where your city stands.</p>
      </section>
      <div className="national-grid">
        <div className="national-card hero-national">
          <div><div className="eyebrow">India / {season.label}</div><h3>The country is<br />keeping score.</h3>
            <p>{summaries.length ? `City ranking by the combined Season Score of everyone on each city board.${ds.availability === 'demo' ? ' Demo data.' : ''}` : 'City comparisons appear once rankings open.'}</p></div>
          <div className="national-score">{mine ? pad2(mine.rank) : '—'}<span>{homeCity.name}&apos;s city rank</span></div>
        </div>
        <div className="national-card">
          <div className="eyebrow">01 / City index</div><h3>Who&apos;s making noise?</h3><p>Combined Season Score per city.</p>
          <div className="national-list">
            {summaries.length === 0 && <span>No city has ranked members yet.</span>}
            {summaries.map((s) => <Link key={s.cityId} href={`/board?level=city&city=${s.cityId}`}><b>{pad2(s.rank)}&nbsp; {CITY_NAMES[s.cityId]}</b><span>{inrShort(s.seasonTotal)}</span></Link>)}
          </div>
        </div>
        <div className="national-card">
          <div className="eyebrow">02 / National activity</div><h3>On the move.</h3><p>City-index changes in the last 24 hours.</p>
          <div className="national-list">
            {movers.length === 0 && <span>No city changed places in the last 24 hours.</span>}
            {movers.map((s) => <div key={s.cityId}><b>{CITY_NAMES[s.cityId]}</b><span>{s.rank < s.previousRank! ? `▲ ${s.previousRank! - s.rank}` : `▼ ${s.rank - s.previousRank!}`} {Math.abs(s.previousRank! - s.rank) === 1 ? 'place' : 'places'}</span></div>)}
          </div>
        </div>
        <div className="national-card wide board-panel">
          <div className="panel-head"><h3>India / National board</h3><Link className="textlink" href="/board?level=india">Full national board ↗</Link></div>
          <BoardList board={national} scopeLabel="India" metaMode="city" cityNames={CITY_NAMES} limit={5}
            emptyTitle={!rankingsOpen(ds) ? 'Rankings are not open yet.' : 'No one rules India yet.'} emptyText="The national board lists every ranked member across all launch cities." />
        </div>
      </div>
    </>
  );
}
