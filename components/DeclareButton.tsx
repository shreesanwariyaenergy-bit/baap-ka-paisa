'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { declareAction } from '@/app/actions';

/** Declare for a city throne: pick one of the fixed lines, confirm, and the declaration is public. */
export function DeclareButton({ cityId, city, holder, lines, required }: { cityId: string; city: string; holder: string; lines: readonly string[]; required: string }) {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = () => start(async () => { const r = await declareAction(cityId, line); if (r.ok && r.id) router.push(`/declare/${r.id}`); else setMsg(r.message); });
  if (!open) return <button className="btn hot" type="button" onClick={() => setOpen(true)} data-testid="declare-start">Declare for {city}</button>;
  return (
    <div className="backing-confirm" role="group" aria-label={`Declare for ${city}`} data-testid="declare-form">
      <p><b>This goes on the public record under your name.</b> A numbered declaration that you are coming for {city}, held by {holder}. You are {required} from taking it. Declaring costs nothing and moves no rank; only the board can make it true.</p>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend className="field-label">Your line (fixed wording only)</legend>
        {lines.map((l, n) => <label key={l} style={{ display: 'block', margin: '6px 0' }}><input type="radio" name="line" checked={line === n} onChange={() => setLine(n)} /> &ldquo;{l}&rdquo;</label>)}
      </fieldset>
      <div className="modal-actions" style={{ marginTop: 0 }}>
        <button className="btn hot" type="button" disabled={pending} onClick={go} data-testid="declare-confirm">{pending ? 'Declaring…' : 'Put it on the record'}</button>
        <button className="btn light" type="button" disabled={pending} onClick={() => setOpen(false)}>Not yet</button>
      </div>
      <p className="share-status" role="alert" style={{ marginTop: 8 }}>{msg}</p>
    </div>
  );
}
