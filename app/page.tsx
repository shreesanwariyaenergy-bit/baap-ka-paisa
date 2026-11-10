import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import type { Board, BoardEvent } from '@/lib/data/types';
import { STATES, cityById, DEFAULT_CITY_ID, scopeName, type Level, type Scope } from '@/lib/geo';
import { timeLeft } from '@/lib/season';
import { inr, pad2 } from '@/lib/format';
import { RankNumber } from '@/components/RankNumber';
import { HomeBoard } from '@/components/HomeBoard';
import { CrownMoment } from '@/components/CrownMoment';
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

  // Locality spotlight: the locality with the most members in the city's top ten (from ranked rows).
  const counts = new Map<string, number>();
  cityBoard.rows.slice(0, 10).forEach((r) => counts.set(r.member.locality, (counts.get(r.member.locality) ?? 0) + 1));
  const spotlight = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const mover = events.filter((e) => e.kind === 'up').sort((a, b) => b.by - a.by)[0];
  const myCity = viewer?.standings.find((s) => s.level === 'city');
  // Rival strip: each rival's current city rank next to yours.
  const rivalNames = viewer ? (await readDemoSocial({ follows: [], rivals: (await ds.social(viewer.member.username))?.rivals.map((r) => r.member.username) ?? [], respected: {} })).rivals : [];
  const rivals = (await Promise.all(rivalNames.map(async (u) => ({ m: await ds.member(u), s: (await ds.standings(u)).find((x) => x.level === 'city') })))).filter((r) => r.m);
  const tickerItems = [
    cityBoard.total ? `${city.name}: ${cityBoard.total} on the board` : null,
    ...events.map((e) => eventText(e).ticker).filter(Boolean),
    left.closed || !rankingsOpen(ds) ? null : `${season.label} / ${left.days} days left`,
  ].filter(Boolean) as string[];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <div className="eyebrow">A little friendly pressure looks good on you</div>
          <h1 id="hero-title">Who owns<br /><span className="outline">your</span> <span className="accent">city?</span></h1>
          <div className="hero-copy">
            <p>Every neighbourhood has a pecking order. Find out who&apos;s holding it, who&apos;s moving up, and where you stand.</p>
            <Link className="btn" href={`/board?level=city&city=${city.id}`}>Enter the board <span className="arrow" aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <div className="leader-feature" data-testid="leader-feature">
          <span className="ghost" aria-hidden="true">01</span>
          <div className="feature-top"><span className="feature-label">{city.name} / City leader</span><span className="tag">{season.label}{leader ? ' · Crowned' : ''}</span></div>
          {leader ? (
            <div className="feature-main">
              <RankNumber rank={1} className="feature-rank" />
              <div className="feature-user"><b>{leader.member.masked ? leader.member.publicLabel : leader.member.displayName}</b><span>{leader.member.locality} · {city.name} · {STATES[city.state]}</span></div>
            </div>
          ) : (
            <div className="feature-empty"><h2>No one rules {city.name} yet.</h2><p>{!rankingsOpen(ds) ? 'Rankings are not open yet. The first ranked member here will hold the crown.' : 'Be the first.'}</p></div>
          )}
          <div className="feature-bottom">
            <div><strong>{leader ? inr(leader.member.seasonScore) : '—'}</strong><span>Season Score</span></div>
            <div style={{ textAlign: 'right' }}><strong style={{ fontSize: 20 }}>{!rankingsOpen(ds) ? 'Not open' : left.closed ? 'Closed' : `${left.days}D : ${pad2(left.hours)}H`}</strong><span>{rankingsOpen(ds) ? 'Until scheduled close' : 'Season status'}</span></div>
          </div>
        </div>
      </section>

      {latestMoment && (
        <CrownMoment moment={{ id: `${latestMoment.boardName}-${latestMoment.at.getTime()}`, boardName: latestMoment.boardName, toName: nm(latestMoment.to),
          fromName: latestMoment.from ? nm(latestMoment.from) : null, seasonLabel: latestMoment.seasonLabel,
          whenLabel: hoursAgo < 1 ? 'just now' : `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`, simulated: ds.availability === 'demo' }} />
      )}

      {tickerItems.length > 0 && (
        <div className="ticker" aria-label="Board summary">
          <div className="ticker-track">
            {tickerItems.map((t, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <span className="star" aria-hidden="true">✳</span>}<b>{t}</b></span>)}
          </div>
        </div>
      )}

      <div className="section-head">
        <div><p>01 / The city, right now</p><h2>{city.name} has a pecking order.</h2></div>
        <Link className="textlink" href={`/board?level=city&city=${city.id}`}>See full board ↗</Link>
      </div>
      <div className="home-grid">
        <HomeBoard boards={boards} names={names} initial="city" note={isDemo ? 'Demo data · not live' : `${season.label}`} />
        <div className="side-stack">
          <div className="activity-panel">
            <div className="activity-title"><h3>City dispatch</h3><span>Last 24 hours</span></div>
            {events.length === 0 && <p className="activity-empty">No ranking changes in {city.name} in the last 24 hours.</p>}
            {events.map((e) => { const t = eventText(e); return (
              <div className="activity" key={e.member.username + e.kind}><div className="activity-mark" aria-hidden="true">{t.mark}</div><div><p>{t.text}</p><small>{e.member.locality} · last 24 hours</small></div><em>{t.tag}</em></div>
            ); })}
          </div>
          {viewer && (
            <div className="activity-panel" data-testid="home-rivals">
              <div className="activity-title"><h3>Rival strip</h3><span>You #{myCity?.rank ? pad2(myCity.rank) : '--'}</span></div>
              {rivals.length === 0 && <p className="activity-empty">No rivals yet. Add up to five from any profile.</p>}
              {rivals.map(({ m, s }) => (
                <Link className="activity" key={m!.username} href={`/u/${encodeURIComponent(m!.username)}`}>
                  <div className="activity-mark" aria-hidden="true">{s?.rank && myCity?.rank ? (s.rank < myCity.rank ? '↑' : '↓') : '·'}</div>
                  <div><p><b>{m!.masked ? m!.publicLabel : m!.displayName}</b> is #{s?.rank ? pad2(s.rank) : '--'} in {cityById(m!.cityId)?.name}.</p><small>{s?.rank && myCity?.rank ? (s.rank < myCity.rank ? `${myCity.rank - s.rank} ahead of you` : `${s.rank - myCity.rank} behind you`) : 'Different board'}</small></div>
                  <em>Rival</em>
                </Link>
              ))}
            </div>
          )}
          <Link className="city-map" href="/cities">
            <div className="map-index">City index / {city.indexRef}</div>
            <h3>Find your<br />side of town.</h3>
            <p>{city.localities.slice(0, 3).join(', ')} and the rest of {city.name}.</p>
            <span className="map-pin" aria-hidden="true">{city.name[0]}</span>
          </Link>
        </div>
      </div>

      <div className="section-head">
        <div><p>02 / More than one throne</p><h2>Pick your territory.</h2></div>
        <Link className="textlink" href="/cities">Explore all cities ↗</Link>
      </div>
      <div className="bottom-cards">
        <div className="mini-card">
          <div className="mini-top"><span>Locality spotlight</span><span>{spotlight?.[0] ?? city.name}</span></div>
          <div>{spotlight ? <><h3>{spotlight[0]} is heating up.</h3><p>{spotlight[1]} of the top ten in {city.name} are from {spotlight[0]}.</p></> : <><h3>Every locality is open.</h3><p>No one has ranked in {city.name} yet.</p></>}</div>
          <Link className="mini-value" href={`/board?level=locality&city=${city.id}&locality=${encodeURIComponent(spotlight?.[0] ?? city.localities[0])}`}>Explore locality ↗</Link>
        </div>
        <div className="mini-card">
          <div className="mini-top"><span>Biggest mover</span><span>Last 24 hours</span></div>
          <div>{mover ? <><h3>{mover.member.masked ? mover.member.publicLabel : mover.member.displayName}</h3><p>Up {mover.by} {mover.by === 1 ? 'place' : 'places'} to #{pad2(mover.rank)} in {city.name}.</p></> : <><h3>No climbers yet.</h3><p>Nobody has moved up in {city.name} in the last 24 hours.</p></>}</div>
          {mover ? <Link className="mini-value" href={`/u/${encodeURIComponent(mover.member.username)}`}>View profile ↗</Link> : <span className="mini-value">&nbsp;</span>}
        </div>
        <div className="mini-card">
          <div className="mini-top"><span>Your position</span><span>You</span></div>
          <div>{myCity?.rank ? <><h3>You&apos;re on the board.</h3><p>Rank #{myCity.rank} of {myCity.of} in {cityById(myCity.scope.cityId)?.name}.</p></> : <><h3>Not on a board yet.</h3><p>{viewer ? 'You have not ranked this season.' : 'Sign-in is not open yet.'}</p></>}</div>
          <Link className="mini-value" href="/seal">Open The Seal ↗</Link>
        </div>
      </div>
      {isDemo && <p className="notice"><b>Demo data.</b> Every name, amount and movement on this site is invented for design review. No backend is connected and payments are off.</p>}
    </>
  );
}
