import { describe, expect, it } from 'vitest';
import { demoSource } from '@/lib/data/demo';
import { unavailableSource } from '@/lib/data/unavailable';
import { CITIES, LEVELS } from '@/lib/geo';

describe('demo data source', () => {
  it('returns rows already ranked 1..n with one #01 per board, at every level and city', async () => {
    for (const city of CITIES) for (const level of LEVELS) {
      const b = await demoSource.board({ level, cityId: city.id, locality: city.localities[0] });
      expect(b.rows.map((r) => r.rank)).toEqual(b.rows.map((_, i) => i + 1));
      expect(b.rows.filter((r) => r.rank === 1).length).toBe(b.total > 0 ? 1 : 0);
      for (let i = 1; i < b.rows.length; i++) expect(b.rows[i - 1].member.seasonScore).toBeGreaterThanOrEqual(b.rows[i].member.seasonScore);
    }
  });
  it('one member counts on four boards at once', async () => {
    const st = await demoSource.standings('ishaan.m');
    expect(st.map((s) => s.level)).toEqual(['locality', 'city', 'state', 'india']);
    expect(st.every((s) => s.rank !== null && s.rank <= s.of)).toBe(true);
  });
  it('different boards can have different #01 holders', async () => {
    const surat = await demoSource.board({ level: 'city', cityId: 'surat', locality: 'Vesu' });
    const india = await demoSource.board({ level: 'india', cityId: 'surat', locality: 'Vesu' });
    expect(surat.rows[0].member.username).not.toBe(india.rows[0].member.username);
  });
  it('never exposes a name for Mystery mode members', async () => {
    const m = await demoSource.member('ANON-07');
    expect(m?.masked).toBe(true);
    expect(m?.displayName).toBeNull();
    expect(Object.keys(m!)).not.toContain('phone');
  });
  it('honest count stays the full board size when a search narrows the rows', async () => {
    const b = await demoSource.board({ level: 'city', cityId: 'surat', locality: 'Vesu' }, { query: 'vesu' });
    expect(b.total).toBe(16);
    expect(b.rows.length).toBeLessThan(16);
  });
  it('empty localities stay empty', async () => {
    const b = await demoSource.board({ level: 'locality', cityId: 'surat', locality: 'Althan' });
    expect(b.total).toBe(0);
  });
});

describe('unavailable data source', () => {
  it('invents nothing', async () => {
    const s = unavailableSource(null);
    expect((await s.board({ level: 'city', cityId: 'surat', locality: 'Vesu' })).total).toBe(0);
    expect(await s.viewer()).toBeNull();
    expect(await s.cities()).toEqual([]);
    expect(await s.archive()).toEqual([]);
    expect(s.season().number).toBeNull();
  });
});
