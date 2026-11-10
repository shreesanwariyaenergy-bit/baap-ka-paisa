import { describe, expect, it } from 'vitest';
import { seasonFor, timeLeft } from '@/lib/season';
import { parseScope, scopeName } from '@/lib/geo';
import { inr, inrShort } from '@/lib/format';

describe('season calendar in Asia/Kolkata', () => {
  it('23:59 IST on 30 November is still the November season', () => {
    const s = seasonFor(new Date('2026-11-30T18:29:00Z'));
    expect(s.monthLabel).toBe('November 2026');
  });
  it('00:00 IST on 1 December starts the December season', () => {
    expect(seasonFor(new Date('2026-11-30T18:30:00Z')).monthLabel).toBe('December 2026');
  });
  it('season starts at 00:00 IST on the 1st and closes at 23:59 IST on the last day', () => {
    const s = seasonFor(new Date('2026-11-10T12:00:00Z'));
    expect(s.startsAt.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(s.endsAt.toISOString()).toBe('2026-11-30T18:29:00.000Z');
  });
  it('has no season number until the launch month is configured', () => {
    expect(seasonFor(new Date('2026-11-10T12:00:00Z')).number).toBeNull();
    expect(seasonFor(new Date('2026-11-10T12:00:00Z'), '2026-08').number).toBe(4);
    expect(seasonFor(new Date('2026-07-10T12:00:00Z'), '2026-08').number).toBeNull();
  });
  it('reports time left and closure', () => {
    const s = seasonFor(new Date('2026-11-10T12:30:00Z'));
    expect(timeLeft(s, new Date('2026-11-10T12:30:00Z'))).toEqual({ days: 20, hours: 5, closed: false });
    expect(timeLeft(s, new Date('2026-12-02T00:00:00Z')).closed).toBe(true);
  });
});

describe('scope parsing and formatting', () => {
  it('rejects unknown input and falls back to valid values', () => {
    expect(parseScope({ level: 'galaxy', city: 'atlantis', locality: '<script>' })).toEqual({ level: 'city', cityId: 'surat', locality: 'Vesu' });
    expect(parseScope({ level: 'locality', city: 'pune', locality: 'Baner' })).toEqual({ level: 'locality', cityId: 'pune', locality: 'Baner' });
  });
  it('names the right territory for each level', () => {
    const s = { cityId: 'mumbai', locality: 'Bandra' };
    expect(scopeName({ ...s, level: 'locality' })).toBe('Bandra');
    expect(scopeName({ ...s, level: 'city' })).toBe('Mumbai');
    expect(scopeName({ ...s, level: 'state' })).toBe('Maharashtra');
    expect(scopeName({ ...s, level: 'india' })).toBe('India');
  });
  it('uses Indian digit grouping', () => {
    expect(inr(100000)).toBe('₹1,00,000');
    expect(inrShort(380000)).toBe('₹3.8L');
  });
});
