'use client';
// City index: search, region filter and sort, with cities grouped under their state or union territory.
// Sorting here only orders cities for browsing; it never decides a member's rank.
// On phones each state is a collapsible group (a real button with aria-expanded): the visitor's own state, or the
// first, starts open, and every group opens while a search or region filter is active. From 721px up all groups
// are open and the state names are plain headings.
import { IntentLink } from './IntentLink';
import { useEffect, useMemo, useState } from 'react';

export interface CityCardData { id: string; name: string; stateCode: string; stateName: string; region: string; mark: string; nickname: string; members: number | null; total: number | null; isViewerCity: boolean; }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim();
const DESKTOP = '(min-width: 721px)';

export function CityIndex({ cities, regions, states, open }: { cities: CityCardData[]; regions: string[]; states: { code: string; name: string }[]; /** Rankings open (the season state): drives the card labels. */ open: boolean }) {
  const [region, setRegion] = useState('All');
  const [sort, setSort] = useState<'members' | 'alpha' | 'total'>('members');
  const [query, setQuery] = useState('');
  const firstState = cities.find((c) => c.isViewerCity)?.stateCode ?? states[0]?.code;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(firstState ? [firstState] : []));
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setDesktop(mq.matches);
    sync(); mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const groups = useMemo(() => {
    const q = norm(query);
    const shown = cities.filter((c) => (region === 'All' || c.region === region) && (!q || norm(c.name).includes(q) || norm(c.stateName).includes(q)));
    const order = (a: CityCardData, b: CityCardData) => sort === 'alpha' ? a.name.localeCompare(b.name)
      : sort === 'total' ? (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name)
      : (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name);
    return states.map((s) => ({ ...s, cities: shown.filter((c) => c.stateCode === s.code).sort(order) })).filter((g) => g.cities.length > 0);
  }, [cities, states, region, sort, query]);
  const count = groups.reduce((n, g) => n + g.cities.length, 0);
  const filtering = region !== 'All' || norm(query) !== '';
  const toggle = (code: string) => setExpanded((e) => { const n = new Set(e); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  return (
    <>
      <div className="filterbar city-filters" role="group" aria-label="Find and filter cities">
        <label className="city-search"><span className="sr-only">Search cities or states</span>
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
      {groups.map((g) => {
        const isOpen = desktop || filtering || expanded.has(g.code);
        const listId = `state-cities-${g.code}`;
        const label = `${g.cities.length} ${g.cities.length === 1 ? 'city' : 'cities'}`;
        return (
          <section key={g.code} className="state-group" aria-labelledby={`state-${g.code}`} data-testid={`state-${g.code}`} data-open={isOpen ? 'true' : 'false'}>
            <h2 className="state-head" id={`state-${g.code}`}>
              {desktop ? <>{g.name}<span>{label}</span></> : (
                <button type="button" aria-expanded={isOpen} aria-controls={listId} disabled={filtering} onClick={() => toggle(g.code)}>
                  <span className="state-name">{g.name}</span><span>{label}</span><span className="state-sign" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
              )}
            </h2>
            <div className="city-grid" id={listId} hidden={!isOpen}>
              {g.cities.map((c) => (
                <IntentLink key={c.id} className="city-card" href={`/board?level=city&city=${c.id}`} data-testid={`city-${c.id}`}>
                  <span className="watermark" aria-hidden="true">{c.mark}</span>
                  <span className="city-main"><h3>{c.name}</h3>{(c.nickname || c.members !== null) && <p>{[c.nickname, c.members !== null ? `${c.members} on the board` : ''].filter(Boolean).join(' · ')}</p>}</span>
                  <span className="city-rank">{c.stateCode} · {c.region} India</span>
                  <span className="city-footer"><span>{c.isViewerCity ? 'Your city' : open ? 'Season open' : 'Opens with Season 1'}</span><b>Open board ↗</b></span>
                </IntentLink>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
