// Head-to-head: a shareable page comparing two members on the boards they share.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { LEVEL_LABEL, LEVELS, cityById, scopeName } from '@/lib/geo';
import { inr, pad2 } from '@/lib/format';
import type { PublicMember } from '@/lib/data/types';
import { CrownMark } from '@/components/Crown';

const nm = (m: PublicMember) => (m.masked ? m.publicLabel : m.displayName ?? m.username);
type P = { params: Promise<{ a: string; b: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { a, b } = await params; const ds = await getDataSource();
  const [x, y] = await Promise.all([ds.member(decodeURIComponent(a)), ds.member(decodeURIComponent(b))]);
  return { title: x && y ? `${nm(x)} vs ${nm(y)}` : 'Head to head' };
}

export default async function VsPage({ params }: P) {
  const { a, b } = await params; const ds = await getDataSource();
  const [x, y] = await Promise.all([ds.member(decodeURIComponent(a)), ds.member(decodeURIComponent(b))]);
  if (!x || !y || x.username === y.username) notFound();
  const [sx, sy, ax, ay] = await Promise.all([ds.standings(x.username), ds.standings(y.username), ds.achievements(x.username), ds.achievements(y.username)]);
  const shared = LEVELS.filter((l) => l === 'india' || (l === 'state' && x.state === y.state) || (l === 'city' && x.cityId === y.cityId) || (l === 'locality' && x.cityId === y.cityId && x.locality === y.locality));
  const ahead = x.seasonScore === y.seasonScore ? null : x.seasonScore > y.seasonScore ? x : y;
  const gap = Math.abs(x.seasonScore - y.seasonScore);
  const side = (m: PublicMember, won: boolean) => (
    <Link className="terr" href={`/u/${encodeURIComponent(m.username)}`} aria-current={won ? 'true' : undefined} style={{ padding: 22 }}>
      <small>{m.locality}, {cityById(m.cityId)?.name}</small>
      <b style={{ fontSize: 'clamp(34px,5vw,60px)', overflowWrap: 'anywhere' }}>{nm(m)}</b>
      <span style={{ fontSize: 22, fontWeight: 800 }}>{inr(m.seasonScore)}</span>
      <span>{won ? 'Ahead this season' : ahead ? 'Chasing' : 'Level'}</span>
    </Link>
  );
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">Head to head{ds.availability === 'demo' ? ' · demo data' : ''}</div><h1>{nm(x)}<br />vs {nm(y)}.</h1></div>
        <p>{ahead ? `${nm(ahead)} leads by ${inr(gap)} this season. Passing takes ${inr(gap + 500)}.` : 'Dead level this season. Whoever reached the score first ranks higher.'}</p>
      </section>
      <div className="terr-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', margin: '26px 0' }}>{side(x, ahead === x)}{side(y, ahead === y)}</div>
      <div className="board-panel" style={{ marginBottom: 26 }}>
        <div className="panel-head"><h3>Shared boards</h3><span>{ds.season().label}</span></div>
        {shared.map((l) => { const rx = sx.find((s) => s.level === l); const ry = sy.find((s) => s.level === l); return (
          <div className="history-row" key={l} style={{ gridTemplateColumns: '1fr auto 1fr', padding: '14px 19px' }} data-testid="vs-row">
            <b style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{rx?.rank === 1 && <span style={{ width: 28 }}><CrownMark size="compact" /></span>}{rx?.rank ? `#${pad2(rx.rank)}` : '—'}</b>
            <span style={{ textAlign: 'center' }}>{l === 'india' ? 'India' : `${scopeName(rx!.scope)} / ${LEVEL_LABEL[l]}`}</span>
            <b style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>{ry?.rank ? `#${pad2(ry.rank)}` : '—'}{ry?.rank === 1 && <span style={{ width: 28 }}><CrownMark size="compact" /></span>}</b>
          </div>
        ); })}
        <div className="history-row" style={{ gridTemplateColumns: '1fr auto 1fr', padding: '14px 19px' }}><b>{ax.length}</b><span style={{ textAlign: 'center' }}>Achievements earned</span><b style={{ textAlign: 'right' }}>{ay.length}</b></div>
      </div>
      <div className="hero-cta" style={{ marginBottom: 70 }}>
        <Link className="btn" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link>
        <Link className="btn light" href={`/board?level=city&city=${x.cityId}`}>Open {cityById(x.cityId)?.name} board</Link>
      </div>
    </>
  );
}
