'use client';
import { useState, useTransition } from 'react';
import { blockChallenger } from '@/app/actions';

/** For a throne-holder: block (or unblock) one challenger from declaring against them. */
export function BlockButton({ name, label, blocked = false }: { name: string; label: string; blocked?: boolean }) {
  const [isBlocked, setBlocked] = useState(blocked);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const run = () => start(async () => { const r = await blockChallenger(name, !isBlocked); setMsg(r.message); if (r.ok) setBlocked(!isBlocked); });
  return (
    <span data-testid="block-control">
      <button className="btn light" type="button" disabled={pending} onClick={run} aria-pressed={isBlocked}>{isBlocked ? `Unblock ${label}` : `Block ${label} from declaring against you`}</button>
      <span className="share-status" role="status" aria-live="polite" style={{ display: 'block', marginTop: 6 }}>{msg}</span>
    </span>
  );
}
