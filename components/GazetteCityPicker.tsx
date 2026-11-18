'use client';
// City edition picker for The Gazette: the current edition stays in front; "Change city" opens a search field and
// the cities grouped by state, as ordinary links (keyboard and screen-reader friendly, works as a plain list).
import Link from 'next/link';
import { useMemo, useState } from 'react';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim();

export function GazetteCityPicker({ currentId, currentName, groups }: { currentId: string; currentName: string; groups: { label: string; cities: { id: string; name: string }[] }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = norm(q);
    return groups.map((g) => ({ ...g, cities: g.cities.filter((c) => !n || norm(c.name).includes(n) || norm(g.label).includes(n)) })).filter((g) => g.cities.length > 0);
  }, [groups, q]);
  return (
    <div className="gz-picker">
      <button type="button" className="gz-picker-toggle" aria-expanded={open} aria-controls="gz-editions" onClick={() => setOpen((o) => !o)} data-testid="gazette-city-toggle">
        <span>Edition: <b>{currentName}</b></span><span aria-hidden="true">{open ? 'Close −' : 'Change city +'}</span>
      </button>
      <div id="gz-editions" className="gz-picker-panel" hidden={!open}>
        <label><span className="sr-only">Search a city edition</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city or state" data-testid="gazette-city-search" />
        </label>
        <nav aria-label="City editions">
          {shown.length === 0 && <p className="gz-picker-none">No city matches “{q}”.</p>}
          {shown.map((g) => (
            <div key={g.label} className="gz-picker-group">
              <small>{g.label}</small>
              <div>{g.cities.map((c) => <Link key={c.id} href={`/gazette?city=${c.id}`} aria-current={c.id === currentId ? 'page' : undefined} onClick={() => setOpen(false)}>{c.name}</Link>)}</div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
