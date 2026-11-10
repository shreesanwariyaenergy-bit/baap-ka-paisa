import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { LEVEL_LABEL, STATES, cityById, scopeName } from '@/lib/geo';
import { inr, memberNo, pad2 } from '@/lib/format';
import { Crown } from '@/components/Crown';
import { groupAchievements } from '@/lib/achievements';
import { SocialActions } from '@/components/SocialActions';
import { readDemoSocial } from '@/lib/demo-social';
import { istDay } from '@/lib/engine/engine';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const m = await (await getDataSource()).member(decodeURIComponent(username));
  return { title: m ? (m.masked ? m.publicLabel : m.displayName ?? m.username) : 'Member not found' };
}

export default async function MemberPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const ds = await getDataSource();
  const m = await ds.member(decodeURIComponent(username));
  if (!m) notFound();
  const [standings, achievements, reigns, social] = await Promise.all([ds.standings(m.username), ds.achievements(m.username), ds.throneHistory({ username: m.username, limit: 10 }), ds.social(m.username)]);
  const grouped = groupAchievements(achievements);
  const viewer = await ds.viewer();
  const isSelf = viewer?.member.username === m.username;
  const demoState = viewer ? await readDemoSocial({ follows: [], rivals: (await ds.social(viewer.member.username))?.rivals.map((r) => r.member.username) ?? [], respected: {} }) : null;
  const today = istDay(ds.now().getTime());
  const city = cityById(m.cityId)!;
  const name = m.masked ? m.publicLabel : m.displayName ?? m.username;
  const top = standings.find((s) => s.rank === 1);
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">Public profile</div><h1 style={{ overflowWrap: 'anywhere' }}>{name}</h1></div>
        <p>{m.masked ? 'This member uses Mystery mode. Their name, photo and socials stay hidden until they choose to reveal them.' : `@${m.username}${m.title ? ` · ${m.title}` : ''} · ${m.locality}, ${city.name}, ${STATES[city.state]}.`}</p>
      </section>
      <div className="profile-wrap">
        <div>
          {m.flexLine && <p className="flex-quote" style={{ fontSize: 24, marginTop: 0 }}>“{m.flexLine}”</p>}
          <div className="profile-stats">
            <div className="stat-box"><span>Season Score</span><strong>{inr(m.seasonScore)}</strong><small>This season</small></div>
            <div className="stat-box"><span>Lifetime tier</span><strong>{m.lifetimeTier ?? '—'}</strong><small>{m.lifetimeTier ? 'Never lost' : 'No tier yet'}</small></div>
            <div className="stat-box"><span>Member no.</span><strong>{memberNo(m.memberNo)}</strong><small>Permanent</small></div>
            <div className="stat-box"><span>Respect</span><strong>{social?.respectThisSeason ?? 0}</strong><small>This season</small></div>
            <div className="stat-box"><span>Army</span><strong>{social?.followers ?? 0}</strong><small>Followers</small></div>
            <div className="stat-box"><span>Holds #01</span><strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{top ? <><span style={{ width: 34, display: 'inline-block' }}><Crown /></span>{scopeName(top.scope)}</> : 'No'}</strong><small>{top ? `Current ${LEVEL_LABEL[top.level].toLowerCase()} number-one holder` : 'Right now'}</small></div>
          </div>
        </div>
        <div className="history" style={{ marginTop: 0 }}>
          <h3>Territory standing</h3>
          {standings.map((s) => (
            <Link className="history-row" key={s.level} href={`/board?level=${s.level}&city=${m.cityId}${s.level === 'locality' ? `&locality=${encodeURIComponent(m.locality)}` : ''}`}>
              <b>{s.rank ? `#${pad2(s.rank)}` : '#--'}</b><span>{s.level === 'india' ? 'India / National' : `${scopeName(s.scope)} / ${LEVEL_LABEL[s.level]}`}</span><small>{s.rank ? `of ${s.of}` : 'Not ranked'}</small>
            </Link>
          ))}
          <p style={{ fontSize: 13, color: 'var(--muted-strong)', marginBottom: 0 }}>Phone number, exact address, date of birth and live location are never shown.</p>
        </div>
        {!isSelf && (
          <SocialActions username={m.username} label={name} enabled={!!viewer && ds.availability === 'demo'}
            note={viewer && ds.availability === 'demo' ? 'Demo: actions are checked on the server and kept only in this browser.' : 'Sign in to follow, give Respect or add rivals. Sign-in is not open yet.'}
            initial={{ following: !!demoState?.follows.includes(m.username), rival: !!demoState?.rivals.includes(m.username), respectedToday: demoState?.respected[m.username] === today }} />
        )}
        {isSelf && <div className="history"><h3>This is you</h3><p><Link href="/me" style={{ textDecoration: 'underline' }}>Edit your profile</Link> or open <Link href="/seal" style={{ textDecoration: 'underline' }}>The Seal</Link>.</p></div>}
        <div className="history" data-testid="profile-achievements">
          <h3>Achievements</h3>
          {grouped.length === 0 ? <p>No achievements yet.</p> : grouped.map((g) => (
            <div className="history-row" key={g.label}><b aria-hidden="true">{g.count > 1 && g.id !== 'streak' ? `×${g.count}` : '✦'}</b><span><strong>{g.label}</strong>: {g.latest.detail}</span><small>{g.latest.seasonLabel ?? ''}</small></div>
          ))}
        </div>
        <div className="history">
          <h3>Throne record</h3>
          {reigns.length === 0 ? <p>Has not held a #01 yet.</p> : reigns.map((r) => (
            <div className="history-row" key={`${r.boardName}-${r.from.getTime()}`}><b style={{ width: 40 }}>{r.current ? <Crown variant="compact" /> : '#01'}</b><span>{r.boardName} · {r.seasonLabel}{r.untouchable ? ' · Untouchable' : ''}{r.revenge ? ' · Revenge Taken' : ''}</span><small>{r.current ? 'Holding now' : `${r.hours}h`}</small></div>
          ))}
        </div>
      </div>
    </>
  );
}
