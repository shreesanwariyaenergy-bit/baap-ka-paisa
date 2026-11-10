// Board views from the blueprint: Season (default), Today's Movers, Hall of Fame.
import type { Board, BoardRow } from './types';

export type BoardView = 'season' | 'movers' | 'hall';
export const BOARD_VIEWS: readonly BoardView[] = ['season', 'movers', 'hall'];
export const VIEW_LABEL: Record<BoardView, string> = { season: 'Season', movers: "Today's Movers", hall: 'Hall of Fame' };
export const parseView = (v?: string): BoardView => ((BOARD_VIEWS as readonly string[]).includes(v ?? '') ? (v as BoardView) : 'season');

const climb = (r: BoardRow) => (r.movement?.kind === 'took' ? 1000 + r.movement.by : r.movement?.kind === 'new' ? 500 : r.movement?.by ?? 0);

/**
 * Today's Movers: members whose position improved in the last 24 hours, biggest climb first.
 * This orders a list of changes; the rank numbers shown are still the server's Season ranks.
 */
export function movers(board: Board): Board {
  const rows = board.rows.filter((r) => r.movement && ['up', 'took', 'new'].includes(r.movement.kind)).sort((a, b) => climb(b) - climb(a) || a.rank - b.rank);
  return { ...board, rows };
}
