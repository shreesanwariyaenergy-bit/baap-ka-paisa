'use client';
// City index: search, region filter and sort, with cities grouped under their state or union territory.
// Sorting here only orders cities for browsing; it never decides a member's rank.
import { IntentLink } from './IntentLink';
import { useMemo, useState } from 'react';

export interface CityCardData { id: string; name: string; stateCode: string; stateName: string; region: string; mark: string; nickname: string; members: number | null; total: number | null; isViewerCity: boolean; }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim();

export function CityIndex({ cities, regions, states }: { cities: CityCardData[]; regions: string[]; states: { code: string; name: string }[] }) {
  const [region, setRegion] = useState('All');
  const [sort, setSort] = useState<'members' | 'alpha' | 'total'>('members');
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = norm(query);
    const shown = cities.filter((c) => (region === 'All' || c.region === region) && (!q || norm(c.name).includes(q) || norm(c.stateName).includes(q)));
    const order = (a: CityCardData, b: CityCardData) => sort === 'alpha' ? a.name.localeCompare(b.name)
      : sort === 'total' ? (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name)
      : (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name);
    return states.map((s) => ({ ...s, cities: shown.filter((c) => c.stateCode === s.code).sort(order) })).filter((g) => g.cities.length > 0);
  }, [cities, states, region, sort, query]);
  const count = groups.reduce((n, g) => n + g.cities.length, 0);
  return (
    <>
      <div className="filterbar city-filters" role="group" aria-label="Find and filter cities">
        <label><span className="sr-only">Search cities or states</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a city or state" data-testid="city-search" />
        </label>
        <label><span className="sr-only">Sort cities</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="members">Sort: Most members</option><option value="alpha">Alphabetical</option><option value="total">Top board total</option>
          </select>
        </label>
        <div className="region-chips" role="group" aria-label="Region">
          {['All', ...regions].map((r) => (
            <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)} data-testid={`region-${r}`}>{r === 'All' ? 'All cities' : `${r} India`}</button>
          ))}
        </div>
      </div>
      <p className="city-count" aria-live="polite" data-testid="city-count">{count === cities.length ? `${count} cities` : `${count} of ${cities.length} cities`}</p>
      {groups.length === 0 && <p className="activity-empty" data-testid="city-empty">No city or state matches “{query}”.</p>}
      {groups.map((g) => (
        <section key={g.code} className="state-group" aria-labelledby={`state-${g.code}`} data-testid={`state-${g.code}`}>
          <h2 className="state-head" id={`state-${g.code}`}>{g.name}<span>{g.cities.length} {g.cities.length === 1 ? 'city' : 'cities'}</span></h2>
          <div className="city-grid">
            {g.cities.map((c) => (
              <IntentLink key={c.id} className="city-card" href={`/board?level=city&city=${c.id}`} data-testid={`city-${c.id}`}>
                <span className="watermark" aria-hidden="true">{c.mark}</span>
                <span className="city-rank">{c.stateCode} / {c.region} India</span>
                <span><h3>{c.name}</h3><p>{c.nickname}{c.members !== null ? ` · ${c.members} on the board` : ''}</p></span>
                <span className="city-footer"><span>{c.isViewerCity ? 'Your city' : 'Season open'}</span><b>Open board ↗</b></span>
              </IntentLink>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
