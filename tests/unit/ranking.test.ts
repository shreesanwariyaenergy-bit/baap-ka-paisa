import { describe, expect, it } from 'vitest';
import { amountToPass, lifetimeTier, movement, rankEntries } from '@/lib/data/ranking';

describe('ranking rules (Product Blueprint section 1)', () => {
  it('orders by Season Score, highest first', () => {
    const r = rankEntries([{ id: 'a', score: 2000, reachedAt: 1 }, { id: 'b', score: 5000, reachedAt: 2 }, { id: 'c', score: 3500, reachedAt: 3 }]);
    expect(r.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
  it('breaks ties in favour of whoever reached the score first', () => {
    const r = rankEntries([{ id: 'late', score: 5000, reachedAt: 200 }, { id: 'early', score: 5000, reachedAt: 100 }]);
    expect(r[0].id).toBe('early');
  });
  it('leaves members with no Season Score off the board', () => {
    expect(rankEntries([{ id: 'z', score: 0, reachedAt: 1 }])).toHaveLength(0);
  });
  it('blueprint example: at ₹2,000 passing #1 on ₹5,000 needs ₹3,500 more', () => {
    expect(amountToPass(2000, 5000)).toBe(3500);
    expect(amountToPass(6000, 5000)).toBe(0);
  });
  it('describes movement against the previous ranking', () => {
    expect(movement(3, 5)).toEqual({ kind: 'up', by: 2 });
    expect(movement(5, 3)).toEqual({ kind: 'down', by: 2 });
    expect(movement(4, 4)).toEqual({ kind: 'held', by: 0 });
    expect(movement(6, undefined)).toEqual({ kind: 'new', by: 0 });
    expect(movement(1, 2)).toEqual({ kind: 'took', by: 1 });
    expect(movement(1, 1)).toEqual({ kind: 'defending', by: 0 });
  });
  it('lifetime tiers start at ₹5,000 / ₹25,000 / ₹1,00,000 / ₹5,00,000', () => {
    expect(lifetimeTier(4999)).toBeNull();
    expect(lifetimeTier(5000)).toBe('Bronze');
    expect(lifetimeTier(25000)).toBe('Silver');
    expect(lifetimeTier(100000)).toBe('Gold');
    expect(lifetimeTier(500000)).toBe('Black');
  });
});
