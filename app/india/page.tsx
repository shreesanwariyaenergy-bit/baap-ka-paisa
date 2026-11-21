import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { pageMetadata, pageJsonLd } from '@/lib/seo';
import Link from 'next/link';
import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
import { CITIES, cityById, DEFAULT_CITY_ID } from '@/lib/geo';

const CITY_COUNT = CITIES.length;
import { inrShort, pad2 } from '@/lib/format';
import { BoardList } from '@/components/BoardList';
import { CITY_NAMES } from '@/components/cityNames';

const SEO_TITLE = 'India: The National Table';
const SEO_DESCRIPTION = "Zoom out. See how the cities compare on combined Season Score, who leads the national table and where your city stands on BAAP KA PAISA.";

export const metadata: Metadata = pageMetadata({ title: SEO_TITLE, path: '/india', description: SEO_DESCRIPTION });

export default async function IndiaPage() {
  // Every read starts in the same round trip as the season row. The India board is the same for everyone (the city
  // only labels it); the member's own profile is one prefetched read.
  const ds = await getDataSourceEarly();
  const def = cityById(DEFAULT_CITY_ID)!;
  const [summaries, me, national] = await Promise.all([ds.cities(), ds.viewerMember(), ds.board({ level: 'india', cityId: def.id, locality: def.localities[0] }, { limit: 5 }), ds.ready()]);
  const viewer = me ? { member: me } : null;
  const season = ds.season();
  const homeCity = cityById(viewer?.member.cityId) ?? def;
  const mine = summaries.find((s) => s.cityId === homeCity.id);
  const movers = summaries.filter((s) => s.previousRank !== null && s.previousRank !== s.rank);
  const open = rankingsOpen(ds);
  // The full national view needs real data: a city with ranked members or a member on the national board.
  const hasData = summaries.length > 0 || national.total > 0;
  return (
    <>
      <JsonLd data={pageJsonLd({ name: 'India', path: '/india', description: SEO_DESCRIPTION })} />
      <section className="page-intro">
        <div><div className="eyebrow">The national register / 03</div><h1>Big country.<br />Big egos.</h1></div>
        <p>Zoom out. See how the cities compare on combined Season Score, who leads the national table, and where your city stands.</p>
      </section>
      {hasData ? (
      <div className="national-grid">
        <div className="national-card hero-national">
          <div><div className="eyebrow">India / {season.label}</div><h3>The country is<br />keeping score.</h3>
            <p>City ranking by the combined Season Score of everyone on each city board.{ds.availability === 'demo' ? ' Demo data.' : ''}</p></div>
          <div className="national-score">{mine ? pad2(mine.rank) : '—'}<span>{homeCity.name}&apos;s city rank</span></div>
        </div>
        <div className={movers.length > 0 ? 'national-card' : 'national-card span2'}>
          <div className="eyebrow">01 / City index</div><h3>Who&apos;s making noise?</h3><p>Combined Season Score per city.</p>
          <div className="national-list">
            {summaries.length === 0 && <span>No city has ranked members yet.</span>}
            {summaries.map((s) => <Link key={s.cityId} href={`/board?level=city&city=${s.cityId}`}><b>{pad2(s.rank)}&nbsp; {CITY_NAMES[s.cityId]}</b><span>{inrShort(s.seasonTotal)}</span></Link>)}
          </div>
        </div>
        {movers.length > 0 && (
          <div className="national-card">
            <div className="eyebrow">02 / National activity</div><h3>On the move.</h3><p>City-index changes in the last 24 hours.</p>
            <div className="national-list">
              {movers.map((s) => <div key={s.cityId}><b>{CITY_NAMES[s.cityId]}</b><span>{s.rank < s.previousRank! ? `▲ ${s.previousRank! - s.rank}` : `▼ ${s.rank - s.previousRank!}`} {Math.abs(s.previousRank! - s.rank) === 1 ? 'place' : 'places'}</span></div>)}
            </div>
          </div>
        )}
        <div className="national-card wide board-panel">
          <div className="panel-head"><h3>India / National board</h3><Link className="textlink" href="/board?level=india">Full national board ↗</Link></div>
          <BoardList board={national} scopeLabel="India" metaMode="city" cityNames={CITY_NAMES} limit={5}
            emptyTitle="No one rules India yet." emptyText="The national board lists every ranked member across all launch cities." />
        </div>
      </div>
      ) : (
        // Before anyone is ranked: one national section instead of four empty panels. Nothing here is a figure.
        <div className="national-grid prelaunch">
          <div className="national-card hero-national" data-testid="india-prelaunch">
            <div>
              <div className="eyebrow">India / {open ? season.label : 'Season 1 opening soon'}</div>
              <h3>{open ? 'No one rules India yet.' : 'The national table opens with Season 1.'}</h3>
              <p>{open ? 'The first members on any city board start the national table.' : 'When rankings open, this page ranks the cities by the combined Season Score on each city board, shows which cities moved in the last 24 hours and lists the national board.'}</p>
              <div className="hero-cta" style={{ marginTop: 18 }}>
                {me ? <Link className="btn light" href="/seal">Open The Seal <span className="arrow" aria-hidden="true">↗</span></Link>
                  : <Link className="btn light" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link>}
                <Link className="btn light" href="/cities">Explore the {CITY_COUNT} cities</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
