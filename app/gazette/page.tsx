import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { CITIES, DEFAULT_CITY_ID, cityById, type Scope } from '@/lib/geo';
import { buildEdition } from '@/lib/gazette';
import { inr, inrShort } from '@/lib/format';
import { CopyLink } from '@/components/CopyLink';

export const metadata: Metadata = { title: 'The Gazette' };

export default async function GazettePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  const city = cityById(sp.city) ?? cityById(viewer?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
  const scope: Scope = { level: 'city', cityId: city.id, locality: city.localities[0] };
  const now = ds.now();
  const [board, reigns, moments, events, cities, respect, backed, declarations] = await Promise.all([
    ds.board(scope, { limit: 10 }), ds.throneHistory({ scope, limit: 40 }), ds.crownMoments(scope, new Date(now.getTime() - 7 * 86_400_000)),
    ds.events(scope, 12), ds.cities(), ds.respectBoard(scope, { limit: 3 }), ds.mostBacked(city.id, 3), ds.declarations({ cityId: city.id }),
  ]);
  const ed = buildEdition({ city, season: ds.season(), now, open: rankingsOpen(ds), board, reigns, moments, events, cities, respect, backed, declarations });
  return (
    <article className="gazette" data-testid="gazette">
      <header className="gz-mast">
        <div className="gz-ears"><span>{ed.issue}</span><span>Late city edition</span><span>Price: your pride</span></div>
        <h1>The {city.name} Gazette</h1>
        <div className="gz-rule"><span>{ed.dateline}</span><span>Published by order of the Register</span>{ds.availability === 'demo' && <span className="gz-demo">Demo data: invented members</span>}</div>
        <nav className="gz-cities" aria-label="City editions">
          {CITIES.map((c) => <Link key={c.id} href={`/gazette?city=${c.id}`} aria-current={c.id === city.id ? 'page' : undefined}>{c.name}</Link>)}
        </nav>
      </header>

      <section className={`gz-lead${ed.lead.tone === 'hot' ? ' hot' : ''}`} data-testid="gazette-lead">
        <div className="gz-kicker">{ed.lead.kicker}</div>
        <h2>{ed.lead.href ? <Link href={ed.lead.href}>{ed.lead.headline}</Link> : ed.lead.headline}</h2>
        <p>{ed.lead.body}</p>
        <div className="gz-share">
          <CopyLink path={`/gazette?city=${city.id}`} shareText={ed.shareLine} />
          {ed.quiet && <Link className="btn light" href="/join">Be the first name</Link>}
        </div>
      </section>

      <div className="gz-body">
        <section className="gz-stories" aria-label="More from the register">
          {ed.stories.length === 0 && <p className="gz-quiet">No further news. The register is quiet, which is exactly when thrones get taken.</p>}
          {ed.stories.map((s) => (
            <div className={`gz-story${s.tone === 'hot' ? ' hot' : ''}`} key={s.headline}>
              <div className="gz-kicker">{s.kicker}</div>
              <h3>{s.href ? <Link href={s.href}>{s.headline}</Link> : s.headline}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </section>
        <aside className="gz-side">
          <section aria-labelledby="gz-notices">
            <h3 id="gz-notices" className="gz-sidehead">Notices of dethronement</h3>
            {ed.notices.length === 0 && <p className="gz-quiet">None issued this season. Every change of #01 is recorded here, numbered, permanently.</p>}
            {ed.notices.slice(0, 6).map((n) => (
              <div className="gz-notice" key={n.no} data-testid="gazette-notice">
                <b>Notice No. {n.no}</b>
                <p>{n.text}</p>
              </div>
            ))}
            <Link className="gz-more" href={`/throne?level=city&city=${city.id}`}>Full throne history ↗</Link>
          </section>
          {ed.declarations.length > 0 && (
            <section aria-labelledby="gz-decl">
              <h3 id="gz-decl" className="gz-sidehead">Declarations</h3>
              {ed.declarations.map((d) => <Link className="gz-notice" style={{ display: 'block' }} key={d.id} href={`/declare/${d.id}`} data-testid="gazette-declaration"><b>No. {d.no} · {d.status === 'won' ? 'made good' : d.status === 'standing' ? 'standing' : d.status === 'lapsed' ? 'lapsed' : 'throne moved'}</b><p>{d.text}</p></Link>)}
            </section>
          )}
          {rankingsOpen(ds) && ed.prices.some((c) => c.price > 1000) && (
            <section aria-labelledby="gz-prices">
              <h3 id="gz-prices" className="gz-sidehead">Price of each throne today</h3>
              <ol className="gz-table" data-testid="gazette-prices">
                {ed.prices.map((c, n) => <li key={c.name} className={c.isCity ? 'me' : undefined}><span>{n + 1}</span><b>{c.name}</b><i>{inr(c.price)}</i></li>)}
              </ol>
            </section>
          )}
          {ed.standing.some((c) => c.total > 0) && (
            <section aria-labelledby="gz-cities">
              <h3 id="gz-cities" className="gz-sidehead">City against city</h3>
              <ol className="gz-table">
                {ed.standing.map((c) => <li key={c.name} className={c.isCity ? 'me' : undefined}><span>{c.rank}</span><b>{c.name}</b><i>{inrShort(c.total)}</i></li>)}
              </ol>
            </section>
          )}
        </aside>
      </div>
      <footer className="gz-foot">Every line in this edition is written from the register&apos;s own records. No prizes. No cash-outs. The record stays.</footer>
    </article>
  );
}
