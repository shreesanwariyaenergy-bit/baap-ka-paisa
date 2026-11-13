'use client';
import type { BoardRow } from '@/lib/data/types';
import { movementLabel } from './movement';
import { inr, initials } from '@/lib/format';
import { RankNumber } from './RankNumber';
import { useProfileDialog } from './ProfileDialog';

export function memberLabel(row: BoardRow) {
  const m = row.member;
  return m.masked ? m.publicLabel : (m.displayName ?? m.username);
}

export function RankRow({ row, scopeLabel, meta, isViewer, crownLive = true, unit = 'inr', backers }: { backers?: number; row: BoardRow; scopeLabel: string; meta: string; isViewer?: boolean; crownLive?: boolean; unit?: 'inr' | 'count' }) {
  const { open } = useProfileDialog();
  const mv = movementLabel(row.movement);
  const name = memberLabel(row);
  return (
    <button type="button" className={`rank-row${row.rank === 1 ? (crownLive ? ' first' : ' first-past') : ''}`} onClick={() => open(row, scopeLabel)}
      data-rank={row.rank} data-username={row.member.username} aria-label={`${name}, rank ${row.rank}, ${unit === 'count' ? `${row.score ?? 0} Respect` : inr(row.score ?? row.member.seasonScore)}. Open profile.`}>
      {row.rank === 1 && crownLive && <span className="holder-label" aria-hidden="true">Current holder</span>}
      <RankNumber rank={row.rank} live={crownLive} />
      <span className="rank-avatar" aria-hidden="true">{row.member.masked ? row.member.publicLabel.slice(-2) : initials(name)}</span>
      <span style={{ minWidth: 0 }}>
        <span className="rank-name" style={{ display: 'block' }}>{name}{isViewer ? ' (you)' : ''}</span>
        <span className="rank-meta" style={{ display: 'block' }}>{meta}{backers ? <span data-testid="row-backers"> · {backers} backing</span> : null}</span>
      </span>
      <span className="rank-value">{unit === 'count' ? `${row.score ?? 0} Respect` : inr(row.score ?? row.member.seasonScore)}</span>
      <span className={`rank-change ${mv.cls}`}><span aria-hidden="true">{mv.text}</span><span className="sr-only">{mv.sr}</span></span>
    </button>
  );
}

export function YouRow({ row, scopeLabel, meta }: { row: BoardRow; scopeLabel: string; meta: string }) {
  // Never crowned: the crown sits on the #01 row of the board itself.
  const { open } = useProfileDialog();
  return (
    <button type="button" className="you-row" onClick={() => open(row, scopeLabel)} data-testid="viewer-row" aria-label={`Your position: rank ${row.rank}. Open profile.`}>
      <RankNumber rank={row.rank} live={false} />
      <span className="rank-avatar" aria-hidden="true">{initials(memberLabel(row))}</span>
      <span style={{ minWidth: 0 }}><span className="rank-name" style={{ display: 'block' }}>You</span><span className="rank-meta" style={{ display: 'block' }}>{meta}</span></span>
      <span className="rank-value">{inr(row.score ?? row.member.seasonScore)}</span>
    </button>
  );
}
