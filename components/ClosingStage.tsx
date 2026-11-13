'use client';
// The Closing: live event screen. It shows only what the server says. The countdown between
// server answers is a local animation that is corrected on every answer.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CrownMark } from './Crown';
import type { ClosingState } from '@/lib/closing';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const STATUS = { standing: 'At stake', won: 'Made good', 'throne-moved': 'Spent', lapsed: 'Lapsed' } as const;

export function ClosingStage({ initial, speed }: { initial: ClosingState; speed: number }) {
  const [s, setS] = useState(initial);
  const [remaining, setRemaining] = useState(initial.remainingMs);
  const [flash, setFlash] = useState<string | null>(null);
  const seen = useRef({ ext: initial.extensions, holder: initial.holder?.name ?? '', synced: 0 });

  const apply = useCallback((n: ClosingState) => {
    if (n.phase !== 'idle') {
      if (n.extensions > seen.current.ext) setFlash(`EXTENDED +15 MIN`);
      else if (n.holder && seen.current.holder && n.holder.name !== seen.current.holder && n.phase !== 'closed') setFlash(`${n.holder.name.split(' ')[0].toUpperCase()} TAKES IT`);
      seen.current = { ext: n.extensions, holder: n.holder?.name ?? '', synced: performance.now() };
    }
    setS(n); setRemaining(n.remainingMs);
  }, []);

  useEffect(() => {
    if (s.phase === 'idle' || s.phase === 'closed') return;
    const poll = setInterval(async () => { try { const r = await fetch(`/api/closing${s.live ? `?city=${s.live.cityId}` : ''}`, { cache: 'no-store' }); if (r.ok) apply(await r.json()); } catch { /* keep the last server answer */ } }, s.live ? 5000 : 1000);
    const tick = setInterval(() => setRemaining((r) => Math.max(0, r - 100 * speed)), 100);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [s.phase, s.live, speed, apply]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 2600); return () => clearTimeout(t); }, [flash]);

  const start = async () => {
    seen.current = { ext: 0, holder: '', synced: 0 };
    const r = await fetch('/api/closing', { method: 'POST' });
    if (r.ok) { const n = (await r.json()) as ClosingState; seen.current.holder = n.holder?.name ?? ''; setS({ ...n, phase: 'live' }); setRemaining(n.remainingMs); }
  };

  if (s.phase === 'idle') {
    return (
      <section className="closing closing-idle" data-testid="closing" data-phase="idle">
        <p className="cl-kicker">Practice season · invented members · replayed at {speed}× speed</p>
        <h1>The<br />Closing.</h1>
        <p className="cl-lede">The last twenty minutes of a season. <b>{s.holder?.name}</b> holds the throne with {inr(s.holder?.score ?? 0)}. Three members have declared for it in writing. The board shuts at {s.scheduledClose}, unless someone takes the throne in the final fifteen minutes.</p>
        <button className="btn hot" type="button" onClick={start} data-testid="closing-start">Open the final stretch</button>
        <p className="cl-note">Every figure comes from the season engine on the server, anti-snipe included. No payment is involved and no real season is running.</p>
      </section>
    );
  }
  const v = s.verdict;
  if (s.phase === 'closed' && v) {
    return (
      <section className="closing closing-verdict" data-testid="closing" data-phase="closed">
        <p className="cl-kicker">The board is closed · {v.closedAt} IST · {s.live ? `${s.live.city} · ${s.live.season}` : 'practice season'}</p>
        <div className="cl-crown"><CrownMark size="large" /></div>
        <h1 data-testid="closing-winner">{v.winner}</h1>
        <p className="cl-verdict-line">holds the throne. Season Crown.</p>
        <dl className="cl-facts">
          <div><dt>Final score</dt><dd>{inr(v.score)}</dd></div>
          <div><dt>{v.margin === 0 ? `Level with ${v.runnerUp}; first to reach it wins` : `Ahead of ${v.runnerUp}`}</dt><dd>{v.margin === 0 ? 'By the clock' : inr(v.margin)}</dd></div>
          <div><dt>Times the throne changed hands</dt><dd>{v.changes}</dd></div>
          <div><dt>Extensions</dt><dd>{v.extensions} <i>(+{s.extendedBy} min)</i></dd></div>
          {!s.live && <div><dt>Payments refused after the close</dt><dd>{v.refused}</dd></div>}
        </dl>
        <div className="cl-decls">{s.declarations.map((d) => <span key={d.no} className={`cl-decl ${d.status}`}><b>{STATUS[d.status]}</b>{d.challenger}</span>)}</div>
        <div className="hero-cta" style={{ marginTop: 26 }}>{s.live ? <Link className="btn" href={`/gazette?city=${s.live.cityId}`}>Read the Gazette</Link> : <button className="btn" type="button" onClick={start}>Run it again</button>}<Link className="btn light" href={s.live ? '/archive' : '/simulator'}>{s.live ? 'The archive' : 'Step through the rules'}</Link></div>
        {!s.live && <p className="cl-note">Practice replay with invented members. The verdict was produced by the season engine on the server.</p>}
      </section>
    );
  }
  const danger = remaining <= 5 * 60_000;
  return (
    <section className={`closing closing-live${danger ? ' danger' : ''}`} data-testid="closing" data-phase={s.phase}>
      {flash && <div className="cl-flash" role="status" data-testid="closing-flash">{flash}</div>}
      <header className="cl-top">
        <span>{s.live ? `${s.live.city} · ${s.live.season}` : `Practice season · ${speed}×`} · {s.clock} IST</span>
        <span data-testid="closing-extensions">{s.extensions ? `Extended ${s.extensions}× · now closes ${s.closesAt}` : `Closes ${s.scheduledClose}`}</span>
      </header>
      <div className="cl-clock" aria-live="off"><small>{s.live?.settling ? 'The bell has rung. Payments made before it are being confirmed' : s.extensions ? 'Extended. The board closes in' : 'The board closes in'}</small><b data-testid="closing-countdown">{mmss(remaining)}</b></div>
      <div className="cl-main">
        <div className="cl-throne">
          <small>On the throne</small>
          <div className="cl-holder"><CrownMark size="medium" /><b data-testid="closing-holder">{s.holder?.name}</b></div>
          <span className="cl-score">{inr(s.holder?.score ?? 0)}</span>
          <div className="cl-price"><small>Price of the throne this second</small><b data-testid="closing-price">{inr(s.price)}</b><i>indicative · one ₹500 step past the holder · nothing is being charged</i></div>
        </div>
        <ol className="cl-board" aria-label="Challengers">
          {s.board.slice(1).map((r) => (
            <li key={r.name}><span>#{String(r.rank).padStart(2, '0')}</span><b>{r.name}</b><i>{inr(r.score)}</i><em>{inr(r.toTake)} to take it</em>
              <u style={{ width: `${Math.max(4, Math.round((r.score / (s.holder?.score || 1)) * 100))}%` }} /></li>
          ))}
        </ol>
      </div>
      <div className="cl-lower">
        <div className="cl-decls" aria-label="Declarations at stake">
          {s.declarations.map((d) => <span key={d.no} className={`cl-decl ${d.status}`}><b>{STATUS[d.status]}</b>{d.challenger}<i>&ldquo;{d.line}&rdquo;</i></span>)}
        </div>
        <ul className="cl-ticker" aria-label="What just happened" data-testid="closing-ticker">
          {s.ticker.length === 0 && <li><time>—</time>Nobody has moved yet.</li>}
          {s.ticker.slice(0, 6).map((t) => <li key={t.at} className={t.kind}><time>{t.clock}</time>{t.text}{t.extended && <strong> Season extended.</strong>}</li>)}
        </ul>
      </div>
    </section>
  );
}
