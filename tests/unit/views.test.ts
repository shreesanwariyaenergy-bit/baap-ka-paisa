import { describe, expect, it } from 'vitest';
import { projectedRank, validTopUp } from '@/lib/data/ranking';
import { movers, parseView } from '@/lib/data/views';
import { demoSource } from '@/lib/data/demo';

describe('Rank Up preview helpers', () => {
  const others = [{ username: 'a', score: 5000 }, { username: 'b', score: 3000 }, { username: 'me', score: 2000 }];
  it('passing someone needs their score + ₹500; reaching it exactly does not pass them', () => {
    expect(projectedRank(others, 'me', 5500)).toBe(1);
    expect(projectedRank(others, 'me', 5000)).toBe(2);
    expect(projectedRank(others, 'me', 3500)).toBe(2);
  });
  it('enforces ₹1,000 entry and ₹500 steps', () => {
    expect(validTopUp(0, 500)).toMatch(/1,000/);
    expect(validTopUp(0, 1000)).toBeNull();
    expect(validTopUp(2000, 700)).toMatch(/₹500/);
    expect(validTopUp(2000, 3500)).toBeNull();
    expect(validTopUp(2000, -500)).not.toBeNull();
  });
});

describe('board views', () => {
  it('parses unknown views as Season', () => {
    expect(parseView('hall')).toBe('hall');
    expect(parseView('<x>')).toBe('season');
  });
  it("Today's Movers lists only climbers and new entries, keeping their season rank", async () => {
    const b = await demoSource.board({ level: 'city', cityId: 'surat', locality: 'Vesu' });
    const m = movers(b);
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.rows.every((r) => ['up', 'took', 'new'].includes(r.movement!.kind))).toBe(true);
    expect(m.rows.every((r) => b.rows.find((x) => x.member.username === r.member.username)!.rank === r.rank)).toBe(true);
    expect(m.rows[0].movement!.kind).toBe('took');
  });
  it('Hall of Fame ranks by Lifetime Score and can differ from the season order', async () => {
    const scope = { level: 'city' as const, cityId: 'surat', locality: 'Vesu' };
    const hof = await demoSource.hallOfFame(scope);
    for (let i = 1; i < hof.rows.length; i++) expect(hof.rows[i - 1].score!).toBeGreaterThanOrEqual(hof.rows[i].score!);
    expect(hof.total).toBe((await demoSource.board(scope)).total);
  });
});
