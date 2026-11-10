'use client';
// Renders rows exactly in the order the data source ranked them. No client-side sorting.
import type { Board, BoardRow } from '@/lib/data/types';
import { inr, pad2 } from '@/lib/format';
import { RankRow, YouRow } from './RankRow';

export type RowMetaMode = 'locality' | 'city' | 'flex';

function metaFor(row: BoardRow, mode: RowMetaMode, cityNames: Record<string, string>, crown: boolean) {
  const m = row.member;
  const place = mode === 'locality' ? m.locality : mode === 'city' ? `${m.locality} · ${cityNames[m.cityId] ?? ''}` : m.locality;
  if (row.rank === 1 && crown) return `Crowned · ${place}`;
  if (mode === 'flex' && m.flexLine) return `${place} · ${m.flexLine}`;
  return place;
}

export function BoardList({ board, scopeLabel, metaMode, cityNames, limit, emptyTitle, emptyText, crownLive = true, valueLabel = 'season' }: {
  board: Board; scopeLabel: string; metaMode: RowMetaMode; cityNames: Record<string, string>; limit?: number; emptyTitle: string; emptyText: string;
  /** False for lists that are not the live Season ranking (Hall of Fame): no gold crown. */
  crownLive?: boolean; valueLabel?: 'season' | 'lifetime';
}) {
  const rows = limit ? board.rows.slice(0, limit) : board.rows;
  if (board.total === 0) {
    return <div className="state-box" data-testid="board-empty"><h4>{emptyTitle}</h4><p>{emptyText}</p></div>;
  }
  if (rows.length === 0) {
    return <div className="state-box" data-testid="board-no-rows"><h4>Nothing to show</h4><p>{emptyText}</p></div>;
  }
  const v = board.viewerRow;
  const showViewer = v && !rows.some((r) => r.member.username === v.member.username);
  const above = v ? board.rows.find((r) => r.rank === v.rank - 1) : undefined;
  const val = (r: BoardRow) => r.score ?? r.member.seasonScore;
  const viewerMeta = v ? (v.rank === 1 ? `Number one in ${scopeLabel}` : above ? `${inr(val(above) - val(v))} behind #${pad2(above.rank)}${valueLabel === 'lifetime' ? ' · lifetime' : ''}` : `#${pad2(v.rank)} of ${board.total} in ${scopeLabel}`) : '';
  return (
    <div data-testid="board-rows">
      {rows.map((r) => (
        <RankRow key={r.member.username} row={r} scopeLabel={scopeLabel} meta={metaFor(r, metaMode, cityNames, crownLive)} isViewer={v?.member.username === r.member.username} crownLive={crownLive} />
      ))}
      {v && <YouRow row={v} scopeLabel={scopeLabel} meta={showViewer || !v ? viewerMeta : `You are #${pad2(v.rank)} · ${viewerMeta}`} />}
    </div>
  );
}
