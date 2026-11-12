import type { Metadata } from 'next';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { CITIES, STATES } from '@/lib/geo';
import { CityIndex, type CityCardData } from '@/components/CityIndex';

export const metadata: Metadata = { title: 'Cities' };

export default async function CitiesPage() {
  const ds = await getDataSource();
  const [summaries, viewer] = await Promise.all([ds.cities(), ds.viewer()]);
  const cards: CityCardData[] = CITIES.map((c) => {
    const s = summaries.find((x) => x.cityId === c.id);
    return { id: c.id, name: c.name, stateCode: c.state, region: c.region, mark: c.mark, nickname: c.nickname ?? STATES[c.state],
      members: s ? s.members : null, total: s ? s.seasonTotal : null, isViewerCity: viewer?.member.cityId === c.id };
  });
  const regions = [...new Set(CITIES.map((c) => c.region))];
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">The geographic index / 02</div><h1>Find your<br />territory.</h1></div>
        <p>Start where you live. Follow the local scene. Five launch cities across {[...new Set(CITIES.map((c) => STATES[c.state]))].join(', ')}.{!rankingsOpen(ds) ? ' Member counts appear once rankings open.' : ''}</p>
      </section>
      <CityIndex cities={cards} regions={regions} />
    </>
  );
}
