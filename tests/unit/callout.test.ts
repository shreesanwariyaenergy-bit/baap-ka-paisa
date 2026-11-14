import { describe, expect, it } from 'vitest';
import { DAY, HOUR, runEngine, type EngineEvent, type EngineMember, type SeasonDef } from '@/lib/engine/engine';
import { COOLDOWN, canDeclare, publicDeclarations, runCallouts, toOvertake, type DeclareEvent } from '@/lib/engine/callout';

const T0 = Date.UTC(2026, 0, 1);
const members: EngineMember[] = ['king', 'ch', 'third', 'spam', 'new'].map((id) => ({ id, cityId: 'surat', state: 'GJ', locality: 'Vesu' }));
const seasons: SeasonDef[] = [{ id: 1, startsAt: T0, scheduledEnd: T0 + 20 * DAY }, { id: 2, startsAt: T0 + 21 * DAY, scheduledEnd: T0 + 41 * DAY }];
const cr = (id: string, memberId: string, amount: number, day: number): EngineEvent => ({ type: 'credit', id, memberId, amount, at: T0 + day * DAY });
const credits = [cr('1', 'king', 10000, 1), cr('2', 'ch', 4000, 2), cr('3', 'third', 3000, 2), cr('4', 'spam', 1000, 2),
  cr('5', 'king', 2000, 6), cr('6', 'ch', 8500, 8) /* ch takes it: 12,500 vs 12,000 */, cr('7', 'third', 10000, 12) /* third takes it: 13,000 */, cr('8', 'king', 1000, 22)];
const B = 'city:surat';
const d = (id: string, challenger: string, day: number, line?: number): DeclareEvent => ({ id, challenger, board: B, at: T0 + day * DAY, line });
const run = (events: DeclareEvent[], now: number, blocks = [] as { holder: string; challenger: string; at: number }[], removed = new Set<string>()) => {
  const res = runEngine(members, seasons, credits, now); return { res, r: runCallouts(res, events, blocks, removed) };
};

describe('Declarations', () => {
  it('prices an overtake by the approved rules: one ₹500 step past the leader, ₹1,000 minimum to enter', () => {
    expect(toOvertake(10000, 4000)).toBe(6500); expect(toOvertake(10000, 0)).toBe(10500); expect(toOvertake(500, 0)).toBe(1000); expect(toOvertake(10000, 10000)).toBe(500);
  });
  it('records the holder, both scores and the amount needed at the moment of declaring', () => {
    const { r } = run([d('a', 'ch', 3, 1)], T0 + 4 * DAY);
    expect(r.declarations[0]).toMatchObject({ seq: 1, holder: 'king', holderScore: 10000, challengerScore: 4000, required: 6500, status: 'standing', line: 'Enjoy it while it lasts.' });
  });
  it('follows the rivalry and is made good only by the board', () => {
    const { r } = run([d('a', 'ch', 3)], T0 + 9 * DAY);
    expect(r.declarations[0].status).toBe('won');
    expect(r.declarations[0].timeline.map((t) => [t.kind, t.gap])).toEqual([['declared', 6000], ['holder-added', 8000], ['won', -500]]);
  });
  it('is spent when someone else takes the throne, and lapses when the season closes', () => {
    expect(run([d('a', 'spam', 3)], T0 + 13 * DAY).r.declarations[0]).toMatchObject({ status: 'throne-moved', resolvedAt: T0 + 8 * DAY });
    const late = run([d('a', 'spam', 13)], T0 + 25 * DAY).r.declarations[0];
    expect(late).toMatchObject({ holder: 'third', status: 'lapsed' });
  });
  it('refuses self, vacant thrones, closed seasons, duplicates, the cooldown and the season limit', () => {
    const { res, r } = run([d('a', 'spam', 3), d('b', 'spam', 3.5), d('c', 'king', 3), d('e', 'zz', 3), d('f', 'spam', 20.5)], T0 + 5 * DAY);
    expect(Object.fromEntries(r.rejected.map((x) => [x.event.id, x.reason]))).toEqual({ b: 'already-standing', c: 'self', e: 'not-a-member' });
    expect(canDeclare(res, [], [], 'new', B, T0 + 20.5 * DAY)).toEqual({ ok: false, reason: 'season-not-open' });
    expect(canDeclare(res, [], [], 'new', 'city:pune', T0 + 3 * DAY)).toEqual({ ok: false, reason: 'not-your-board' });
    expect(canDeclare(res, [], [], 'new', 'city:surat', T0 + 0.5 * DAY)).toEqual({ ok: false, reason: 'vacant' });
    // spam's first declaration is spent on day 8; a new one inside 72h of the last is refused, then three per season is the cap
    const many = run([d('a', 'spam', 3), d('b', 'spam', 8.5), d('c', 'spam', 5), d('g', 'spam', 12.5), d('h', 'spam', 16), d('i', 'spam', 19.5)], T0 + 20 * DAY).r;
    expect(many.declarations.map((x) => x.id)).toEqual(['a', 'b', 'g']);
    expect(Object.fromEntries(many.rejected.map((x) => [x.event.id, x.reason]))).toEqual({ c: 'already-standing', h: 'already-standing', i: 'already-standing' });
    const full = runEngine(members, seasons, credits, T0 + 20 * DAY);
    expect(canDeclare(full, many.declarations, [], 'spam', 'india', T0 + 16 * DAY)).toEqual({ ok: false, reason: 'season-limit' });
    expect(canDeclare(res, r.declarations, [], 'spam', 'india', T0 + 3 * DAY + COOLDOWN - HOUR)).toEqual({ ok: false, reason: 'cooldown' });
  });
  it('a holder can block a challenger: no new declarations, and standing ones leave public view', () => {
    const blocks = [{ holder: 'king', challenger: 'spam', at: T0 + 4 * DAY }];
    const { res, r } = run([d('a', 'spam', 3), d('b', 'ch', 3)], T0 + 5 * DAY, blocks);
    expect(r.declarations.find((x) => x.id === 'a')!.status).toBe('withdrawn');
    expect(publicDeclarations(r).map((x) => x.id)).toEqual(['b']);
    expect(canDeclare(res, [], blocks, 'spam', B, T0 + 5 * DAY)).toEqual({ ok: false, reason: 'blocked' });
  });
  it('a moderator can remove a declaration; its number is never reused', () => {
    const { r } = run([d('a', 'spam', 3), d('b', 'ch', 3.5)], T0 + 5 * DAY, [], new Set(['a']));
    expect(publicDeclarations(r).map((x) => [x.id, x.seq])).toEqual([['b', 2]]);
  });
  it('carries no free text: the line is always from the fixed list', () => {
    const { r } = run([{ ...d('a', 'ch', 3), line: 99 }], T0 + 4 * DAY);
    expect(r.declarations[0].line).toBe('I am coming for this throne.');
  });
});
