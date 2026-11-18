import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { getDataSourceEarly, rankingsOpen } from '@/lib/data';
import { CITIES, REGIONS, STATES, STATE_ORDER } from '@/lib/geo';
import { CityIndex, type CityCardData } from '@/components/CityIndex';

export const metadata: Metadata = pageMetadata({
  title: 'Cities',
  path: '/cities',
  description: "Find your territory. 45 cities across 19 states and union territories, grouped by state, each with its own locality, city, state and India boards on the BAAP KA PAISA register.",
});

export default async function CitiesPage() {
  // Reads start in the same round trip as the season row; only the member's own profile (one prefetched read) is needed.
  const ds = await getDataSourceEarly();
  const [summaries, me] = await Promise.all([ds.cities(), ds.viewerMember(), ds.ready()]);
  const viewer = me ? { member: me } : null;
  const cards: CityCardData[] = CITIES.map((c) => {
    const s = summaries.find((x) => x.cityId === c.id);
    return { id: c.id, name: c.name, stateCode: c.state, stateName: STATES[c.state], region: c.region, mark: c.mark, nickname: c.nickname ?? STATES[c.state],
      members: s ? s.members : null, total: s ? s.seasonTotal : null, isViewerCity: viewer?.member.cityId === c.id };
  });
  const states = STATE_ORDER.map((code) => ({ code, name: STATES[code] }));
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">The geographic index / 02</div><h1>Find your<br />territory.</h1></div>
        <p>Start where you live. Follow the local scene. {CITIES.length} cities across {STATE_ORDER.length} states and UTs.{!rankingsOpen(ds) ? ' Member counts appear once rankings open.' : ''}</p>
      </section>
      <CityIndex cities={cards} regions={[...REGIONS]} states={states} />
    </>
  );
}
