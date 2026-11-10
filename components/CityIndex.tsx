'use client';
// City index with working region filter and sort. Sorting here only orders cities for browsing;
// it never decides a member's rank.
import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface CityCardData { id: string; name: string; stateCode: string; region: string; mark: string; nickname: string; members: number | null; total: number | null; isViewerCity: boolean; }

export function CityIndex({ cities, regions }: { cities: CityCardData[]; regions: string[] }) {
  const [region, setRegion] = useState('All');
  const [sort, setSort] = useState<'members' | 'alpha' | 'total'>('members');
  const list = useMemo(() => {
    const l = cities.filter((c) => region === 'All' || c.region === region);
    return [...l].sort((a, b) => sort === 'alpha' ? a.name.localeCompare(b.name) : sort === 'total' ? (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name) : (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name));
  }, [cities, region, sort]);
  return (
    <>
      <div className="filterbar" role="group" aria-label="Filter cities">
        {['All', ...regions].map((r) => (
          <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)}>{r === 'All' ? 'All cities' : `${r} India`}</button>
        ))}
        <label><span className="sr-only">Sort cities</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="members">Sort: Most members</option><option value="alpha">Alphabetical</option><option value="total">Top board total</option>
          </select>
        </label>
      </div>
      <div className="city-grid">
        {list.map((c) => (
          <Link key={c.id} className="city-card" href={`/board?level=city&city=${c.id}`} data-testid={`city-${c.id}`}>
            <span className="watermark" aria-hidden="true">{c.mark}</span>
            <span className="city-rank">{c.stateCode} / {c.region} India</span>
            <span><h3>{c.name}</h3><p>{c.nickname}{c.members !== null ? ` · ${c.members} on the board` : ''}</p></span>
            <span className="city-footer"><span>{c.isViewerCity ? 'Your city' : 'Season open'}</span><b>Open board ↗</b></span>
          </Link>
        ))}
      </div>
    </>
  );
}
