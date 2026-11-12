import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import type { Board, BoardEvent } from '@/lib/data/types';
import { CITIES, STATES, cityById, DEFAULT_CITY_ID, scopeName, type Level, type Scope } from '@/lib/geo';
import { timeLeft } from '@/lib/season';
import { inr, pad2 } from '@/lib/format';
import { HomeBoard } from '@/components/HomeBoard';
import { CrownMoment } from '@/components/CrownMoment';
import { buildEdition } from '@/lib/gazette';
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

export default async function ScenePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const season = ds.season();
  const left = timeLeft(season, ds.now());
  const viewer = await ds.viewer();
  const city = cityById(sp.city) ?? cityById(viewer?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
  const locality = viewer && viewer.member.cityId === city.id ? viewer.member.locality : city.localities[0];
  const scopes = Object.fromEntries(LEVELS.map((l) => [l, { level: l, cityId: city.id, locality } satisfies Scope])) as Record<Level, Scope>;
  const boards = Object.fromEntries(await Promise.all(LEVELS.map(async (l) => [l, await ds.board(scopes[l], { limit: 10 })] as const))) as Record<Level, Board>;
  const names = Object.fromEntries(LEVELS.map((l) => [l, scopeName(scopes[l])])) as Record<Level, string>;
  const cityBoard = boards.city;
  const leader = cityBoard.rows[0];
  const events = await ds.events(scopes.city, 3);
  // Crown Moment: the newest #01 change on this city board in the last 24 hours.
  const latestMoment = (await ds.crownMoments(scopes.city, new Date(ds.now().getTime() - 86_400_000)))[0];
  const nm = (m: PublicMember) => (m.masked ? m.publicLabel : m.displayName ?? m.username);
  const hoursAgo = latestMoment ? Math.max(0, Math.round((ds.now().getTime() - latestMoment.at.getTime()) / 3_600_000)) : 0;
  const isDemo = ds.availability === 'demo';
  const open = rankingsOpen(ds);
  const [summaries, reign, archive] = await Promise.all([ds.cities(), ds.throneHistory({ scope: scopes.city, limit: 1 }), ds.archive()]);
  const second = cityBoard.rows[1];
  const ranked = new Set(boards.city.rows.map((r) => r.member.locality));

  const edition = buildEdition({ city, season, now: ds.now(), open, board: cityBoard, reigns: await ds.throneHistory({ scope: scopes.city, limit: 40 }), moments: latestMoment ? [latestMoment] : [], events, cities: summaries, respect: await ds.respectBoard(scopes.city, { limit: 1 }) });
  const myCity = viewer?.standings.find((s) => s.level === 'city');
  // Rival strip: each rival's current city rank next to yours.
  const rivalNames = viewer ? (await readDemoSocial({ follows: [], rivals: (await ds.social(viewer.member.username))?.rivals.map((r) => r.member.username) ?? [], respected: {} })).rivals : [];
  const rivals = (await Promise.all(rivalNames.map(async (u) => ({ m: await ds.member(u), s: (await ds.standings(u)).find((x) => x.level === 'city') })))).filter((r) => r.m);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <div className="hero-tags">
            <span className="tagchip dark">{open ? season.label : 'Season 1 opening soon'}</span>
            <span className="tagchip">{city.name} · {STATES[city.state]}</span>
            {isDemo && <span className="tagchip hot">Demo data</span>}
          </div>
          <h1 id="hero-title">Who owns<br /><span className="outline">your city?</span></h1>
          <p className="hero-sub">Your city. Your rank. <b>Your place on the register.</b> India&apos;s public status board, ranked by locality, city, state and country.</p>
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
        </aside>
      </section>
      <Link className="gz-strip" href={`/gazette?city=${city.id}`} data-testid="gazette-strip">
        <small>The {city.name} Gazette</small><b>{edition.lead.headline}</b><span>Read today&apos;s edition ↗</span>
      </Link>

      {latestMoment && (
        <CrownMoment moment={{ id: `${latestMoment.boardName}-${latestMoment.at.getTime()}`, boardName: latestMoment.boardName, toName: nm(latestMoment.to),
          fromName: latestMoment.from ? nm(latestMoment.from) : null, seasonLabel: latestMoment.seasonLabel,
          whenLabel: hoursAgo < 1 ? 'just now' : `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`, simulated: isDemo }} autoPlay={!!viewer} />
      )}

      <div className="section-head"><div><p>The throne</p><h2>Who holds {city.name} right now</h2></div>
        <Link className="textlink" href={`/throne?level=city&city=${city.id}`}>Throne history ↗</Link></div>
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
            <p style={{ margin: 0, maxWidth: '52ch' }}>{open ? 'The first ranked member takes the crown.' : 'Rankings are not open yet. Create your profile now and be on the register before Season 1 opens.'}</p>
            <div className="acts"><Link className="btn" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link></div></div>
        </div>
      )}

      <div className="section-head"><div><p>The board</p><h2>{city.name}&apos;s pecking order</h2></div>
        <Link className="textlink" href={`/board?level=city&city=${city.id}`}>See full board ↗</Link></div>
      <div className="home-grid">
        <HomeBoard boards={boards} names={names} initial="city" note={isDemo ? 'Demo data · not live' : season.label} />
        <div className="side-stack">
          <div className="activity-panel">
            <div className="activity-title"><h3>Rank movement</h3><span>Last 24 hours</span></div>
            {events.length === 0 && <p className="activity-empty">No ranking changes in {city.name} in the last 24 hours.</p>}
            {events.map((e) => { const t = eventText(e); return (
              <div className="activity" key={e.member.username + e.kind}><div className="activity-mark" aria-hidden="true">{t.mark}</div><div><p>{t.text}</p><small>{e.member.locality} · last 24 hours</small></div><em>{t.tag}</em></div>
            ); })}
          </div>
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
      </div>

      <div className="section-head"><div><p>Territories</p><h2>Pick your ground</h2></div>
        <Link className="textlink" href="/cities">All cities ↗</Link></div>
      <div className="terr-grid">
        {CITIES.map((c) => { const sm = summaries.find((x) => x.cityId === c.id); return (
          <Link className="terr" key={c.id} href={`/?city=${c.id}`} aria-current={c.id === city.id ? 'true' : undefined} scroll={false}>
            <small>{STATES[c.state]}</small><b>{c.name}</b>
            <span>{sm ? `${sm.members} ranked · #${pad2(sm.rank)} city` : 'Open territory'}</span>
          </Link>
        ); })}
      </div>
      <div className="loc-chips" aria-label={`Localities in ${city.name}`}>
        {city.localities.filter((l) => l !== 'Other').map((l) => (
          <Link key={l} href={`/board?level=locality&city=${city.id}&locality=${encodeURIComponent(l)}`} className={ranked.has(l) ? '' : 'open'}>{l}{ranked.has(l) ? '' : ' · unclaimed'}</Link>
        ))}
      </div>

      <div className="section-head"><div><p>The Seal</p><h2>Your permanent identity</h2></div></div>
      <div className="seal-intro">
        <div className="member-preview" aria-hidden="true">
          <small>BAAP KA PAISA · The Seal</small>
          <span>Member ID</span>
          <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--lime)', fontSize: 40, letterSpacing: '.08em' }}>{viewer?.member.memberNo ? String(viewer.member.memberNo).padStart(5, '0') : '— — — — —'}</b>
          <b>{viewer ? nm(viewer.member) : 'Your name here'}</b>
          <span>{viewer ? `${viewer.member.locality}, ${cityById(viewer.member.cityId)?.name}` : `${city.localities[0]}, ${city.name}`} · {season.label}</span>
        </div>
        <div>
          <h3>The number stays. The rank moves.</h3>
          <ul>
            <li>A permanent member ID that never changes.</li>
            <li>Your live rank on all four boards, updated as it moves.</li>
            <li>Every crown, streak and achievement you earn, kept for good.</li>
            <li>A story-sized card to post on Instagram and WhatsApp.</li>
          </ul>
          <Link className="btn" href={viewer ? '/seal' : '/join'}>{viewer ? 'Open The Seal' : 'Get your Seal'} <span className="arrow" aria-hidden="true">↗</span></Link>
        </div>
      </div>

      <div className="section-head"><div><p>The season</p><h2>Monthly reset. Permanent record.</h2></div>
        <Link className="textlink" href="/archive">Open the archive ↗</Link></div>
      <div className="season-band">
        <div><small>Now</small><b>{open ? season.label : 'Not open'}</b><span>{open ? season.monthLabel : 'Season 1 has not started'}</span></div>
        <div><small>Closes in</small><b>{!open ? '—' : left.closed ? 'Closed' : `${left.days}d ${pad2(left.hours)}h`}</b><span>Last-minute overtakes extend the close by 15 minutes</span></div>
        <div><small>Then</small><b>Boards reset</b><span>Every throne is empty again on the 1st</span></div>
        <div><small>Forever</small><b>{archive.length} {archive.length === 1 ? 'season' : 'seasons'} archived</b><span><Link href="/board?view=hall">Hall of Fame</Link> and <Link href="/archive">past champions</Link></span></div>
      </div>
    </>
  );
}
