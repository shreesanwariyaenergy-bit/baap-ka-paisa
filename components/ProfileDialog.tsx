'use client';
// Profile quick view, as in the prototype's modal. Receives public fields only.
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { BoardRow } from '@/lib/data/types';
import { inr, pad2 } from '@/lib/format';
import { CITY_NAMES } from './cityNames';

type Ctx = { open: (row: BoardRow, scopeLabel: string) => void };
const ProfileCtx = createContext<Ctx>({ open: () => {} });
export const useProfileDialog = () => useContext(ProfileCtx);

export function ProfileDialogProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ row: BoardRow; scopeLabel: string } | null>(null);
  const open = useCallback((row: BoardRow, scopeLabel: string) => setState({ row, scopeLabel }), []);
  useEffect(() => { if (state && ref.current && !ref.current.open) ref.current.showModal(); }, [state]);
  const close = () => ref.current?.close();
  const m = state?.row.member;
  return (
    <ProfileCtx.Provider value={{ open }}>
      {children}
      <dialog ref={ref} className="modal" aria-labelledby="pq-name" onClose={() => setState(null)}
        onClick={(e) => { if (e.target === ref.current) close(); }}>
        {m && state && (
          <div className="modal-inner">
            <button className="modal-close" type="button" onClick={close} aria-label="Close profile">×</button>
            <div className="eyebrow">Profile quick view</div>
            <h2 id="pq-name">{m.masked ? m.publicLabel : m.displayName}</h2>
            <div className="modal-stat">#{pad2(state.row.rank)} · {inr(m.seasonScore)}</div>
            <p>
              {state.row.rank === 1 ? `Current number-one holder in ${state.scopeLabel}.` : `Rank ${state.row.rank} in ${state.scopeLabel} this season.`}{' '}
              {m.masked ? 'This member uses Mystery mode. Only they can reveal who they are.' : `@${m.username}${m.title ? ', ' + m.title : ''}. ${m.locality}, ${CITY_NAMES[m.cityId] ?? ''}.`}
            </p>
            {m.flexLine && <p className="flex-quote">“{m.flexLine}”</p>}
            <div className="modal-actions">
              <Link className="btn" href={`/u/${encodeURIComponent(m.username)}`} onClick={close}>Open profile <span className="arrow">↗</span></Link>
              <button className="btn light" type="button" onClick={close}>Close</button>
            </div>
          </div>
        )}
      </dialog>
    </ProfileCtx.Provider>
  );
}
