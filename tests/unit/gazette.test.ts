import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => { throw new Error('no request'); } }));
import { buildEdition, heldFor } from '@/lib/gazette';
import { demoSource } from '@/lib/data/demo';
import { cityById, type Scope } from '@/lib/geo';
import type { Board } from '@/lib/data/types';

const city = cityById('surat')!;
const scope: Scope = { level: 'city', cityId: 'surat', locality: 'Vesu' };
const empty: Board = { scope, rows: [], total: 0, viewerRow: null };

async function demoEdition() {
  const ds = demoSource; const now = ds.now();
  const [board, reigns, moments, events, cities, respect] = await Promise.all([ds.board(scope, { limit: 10 }), ds.throneHistory({ scope, limit: 40 }),
    ds.crownMoments(scope, new Date(now.getTime() - 7 * 86_400_000)), ds.events(scope, 12), ds.cities(), ds.respectBoard(scope, { limit: 3 })]);
  return { ds, board, reigns, ed: buildEdition({ city, season: ds.season(), now, open: true, board, reigns, moments, events, cities, respect }) };
}

describe('The Gazette', () => {
  it('formats how long a throne was held', () => {
    expect(heldFor(0.4)).toBe('under an hour'); expect(heldFor(1)).toBe('1 hour'); expect(heldFor(24)).toBe('1 day'); expect(heldFor(148)).toBe('6 days 4 hours');
  });
  it('leads with a change of throne and names the real winner and loser', async () => {
    const { ed, board } = await demoEdition();
    expect(ed.lead.headline).toBe('KINJAL SHAH TAKES SURAT');
    expect(board.rows[0].member.displayName).toBe('Kinjal Shah');
    expect(ed.lead.body).toContain("Vikram Desai's reign ended");
  });
  it('numbers one notice per reign, newest first, with the time held', async () => {
    const { ed, reigns } = await demoEdition();
    const season = reigns.filter((r) => r.seasonLabel === 'Season 4');
    expect(ed.notices).toHaveLength(season.length);
    expect(ed.notices[0].no).toBe(`S4/ST/${String(season.length).padStart(3, '0')}`);
    expect(ed.notices.at(-1)!.loser).toBeNull();
    expect(ed.notices[0].text).toMatch(/held it for \d/);
  });
  it('never reveals a Mystery-mode member', async () => {
    const { ed } = await demoEdition();
    const story = ed.stories.find((s) => s.kicker === 'Unidentified')!;
    expect(story.headline).toMatch(/^NOBODY KNOWS WHO ANON-\d+ IS$/);
    expect(story.href).toMatch(/\/u\/ANON-/);
  });
  it('an empty open board is a vacant throne, not a blank page', async () => {
    const { ds } = await demoEdition();
    const ed = buildEdition({ city, season: ds.season(), now: ds.now(), open: true, board: empty, reigns: [], moments: [], events: [], cities: [], respect: empty });
    expect(ed.lead.headline).toBe('THE THRONE OF SURAT IS VACANT'); expect(ed.quiet).toBe(true); expect(ed.notices).toEqual([]); expect(ed.stories).toEqual([]);
  });
  it('before any season it says the city has never been held', async () => {
    const { ds } = await demoEdition();
    const ed = buildEdition({ city, season: ds.season(), now: ds.now(), open: false, board: empty, reigns: [], moments: [], events: [], cities: [], respect: empty });
    expect(ed.lead.headline).toBe('THE THRONE OF SURAT HAS NEVER BEEN HELD'); expect(ed.issue).toBe('Before the first season');
  });
});
