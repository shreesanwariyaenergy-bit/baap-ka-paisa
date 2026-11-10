'use client';
// City, locality and search controls for The Board. They only change the URL; the server ranks the board.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Level } from '@/lib/geo';

export function BoardFilters({ view, level, cityId, locality, query, cities, localities }: {
  view: string; level: Level; cityId: string; locality: string; query: string; cities: { id: string; name: string }[]; localities: readonly string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const go = (p: Record<string, string>) => {
    const s = new URLSearchParams({ level, city: cityId, ...(level === 'locality' ? { locality } : {}), ...(view !== 'season' ? { view } : {}), ...p });
    if (!s.get('q')) s.delete('q');
    router.push(`/board?${s.toString()}`);
  };
  return (
    <>
      {level !== 'india' && (
        <label><span className="sr-only">City</span>
          <select value={cityId} onChange={(e) => go({ city: e.target.value, locality: '', q: '' })} data-testid="city-select">
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      {level === 'locality' && (
        <label><span className="sr-only">Locality</span>
          <select value={locality} onChange={(e) => go({ locality: e.target.value, q: '' })} data-testid="locality-select">
            {localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      {view === 'season' && <form role="search" onSubmit={(e) => { e.preventDefault(); go({ q }); }} style={{ display: 'contents' }}>
        <label><span className="sr-only">Find a member on this board</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member on this board" />
        </label>
      </form>}
    </>
  );
}
