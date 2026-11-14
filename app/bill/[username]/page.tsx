// The Bill: a member's standing as an itemised bill that only gets longer. Public fields only.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { STATES, cityById, type Scope } from '@/lib/geo';
import { inr, memberNo } from '@/lib/format';
import { heldFor, who } from '@/lib/gazette';
import { groupAchievements } from '@/lib/achievements';

export const metadata: Metadata = { title: 'The Bill' };
const day = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: '2-digit' }).format(d).toUpperCase();
const time = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(d).toUpperCase();

export default async function BillPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const ds = await getDataSource();
  const m = await ds.member(decodeURIComponent(username));
  if (!m) notFound();
  const city = cityById(m.cityId)!;
  const cityScope: Scope = { level: 'city', cityId: m.cityId, locality: m.locality };
  const [standings, reigns, achievements, moments, backing, viewer] = await Promise.all([
    ds.standings(m.username), ds.throneHistory({ username: m.username, limit: 100 }), ds.achievements(m.username),
    Promise.all((['city', 'state', 'india'] as const).map((level) => ds.crownMoments({ ...cityScope, level }, new Date(0)))).then((x) => x.flat()), ds.backing(m.username), ds.viewer(),
  ]);
  const name = who(m), now = ds.now();
  const thrones = reigns.filter((r) => r.scope.level !== 'locality').sort((a, b) => a.from.getTime() - b.from.getTime());
  const near = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) < 60_000;
  const lines = thrones.map((r) => {
    const took = moments.find((e) => e.boardName === r.boardName && e.to.username === m.username && near(e.at, r.from));
    const lostTo = r.to ? moments.find((e) => e.boardName === r.boardName && e.from?.username === m.username && near(e.at, r.to!)) : undefined;
    return { r, from: took?.from ? who(took.from) : null, endedBy: lostTo ? who(lostTo.to) : null };
  });
  const marks = groupAchievements(achievements);
  const mine = viewer?.member.username === m.username;
  const held = thrones.reduce((a, r) => a + r.hours, 0);
  return (
    <div className="bill-stage">
      <div className="bill-side">
        <div className="eyebrow">The Bill{ds.availability === 'demo' ? ' · demo data' : ''}</div>
        <h1>The Bill.</h1>
        <p>Every member carries one. It is never settled and it only gets longer: every throne taken is a line, and every throne lost is stamped where everyone can read it.</p>
        <p style={{ fontSize: 14, color: 'var(--muted-strong)' }}>A record of standing, not a payment document.</p>
        <div className="hero-cta"><Link className="btn light" href={`/u/${encodeURIComponent(m.username)}`}>Profile</Link>{mine && <Link className="btn light" href="/seal">The Seal</Link>}</div>
      </div>
      <article className="bill" data-testid="bill">
        <header>
          <b>BAAP KA PAISA</b><span>THE STATUS REGISTER</span>
          <span>{city.name.toUpperCase()} · {STATES[city.state].toUpperCase()}</span>
          <hr /><div className="bill-row"><span>BILL NO.</span><span>{m.masked ? 'WITHHELD' : memberNo(m.memberNo)}</span></div>
          <div className="bill-row"><span>ISSUED TO</span><span data-testid="bill-name">{name.toUpperCase()}</span></div>
          <div className="bill-row"><span>PRINTED</span><span>{day(now)} {time(now)}</span></div><hr />
        </header>
        <section aria-label="Standing this season">
          <h2>{ds.season().label.toUpperCase()} — STANDING</h2>
          {standings.map((s) => <div className="bill-row" key={s.level}><span>{s.level === 'india' ? 'INDIA' : s.level === 'state' ? STATES[city.state].toUpperCase() : s.level === 'city' ? city.name.toUpperCase() : m.locality.toUpperCase()}</span><span>{s.rank ? `#${String(s.rank).padStart(2, '0')} / ${s.of}` : 'NOT RANKED'}</span></div>)}
        </section>
        <section aria-label="Thrones">
          <h2>THRONES TAKEN — {thrones.length}</h2>
          {lines.length === 0 && <p className="bill-none">NONE YET. THIS SPACE IS WAITING.</p>}
          {lines.map(({ r, from, endedBy }) => (
            <div className={`bill-item${r.current ? ' holding' : ''}`} key={`${r.boardName}-${r.from.getTime()}`} data-testid="bill-throne">
              <div className="bill-row"><span>1 × {r.boardName.toUpperCase()}</span><span>{r.seasonLabel.replace('Season ', 'S')}</span></div>
              <small>{day(r.from)} {time(r.from)}{from ? ` · TAKEN FROM ${from.toUpperCase()}` : ' · TAKEN'}</small>
              <small>HELD {heldFor(r.hours).toUpperCase()}{r.untouchable ? ' · UNTOUCHABLE' : ''}{r.revenge ? ' · REVENGE' : ''}</small>
              {r.current ? <em className="bill-stamp live">HOLDING</em>
                : <em className="bill-stamp" data-testid="bill-ended">REIGN ENDED{r.endReason === 'season-end' ? ' · SEASON CLOSED' : endedBy ? ` · BY ${endedBy.toUpperCase()}` : ''}</em>}
            </div>
          ))}
        </section>
        {marks.length > 0 && (
          <section aria-label="Not for sale">
            <h2>NOT FOR SALE</h2>
            {marks.map((a) => <div className="bill-row" key={a.id + a.label}><span>{a.count > 1 ? `${a.count} × ` : '1 × '}{a.label.toUpperCase()}</span><span>₹0</span></div>)}
            {backing && backing.backers > 0 && <div className="bill-row"><span>{backing.backers} × BACKERS, {backing.seasonLabel.toUpperCase()}</span><span>₹0</span></div>}
          </section>
        )}
        <footer>
          <hr />
          <div className="bill-row"><span>TIME ON A THRONE</span><span>{heldFor(held).toUpperCase()}</span></div>
          <div className="bill-row"><span>LIFETIME TIER</span><span>{(m.lifetimeTier ?? '—').toUpperCase()}</span></div>
          <div className="bill-row total"><span>THIS SEASON</span><span data-testid="bill-total">{inr(m.seasonScore)}</span></div>
          <div className="bill-row"><span>PAID BY</span><span>BAAP</span></div>
          <div className="bill-row"><span>BALANCE DUE</span><span>THE THRONE</span></div><hr />
          <div className="bill-bars" aria-hidden="true" />
          <p>NOT A TAX INVOICE. NOT A RECEIPT OF PAYMENT.<br />NO PRIZES. NO CASH-OUTS. NO REFUND OF PRIDE.<br />THE RECORD STAYS.</p>
        </footer>
      </article>
    </div>
  );
}
