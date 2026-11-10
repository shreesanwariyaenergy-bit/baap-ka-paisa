'use client';
import { useState, useTransition } from 'react';
import { socialAction, type SocialResult } from '@/app/actions';

export function SocialActions({ username, label, initial, enabled, note }: {
  username: string; label: string; initial: { following: boolean; rival: boolean; respectedToday: boolean }; enabled: boolean; note: string;
}) {
  const [state, setState] = useState(initial);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const run = (kind: Parameters<typeof socialAction>[0]) => start(async () => {
    const r: SocialResult = await socialAction(kind, username);
    setMsg(r.message); if (r.state) setState(r.state);
  });
  return (
    <div className="history" data-testid="social-actions">
      <h3>Follow, Respect, rivals</h3>
      <div className="modal-actions" style={{ marginTop: 0 }}>
        <button className="btn" type="button" disabled={!enabled || pending} onClick={() => run(state.following ? 'unfollow' : 'follow')} aria-pressed={state.following}>{state.following ? 'Following' : 'Follow'}</button>
        <button className="btn light" type="button" disabled={!enabled || pending || state.respectedToday} onClick={() => run('respect')}>{state.respectedToday ? 'Respect given today' : 'Give Respect'}</button>
        <button className="btn light" type="button" disabled={!enabled || pending} onClick={() => run(state.rival ? 'unrival' : 'rival')} aria-pressed={state.rival}>{state.rival ? 'Remove rival' : 'Add rival'}</button>
      </div>
      <p className="share-status" role="status" aria-live="polite" style={{ marginTop: 10 }}>{msg || note}</p>
      <p style={{ fontSize: 13, color: 'var(--muted-strong)', marginBottom: 0 }}>Respect is free: one per profile per day. Up to 5 rivals. Following {label} adds you to their Army.</p>
    </div>
  );
}
