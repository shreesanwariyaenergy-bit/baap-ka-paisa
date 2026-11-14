import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, addRival, boardAt, istWeekStart, respectBoard, runEngine, seasonStatus, type EngineEvent, type EngineMember, type SeasonDef } from '@/lib/engine/engine';

// Simulated members and events only. Nothing here is a real person or transaction.
const T0 = Date.UTC(2026, 10, 1) - 5.5 * HOUR; // 1 Nov 2026 00:00 IST
const S1: SeasonDef = { id: 1, startsAt: T0, scheduledEnd: T0 + 30 * DAY - MINUTE };
const S2: SeasonDef = { id: 2, startsAt: T0 + 30 * DAY, scheduledEnd: T0 + 61 * DAY - MINUTE };
const M: EngineMember[] = [
  { id: 'a', cityId: 'surat', state: 'GJ', locality: 'Vesu' },
  { id: 'b', cityId: 'surat', state: 'GJ', locality: 'Vesu' },
  { id: 'c', cityId: 'surat', state: 'GJ', locality: 'Adajan' },
  { id: 'd', cityId: 'mumbai', state: 'MH', locality: 'Worli' },
];
let n = 0;
const credit = (memberId: string, amount: number, at: number): EngineEvent => ({ type: 'credit', id: `e${++n}`, memberId, amount, at });

describe('credits and ranking', () => {
  it('rejects amounts below ₹1,000 entry or not in ₹500 steps, and credits outside an open season', () => {
    const r = runEngine(M, [S1], [credit('a', 500, T0 + HOUR), credit('a', 1200, T0 + 2 * HOUR), credit('a', 1000, T0 - HOUR), credit('a', 1000, T0 + 3 * HOUR)], T0 + DAY);
    expect(r.rejected.map((x) => x.reason)).toEqual(['no-open-season', 'entry-minimum-1000', 'amount-not-multiple-of-500']);
    expect(r.credits).toHaveLength(1);
  });
  it('ranks by Season Score and breaks ties by who reached the score first', () => {
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('b', 5000, T0 + 2 * HOUR), credit('c', 2000, T0 + 3 * HOUR)], T0 + DAY);
    expect(boardAt(r, 1, 'city:surat', T0 + DAY).map((x) => x.memberId)).toEqual(['a', 'b', 'c']);
  });
  it('blueprint overtake: ₹2,000 → ₹5,500 passes a ₹5,000 #01 with a ₹3,500 payment', () => {
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('c', 2000, T0 + 2 * HOUR), credit('c', 3500, T0 + 3 * HOUR)], T0 + DAY);
    expect(boardAt(r, 1, 'city:surat', T0 + DAY)[0]).toMatchObject({ memberId: 'c', score: 5500 });
  });
  it('one payment updates all four boards', () => {
    const r = runEngine(M, [S1], [credit('c', 1000, T0 + HOUR)], T0 + DAY);
    for (const k of ['locality:surat:Adajan', 'city:surat', 'state:GJ', 'india']) expect(boardAt(r, 1, k, T0 + DAY)[0].memberId).toBe('c');
  });
  it('a new season starts at zero while lifetime credits are kept', () => {
    const r = runEngine(M, [S1, S2], [credit('a', 5000, T0 + HOUR), credit('b', 1000, S2.startsAt + HOUR)], S2.startsAt + DAY);
    expect(boardAt(r, 2, 'city:surat', S2.startsAt + DAY).map((x) => x.memberId)).toEqual(['b']);
    expect(r.credits.filter((c) => c.memberId === 'a').reduce((s, c) => s + c.amount, 0)).toBe(5000);
  });
});

describe('season engine', () => {
  it('moves upcoming → open → closed on its own schedule', () => {
    const r = runEngine(M, [S1], [], T0 - 1);
    expect(seasonStatus(r.seasons[0], T0 - 1)).toBe('upcoming');
    expect(seasonStatus(r.seasons[0], T0 + DAY)).toBe('open');
    expect(seasonStatus(r.seasons[0], S1.scheduledEnd)).toBe('closed');
  });
  it('anti-snipe: an overtake in the last 15 minutes extends the season by 15 minutes', () => {
    const end = S1.scheduledEnd;
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('b', 5500, end - 10 * MINUTE)], end + HOUR);
    expect(r.seasons[0].endsAt).toBe(end + 15 * MINUTE);
    expect(r.seasons[0].extensions).toHaveLength(1);
  });
  it('anti-snipe: a credit that passes nobody does not extend', () => {
    const end = S1.scheduledEnd;
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('b', 1000, end - 5 * MINUTE)], end + HOUR);
    expect(r.seasons[0].endsAt).toBe(end);
  });
  it('anti-snipe: an overtake below #01 on every board does not extend the national close', () => {
    const end = S1.scheduledEnd;
    // b passes d on the India board (3rd → 2nd) but takes #01 nowhere: a holds Vesu, Surat, Gujarat and India.
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('b', 2000, T0 + 2 * HOUR), credit('d', 3000, T0 + 3 * HOUR), credit('b', 1500, end - 5 * MINUTE)], end + HOUR);
    expect(boardAt(r, 1, 'india', end).map((x) => x.memberId)).toEqual(['a', 'b', 'd']);
    expect(r.seasons[0].endsAt).toBe(end);
  });
  it('anti-snipe: taking a #01 on a smaller board (here a vacant locality) still extends', () => {
    const end = S1.scheduledEnd;
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('c', 1000, end - 5 * MINUTE)], end + HOUR);
    expect(r.seasons[0].endsAt).toBe(end + 15 * MINUTE);
  });
  it('anti-snipe: extensions stop at 2 hours in total', () => {
    const end = S1.scheduledEnd;
    const evs: EngineEvent[] = [credit('a', 1000, T0 + HOUR)];
    let t = end - 10 * MINUTE; let amt = 1500;
    for (let i = 0; i < 12; i++) { evs.push(credit(i % 2 ? 'a' : 'b', amt, t)); amt += 1000; t += 14 * MINUTE; }
    const r = runEngine(M, [S1], evs, end + 5 * HOUR);
    expect(r.seasons[0].endsAt).toBe(end + 2 * HOUR);
    expect(r.rejected.some((x) => x.reason === 'no-open-season')).toBe(true);
  });
  it('freezes final standings at the close', () => {
    const r = runEngine(M, [S1], [credit('a', 5000, T0 + HOUR), credit('b', 2000, T0 + 2 * HOUR)], S1.scheduledEnd + HOUR);
    expect(r.seasons[0].closed).toBe(true);
    expect(r.frozen.get(1)!.get('city:surat')!.map((x) => x.memberId)).toEqual(['a', 'b']);
  });
});

describe('crown, throne history and achievements', () => {
  const evs = () => [
    credit('a', 5000, T0 + HOUR),          // a takes #01
    credit('b', 5500, T0 + 4 * DAY),       // b takes #01 after 4 days (a: Untouchable)
    credit('a', 1000, T0 + 4 * DAY + 2 * HOUR), // a retakes within 24h (Revenge Taken)
  ];
  const r = runEngine(M, [S1], evs(), S1.scheduledEnd + HOUR);
  it('records a Crown Moment whenever #01 changes on a board, not attached to a person', () => {
    const city = r.crownEvents.filter((e) => e.board === 'city:surat');
    expect(city.map((e) => [e.from, e.to])).toEqual([[null, 'a'], ['a', 'b'], ['b', 'a']]);
  });
  it('keeps a throne history of reigns with start, end and reason', () => {
    const city = r.reigns.filter((x) => x.board === 'city:surat');
    expect(city.map((x) => [x.memberId, x.endReason])).toEqual([['a', 'overtaken'], ['b', 'overtaken'], ['a', 'season-end']]);
  });
  const has = (id: string, who: string) => r.achievements.some((a) => a.id === id && a.memberId === who);
  it('awards Untouchable after 72 hours as city #01', () => { expect(has('untouchable', 'a')).toBe(true); expect(has('untouchable', 'b')).toBe(false); });
  it('awards Revenge Taken for retaking #01 within 24 hours', () => expect(has('revenge-taken', 'a')).toBe(true));
  it('awards Season Crown to each #01 at the finale', () => {
    expect(r.achievements.filter((a) => a.id === 'season-crown' && a.memberId === 'a').map((a) => a.board).sort()).toEqual(['city:surat', 'india', 'locality:surat:Vesu', 'state:GJ']);
  });
  it('awards Pioneer once per locality and Founding 500 to early members', () => {
    expect(r.achievements.filter((a) => a.id === 'pioneer').map((a) => a.memberId)).toEqual(['a']);
    expect(has('founding-500', 'a') && has('founding-500', 'b')).toBe(true);
  });
  it('awards Longest Reign to the record holder per city', () => expect(r.achievements.find((a) => a.id === 'longest-reign')?.memberId).toBe('a'));
  it('awards Streak ×2 for consecutive seasons', () => {
    const r2 = runEngine(M, [S1, S2], [credit('a', 1000, T0 + HOUR), credit('a', 1000, S2.startsAt + HOUR)], S2.scheduledEnd + HOUR);
    expect(r2.achievements.find((a) => a.id === 'streak')?.label).toBe('Streak ×2');
  });
  it('awards Climber of the Week for the biggest completed-week climb', () => {
    const wk = istWeekStart(T0) + 7 * DAY; // first full Monday-start week inside the season
    const r3 = runEngine(M, [S1], [credit('a', 3000, T0 + HOUR), credit('b', 2000, T0 + 2 * HOUR), credit('c', 1000, T0 + 3 * HOUR), credit('c', 3000, wk + DAY)], wk + 8 * DAY);
    const w = r3.achievements.filter((a) => a.id === 'climber-of-week');
    expect(w.some((a) => a.memberId === 'c')).toBe(true);
  });
});

describe('free social rules', () => {
  it('one Respect per profile per day, never to yourself', () => {
    const r = runEngine(M, [S1], [
      { type: 'respect', giver: 'a', receiver: 'b', at: T0 + HOUR },
      { type: 'respect', giver: 'a', receiver: 'b', at: T0 + 2 * HOUR },
      { type: 'respect', giver: 'a', receiver: 'a', at: T0 + 3 * HOUR },
      { type: 'respect', giver: 'a', receiver: 'b', at: T0 + DAY + HOUR },
      { type: 'respect', giver: 'c', receiver: 'b', at: T0 + DAY + HOUR },
    ], T0 + 3 * DAY);
    expect(r.rejected.map((x) => x.reason)).toEqual(['one-respect-per-profile-per-day', 'cannot-respect-self']);
    expect(respectBoard(r, 1, 'city:surat')[0]).toMatchObject({ memberId: 'b', score: 3 });
  });
  it('Most Respected goes to the Respect board #01 at the finale', () => {
    const r = runEngine(M, [S1], [{ type: 'respect', giver: 'a', receiver: 'c', at: T0 + HOUR }], S1.scheduledEnd + HOUR);
    expect(r.achievements.find((a) => a.id === 'most-respected')?.memberId).toBe('c');
  });
  it('rivals: up to five, not yourself, no duplicates', () => {
    let list: string[] = [];
    for (const x of ['1', '2', '3', '4', '5']) { const res = addRival(list, 'me', x); if (res.ok) list = res.rivals; }
    expect(addRival(list, 'me', '6')).toMatchObject({ ok: false });
    expect(addRival([], 'me', 'me')).toMatchObject({ ok: false });
    expect(addRival(['x'], 'me', 'x')).toMatchObject({ ok: false });
  });
});
