import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource } from '@/lib/data';
import { LEVEL_LABEL, STATES, cityById, scopeName } from '@/lib/geo';
import { inr, memberNo, pad2 } from '@/lib/format';
import { Seal } from '@/components/Seal';
import { SealShare } from '@/components/SealShare';
import { movementLabel } from '@/components/movement';
import { profileQr } from '@/lib/qr';
import { groupAchievements } from '@/lib/achievements';
import { strongestClaim } from '@/lib/claim';
import { Crown, PastChampionMark } from '@/components/Crown';

export const metadata: Metadata = { title: 'The Seal' };

export default async function SealPage() {
  const ds = await getDataSource();
  const season = ds.season();
  const viewer = await ds.viewer();
  const intro = (
    <section className="page-intro">
      <div><div className="eyebrow">Permanent member identity / 04</div><h1>The Seal.<br />Your status.</h1></div>
      <p>The Seal is your permanent member identity. Your number stays; your rank, achievements and history change with every season. It is a membership credential, not an official identity document.</p>
    </section>
  );
  if (!viewer) {
    return (
      <>
        {intro}
        <div className="board-panel" style={{ margin: '26px 0 70px' }}>
          <div className="state-box" data-testid="seal-signed-out"><h4>Your Seal is waiting.</h4>
            <p>The Seal is issued the moment you create your profile: a permanent member ID, your live rank and every achievement you earn.</p>
            <div className="hero-cta" style={{ marginTop: 16 }}><Link className="btn" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link><Link className="btn light" href="/signin">Sign in</Link></div></div>
        </div>
      </>
    );
  }
  const m = viewer.member;
  const city = cityById(m.cityId)!;
  const cityStanding = viewer.standings.find((s) => s.level === 'city');
  const name = m.masked ? m.publicLabel : m.displayName ?? m.username;
  const mv = movementLabel(viewer.cityMovement);
  const [qr, achievements, reigns] = await Promise.all([profileQr(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 20 })]);
  const grouped = groupAchievements(achievements);
  const claim = strongestClaim({ standings: viewer.standings, achievements, reigns: await ds.throneHistory({ username: m.username, limit: 100 }) });
  const backing = await ds.backing(m.username);
  const contenders = backing && !backing.pick ? await ds.mostBacked(m.cityId, 3) : [];
  const nm2 = (x: { masked: boolean; publicLabel: string; displayName: string | null; username: string }) => (x.masked ? x.publicLabel : x.displayName ?? x.username);
  const finishes = [cityStanding?.rank ?? null, ...viewer.record.map((r) => r.cityRank)].filter((n): n is number => !!n);
  const best = finishes.length ? Math.min(...finishes) : null;
  const istDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return (
    <>
      {intro}
      <p style={{ margin: '18px 0 0' }}><Link className="textlink" href={`/bill/${encodeURIComponent(m.username)}`} data-testid="seal-bill-link">Your Bill ↗</Link></p>
      {(claim || backing) && (
        <div style={{ margin: '22px 0 0' }}>
          {claim && <div className="claim" data-testid="seal-claim">{claim.headline}<small>Your strongest claim · {claim.proof}</small></div>}
          {backing && (
            <div className="pick-card" data-testid="pick-card">
              <small>Backing · {backing.seasonLabel} · {backing.backers} backing you</small>
              {backing.pick ? (<>
                <h3>Your pick: <Link href={`/u/${encodeURIComponent(backing.pick.member.username)}`}>{nm2(backing.pick.member)}</Link> is {backing.pick.cityRank === 1 ? 'holding #01' : backing.pick.cityRank ? `#${String(backing.pick.cityRank).padStart(2, '0')}` : 'off the board'}</h3>
                <p>{backing.pick.cityRank === 1 ? 'If it stays that way at the closing, “Backed the Crown” goes on your Seal for good.' : backing.pick.cityRank ? `${inr(backing.pick.gapToFirst)} behind #01. Your backing is locked; all you can do now is watch, or send them this.` : 'Your backing is locked for the season.'}</p>
              </>) : (<>
                <h3>You have not backed anyone</h3>
                <p>One backing per season, locked once given. Back the member you think takes {city.name}{contenders.length ? ': ' : '.'}{contenders.map((c, n) => <span key={c.member.username}>{n ? ', ' : ''}<Link href={`/u/${encodeURIComponent(c.member.username)}`}>{nm2(c.member)}</Link> ({c.backers})</span>)}{contenders.length ? '.' : ''}</p>
              </>)}
              {backing.history.length > 0 && <p><small>Past seasons: {backing.history.map((h) => `${h.seasonLabel.replace('Season ', 'S')} ${nm2(h.member)}${h.crowned ? ' — took the crown' : h.finalRank ? ` — finished #${h.finalRank}` : ''}`).join(' · ')}</small></p>}
            </div>
          )}
        </div>
      )}
      <div className="profile-wrap">
        <div>
          <Seal
            front={{ brandLine: 'The Seal / permanent identity', memberNo: memberNo(m.memberNo), name, location: `${m.locality} · ${city.name} · ${STATES[city.state]} · India`,
              rank: cityStanding?.rank ? `${cityStanding.rank === 1 ? '' : '#'}${pad2(cityStanding.rank)}` : '—', rankIsFirst: cityStanding?.rank === 1,
              scopeLine: cityStanding?.rank ? `#${cityStanding.rank} of ${cityStanding.of} in ${city.name}` : `Not ranked in ${city.name} this season`, season: `${season.label} / ${season.monthLabel}`, marks: grouped.slice(0, 3).map((g) => g.label) }}
            back={{ memberNo: memberNo(m.memberNo), lifetime: inr(viewer.lifetimeScore), bestRank: best ? `#${pad2(best)}` : undefined,
              territory: viewer.standings.filter((s) => s.level !== 'city').map((s) => ({ label: s.level === 'india' ? 'India' : scopeName(s.scope), rank: s.rank ? `#${pad2(s.rank)}` : '—' })),
              records: viewer.record.map((r) => ({ rank: r.cityRank ? `#${pad2(r.cityRank)}` : '—', text: `${city.name} city finish${r.note ? ` · ${r.note}` : ''}`, when: `${r.seasonLabel.replace('Season ', 'S')} · ${r.monthLabel}` })),
              insignia: grouped.map((g) => (g.count > 1 && g.id !== 'streak' ? `${g.label} ×${g.count}` : g.label)),
              qr: { svg: qr.svg, caption: qr.placeholder ? 'Placeholder link until the domain is confirmed' : 'Public profile' } }}
          />
          <div className="history">
            <h3>How the story moved</h3>
            <div className="history-row"><b>{cityStanding?.rank ? `#${pad2(cityStanding.rank)}` : '—'}</b><span>Current {city.name} position</span><small>Now</small></div>
            {viewer.record.map((r) => <div className="history-row" key={r.seasonLabel}><b>{r.cityRank ? `#${pad2(r.cityRank)}` : '—'}</b><span>Finished {r.seasonLabel.toLowerCase()} in {city.name}{r.note ? `. ${r.note}.` : ''}</span><small>{r.monthLabel}</small></div>)}
            <div className="history-row"><b>No.</b><span>Member no. {memberNo(m.memberNo)} since {viewer.memberSince}. The member number never changes.</span><small>Joined</small></div>
          </div>
        </div>
        <div>
          <div className="profile-stats">
            <div className="stat-box"><span>City position</span><strong>{cityStanding?.rank ? `#${pad2(cityStanding.rank)}` : '—'}</strong><small>{city.name}</small></div>
            <div className="stat-box"><span>Season Score</span><strong>{inr(m.seasonScore)}</strong><small>{season.label}</small></div>
            <div className="stat-box"><span>Lifetime Score</span><strong>{inr(viewer.lifetimeScore)}</strong><small>{m.lifetimeTier ? `${m.lifetimeTier} tier · never resets` : 'Never resets'}</small></div>
            <div className="stat-box"><span>Movement</span><strong style={{ color: 'var(--forest-2)' }}>{mv.text === '●' ? 'Held' : mv.text || '—'}</strong><small>{city.name}, last 24 hours</small></div>
          </div>
          <div className="history">
            <h3>Territory standing</h3>
            {viewer.standings.map((s) => (
              <Link className="history-row" key={s.level} href={`/board?level=${s.level}&city=${m.cityId}${s.level === 'locality' ? `&locality=${encodeURIComponent(m.locality)}` : ''}`}>
                <b>{s.rank ? `#${pad2(s.rank)}` : '#--'}</b><span>{s.level === 'india' ? 'India / National' : `${scopeName(s.scope)} / ${LEVEL_LABEL[s.level]}`}</span><small>{s.rank ? `of ${s.of}` : 'Not ranked'}</small>
              </Link>
            ))}
            <div style={{ marginTop: 17 }}><SealShare username={m.username} label={name} /></div>
            <Link className="textlink" href="/me" style={{ display: 'inline-block', marginTop: 14 }}>Edit profile and Mystery mode ↗</Link>
          </div>
          <div className="history" data-testid="achievement-history">
            <h3>Achievement history</h3>
            {grouped.length === 0 && <p>No achievements yet. They are awarded automatically by the season engine.</p>}
            {grouped.map((g) => (
              <div className="history-row" key={g.label}><b aria-hidden="true">{g.count > 1 && g.id !== 'streak' ? `×${g.count}` : '✦'}</b><span><strong>{g.label}</strong>: {g.latest.detail}{g.latest.boardName ? ` (${g.latest.boardName})` : ''}</span><small>{istDate(g.latest.at)}</small></div>
            ))}
          </div>
          <div className="history" data-testid="throne-record">
            <h3>Throne record</h3>
            {reigns.length === 0 && <p>You have not held a #01 yet.</p>}
            {reigns.slice(0, 6).map((r) => (
              <div className="history-row" key={`${r.boardName}-${r.from.getTime()}`}><b style={{ width: 40 }}>{r.current ? <Crown variant="compact" /> : '#01'}</b><span>{r.boardName} · {r.seasonLabel}{r.untouchable ? ' · Untouchable' : ''}{r.revenge ? ' · Revenge Taken' : ''}</span><small>{r.current ? 'Holding now' : `${r.hours}h`}</small></div>
            ))}
            {reigns.length > 0 && <PastChampionMark label="Past reigns never carry the live crown" />}
          </div>
        </div>
      </div>
    </>
  );
}
