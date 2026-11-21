import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { pageMetadata, pageJsonLd } from '@/lib/seo';
import Link from 'next/link';
import { getDataSource } from '@/lib/data';
import { CITIES } from '@/lib/geo';
import { CITY_NAMES } from '@/components/cityNames';
import { PastChampionMark } from '@/components/Crown';

const SEO_TITLE = 'Archive: Past Seasons and Champions';
const SEO_DESCRIPTION = "Seasons end. The record stays. The BAAP KA PAISA archive keeps every finished season and every city's champion, frozen for good.";

export const metadata: Metadata = pageMetadata({ title: SEO_TITLE, path: '/archive', description: SEO_DESCRIPTION });

const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toUpperCase();

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ year?: string; city?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const all = await ds.archive();
  const years = [...new Set(all.map((s) => s.year))].sort((a, b) => b - a);
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : null;
  const cityId = CITIES.some((c) => c.id === sp.city) ? sp.city! : 'surat';
  const seasons = all.filter((s) => year === null || s.year === year);
  const href = (p: { year?: number | null; city?: string }) => {
    const q = new URLSearchParams();
    const y = p.year === undefined ? year : p.year; if (y) q.set('year', String(y));
    q.set('city', p.city ?? cityId);
    return `/archive?${q}`;
  };
  return (
    <>
      <JsonLd data={pageJsonLd({ name: 'Archive', path: '/archive', description: SEO_DESCRIPTION })} />
      <section className="page-intro">
        <div><div className="eyebrow">The history books / 05</div><h1>The ones<br />who held it.</h1></div>
        <p>Seasons end. The record stays. Past champions carry an outline mark; the gold crown belongs only to whoever holds #01 right now.</p>
      </section>
      {/* Year and city filters only once there is a finished season to filter. */}
      {all.length > 0 && (
      <div className="filterbar" role="group" aria-label="Filter the archive">
        <Link href={href({ year: null })} aria-current={year === null ? 'true' : undefined}>All seasons</Link>
        {years.map((y) => <Link key={y} href={href({ year: y })} aria-current={year === y ? 'true' : undefined}>{y}</Link>)}
        {CITIES.map((c) => <Link key={c.id} href={href({ city: c.id })} aria-current={cityId === c.id ? 'true' : undefined}>{c.name}</Link>)}
      </div>
      )}
      {seasons.length === 0 ? (
        <div className="board-panel" style={{ margin: '22px 0 70px' }}><div className="state-box" data-testid="archive-empty"><h4>No finished seasons yet.</h4><p>The archive fills when the first season closes. Final standings and every city&apos;s champion are frozen and kept here permanently.</p>
          <div className="hero-cta" style={{ marginTop: 18 }}><Link className="btn light" href="/board">See the current board <span className="arrow" aria-hidden="true">↗</span></Link></div></div></div>
      ) : (
        <div className="archive-list">
          {seasons.map((s) => {
            const champ = s.champions.find((c) => c.cityId === cityId);
            const cname = (m: typeof champ) => m ? (m.member.masked ? m.member.publicLabel : m.member.displayName) : '—';
            return (
              <details className="archive-item" key={s.seasonLabel}>
                <summary>
                  <span className="season-no">{s.seasonLabel.replace('Season ', 'S').replace(/S(\d)$/, 'S0$1')}</span>
                  <span><h3>The {s.monthLabel.split(' ')[0]} register</h3><p>{fmt(s.startsAt)} — {fmt(s.endsAt)} · {CITY_NAMES[cityId]} city</p></span>
                  <span className="champ">{cname(champ)}<PastChampionMark label={`${s.seasonLabel} champion`} /></span>
                  <span className="toggle">View record ↗</span>
                </summary>
                <div className="archive-detail">
                  {s.champions.map((c) => (
                    <div key={c.cityId}><span>{c.cityId === 'india' ? 'India' : CITY_NAMES[c.cityId]} · final #01</span><Link href={`/u/${encodeURIComponent(c.member.username)}`}><b>{c.member.masked ? c.member.publicLabel : c.member.displayName}</b></Link></div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
