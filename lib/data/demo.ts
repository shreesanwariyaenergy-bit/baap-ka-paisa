import 'server-only';
// DEMO DATA SOURCE. Every name, number, amount and season here is invented for design review.
// It exists so the site can be reviewed before a BAAP KA PAISA backend is connected.
// It is only used when BKP_DATA_SOURCE=demo, and every page then shows a "Demo data" notice.
import { CITIES, cityById, type Level, type Scope } from '../geo';
import { seasonFor, istMonthStart } from '../season';
import { monthName } from '../format';
import { lifetimeTier, movement, rankEntries } from './ranking';
import type { ArchiveSeason, Board, BoardEvent, BoardRow, CitySummary, DataSource, PublicMember, Standing, ViewerSeal } from './types';

const AS_OF = new Date('2026-11-10T18:00:00+05:30');
const DEMO_SEASON_ONE = '2026-08';

// [username, display name or null for Mystery mode, locality, title, flex line]
type P = [string, string | null, string, string | null, string | null];
const PEOPLE: Record<string, P[]> = {
  surat: [
    ['kinjal.adajan', 'Kinjal Shah', 'Adajan', 'Founder', 'Built it in Adajan, kept it in Adajan'],
    ['vesu.vikram', 'Vikram Desai', 'Vesu', 'Entrepreneur', 'Ring road to the top'],
    ['diamondwala', 'Harsh Kothari', 'Varachha', 'Entrepreneur', 'Cut, polish, repeat'],
    ['ANON-07', null, 'City Light', null, null],
    ['ishaan.m', 'Ishaan Mehta', 'Vesu', 'CA', 'Audited. Approved.'],
    ['pal.prince', 'Ronak Patel', 'Pal', 'Creator', 'Pal ka naam'],
    ['meera.textiles', 'Meera Agarwal', 'Ghod Dod Road', 'Founder', 'Fabric of the city'],
    ['athwa.ace', 'Dhruv Jariwala', 'Athwa', 'Doctor', 'On call, on top'],
    ['dumas.drift', 'Aarav Modi', 'Dumas', 'Student', 'Sea breeze, high rank'],
    ['nidhi.piplod', 'Nidhi Gandhi', 'Piplod', 'Lawyer', 'Objection overruled'],
    ['vesu.queen', 'Tanvi Bhatt', 'Vesu', 'Artist', 'Painting Vesu gold'],
    ['rander.raja', 'Imran Kapadia', 'Rander', 'Entrepreneur', 'Old city, new money'],
    ['katargam.k', 'Kunal Savani', 'Katargam', 'Investor', 'Long term only'],
    ['bhatar.b', 'Pooja Rana', 'Bhatar', 'Athlete', 'Fast and first'],
    ['vesu.vibes', 'Neel Chokshi', 'Vesu', 'Creator', 'Main character energy'],
    ['udhna.u', 'Sahil Rathod', 'Udhna', 'Entrepreneur', 'From Udhna with love'],
  ],
  ahmedabad: [
    ['sg.highway.sid', 'Siddharth Amin', 'SG Highway', 'Founder', 'Fast lane only'],
    ['bodakdev.b', 'Aditi Parikh', 'Bodakdev', 'Doctor', 'Prescribing ambition'],
    ['ANON-12', null, 'Satellite', null, null],
    ['thaltej.t', 'Manav Thakkar', 'Thaltej', 'Investor', 'Compounding quietly'],
    ['prahlad.p', 'Riddhi Joshi', 'Prahlad Nagar', 'Lawyer', 'Case closed'],
    ['navrang.n', 'Jay Vyas', 'Navrangpura', 'Student', 'CEPT to the crown'],
    ['bopal.boss', 'Hetal Panchal', 'Bopal', 'Entrepreneur', 'Bopal on the map'],
    ['vastrapur.v', 'Karan Dave', 'Vastrapur', 'Creator', 'Lake view, top view'],
    ['gota.g', 'Mitali Soni', 'Gota', 'Artist', 'Gota represent'],
    ['maninagar.m', 'Parth Trivedi', 'Maninagar', 'CA', 'Balance sheet king'],
  ],
  mumbai: [
    ['worli.w', 'Rohan Malhotra', 'Worli', 'Investor', 'Sea link to the summit'],
    ['bandra.b', 'Zara Fernandes', 'Bandra', 'Creator', 'Bandstand to bandwidth'],
    ['ANON-03', null, 'Malabar Hill', null, null],
    ['bkc.boss', 'Arjun Iyer', 'BKC', 'Founder', 'Term sheets and top spots'],
    ['juhu.j', 'Kiara Kapoor', 'Juhu', 'Artist', 'Sunset seats'],
    ['powai.p', 'Nikhil Rao', 'Powai', 'Founder', 'Lake, laptop, lead'],
    ['colaba.c', 'Farhan Merchant', 'Colaba', 'Entrepreneur', 'South Bombay standard'],
    ['andheri.a', 'Sneha Kulkarni', 'Andheri', 'Creator', 'Andheri West wins'],
    ['chembur.c', 'Rahul Pillai', 'Chembur', 'Doctor', 'East side rising'],
    ['khar.k', 'Tara Shetty', 'Khar', 'Lawyer', 'Khar, and counting'],
    ['lowerparel.lp', 'Vivaan Shah', 'Lower Parel', 'Investor', 'Mill to mall to #1'],
    ['borivali.b', 'Omkar Sawant', 'Borivali', 'Athlete', 'National park pace'],
  ],
  pune: [
    ['kp.kabir', 'Kabir Khanna', 'Koregaon Park', 'Founder', 'KP is home'],
    ['baner.b', 'Anushka Deshpande', 'Baner', 'Entrepreneur', 'Baner balcony views'],
    ['hinjewadi.h', 'Varun Gokhale', 'Hinjewadi', 'Founder', 'Phase 3, rank 1'],
    ['kalyani.k', 'Ira Bhosale', 'Kalyani Nagar', 'Lawyer', 'Strictly Pune'],
    ['ANON-21', null, 'Aundh', null, null],
    ['kothrud.k', 'Aditya Kale', 'Kothrud', 'CA', 'Puneri and proud'],
    ['magarpatta.m', 'Shruti Jadhav', 'Magarpatta', 'Creator', 'Cycle track to the top'],
    ['viman.v', 'Rehan Sayyed', 'Viman Nagar', 'Athlete', 'Cleared for takeoff'],
    ['deccan.d', 'Gauri Paranjpe', 'Deccan', 'Student', 'FC Road regular'],
  ],
  delhi: [
    ['vasantvihar.v', 'Kabir Sethi', 'Vasant Vihar', 'Investor', 'Old Delhi money, new Delhi mood'],
    ['gk.gaurav', 'Gaurav Arora', 'South Delhi', 'Entrepreneur', 'GK forever'],
    ['ANON-09', null, 'Chanakyapuri', null, null],
    ['defcol.d', 'Ananya Bhalla', 'Defence Colony', 'Doctor', 'Def Col finest'],
    ['cp.c', 'Raghav Bansal', 'Connaught Place', 'Founder', 'Inner circle, outer circle'],
    ['dwarka.d', 'Simran Kaur', 'Dwarka', 'Athlete', 'Sector by sector'],
    ['punjabibagh.p', 'Manpreet Gill', 'Punjabi Bagh', 'Entrepreneur', 'West side story'],
    ['rajouri.r', 'Ishita Malik', 'Rajouri Garden', 'Creator', 'Rajouri runs it'],
    ['lajpat.l', 'Kartik Chawla', 'Lajpat Nagar', 'CA', 'Market to market'],
    ['pitampura.p', 'Neha Jain', 'Pitampura', 'Lawyer', 'North campus never left'],
    ['dwarka.dev', 'Dev Yadav', 'Dwarka', 'Student', 'Metro to the top'],
  ],
};

interface DemoMember { pub: PublicMember; score: number; yScore: number; reachedAt: number; lifetime: number; }

function build(): DemoMember[] {
  let seed = 20261110;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const top: Record<string, number> = { surat: 25000, ahmedabad: 21500, mumbai: 64000, pune: 30500, delhi: 52000 };
  const out: DemoMember[] = [];
  for (const city of CITIES) {
    PEOPLE[city.id].forEach((p, i, list) => {
      const score = Math.max(1000, 500 * Math.round((top[city.id] * Math.pow(0.8, i) * (0.92 + rnd() * 0.12)) / 500));
      const moved = rnd() < 0.35;
      let yScore = moved ? Math.max(0, score - 500 * Math.round((500 + rnd() * (Math.min(6000, score - 500) - 500)) / 500)) : score;
      if (i === list.length - 2 || p[0] === 'pal.prince') yScore = 0;
      const reachedAt = AS_OF.getTime() - Math.floor(rnd() * 9 * 86_400_000);
      const prior = 500 * Math.round((rnd() * score * 2.2) / 500);
      const lifetime = score + prior;
      out.push({
        score, yScore, reachedAt, lifetime,
        pub: {
          username: p[0], displayName: p[1], masked: p[1] === null, publicLabel: p[1] === null ? p[0] : p[0],
          title: p[3], flexLine: p[4], cityId: city.id, state: city.state, locality: p[2],
          memberNo: 100 + Math.floor(rnd() * 4900), seasonScore: score, lifetimeTier: lifetimeTier(lifetime),
        },
      });
    });
  }
  // Demo storyline: Kinjal took Surat #01 from Vikram in the last 24 hours.
  out.find((m) => m.pub.username === 'kinjal.adajan')!.yScore = 17500;
  const me = out.find((m) => m.pub.username === 'ishaan.m')!;
  Object.assign(me, { score: 3000, yScore: 2000, lifetime: 9500, reachedAt: new Date('2026-11-09T21:14:00+05:30').getTime() });
  me.pub = { ...me.pub, memberNo: 4812, seasonScore: 3000, lifetimeTier: lifetimeTier(9500) };
  return out;
}

const MEMBERS = build();
const VIEWER = 'ishaan.m';

function inScope(m: DemoMember, s: Scope): boolean {
  const city = cityById(s.cityId)!;
  if (s.level === 'india') return true;
  if (s.level === 'state') return m.pub.state === city.state;
  if (s.level === 'city') return m.pub.cityId === s.cityId;
  return m.pub.cityId === s.cityId && m.pub.locality === s.locality;
}

function rankedRows(scope: Scope): BoardRow[] {
  const list = MEMBERS.filter((m) => inScope(m, scope));
  const now = rankEntries(list.map((m) => ({ id: m.pub.username, score: m.score, reachedAt: m.reachedAt, m })));
  const prev = rankEntries(list.map((m) => ({ id: m.pub.username, score: m.yScore, reachedAt: m.reachedAt, m })));
  const prevRank = new Map(prev.map((e, i) => [e.id, i + 1]));
  return now.map((e, i) => ({ rank: i + 1, member: e.m.pub, movement: movement(i + 1, prevRank.get(e.id)) }));
}

const scopeFor = (m: PublicMember, level: Level): Scope => ({ level, cityId: m.cityId, locality: m.locality });

const ARCHIVE_HOLDERS = [
  { month: 9, holders: { surat: 'vesu.vikram', ahmedabad: 'sg.highway.sid', mumbai: 'worli.w', pune: 'kp.kabir', delhi: 'gk.gaurav', india: 'worli.w' } },
  { month: 8, holders: { surat: 'kinjal.adajan', ahmedabad: 'bodakdev.b', mumbai: 'bkc.boss', pune: 'baner.b', delhi: 'vasantvihar.v', india: 'vasantvihar.v' } },
  { month: 7, holders: { surat: 'diamondwala', ahmedabad: 'sg.highway.sid', mumbai: 'worli.w', pune: 'kp.kabir', delhi: 'cp.c', india: 'worli.w' } },
];

export const demoSource: DataSource = {
  availability: 'demo',
  now: () => AS_OF,
  season: () => seasonFor(AS_OF, DEMO_SEASON_ONE),
  async board(scope, opts = {}) {
    const all = rankedRows(scope);
    const q = opts.query?.trim().toLowerCase();
    const filtered = q ? all.filter((r) => [r.member.publicLabel, r.member.displayName ?? '', r.member.locality].some((v) => v.toLowerCase().includes(q))) : all;
    const rows = filtered.slice(0, opts.limit ?? 100);
    const viewerRow = all.find((r) => r.member.username === VIEWER) ?? null;
    return { scope, rows, total: all.length, viewerRow } satisfies Board;
  },
  async events(scope, limit) {
    const at = new Date(AS_OF.getTime() - 3_600_000);
    return rankedRows(scope)
      .filter((r) => r.movement && ['up', 'down', 'new', 'took'].includes(r.movement.kind))
      .sort((a, b) => (b.movement!.kind === 'took' ? 99 : b.movement!.by) - (a.movement!.kind === 'took' ? 99 : a.movement!.by))
      .slice(0, limit)
      .map((r): BoardEvent => ({ kind: r.movement!.kind as BoardEvent['kind'], member: r.member, rank: r.rank, by: r.movement!.by, scope, at }));
  },
  async member(username) {
    return MEMBERS.find((m) => m.pub.username === username)?.pub ?? null;
  },
  async standings(username) {
    const m = MEMBERS.find((x) => x.pub.username === username);
    if (!m) return [];
    return (['locality', 'city', 'state', 'india'] as Level[]).map((level): Standing => {
      const scope = scopeFor(m.pub, level); const rows = rankedRows(scope);
      return { level, scope, rank: rows.find((r) => r.member.username === username)?.rank ?? null, of: rows.length };
    });
  },
  async viewer() {
    const m = MEMBERS.find((x) => x.pub.username === VIEWER)!;
    const standings = await this.standings(VIEWER);
    const cityRow = rankedRows(scopeFor(m.pub, 'city')).find((r) => r.member.username === VIEWER);
    return {
      member: m.pub, lifetimeScore: m.lifetime, memberSince: 'Aug 2026', standings,
      cityMovement: cityRow?.movement ?? null,
      record: [
        { seasonLabel: 'Season 3', monthLabel: 'Oct 2026', cityRank: 9, localityRank: 2, note: 'Best city finish so far' },
        { seasonLabel: 'Season 2', monthLabel: 'Sep 2026', cityRank: 15, localityRank: 4, note: null },
        { seasonLabel: 'Season 1', monthLabel: 'Aug 2026', cityRank: 22, localityRank: 6, note: 'First season on the board' },
      ],
      insignia: [
        { id: 'streak-3', name: 'Streak ×3', meaning: 'Ranked in three seasons in a row' },
        { id: 'founding-500', name: 'Founding 500', meaning: 'One of the first 500 ranked members in Surat' },
      ],
    } satisfies ViewerSeal;
  },
  async cities() {
    const totals = (key: 'score' | 'yScore') => CITIES.map((c) => ({ c, t: MEMBERS.filter((m) => m.pub.cityId === c.id).reduce((a, m) => a + m[key], 0) }))
      .sort((a, b) => b.t - a.t);
    const now = totals('score'); const prev = totals('yScore');
    return now.map(({ c, t }, i): CitySummary => ({
      cityId: c.id, members: rankedRows({ level: 'city', cityId: c.id, locality: '' }).length, seasonTotal: t,
      leader: rankedRows({ level: 'city', cityId: c.id, locality: '' })[0]?.member ?? null,
      rank: i + 1, previousRank: prev.findIndex((p) => p.c.id === c.id) + 1,
    }));
  },
  async archive() {
    return ARCHIVE_HOLDERS.map(({ month, holders }, i): ArchiveSeason => ({
      seasonLabel: `Season ${3 - i}`, monthLabel: `${monthName(month)} 2026`, year: 2026,
      startsAt: istMonthStart(2026, month), endsAt: new Date(istMonthStart(2026, month + 1).getTime() - 60_000),
      champions: Object.entries(holders).map(([cityId, u]) => ({ cityId, member: MEMBERS.find((m) => m.pub.username === u)!.pub })),
    }));
  },
};

export const DEMO_AS_OF_LABEL = '10 Nov 2026, 6:00 pm IST';
