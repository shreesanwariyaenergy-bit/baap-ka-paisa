import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { inr } from '@/lib/format';
import { heldFor, who } from '@/lib/gazette';
import { CopyLink } from '@/components/CopyLink';
import { ThronePrice } from '@/components/ThronePrice';
import { BlockButton } from '@/components/BlockButton';

const STAMP = { standing: 'Standing', won: 'Made good', 'throne-moved': 'Throne moved', lapsed: 'Lapsed' } as const;
const when = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = (await (await getDataSource()).declarations({ id: (await params).id }))[0];
  return { title: d ? `${who(d.challenger)} declares for ${d.boardName}` : 'Declaration not found' };
}

export default async function DeclarationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ds = await getDataSource();
  const d = (await ds.declarations({ id }))[0];
  if (!d) notFound();
  const viewer = await ds.viewer();
  const ch = who(d.challenger), ho = who(d.holder);
  const took = d.status === 'won' && d.resolvedAt ? heldFor((d.resolvedAt.getTime() - d.at.getTime()) / 3_600_000) : null;
  const line = (t: (typeof d.timeline)[number]) => t.kind === 'declared' ? `${ch} declares for ${d.boardName}. Gap: ${inr(Math.max(0, t.gap))}.`
    : t.kind === 'holder-added' ? `${ho} answers with ${inr(t.amount!)}. Gap: ${inr(Math.max(0, t.gap))}.`
    : t.kind === 'challenger-added' ? `${ch} adds ${inr(t.amount!)}. Gap: ${t.gap > 0 ? inr(t.gap) : 'closed'}.`
    : t.kind === 'won' ? `${ch} takes ${d.boardName}. The declaration is made good.`
    : t.kind === 'throne-moved' ? `${t.by ? who(t.by) : 'Someone else'} took ${d.boardName} first. This declaration is spent.`
    : `The season closed with ${ho} still on the throne.`;
  return (
    <>
      <article className={`decl decl-${d.status}`} data-testid="declaration">
        <header><span>Declaration No. {d.no}</span><span>{d.seasonLabel}</span><span className="decl-stamp" data-testid="declaration-status">{STAMP[d.status]}</span></header>
        <p className="decl-pre">Entered in the public register, {when(d.at)} IST{ds.availability === 'demo' ? ' · demo data' : ''}</p>
        <h1><Link href={`/u/${encodeURIComponent(d.challenger.username)}`}>{ch}</Link><em>declares for the throne of</em>{d.boardName}</h1>
        <p className="decl-held">held by <Link href={`/u/${encodeURIComponent(d.holder.username)}`}>{ho}</Link></p>
        <blockquote>&ldquo;{d.line}&rdquo;</blockquote>
        <dl className="decl-figs">
          <div><dt>{ho} held it with</dt><dd>{inr(d.holderScore)}</dd></div>
          <div><dt>{ch} stood at</dt><dd>{d.challengerScore ? inr(d.challengerScore) : 'Not on the board'}</dd></div>
          <div><dt>Needed to take it, when declared</dt><dd>{inr(d.required)}</dd></div>
        </dl>
        {took && <p className="decl-story" data-testid="declaration-story"><b>Declared. Then did it.</b> {ch} took {d.boardName} from {ho} {took} after putting it in writing.</p>}
        {d.status === 'throne-moved' && <p className="decl-story">The throne changed hands before {ch} could take it. A new declaration is needed against the new holder.</p>}
        {d.status === 'lapsed' && <p className="decl-story">{ho} saw the season out. The declaration stays on the record, unfulfilled.</p>}
      </article>

      <div className="decl-below">
        <section className="history" style={{ marginTop: 0 }} aria-labelledby="decl-tl">
          <h3 id="decl-tl">The rivalry so far</h3>
          {d.timeline.map((t) => <div className="history-row" key={`${t.kind}-${t.at.getTime()}`} data-testid="declaration-event"><b style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{when(t.at)}</b><span>{line(t)}</span></div>)}
          {viewer?.member.username === d.holder.username && <div style={{ margin: '14px 0' }}><BlockButton name={d.challenger.username} label={ch} /></div>}
          <p style={{ fontSize: 13, color: 'var(--muted-strong)', marginBottom: 0 }}>A declaration moves no rank and costs nothing. Its wording comes from a fixed list; the names and figures come from the board. {ho} can block {ch} from declaring again, and any declaration can be removed by moderators.</p>
        </section>
        <div>
          {d.current && <ThronePrice place={d.boardName} holder={ho} holderScore={d.current.holderScore} myScore={viewer?.member.username === d.challenger.username ? d.current.challengerScore : undefined} />}
          <div className="history" style={{ marginTop: d.current ? 22 : 0 }}>
            <h3>Send it</h3>
            <CopyLink path={`/declare/${d.id}`} shareText={d.status === 'won' ? `${ch} declared for ${d.boardName}. Then took it.` : `${ch} has declared for ${d.boardName}, held by ${ho}. Declaration No. ${d.no}.`} />
            <p style={{ marginTop: 12 }}><a className="btn light" href={`/api/declaration-card/${d.id}`} target="_blank" rel="noopener noreferrer" data-testid="declaration-card-link">Open the declaration card</a></p>
          </div>
        </div>
      </div>
    </>
  );
}
