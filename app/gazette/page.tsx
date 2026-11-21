import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';
import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
import { DEFAULT_CITY_ID, cityById, cityOptionGroups, type Scope } from '@/lib/geo';
import { GazetteCityPicker } from '@/components/GazetteCityPicker';
import { noindexMetadata, pageMetadata, pageJsonLd } from '@/lib/seo';
import { buildEdition } from '@/lib/gazette';
import { inr, inrShort } from '@/lib/format';
import { CopyLink } from '@/components/CopyLink';

// /gazette (the default edition) is indexable; each city edition (/gazette?city=…) is named but kept out of search
// results while editions carry no members' news.
const SEO_TITLE = 'The Gazette: Throne News for Every City';
const SEO_DESCRIPTION = "The Gazette reports the fight for the throne in every city: who holds #01, who took it and every notice of dethronement, from the register's own records.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  if (Object.keys(sp).length === 0) return pageMetadata({ title: SEO_TITLE, path: '/gazette', description: SEO_DESCRIPTION });
  const city = cityById(typeof sp.city === 'string' ? sp.city : undefined)?.name;
  return noindexMetadata(city ? `The ${city} Gazette` : 'The Gazette');
}

export default async function GazettePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const sp = await searchParams;
  // Reads start in the same round trip as the season row; the member's own profile (one prefetched read) is only
  // needed when the address names no city.
  const ds = await getDataSourceEarly();
  const viewerCity = cityById(sp.city) ? null : (await ds.viewerMember())?.cityId;
  const city = cityById(sp.city) ?? cityById(viewerCity) ?? cityById(DEFAULT_CITY_ID)!;
  const scope: Scope = { level: 'city', cityId: city.id, locality: city.localities[0] };
  const now = ds.now();
  const [board, reigns, moments, events, cities, respect, backed, declarations] = await Promise.all([
    ds.board(scope, { limit: 10 }), ds.throneHistory({ scope, limit: 40 }), ds.crownMoments(scope, new Date(now.getTime() - 7 * 86_400_000)),
    ds.events(scope, 12), ds.cities(), ds.respectBoard(scope, { limit: 3 }), ds.mostBacked(city.id, 3), ds.declarations({ cityId: city.id }),
  ]);
  await ds.ready();
  const ed = buildEdition({ city, season: ds.season(), now, open: rankingsOpen(ds), board, reigns, moments, events, cities, respect, backed, declarations });
  const showPrices = rankingsOpen(ds) && ed.prices.some((c) => c.price > 1000);
  const showStanding = ed.standing.some((c) => c.total > 0);
  const hasStories = ed.stories.length > 0;
  const hasSide = ed.notices.length > 0 || ed.declarations.length > 0 || showPrices || showStanding;
  const hasBody = hasStories || hasSide;
  return (
    <article className="gazette" data-testid="gazette">
      <JsonLd data={pageJsonLd({ name: 'The Gazette', path: '/gazette', description: SEO_DESCRIPTION })} />
      <header className="gz-mast">
        <div className="gz-ears"><span>{ed.issue}</span><span>Late city edition</span><span>Price: your pride</span></div>
        <h1>The {city.name} Gazette</h1>
        <div className="gz-rule"><span>{ed.dateline}</span><span>Published by order of the Register</span>{ds.availability === 'demo' && <span className="gz-demo">Demo data: invented members</span>}</div>
        <GazetteCityPicker currentId={city.id} currentName={city.name} groups={cityOptionGroups()} />
      </header>

      <section className={`gz-lead${ed.lead.tone === 'hot' ? ' hot' : ''}`} data-testid="gazette-lead">
        <div className="gz-kicker">{ed.lead.kicker}</div>
        <h2>{ed.lead.href ? <Link href={ed.lead.href}>{ed.lead.headline}</Link> : ed.lead.headline}</h2>
        <p>{ed.lead.body}</p>
        <div className="gz-share">
          <CopyLink path={`/gazette?city=${city.id}`} shareText={ed.shareLine} />
          <a className="btn light" href={`/api/gazette-card/${city.id}`} target="_blank" rel="noopener noreferrer" data-testid="gazette-card-link">Front page as an image</a>
          {ed.quiet && <Link className="btn light" href="/join">Be the first name</Link>}
        </div>
      </section>

      {/* Only sections with records are shown; an edition with no news is the lead story alone, not a page of "none" boxes. */}
      {hasBody && (
      <div className={hasStories && hasSide ? 'gz-body' : 'gz-body single'}>
        {hasStories && (
          <section className="gz-stories" aria-label="More from the register">
            {ed.stories.map((s) => (
              <div className={`gz-story${s.tone === 'hot' ? ' hot' : ''}`} key={s.headline}>
                <div className="gz-kicker">{s.kicker}</div>
                <h3>{s.href ? <Link href={s.href}>{s.headline}</Link> : s.headline}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </section>
        )}
        {hasSide && (
        <aside className="gz-side">
          {ed.notices.length > 0 && (
            <section aria-labelledby="gz-notices">
              <h3 id="gz-notices" className="gz-sidehead">Notices of dethronement</h3>
              {ed.notices.slice(0, 6).map((n) => (
                <div className="gz-notice" key={n.no} data-testid="gazette-notice">
                  <b>Notice No. {n.no}</b>
                  <p>{n.text}</p>
                </div>
              ))}
              <Link className="gz-more" href={`/throne?level=city&city=${city.id}`}>Full throne history ↗</Link>
            </section>
          )}
          {ed.declarations.length > 0 && (
            <section aria-labelledby="gz-decl">
              <h3 id="gz-decl" className="gz-sidehead">Declarations</h3>
              {ed.declarations.map((d) => <Link className="gz-notice" style={{ display: 'block' }} key={d.id} href={`/declare/${d.id}`} data-testid="gazette-declaration"><b>No. {d.no} · {d.status === 'won' ? 'made good' : d.status === 'standing' ? 'standing' : d.status === 'lapsed' ? 'lapsed' : 'throne moved'}</b><p>{d.text}</p></Link>)}
            </section>
          )}
          {showPrices && (
            <section aria-labelledby="gz-prices">
              <h3 id="gz-prices" className="gz-sidehead">Price of each throne today</h3>
              <ol className="gz-table" data-testid="gazette-prices">
                {ed.prices.map((c, n) => <li key={c.name} className={c.isCity ? 'me' : undefined}><span>{n + 1}</span><b>{c.name}</b><i>{inr(c.price)}</i></li>)}
              </ol>
            </section>
          )}
          {showStanding && (
            <section aria-labelledby="gz-cities">
              <h3 id="gz-cities" className="gz-sidehead">City against city</h3>
              <ol className="gz-table">
                {ed.standing.map((c) => <li key={c.name} className={c.isCity ? 'me' : undefined}><span>{c.rank}</span><b>{c.name}</b><i>{inrShort(c.total)}</i></li>)}
              </ol>
            </section>
          )}
        </aside>
        )}
      </div>
      )}
      <footer className="gz-foot">Every line in this edition is written from the register&apos;s own records. No prizes. No cash-outs. The record stays.</footer>
    </article>
  );
}
