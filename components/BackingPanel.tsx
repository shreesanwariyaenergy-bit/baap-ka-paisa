'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { backAction } from '@/app/actions';

type Mode = 'signed-out' | 'self' | 'can-back' | 'backing-this' | 'backing-other' | 'not-contender' | 'closed';
/** Backing on a contender's profile: public count, and the one-per-season pledge with a confirm step. */
export function BackingPanel({ username, name, city, season, backers, mode, otherPick }: {
  username: string; name: string; city: string; season: string; backers: number; mode: Mode; otherPick?: { name: string; username: string };
}) {
  const [state, setState] = useState<{ mode: Mode; backers: number }>({ mode, backers });
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const confirm = () => start(async () => {
    const r = await backAction(username);
    setMsg(r.message); setConfirming(false);
    if (r.ok) setState((s) => ({ mode: 'backing-this', backers: s.backers + 1 }));
  });
  return (
    <div className="backing" data-testid="backing-panel" data-mode={state.mode}>
      <div className="backing-count"><b data-testid="backing-count">{state.backers}</b><span>{state.backers === 1 ? 'member is' : 'members are'} backing {name} to take {city}<small>{season} · backing is free and never changes a rank</small></span></div>
      {state.mode === 'can-back' && !confirming && <button className="btn" type="button" onClick={() => setConfirming(true)} data-testid="back-start">Back {name}</button>}
      {state.mode === 'can-back' && confirming && (
        <div className="backing-confirm" role="group" aria-label="Confirm your backing">
          <p><b>This is your only backing for {season}.</b> Once confirmed it is locked: you cannot move it, even if {name} is dethroned an hour later.</p>
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button className="btn" type="button" disabled={pending} onClick={confirm} data-testid="back-confirm">{pending ? 'Locking…' : `Lock it in for ${name}`}</button>
            <button className="btn light" type="button" disabled={pending} onClick={() => setConfirming(false)}>Not yet</button>
          </div>
        </div>
      )}
      {state.mode === 'backing-this' && <p className="backing-locked" data-testid="backing-locked"><b>Locked.</b> You are backing {name} for {season}. If {name} finishes #01 in {city}, &ldquo;Backed the Crown&rdquo; goes on your Seal for good.</p>}
      {state.mode === 'backing-other' && otherPick && <p className="backing-locked">Your backing for {season} is locked with <Link href={`/u/${encodeURIComponent(otherPick.username)}`} style={{ textDecoration: 'underline' }}>{otherPick.name}</Link>. One per season.</p>}
      {state.mode === 'self' && <p className="backing-locked">{state.backers ? 'Every one of them gave up their only backing of the season for you.' : 'Nobody has backed you yet.'} Send your profile link to people who would put their name behind yours.</p>}
      {state.mode === 'not-contender' && <p className="backing-locked">{name} is not on the board this season, so there is nothing to back yet.</p>}
      {state.mode === 'signed-out' && <p className="backing-locked"><Link href="/signin" style={{ textDecoration: 'underline', fontWeight: 700 }}>Sign in</Link> to give your one backing of the season.</p>}
      <p className="share-status" role="status" aria-live="polite">{msg}</p>
    </div>
  );
}
