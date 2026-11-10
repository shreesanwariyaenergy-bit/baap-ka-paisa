import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource } from '@/lib/data';
import { LEVEL_LABEL, STATES, cityById, scopeName } from '@/lib/geo';
import { inr, memberNo, pad2 } from '@/lib/format';
import { Seal } from '@/components/Seal';
import { SealShare } from '@/components/SealShare';
import { movementLabel } from '@/components/movement';

export const metadata: Metadata = { title: 'The Seal' };

export default async function SealPage() {
  const ds = await getDataSource();
  const season = ds.season();
  const viewer = await ds.viewer();
  const intro = (
    <section className="page-intro">
      <div><div className="eyebrow">Permanent member identity / 04</div><h1>The Seal.<br />Your status.</h1></div>
      <p>The Seal is your permanent member identity. Your number stays; your monthly standing, insignias and history change with every season.</p>
    </section>
  );
  if (!viewer) {
    return (
      <>
        {intro}
        <div className="board-panel" style={{ margin: '26px 0 70px' }}>
          <div className="state-box" data-testid="seal-signed-out"><h4>Sign-in is not open yet.</h4>
            <p>Your Seal is issued when you create your member profile. Member sign-in will open with the first season. Until then you can browse <Link href="/board" style={{ textDecoration: 'underline' }}>the boards</Link>.</p></div>
        </div>
      </>
    );
  }
  const m = viewer.member;
  const city = cityById(m.cityId)!;
  const cityStanding = viewer.standings.find((s) => s.level === 'city');
  const name = m.masked ? m.publicLabel : m.displayName ?? m.username;
  const mv = movementLabel(viewer.cityMovement);
  return (
    <>
      {intro}
      <div className="profile-wrap">
        <div>
          <Seal
            front={{ brandLine: 'The Seal / permanent identity', memberNo: memberNo(m.memberNo), name, location: `${m.locality} · ${city.name} · ${STATES[city.state]} · India`,
              rank: cityStanding?.rank ? `${cityStanding.rank === 1 ? '' : '#'}${pad2(cityStanding.rank)}` : '—', rankIsFirst: cityStanding?.rank === 1,
              scopeLine: cityStanding?.rank ? `#${cityStanding.rank} of ${cityStanding.of} in ${city.name}` : `Not ranked in ${city.name} this season`, season: `${season.label} / ${season.monthLabel}` }}
            back={{ memberNo: memberNo(m.memberNo), lifetime: inr(viewer.lifetimeScore),
              records: viewer.record.map((r) => ({ rank: r.cityRank ? `#${pad2(r.cityRank)}` : '—', text: `${city.name} city finish${r.note ? ` · ${r.note}` : ''}`, when: `${r.seasonLabel.replace('Season ', 'S')} · ${r.monthLabel}` })),
              insignia: viewer.insignia.map((i) => i.name) }}
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
          </div>
          {viewer.insignia.length > 0 && (
            <div className="history"><h3>Insignias</h3>{viewer.insignia.map((i) => <div className="history-row" key={i.id}><b aria-hidden="true">✦</b><span><strong>{i.name}</strong>: {i.meaning}</span><small>Earned</small></div>)}</div>
          )}
        </div>
      </div>
    </>
  );
}
