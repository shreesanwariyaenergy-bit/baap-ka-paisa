import { inr } from '@/lib/format';
import { toOvertake } from '@/lib/engine/callout';

/** The price of a throne, with every figure labelled. Display only: it reads the board and applies the approved ranking rules. */
export function ThronePrice({ place, holder, holderScore, myScore, signedIn }: { place: string; holder: string | null; holderScore: number; myScore?: number; signedIn?: boolean }) {
  const fresh = toOvertake(holderScore, 0);
  const mine = myScore && myScore > 0 ? toOvertake(holderScore, myScore) : null;
  return (
    <div className="tprice" data-testid="throne-price">
      <div className="tprice-head"><small>The price of {place} right now</small><b data-testid="throne-price-amount">{inr(fresh)}</b></div>
      <dl>
        <div><dt>{holder ? `${holder}'s season score` : 'Season score of the holder'}</dt><dd data-testid="tp-leader">{holder ? inr(holderScore) : 'Vacant'}</dd></div>
        <div><dt>Next qualifying step</dt><dd>{inr(500)} <i>(first entry: {inr(1000)} minimum)</i></dd></div>
        <div><dt>To take #01 starting from nothing</dt><dd>{inr(fresh)}</dd></div>
        {mine !== null && <div className="me"><dt>To take #01 from your {inr(myScore!)}</dt><dd data-testid="tp-mine">{inr(mine)} <i>({Math.ceil(mine / 500)} steps)</i></dd></div>}
        {mine === null && signedIn && <div className="me"><dt>You are not on this board yet</dt><dd>{inr(fresh)}</dd></div>}
      </dl>
      <p>Indicative figure, worked out from the board this moment: one step past the holder. It rises whenever the holder adds to their score. <b>No payment is being taken and nothing here is an order.</b> Rank purchases are not open.</p>
    </div>
  );
}
