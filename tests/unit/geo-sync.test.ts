// The website's geography (lib/geo.ts) and the database's reference data (the migrations that insert states,
// cities and localities) must describe exactly the same records. Registration checks the chosen locality against
// the database, so a city or locality present in one and not the other would break sign-up or hide a board.
//
// The migrations are read as data: every row their INSERT statements add to public.states, public.cities and
// public.localities is extracted and compared, record by record and in order, with lib/geo.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CITIES, OTHER_LOCALITY, REGIONS, STATES, STATE_ORDER, STATE_REGION, UNION_TERRITORIES, citiesByState, localityLabel, scopeName } from '@/lib/geo';

const FILES = ['supabase/migrations/20261110000100_reference_data.sql', 'supabase/pending/20261118001600_city_expansion.sql'];

/** Rows inserted into public.<table>, in insertion order, as arrays of string values (numeric ordering keys dropped). */
function insertedRows(sql: string, table: string): string[][] {
  const rows: string[][] = [];
  const re = new RegExp(`insert into public\\.${table} \\(([^)]*)\\)([\\s\\S]*?);\\s*\\n`, 'g');
  for (const m of sql.matchAll(re)) {
    for (const t of m[2].matchAll(/\(([^()]*)\)/g)) {
      const vals = [...t[1].matchAll(/'((?:[^']|'')*)'/g)].map((v) => v[1].replace(/''/g, "'"));
      if (vals.length) rows.push(vals);
    }
  }
  return rows;
}
const sql = FILES.map((f) => readFileSync(f, 'utf8'));
const db = {
  states: sql.flatMap((s) => insertedRows(s, 'states')).map(([code, name]) => ({ code, name })),
  cities: sql.flatMap((s) => insertedRows(s, 'cities')).map(([id, name, state, region]) => ({ id, name, state, region })),
  localities: sql.flatMap((s) => insertedRows(s, 'localities')).map(([cityId, name]) => ({ cityId, name })),
};

describe('geography: website and database agree', () => {
  it('the same 19 states and union territories (DL is labelled "Delhi (NCT)" on the website only)', () => {
    expect(db.states).toHaveLength(19);
    expect(db.states.map((s) => s.code).sort()).toEqual([...STATE_ORDER].sort());
    for (const s of db.states) expect(s.code === 'DL' ? 'Delhi (NCT)' : s.name).toBe(STATES[s.code as keyof typeof STATES]);
    expect(db.states.find((s) => s.code === 'DL')!.name).toBe('Delhi');   // the existing database row is not renamed
  });
  it('the same 45 cities, with the same names, states and regions, in the same order', () => {
    expect(db.cities).toHaveLength(45);
    expect(db.cities).toEqual(CITIES.map((c) => ({ id: c.id, name: c.name, state: c.state, region: c.region })));
  });
  it('the same localities for every city, in the same order', () => {
    for (const c of CITIES) expect(db.localities.filter((l) => l.cityId === c.id).map((l) => l.name), c.id).toEqual([...c.localities]);
    expect(db.localities).toHaveLength(CITIES.reduce((n, c) => n + c.localities.length, 0));
  });
  it('the five launch cities are unchanged (ids, names, marks, references and localities)', () => {
    const first = CITIES.slice(0, 5).map((c) => [c.id, c.name, c.state, c.region, c.mark, c.indexRef, c.localities.length]);
    expect(first).toEqual([
      ['surat', 'Surat', 'GJ', 'West', 'ST', 'GJ-05', 15], ['ahmedabad', 'Ahmedabad', 'GJ', 'West', 'AMD', 'GJ-01', 13],
      ['mumbai', 'Mumbai', 'MH', 'West', 'MB', 'MH-01', 15], ['pune', 'Pune', 'MH', 'West', 'PUN', 'MH-12', 13], ['delhi', 'Delhi', 'DL', 'North', 'DEL', 'DL', 11],
    ]);
    expect(CITIES[0].localities.slice(0, 3)).toEqual(['Vesu', 'Adajan', 'Pal']);
  });
});

describe('geography: structure', () => {
  it('45 cities, 19 states and UTs, 6 regions; every state has a city', () => {
    expect(CITIES).toHaveLength(45);
    expect(STATE_ORDER).toHaveLength(19);
    expect(REGIONS).toEqual(['West', 'North', 'South', 'East', 'Central', 'North-East']);
    expect(new Set(CITIES.map((c) => c.region)).size).toBe(6);
    expect(citiesByState().map((g) => g.code)).toEqual(STATE_ORDER);
    expect(citiesByState().reduce((n, g) => n + g.cities.length, 0)).toBe(45);
    expect(UNION_TERRITORIES).toEqual(['DL', 'CH']);
  });
  it('each city sits in its state\'s region; administrative assignments hold', () => {
    for (const c of CITIES) expect(c.region, c.id).toBe(STATE_REGION[c.state]);
    const st = (id: string) => CITIES.find((c) => c.id === id)!.state;
    expect([st('gurugram'), st('faridabad'), st('noida'), st('ghaziabad'), st('delhi'), st('chandigarh')]).toEqual(['HR', 'HR', 'UP', 'UP', 'DL', 'CH']);
    expect(STATE_REGION.RJ).toBe('West');
    expect(CITIES.some((c) => /new ?delhi|ncr/i.test(c.id + c.name))).toBe(false);
  });
  it('ids follow the database rule, and ids, names and marks are unique', () => {
    for (const c of CITIES) expect(c.id, c.id).toMatch(/^[a-z]+$/);
    for (const k of ['id', 'name', 'mark'] as const) expect(new Set(CITIES.map((c) => c[k])).size, k).toBe(45);
  });
  it('localities: unique within a city, a short list of major areas, Other last and only once', () => {
    for (const c of CITIES) {
      expect(new Set(c.localities).size, c.id).toBe(c.localities.length);
      expect(c.localities.at(-1), c.id).toBe(OTHER_LOCALITY);
      expect(c.localities.filter((l) => l === OTHER_LOCALITY), c.id).toHaveLength(1);
    }
    for (const c of CITIES.slice(5)) expect(c.localities.length - 1, c.id).toBeGreaterThanOrEqual(4);
    for (const c of CITIES.slice(5)) expect(c.localities.length - 1, c.id).toBeLessThanOrEqual(8);
  });
  it('sector bands do not overlap', () => {
    for (const c of CITIES) {
      const bands = c.localities.map((l) => /^Sectors (\d+)–(\d+)$/.exec(l)).filter(Boolean).map((m) => [Number(m![1]), Number(m![2])]).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < bands.length; i++) expect(bands[i][0], c.id).toBeGreaterThan(bands[i - 1][1]);
    }
  });
  it('the Other locality board is named for its city; ordinary localities keep their name', () => {
    expect(localityLabel({ name: 'Surat' }, 'Other')).toBe('Other areas of Surat');
    expect(scopeName({ level: 'locality', cityId: 'jaipur', locality: 'Other' })).toBe('Other areas of Jaipur');
    expect(scopeName({ level: 'locality', cityId: 'surat', locality: 'Vesu' })).toBe('Vesu');
    expect(scopeName({ level: 'state', cityId: 'delhi', locality: 'Dwarka' })).toBe('Delhi (NCT)');
  });
});
