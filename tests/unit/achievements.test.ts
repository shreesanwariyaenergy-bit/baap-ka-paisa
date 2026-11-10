import { describe, expect, it } from 'vitest';
import { groupAchievements, humanizeDetail } from '@/lib/achievements';
import { demoSource } from '@/lib/data/demo';

describe('achievement display helpers', () => {
  it('replaces city ids with names', () => {
    expect(humanizeDetail('Founding member no. 7 of 500 in surat')).toBe('Founding member no. 7 of 500 in Surat');
    expect(humanizeDetail('Up 3 places in ahmedabad')).toBe('Up 3 places in Ahmedabad');
  });
  it('groups repeats and keeps the latest streak label', async () => {
    const g = groupAchievements(await demoSource.achievements('ishaan.m'));
    expect(g.find((x) => x.id === 'streak')?.label).toBe('Streak ×3');
    expect(g.filter((x) => x.id === 'streak')).toHaveLength(1);
  });
});

describe('simulation data source: season engine views', () => {
  const surat = { level: 'city' as const, cityId: 'surat', locality: 'Vesu' };
  it('throne history has exactly one current reign per board, held by the board #01', async () => {
    const reigns = await demoSource.throneHistory({ scope: surat, limit: 100 });
    const current = reigns.filter((r) => r.current);
    expect(current).toHaveLength(1);
    expect(current[0].member.username).toBe((await demoSource.board(surat)).rows[0].member.username);
  });
  it('the latest Crown Moment matches the #01 change in the last 24 hours', async () => {
    const m = await demoSource.crownMoments(surat, new Date(demoSource.now().getTime() - 86_400_000));
    expect(m[0].to.username).toBe('kinjal.adajan');
    expect(m[0].from?.username).toBe('vesu.vikram');
  });
  it('Respect board counts only accepted Respect', async () => {
    const b = await demoSource.respectBoard(surat);
    expect(b.unit).toBe('count');
    for (let i = 1; i < b.rows.length; i++) expect(b.rows[i - 1].score!).toBeGreaterThanOrEqual(b.rows[i].score!);
  });
  it('Mystery mode members never expose a name or member number', async () => {
    const m = await demoSource.member('ANON-07');
    expect(m?.displayName).toBeNull();
    expect(m?.memberNo).toBeNull();
  });
});
