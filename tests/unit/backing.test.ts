import { describe, expect, it } from 'vitest';
import { DAY, HOUR, boardAt, runEngine, type EngineEvent, type EngineMember, type SeasonDef } from '@/lib/engine/engine';
import { backersOf, canBack, mostBacked, pickOf, runBacking, type BackEvent } from '@/lib/engine/backing';
import { dethronedBand, priceOfThrone, strongestClaim, throneTime } from '@/lib/claim';
import type { ReignView, Standing } from '@/lib/data/types';

const T0 = Date.UTC(2026, 0, 1);
const members: EngineMember[] = ['a', 'b', 'c', 'fan1', 'fan2', 'fan3'].map((id) => ({ id, cityId: 'surat', state: 'GJ', locality: 'Vesu' }));
const seasons: SeasonDef[] = [{ id: 1, startsAt: T0, scheduledEnd: T0 + 10 * DAY }, { id: 2, startsAt: T0 + 11 * DAY, scheduledEnd: T0 + 21 * DAY }];
const credits: EngineEvent[] = [
  { type: 'credit', id: 'c1', memberId: 'a', amount: 1000, at: T0 + DAY },
  { type: 'credit', id: 'c2', memberId: 'b', amount: 1500, at: T0 + 2 * DAY },
  { type: 'credit', id: 'c3', memberId: 'a', amount: 1000, at: T0 + 9 * DAY },       // a finishes Season 1 as #01
  { type: 'credit', id: 'c4', memberId: 'b', amount: 1000, at: T0 + 12 * DAY },
];
const back = (id: string, backer: string, target: string, at: number): BackEvent => ({ id, backer, target, at });
const events: BackEvent[] = [
  back('1', 'fan1', 'a', T0 + 3 * DAY), back('2', 'fan2', 'b', T0 + 3 * DAY), back('3', 'fan3', 'a', T0 + 4 * DAY),
  back('4', 'fan1', 'b', T0 + 5 * DAY),            // tries to move: refused
  back('5', 'a', 'a', T0 + 5 * DAY),               // self
  back('6', 'fan2', 'c', T0 + 6 * DAY),            // already backed (and c is not a contender)
  back('7', 'c', 'zz', T0 + 6 * DAY),              // unknown
  back('8', 'c', 'fan1', T0 + 6 * DAY),            // fan1 is not on the board
  back('9', 'c', 'a', T0 + 10 * DAY + HOUR),       // between seasons
  back('10', 'fan1', 'b', T0 + 13 * DAY),          // Season 2: a fresh backing is allowed
];

describe('Backing', () => {
  const at = (now: number) => { const res = runEngine(members, seasons, credits, now); return { res, r: runBacking(res, events) }; };

  it('accepts one backing per member per season and refuses everything else with a reason', () => {
    const { r } = at(T0 + 14 * DAY);
    expect(r.accepted.map((b) => `${b.seasonId}:${b.backer}>${b.target}`)).toEqual(['1:fan1>a', '1:fan2>b', '1:fan3>a', '2:fan1>b']);
    expect(Object.fromEntries(r.rejected.map((x) => [x.event.id, x.reason]))).toEqual({ 4: 'already-backed', 5: 'self', 6: 'already-backed', 7: 'unknown-contender', 8: 'not-a-contender', 9: 'season-not-open' });
  });
  it('is locked: a second attempt in the same season never replaces the first', () => {
    const { res, r } = at(T0 + 6 * DAY);
    expect(pickOf(r, 1, 'fan1')?.target).toBe('a');
    expect(canBack(res, r.accepted, 'fan1', 'b', T0 + 6 * DAY)).toEqual({ ok: false, reason: 'already-backed' });
    expect(canBack(res, r.accepted, 'c', 'b', T0 + 6 * DAY)).toEqual({ ok: true, seasonId: 1 });
  });
  it('never changes a score or a rank', () => {
    const now = T0 + 14 * DAY;
    const plain = runEngine(members, seasons, credits, now);
    const before = JSON.stringify([boardAt(plain, 1, 'city:surat', now), [...plain.frozen.get(1)!], plain.reigns, plain.crownEvents]);
    runBacking(plain, events);
    expect(JSON.stringify([boardAt(plain, 1, 'city:surat', now), [...plain.frozen.get(1)!], plain.reigns, plain.crownEvents])).toBe(before);
  });
  it('awards nothing while the season is open, then Backed the Crown to backers of the final #01 only', () => {
    expect(at(T0 + 9 * DAY + HOUR).r.awards).toEqual([]);
    const { r } = at(T0 + 14 * DAY);
    expect(r.awards.map((a) => a.memberId).sort()).toEqual(['fan1', 'fan3']);
    expect(r.awards[0]).toMatchObject({ id: 'backed-the-crown', seasonId: 1, target: 'a', label: 'Backed the Crown' });
  });
  it('keeps past seasons after rollover and counts backers publicly', () => {
    const { res, r } = at(T0 + 14 * DAY);
    expect(backersOf(r, 1, 'a')).toBe(2); expect(backersOf(r, 2, 'b')).toBe(1); expect(pickOf(r, 1, 'fan1')?.target).toBe('a'); expect(pickOf(r, 2, 'fan1')?.target).toBe('b');
    expect(mostBacked(res, r, 2, 'surat', T0 + 14 * DAY)).toEqual([{ memberId: 'b', backers: 1, rank: 1 }]);
  });
});

describe('claims and throne time', () => {
  const scope = { level: 'city' as const, cityId: 'surat', locality: 'Vesu' };
  const st = (level: Standing['level'], rank: number | null, of = 20): Standing => ({ level, scope: { ...scope, level }, rank, of });
  const reign = (u: string, hours: number, current = false): ReignView => ({ seasonLabel: 'Season 1', scope, boardName: 'Surat', member: { username: u, displayName: u.toUpperCase(), masked: false, publicLabel: u, title: null, flexLine: null, cityId: 'surat', state: 'GJ', locality: 'Vesu', memberNo: 1, seasonScore: 0, lifetimeTier: null }, from: new Date(0), to: null, endReason: null, hours, current, untouchable: false, revenge: false });
  const ach = (id: string, label: string) => ({ id, label, detail: `${label} detail`, at: new Date(0), seasonLabel: null, boardName: null });

  it('leads with holding #01 on the widest board', () => {
    expect(strongestClaim({ standings: [st('locality', 1), st('city', 1), st('india', 9)], achievements: [], reigns: [] })?.headline).toBe('Holds Surat');
  });
  it('a podium on a small board beats a deep rank on a wide one', () => {
    expect(strongestClaim({ standings: [st('locality', 2, 6), st('city', 47, 300), st('india', 900, 5000)], achievements: [], reigns: [] })?.headline).toBe('#02 in Vesu');
  });
  it('a former holder keeps the time they held it; backers keep Backed the Crown', () => {
    expect(strongestClaim({ standings: [st('city', 14)], achievements: [], reigns: [reign('x', 148)] })?.headline).toBe('Held Surat for 6 days 4 hours');
    expect(strongestClaim({ standings: [st('city', null)], achievements: [ach('backed-the-crown', 'Backed the Crown')], reigns: [] })?.headline).toBe('Backed the Crown');
    expect(strongestClaim({ standings: [st('city', null)], achievements: [], reigns: [] })).toBeNull();
  });
  it('totals time on the throne per member', () => {
    expect(throneTime([reign('a', 10), reign('b', 30), reign('a', 25, true)]).map((t) => [t.username, t.hours, t.reigns, t.longest, t.holding])).toEqual([['a', 35, 2, 25, true], ['b', 30, 1, 30, false]]);
  });
  it('prices the throne one step past the leader', () => {
    expect(priceOfThrone(null)).toBe(1000); expect(priceOfThrone(24000)).toBe(24500); expect(priceOfThrone(24000, 18000)).toBe(6500); expect(priceOfThrone(24000, 24000)).toBe(500);
  });
});

describe('the dethroned band', () => {
  const scope = { level: 'city' as const, cityId: 'surat', locality: 'Vesu' };
  const mk = (u: string) => ({ username: u, displayName: u.toUpperCase(), masked: false, publicLabel: u, title: null, flexLine: null, cityId: 'surat', state: 'GJ' as const, locality: 'Vesu', memberNo: 1, seasonScore: 0, lifetimeTier: null });
  const now = new Date('2026-11-10T12:00:00Z');
  const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
  const reign = (from: Date, to: Date | null, endReason: 'overtaken' | 'season-end' | null): ReignView => ({ seasonLabel: 'Season 4', scope, boardName: 'Surat', member: mk('loser'), from, to, endReason, hours: 10, current: !to, untouchable: false, revenge: false });
  const taken = (at: Date) => [{ boardName: 'Surat', from: mk('loser'), to: mk('winner'), at }];
  it('is worn for 24 hours after being overtaken, naming who took it', () => {
    expect(dethronedBand([reign(h(50), h(3), 'overtaken')], taken(h(3)), now)).toMatchObject({ boardName: 'Surat', by: 'WINNER', hoursAgo: 3, hoursLeft: 21 });
  });
  it('comes off after 24 hours, when the throne is taken back, and never for a season that simply ended', () => {
    expect(dethronedBand([reign(h(80), h(25), 'overtaken')], taken(h(25)), now)).toBeNull();
    expect(dethronedBand([reign(h(1), null, null), reign(h(50), h(3), 'overtaken')], taken(h(3)), now)).toBeNull();
    expect(dethronedBand([reign(h(50), h(3), 'season-end')], [], now)).toBeNull();
  });
});
