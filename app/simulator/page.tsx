import type { Metadata } from 'next';
import Link from 'next/link';
import { HOUR, boardAt, runEngine, seasonStatus } from '@/lib/engine/engine';
import { SCENARIO_MEMBERS, SCENARIO_SEASON, SCENARIO_STEPS, stepTime } from '@/lib/engine/scenario';
import { inr, pad2 } from '@/lib/format';
import { RankNumber } from '@/components/RankNumber';
import { CrownMoment } from '@/components/CrownMoment';

export const metadata: Metadata = { title: 'Season simulator' };
const ist = (t: number) => new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const sp = await searchParams;
  const total = SCENARIO_STEPS.length;
  const step = Math.min(Math.max(Number.parseInt(sp.step ?? '0', 10) || 0, 0), total + 1);
  const now = stepTime(step);
  // Server-side: replay the first `step` events through the engine.
  const res = runEngine(SCENARIO_MEMBERS, [SCENARIO_SEASON], SCENARIO_STEPS.slice(0, Math.min(step, total)).map((s) => s.event), now);
  const season = res.seasons[0];
  const board = boardAt(res, SCENARIO_SEASON.id, 'city:surat', now);
  const name = (id: string) => SCENARIO_MEMBERS.find((m) => m.id === id)!.name;
  const current = step >= 1 && step <= total ? SCENARIO_STEPS[step - 1] : null;
  const rejected = current ? res.rejected.find((r) => r.event === current.event) : null;
  const crown = current ? res.crownEvents.find((e) => e.byEvent === (current.event as { id: string }).id && e.board === 'city:surat') : null;
  const extension = current ? season.extensions.find((x) => x.byEvent === (current.event as { id: string }).id) : null;
  const awarded = res.achievements.filter((a) => a.at <= now && a.id !== 'founding-500' && a.id !== 'pioneer');

  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">Season engine / simulation</div><h1>Season<br />simulator.</h1></div>
        <p>A fixed practice season with three simulated members on the Surat board. Each step is replayed on the server by the same season engine that runs the boards. Nothing here is a real member or payment.</p>
      </section>
      <p className="notice"><span className="sim-flag">Simulation</span> Practice season with invented members. No money moves and no real board changes.</p>
      {crown && (
        <CrownMoment key={step} moment={{ id: `sim-${step}`, boardName: 'Surat', toName: name(crown.to), fromName: crown.from ? name(crown.from) : null, seasonLabel: 'Practice season', whenLabel: ist(crown.at), simulated: true }} />
      )}
      <div className="board-layout" style={{ marginTop: 18 }}>
        <div>
          <div className="board-panel">
            <div className="panel-head"><h3>Surat / City board</h3><span data-testid="sim-status">{seasonStatus(season, now) === 'open' ? 'Open' : seasonStatus(season, now) === 'closed' ? 'Closed' : 'Not started'} · closes {ist(season.endsAt)}</span></div>
            {board.length === 0 ? <div className="state-box"><h4>No one rules Surat yet.</h4><p>Step through the scenario to see the first entry.</p></div> : board.map((r) => (
              <div className={`rank-row${r.rank === 1 ? ' first' : ''}`} key={r.memberId} data-rank={r.rank} data-member={r.memberId}>
                {r.rank === 1 && <span className="holder-label" aria-hidden="true">Current holder</span>}
                <RankNumber rank={r.rank} />
                <span className="rank-avatar" aria-hidden="true">{name(r.memberId)[0]}</span>
                <span style={{ minWidth: 0 }}><span className="rank-name" style={{ display: 'block' }}>{name(r.memberId)}</span><span className="rank-meta" style={{ display: 'block' }}>{SCENARIO_MEMBERS.find((m) => m.id === r.memberId)!.locality}</span></span>
                <span className="rank-value">{inr(r.score)}</span><span className="rank-change neutral" />
              </div>
            ))}
          </div>
          <div className="history" data-testid="sim-result">
            <h3>{current ? `Step ${pad2(step)}: ${current.title}` : step > total ? 'After the close' : 'Before the first step'}</h3>
            {current && <p>{rejected ? <b data-testid="sim-rejected">Rejected by the server: {rejected.reason.replace(/-/g, ' ')}.</b> : 'Accepted by the server.'} {crown ? 'New #01 on the board.' : ''} {extension ? `Season extended to ${ist(extension.newEnd)}.` : ''}</p>}
            {step > total && <p data-testid="sim-closed">Season closed at {ist(season.endsAt)} after {season.extensions.length} extension{season.extensions.length === 1 ? '' : 's'}. Final #01: {board[0] ? name(board[0].memberId) : 'none'}.</p>}
            {awarded.length > 0 && <p>{awarded.map((a) => <span className="chip" key={`${a.id}-${a.memberId}-${a.board}-${a.at}`}>{a.label}: {name(a.memberId)}{a.board ? ` (${a.board.split(':').pop()})` : ''}</span>)}</p>}
            <div className="modal-actions">
              {step > 0 && <Link className="btn light" href={`/simulator?step=${step - 1}`}>Previous step</Link>}
              {step <= total && <Link className="btn" href={`/simulator?step=${step + 1}`} data-testid="sim-next">{step === total ? 'Close the season' : 'Next step'} <span className="arrow" aria-hidden="true">↗</span></Link>}
              {step > 0 && <Link className="btn light" href="/simulator">Start over</Link>}
            </div>
          </div>
        </div>
        <aside className="board-aside" aria-label="Scenario steps">
          <div className="eyebrow">The scenario</div>
          <ol className="steps" style={{ marginTop: 14 }}>
            {SCENARIO_STEPS.map((s, i) => (
              <li key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''} style={i + 1 === step ? { color: 'var(--ink)' } : undefined}>
                <span>{s.title}<small style={{ color: i + 1 === step ? undefined : '#B9C9BD' }}>{s.expect}</small></span>
              </li>
            ))}
          </ol>
          <div className="aside-stat"><span>Anti-snipe</span><b>+15 min, max 2 hours</b></div>
          <div className="aside-stat"><span>Engine time</span><b>{ist(now)}</b></div>
          <div className="aside-stat"><span>Scheduled close</span><b>{ist(SCENARIO_SEASON.scheduledEnd)}</b></div>
          <p style={{ marginBottom: 0 }}>Closes {Math.round((season.endsAt - SCENARIO_SEASON.scheduledEnd) / 60000)} minutes after schedule so far. Maximum extension: {2 * HOUR / 60000} minutes.</p>
        </aside>
      </div>
    </>
  );
}
