import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { LEVEL_LABEL, STATES, cityById, scopeName } from '@/lib/geo';
import { inr, memberNo, pad2 } from '@/lib/format';
import { Crown } from '@/components/Crown';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const m = await getDataSource().member(decodeURIComponent(username));
  return { title: m ? (m.masked ? m.publicLabel : m.displayName ?? m.username) : 'Member not found' };
}

export default async function MemberPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const ds = getDataSource();
  const m = await ds.member(decodeURIComponent(username));
  if (!m) notFound();
  const standings = await ds.standings(m.username);
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
      </div>
    </>
  );
}
