import { pad2 } from '@/lib/format';
import { Crown } from './Crown';

/** Rank numeral. Rank 1 on a live board carries the crown, physically attached above the 01. */
export function RankNumber({ rank, className = 'rank-no', live = true }: { rank: number; className?: string; live?: boolean }) {
  if (rank === 1 && live) {
    return (
      <span className={`${className} is-crowned`}>
        <Crown />
        <span className="rank-number" aria-hidden="true">01</span>
        <span className="sr-only">Rank 01, current number-one holder</span>
      </span>
    );
  }
  return <span className={className}><span className="sr-only">Rank </span>{pad2(rank)}</span>;
}
