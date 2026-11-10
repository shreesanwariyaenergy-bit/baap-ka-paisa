'use client';
// Renders rows exactly in the order the data source ranked them. No client-side sorting.
import type { Board, BoardRow } from '@/lib/data/types';
import { inr, pad2 } from '@/lib/format';
import { RankRow, YouRow } from './RankRow';

export type RowMetaMode = 'locality' | 'city' | 'flex';

function metaFor(row: BoardRow, mode: RowMetaMode, cityNames: Record<string, string>) {
  const m = row.member;
  const place = mode === 'locality' ? m.locality : mode === 'city' ? `${m.locality} · ${cityNames[m.cityId] ?? ''}` : m.locality;
  if (row.rank === 1) return `Crowned · ${place}`;
  if (mode === 'flex' && m.flexLine) return `${place} · ${m.flexLine}`;
  return place;
}

export function BoardList({ board, scopeLabel, metaMode, cityNames, limit, emptyTitle, emptyText }: {
  board: Board; scopeLabel: string; metaMode: RowMetaMode; cityNames: Record<string, string>; limit?: number; emptyTitle: string; emptyText: string;
}) {
  const rows = limit ? board.rows.slice(0, limit) : board.rows;
  if (board.total === 0) {
    return <div className="state-box" data-testid="board-empty"><h4>{emptyTitle}</h4><p>{emptyText}</p></div>;
  }
  if (rows.length === 0) {
    return <div className="state-box"><h4>No match</h4><p>Nobody on this board matches that search. Clear the search to see the full board.</p></div>;
  }
  const v = board.viewerRow;
  const showViewer = v && !rows.some((r) => r.member.username === v.member.username);
  const above = v ? board.rows.find((r) => r.rank === v.rank - 1) : undefined;
  const viewerMeta = v ? (v.rank === 1 ? `Number one in ${scopeLabel}` : above ? `${inr(above.member.seasonScore - v.member.seasonScore)} behind #${pad2(above.rank)}` : `#${pad2(v.rank)} of ${board.total} in ${scopeLabel}`) : '';
  return (
    <div data-testid="board-rows">
      {rows.map((r) => (
        <RankRow key={r.member.username} row={r} scopeLabel={scopeLabel} meta={metaFor(r, metaMode, cityNames)} isViewer={v?.member.username === r.member.username} />
      ))}
      {v && <YouRow row={v} scopeLabel={scopeLabel} meta={showViewer || !v ? viewerMeta : `You are #${pad2(v.rank)} · ${viewerMeta}`} />}
    </div>
  );
}
