'use client';
// Crown Moment: a short takeover when a board gets a new #01. The crown belongs to the position;
// the name underneath is whoever holds it now. Plays once per browser session per event.
import { useEffect, useState } from 'react';
import { Crown } from './Crown';

export interface CrownMomentData { id: string; boardName: string; toName: string; fromName: string | null; seasonLabel: string; whenLabel: string; simulated: boolean; }

export function CrownMoment({ moment, autoPlay = true }: { moment: CrownMomentData; autoPlay?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoPlay) return;
    let seen = false;
    try { seen = sessionStorage.getItem(`crown-moment:${moment.id}`) === '1'; sessionStorage.setItem(`crown-moment:${moment.id}`, '1'); } catch { /* storage unavailable */ }
    if (!seen) setOpen(true);
  }, [moment.id, autoPlay]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 9000);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <>
      <div className="crown-strip" data-testid="crown-strip">
        <span className="crown-strip-mark" aria-hidden="true"><Crown variant="compact" /></span>
        <span><b>New #01 in {moment.boardName}</b> · {moment.toName} took it{moment.fromName ? ` from ${moment.fromName}` : ''} · {moment.whenLabel}{moment.simulated ? ' · simulated' : ''}</span>
        <button type="button" onClick={() => setOpen(true)} data-testid="crown-replay">Watch the Crown Moment</button>
      </div>
      {open && (
        <div className="crown-moment" role="dialog" aria-modal="true" aria-labelledby="cm-title" data-testid="crown-moment" onClick={() => setOpen(false)}>
          <div className="cm-card" onClick={(e) => e.stopPropagation()}>
            <p className="cm-kicker">{moment.seasonLabel} · {moment.boardName}{moment.simulated ? ' · Simulation' : ''}</p>
            <div className="cm-insignia" aria-hidden="true"><span className="cm-crown"><Crown /></span><span className="cm-01">01</span></div>
            <h2 id="cm-title">New #01 in {moment.boardName}</h2>
            <p className="cm-name">{moment.toName}</p>
            <p className="cm-from">{moment.fromName ? `Took the crown from ${moment.fromName}.` : 'First to hold this crown.'} The crown stays with #01, whoever holds it next.</p>
            <button type="button" className="btn light" onClick={() => setOpen(false)} autoFocus>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
