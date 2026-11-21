import Link from 'next/link';
import type { Metadata } from 'next';
import { HOME_TITLE, ORGANIZATION_JSON_LD, WEBSITE_JSON_LD, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
import type { Board, BoardEvent, CitySummary } from '@/lib/data/types';
import { Suspense } from 'react';
import { CITIES, STATES, cityById, DEFAULT_CITY_ID, featuredCities, scopeName, type Level, type Scope } from '@/lib/geo';
import { timeLeft } from '@/lib/season';
import { inr, pad2 } from '@/lib/format';
import { HomeBoard } from '@/components/HomeBoard';
import { CrownMoment } from '@/components/CrownMoment';
import { buildEdition } from '@/lib/gazette';
import { ThronePrice } from '@/components/ThronePrice';
import { CrownMark } from '@/components/Crown';
import { readDemoSocial } from '@/lib/demo-social';
import type { PublicMember } from '@/lib/data/types';

const LEVELS: Level[] = ['locality', 'city', 'state', 'india'];

function eventText(e: BoardEvent) {
  const who = e.member.masked ? e.member.publicLabel : e.member.displayName;
  const where = scopeName(e.scope);
  if (e.kind === 'took') return { mark: '✳', text: <><b>{who}</b> took #01 in {where}.</>, tag: '#01', ticker: `${who} took #01 in ${where}` };
  if (e.kind === 'up') return { mark: '↑', text: <><b>{who}</b> climbed {e.by} {e.by === 1 ? 'spot' : 'spots'} to #{pad2(e.rank)}.</>, tag: `+${e.by}`, ticker: `${e.member.locality} moved +${e.by}` };
  if (e.kind === 'down') return { mark: '↓', text: <><b>{who}</b> slipped {e.by} to #{pad2(e.rank)}.</>, tag: `−${e.by}`, ticker: '' };
  return { mark: '+', text: <><b>{who}</b> entered the board at #{pad2(e.rank)}.</>, tag: 'New', ticker: `${e.member.locality} has a new entry` };
}

export const metadata: Metadata = {
  ...pageMetadata({
    path: '/',
    description: 'Who owns the throne? Discover locality, city, state and national rankings on BAAP KA PAISA. Explore your city, follow the competition and see who holds the top position.',
  }),
  title: { absolute: HOME_TITLE },
};

export default async function ScenePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const sp = await searchParams;
  // Reads start in the same round trip as the season row. Only the member's own profile (one prefetched read)
  // is needed before them, to pick the city; the full viewer (standings) is read alongside the rest.
  const ds = await getDataSourceEarly();
  const me = await ds.viewerMember();
  const city = cityById(sp.city) ?? cityById(me?.cityId) ?? cityById(DEFAULT_CITY_ID)!;
  const locality = me && me.cityId === city.id ? me.locality : city.localities[0];
  const scopes = Object.fromEntries(LEVELS.map((l) => [l, { level: l, cityId: city.id, locality } satisfies Scope])) as Record<Level, Scope>;
  // Every read below depends only on the city, so they run together: the page waits for the slowest, not the sum.
  const since = new Date(ds.now().getTime() - 86_400_000);
  // The city summaries (45 cities) are the slowest read and only feed the Gazette headline and the featured
  // cities: they stream into those two sections instead of holding back the whole page.
  const summariesP = ds.cities();
  const [boardList, events, moments, reigns, archive, respect, declared, mySocial, viewer] = await Promise.all([
    Promise.all(LEVELS.map((l) => ds.board(scopes[l], { limit: 10 }))), ds.events(scopes.city, 3), ds.crownMoments(scopes.city, since),
    ds.throneHistory({ scope: scopes.city, limit: 40 }), ds.archive(), ds.respectBoard(scopes.city, { limit: 1 }),
    ds.declarations({ cityId: city.id }), me ? ds.social(me.username) : null, ds.viewer(), ds.ready(),
  ]);
  const season = ds.season();
  const left = timeLeft(season, ds.now());
  const boards = Object.fromEntries(LEVELS.map((l, n) => [l, boardList[n]])) as Record<Level, Board>;
  const names = Object.fromEntries(LEVELS.map((l) => [l, scopeName(scopes[l])])) as Record<Level, string>;
  const cityBoard = boards.city;
  const leader = cityBoard.rows[0];
  // Crown Moment: the newest #01 change on this city board in the last 24 hours.
  const latestMoment = moments[0];
  const nm = (m: PublicMember) => (m.masked ? m.publicLabel : m.displayName ?? m.username);
  const hoursAgo = latestMoment ? Math.max(0, Math.round((ds.now().getTime() - latestMoment.at.getTime()) / 3_600_000)) : 0;
  const isDemo = ds.availability === 'demo';
  const open = rankingsOpen(ds);
  const reign = reigns.slice(0, 1);
  const second = cityBoard.rows[1];
  // Board preview and side panels are shown only when they have something to show.
  const anyRanked = LEVELS.some((l) => boards[l].rows.length > 0);
  const hasSide = events.length > 0 || !!viewer;

  const editionInput = { city, season, now: ds.now(), open, board: cityBoard, reigns, moments: latestMoment ? [latestMoment] : [], events, respect };
  const myCity = viewer?.standings.find((s) => s.level === 'city');
  // Rival strip: each rival's current city rank next to yours.
  const rivalNames = viewer ? (await readDemoSocial({ follows: [], rivals: mySocial?.rivals.map((r) => r.member.username) ?? [], respected: {} })).rivals : [];
  const rivals = (await Promise.all(rivalNames.map(async (u) => { const [m, st] = await Promise.all([ds.member(u), ds.standings(u)]); return { m, s: st.find((x) => x.level === 'city') }; }))).filter((r) => r.m);

  return (
    <>
      <JsonLd data={ORGANIZATION_JSON_LD} />
      <JsonLd data={WEBSITE_JSON_LD} />
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <div className="hero-tags">
            <span className="tagchip dark">{open ? season.label : 'Season 1 opening soon'}</span>
            <span className="tagchip">{city.name} · {STATES[city.state]}</span>
            {isDemo && <span className="tagchip hot">Demo data</span>}
          </div>
          <h1 id="hero-title">Who owns<br /><span className="outline">the throne?</span></h1>
          <p className="hero-sub"><span className="hero-sub-key">Your city. Your rank. <b>Your throne.</b></span> The public status register, ranked by locality, city, state and India.</p>
          <div className="hero-cta">
            {viewer
              ? <Link className="btn" href="/seal" data-testid="hero-primary">Open The Seal <span className="arrow" aria-hidden="true">↗</span></Link>
              : <Link className="btn" href="/join" data-testid="hero-primary">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link>}
            <Link className="btn light" href={`/board?level=city&city=${city.id}`} data-testid="hero-secondary">Explore the board</Link>
          </div>
          <p className="hero-note">Free to join · 18+ · no prizes, no cash-outs, just the record</p>
        </div>
        <aside className="how-card" aria-label="How it works">
          <h2>How the register works</h2>
          <ol>
            <li><div><b>Claim your territory</b><span>Create a profile, pick your city and locality, get a permanent member ID.</span></div></li>
            <li><div><b>Take a rank</b><span>One entry places you on four boards at once: locality, city, state, India.</span></div></li>
            <li><div><b>Hold it or lose it</b><span>Anyone can pass you. Boards reset monthly; your record stays forever.</span></div></li>
          </ol>
          <Link className="how-more" href="/how-it-works">How the register works, in full ↗</Link>
        </aside>
      </section>
      {open && season.endsAt.getTime() - ds.now().getTime() < 86_400_000 && (
        <Link className="gz-strip" href={`/closing?city=${city.id}`} data-testid="closing-strip"><small>The Closing</small><b>The board closes within a day. Watch the final stretch.</b><span>Open ↗</span></Link>
      )}

      {latestMoment && (
        <CrownMoment moment={{ id: `${latestMoment.boardName}-${latestMoment.at.getTime()}`, boardName: latestMoment.boardName, toName: nm(latestMoment.to),
          fromName: latestMoment.from ? nm(latestMoment.from) : null, seasonLabel: latestMoment.seasonLabel,
          whenLabel: hoursAgo < 1 ? 'just now' : `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`, simulated: isDemo }} autoPlay={!!viewer} />
      )}

      {/* The competition: who holds the city, and its board. One section; before anyone is ranked it is one panel. */}
      <div className="section-head"><div><p>The competition</p><h2>Who holds {city.name} right now</h2></div>
        <Link className="textlink" href={`/board?level=city&city=${city.id}`}>See the full board ↗</Link></div>
      {leader ? (
        <div className="throne" data-testid="leader-feature">
          <div className="big01"><CrownMark size="large" /><b aria-hidden="true">01</b><span className="sr-only">Rank 01, current number-one holder</span></div>
          <div className="who">
            <small>#01 in {city.name} · {season.label}</small>
            <h3>{nm(leader.member)}</h3>
            <p style={{ margin: 0 }}>{leader.member.locality}, {city.name}{leader.member.flexLine ? ` · “${leader.member.flexLine}”` : ''}</p>
            <div className="acts">
              <Link className="btn light" href={`/u/${encodeURIComponent(leader.member.username)}`}>View profile</Link>
              {second && <Link className="btn light" href={`/vs/${encodeURIComponent(leader.member.username)}/${encodeURIComponent(second.member.username)}`}>#01 vs #02</Link>}
              <Link className="textlink" href={`/throne?level=city&city=${city.id}`}>Throne history ↗</Link>
            </div>
          </div>
          <div className="facts side">
            <div><span>Season Score</span><b>{inr(leader.member.seasonScore)}</b></div>
            {second && <div><span>Lead over #02</span><b>{inr(leader.member.seasonScore - second.member.seasonScore)}</b></div>}
            {second && <div><span>To take #01</span><b>{inr(leader.member.seasonScore + 500)}</b></div>}
            {reign[0]?.current && <div><span>Held for</span><b>{reign[0].hours >= 48 ? `${Math.floor(reign[0].hours / 24)} days` : `${reign[0].hours} hours`}</b></div>}
          </div>
        </div>
      ) : (
        <div className="throne empty" data-testid="leader-feature">
          <div className="who"><small>{city.name} · unclaimed</small><h3>No one rules {city.name} yet.</h3>
            <p style={{ margin: 0, maxWidth: '52ch' }}>{open
              ? `The first ranked member takes the crown. The ${city.name} board fills as members are ranked.`
              : 'Rankings open with Season 1. Create your profile now and you are on the register the day it starts: locality, city, state and India boards at once.'}</p>
            <div className="acts">
              {viewer
                ? <Link className="btn" href="/seal">Open The Seal <span className="arrow" aria-hidden="true">↗</span></Link>
                : <Link className="btn" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link>}
              <Link className="btn light" href={`/board?level=city&city=${city.id}`}>See the {city.name} board</Link>
            </div></div>
        </div>
      )}

      {open && (
        <div className="decl-below" style={{ margin: '26px 0 0' }}>
          <ThronePrice place={city.name} holder={leader ? nm(leader.member) : null} holderScore={leader?.member.seasonScore ?? 0} myScore={viewer && viewer.member.cityId === city.id ? viewer.member.seasonScore : undefined} signedIn={!!viewer} />
          <div className="history" style={{ marginTop: 0 }} data-testid="home-declarations">
            <h3>Declared for {city.name}</h3>
            {declared.length === 0 && <p style={{ margin: 0 }}>Nobody has put it in writing yet. A declaration is a numbered public notice that you are coming for the throne.</p>}
            {declared.slice(0, 3).map((d) => (
              <Link className="history-row" key={d.id} href={`/declare/${d.id}`}><b style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{d.no.split('/').pop()}</b><span>{nm(d.challenger)} vs {nm(d.holder)}</span><small>{d.status === 'won' ? 'Made good' : d.status === 'standing' ? 'Standing' : d.status === 'lapsed' ? 'Lapsed' : 'Throne moved'}</small></Link>
            ))}
          </div>
        </div>
      )}

      {/* Board preview, rank movement and rivals appear only when there is something on them. */}
      {anyRanked && (
        <div className={hasSide ? 'home-grid' : 'home-grid solo'} style={{ marginTop: 26 }}>
          <HomeBoard boards={boards} names={names} initial="city" note={isDemo ? 'Demo data · not live' : season.label} />
          {hasSide && (
            <div className="side-stack">
              {events.length > 0 && (
                <div className="activity-panel">
                  <div className="activity-title"><h3>Rank movement</h3><span>Last 24 hours</span></div>
                  {events.map((e) => { const t = eventText(e); return (
                    <div className="activity" key={e.member.username + e.kind}><div className="activity-mark" aria-hidden="true">{t.mark}</div><div><p>{t.text}</p><small>{e.member.locality} · last 24 hours</small></div><em>{t.tag}</em></div>
                  ); })}
                </div>
              )}
              {viewer && (
                <div className="activity-panel" data-testid="home-rivals">
                  <div className="activity-title"><h3>Your rivals</h3><span>You #{myCity?.rank ? pad2(myCity.rank) : '--'}</span></div>
                  {rivals.length === 0 && <p className="activity-empty">No rivals yet. Add up to five from any profile.</p>}
                  {rivals.map(({ m, s }) => (
                    <Link className="activity" key={m!.username} href={`/vs/${encodeURIComponent(viewer.member.username)}/${encodeURIComponent(m!.username)}`}>
                      <div className="activity-mark" aria-hidden="true">{s?.rank && myCity?.rank ? (s.rank < myCity.rank ? '↑' : '↓') : '·'}</div>
                      <div><p><b>{nm(m!)}</b> is #{s?.rank ? pad2(s.rank) : '--'} in {cityById(m!.cityId)?.name}.</p><small>{s?.rank && myCity?.rank ? (s.rank < myCity.rank ? `${myCity.rank - s.rank} ahead of you` : `${s.rank - myCity.rank} behind you`) : 'Different board'}</small></div>
                      <em>VS</em>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Explore cities: six featured cities and the way to all 45. Localities are found inside each city. */}
      <div className="section-head"><div><p>Territories</p><h2>Pick your ground</h2></div>
        <Link className="textlink" href="/cities">All {CITIES.length} cities ↗</Link></div>
      <Suspense fallback={<FeaturedCitiesView viewerCityId={me?.cityId ?? null} currentCityId={city.id} summaries={null} />}>
        <FeaturedCities summariesP={summariesP} viewerCityId={me?.cityId ?? null} currentCityId={city.id} />
      </Suspense>
      <Link className="btn explore-cities" href="/cities" data-testid="explore-cities">Explore all {CITIES.length} cities <span className="arrow">→</span></Link>

      <div className="section-head"><div><p>The Seal</p><h2>Your permanent identity</h2></div></div>
      <div className="seal-intro">
        <div className="member-preview" aria-hidden="true">
          <small>BAAP KA PAISA · The Seal</small>
          <span>Member ID</span>
          <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--lime)', fontSize: 40, letterSpacing: '.08em' }}>{viewer?.member.memberNo ? String(viewer.member.memberNo).padStart(5, '0') : '— — — — —'}</b>
          <b>{viewer ? nm(viewer.member) : 'Your name here'}</b>
          <span>{viewer ? `${viewer.member.locality}, ${cityById(viewer.member.cityId)?.name}` : `${city.localities[0]}, ${city.name}`}{open ? ` · ${season.label}` : ''}</span>
        </div>
        <div>
          <h3>The number stays. The rank moves.</h3>
          <ul>
            <li>A permanent member ID that never changes.</li>
            <li>Your live rank on all four boards, reset every season.</li>
            <li>Every crown and achievement you earn, kept for good.</li>
          </ul>
          <Link className="btn" href={viewer ? '/seal' : '/join'}>{viewer ? 'Open The Seal' : 'Get your Seal'} <span className="arrow" aria-hidden="true">↗</span></Link>
        </div>
      </div>

      {/* One supporting module. Season open: today's Gazette and the close. Before Season 1: how a season works. */}
      <div className="section-head"><div><p>The season</p><h2>Monthly reset. Permanent record.</h2></div>
        {archive.length > 0 && <Link className="textlink" href="/archive">Open the archive ↗</Link>}</div>
      {open && (
        <Suspense fallback={<GazetteStripView cityId={city.id} cityName={city.name} headline={'\u00a0'} pending />}>
          <GazetteStrip summariesP={summariesP} input={editionInput} />
        </Suspense>
      )}
      <div className={`season-band${open ? '' : ' prelaunch'}`} data-testid="season-band">
        {open ? (
          <>
            <div><small>Now</small><b>{season.label}</b><span>{season.monthLabel}</span></div>
            <div><small>Closes in</small><b>{left.closed ? 'Closed' : `${left.days}d ${pad2(left.hours)}h`}</b><span>Taking a #01 in the last 15 minutes extends the close by 15 minutes</span></div>
            <div><small>Then</small><b>Boards reset</b><span>Every throne is empty again on the 1st</span></div>
            <div><small>Forever</small><b>{archive.length} {archive.length === 1 ? 'season' : 'seasons'} archived</b><span><Link href="/board?view=hall">Hall of Fame</Link> and <Link href="/archive">past champions</Link></span></div>
          </>
        ) : (
          <>
            <div><small>Every month</small><b>A new season</b><span>Boards reset on the 1st and every throne is empty again.</span></div>
            <div><small>The final 15 minutes</small><b>No sniping</b><span>Taking a #01 in the last 15 minutes extends the close by 15 minutes.</span></div>
            <div><small>Forever</small><b>The record stays</b><span>Final standings and every past champion are kept in the archive.</span></div>
          </>
        )}
      </div>
    </>
  );
}

// ---- Sections fed by the city summaries, streamed so the rest of the page does not wait for them ----
type EditionInput = Omit<Parameters<typeof buildEdition>[0], 'cities'>;
// Placeholders (pending) carry no test id: while a streamed section is swapped in, both briefly exist in the page.
function GazetteStripView({ cityId, cityName, headline, pending = false }: { cityId: string; cityName: string; headline: string; pending?: boolean }) {
  return (
    <Link className="gz-strip" href={`/gazette?city=${cityId}`} data-testid={pending ? undefined : 'gazette-strip'}>
      <small>The {cityName} Gazette</small><b>{headline}</b><span>Read today&apos;s edition ↗</span>
    </Link>
  );
}
async function GazetteStrip({ summariesP, input }: { summariesP: Promise<CitySummary[]>; input: EditionInput }) {
  const edition = buildEdition({ ...input, cities: await summariesP });
  return <GazetteStripView cityId={input.city.id} cityName={input.city.name} headline={edition.lead.headline} />;
}
function FeaturedCitiesView({ viewerCityId, currentCityId, summaries }: { viewerCityId: string | null; currentCityId: string; summaries: CitySummary[] | null }) {
  return (
    <div className="terr-grid" data-testid={summaries ? 'featured-cities' : undefined} aria-busy={summaries ? undefined : true}>
      {featuredCities({ viewerCityId, currentCityId, summaries: summaries ?? [] }).map((c) => { const sm = summaries?.find((x) => x.cityId === c.id); return (
        <Link className="terr" key={c.id} href={`/?city=${c.id}`} aria-current={c.id === currentCityId ? 'true' : undefined} scroll={false}>
          <small>{STATES[c.state]}</small><b>{c.name}</b>
          <span>{!summaries ? '\u00a0' : sm ? `${sm.members} ranked · #${pad2(sm.rank)} city` : 'Open territory'}</span>
        </Link>
      ); })}
    </div>
  );
}
async function FeaturedCities({ summariesP, viewerCityId, currentCityId }: { summariesP: Promise<CitySummary[]>; viewerCityId: string | null; currentCityId: string }) {
  return <FeaturedCitiesView viewerCityId={viewerCityId} currentCityId={currentCityId} summaries={await summariesP} />;
}
