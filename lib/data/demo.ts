import 'server-only';
// SIMULATION DATA SOURCE (BKP_DATA_SOURCE=demo).
// Every member, payment, Respect and season below is invented. Nothing is a real person or transaction.
// The data is a seeded log of simulated events that runs through the season engine (lib/engine) on the
// server, so boards, archive, throne history and achievements all follow the real rules.
import { CITIES, cityById, type Level, type Scope } from '../geo';
import { istMonthStart, seasonFor, type SeasonInfo } from '../season';
import { monthName, monthShort } from '../format';
import { DAY, HOUR, ACHIEVEMENT_RULES, boardAt, boardKeys, rankScores, respectBoard as engineRespectBoard, runEngine, type EngineEvent, type EngineMember, type EngineResult, type Ranked, type SeasonDef } from '../engine/engine';
import { keyName, keyToScope, scopeToKey } from '../engine/keys';
import { lifetimeTier, movement } from './ranking';
import { humanizeDetail } from '../achievements';
import { demoViewerOn } from '../supabase-server';
import type { AchievementView, ArchiveSeason, Board, BoardEvent, BoardRow, CitySummary, CrownMomentView, DataSource, PublicMember, ReignView, SocialSummary, Standing, ViewerSeal } from './types';

export const SIM_NOW = new Date('2026-11-10T18:00:00+05:30').getTime();
export const DEMO_AS_OF_LABEL = '10 Nov 2026, 6:00 pm IST';
const VIEWER = 'ishaan.m';

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

// ---------- Seasons: Aug–Nov 2026 (Season 4 is open) ----------
export const SIM_SEASONS: SeasonDef[] = [7, 8, 9, 10].map((month, i) => ({
  id: i + 1, startsAt: istMonthStart(2026, month).getTime(), scheduledEnd: istMonthStart(2026, month + 1).getTime() - 60_000,
}));

// ---------- Simulated event log ----------
function buildLog() {
  let seed = 20261110;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const r500 = (v: number) => Math.max(500, 500 * Math.round(v / 500));
  const members: EngineMember[] = [];
  const profile = new Map<string, { p: P; city: string; memberNo: number }>();
  for (const c of CITIES) for (const p of PEOPLE[c.id]) {
    members.push({ id: p[0], cityId: c.id, state: c.state, locality: p[2] });
    profile.set(p[0], { p, city: c.id, memberNo: p[0] === VIEWER ? 4812 : 100 + Math.floor(rnd() * 4900) });
  }
  const TOP: Record<string, number> = { surat: 15500, ahmedabad: 21500, mumbai: 64000, pune: 30500, delhi: 52000 };
  const events: EngineEvent[] = [];
  let n = 0;
  const credit = (memberId: string, amount: number, at: number) => events.push({ type: 'credit', id: `sim-${++n}`, memberId, amount, at });
  const scripted = new Set(['kinjal.adajan', 'vesu.vikram', 'diamondwala', VIEWER]);

  for (const s of SIM_SEASONS) {
    const end = Math.min(s.scheduledEnd, SIM_NOW) - HOUR;
    for (const c of CITIES) {
      PEOPLE[c.id].forEach((p, i) => {
        if (scripted.has(p[0])) return;
        if (rnd() < 0.18 && s.id < 4) return; // some members skip a season (breaks streaks)
        const target = Math.max(1000, r500(TOP[c.id] * Math.pow(0.8, i) * (0.85 + rnd() * 0.3) * (s.id === 4 ? 0.85 : 1)));
        const parts = 1 + Math.floor(rnd() * 3);
        const first = Math.max(1000, r500(target / parts));
        const times = Array.from({ length: parts }, () => s.startsAt + HOUR + rnd() * (end - s.startsAt - HOUR)).sort((a, b) => a - b);
        let left = target;
        times.forEach((t, k) => { const amt = k === 0 ? Math.min(first, left) : k === parts - 1 ? left : Math.min(r500(left / (parts - k)), left); if (amt >= (k === 0 ? 1000 : 500)) { credit(p[0], amt, t); left -= amt; } });
      });
    }
  }
  // Scripted Surat storylines (simulated).
  const [s1, s2, s3, s4] = SIM_SEASONS;
  credit('diamondwala', 9000, s1.startsAt + 2 * DAY); credit('diamondwala', 9500, s1.startsAt + 12 * DAY);
  credit('vesu.vikram', 8000, s1.startsAt + 3 * DAY); credit('kinjal.adajan', 6000, s1.startsAt + 5 * DAY);
  credit('kinjal.adajan', 12000, s2.startsAt + 2 * DAY); credit('kinjal.adajan', 7000, s2.startsAt + 20 * DAY);
  credit('vesu.vikram', 9000, s2.startsAt + 4 * DAY); credit('diamondwala', 8000, s2.startsAt + 6 * DAY);
  // Season 3: Vikram leads, Diamondwala overtakes, Vikram takes it back within 24 hours (Revenge Taken).
  credit('vesu.vikram', 11000, s3.startsAt + 2 * DAY); credit('diamondwala', 11500, s3.startsAt + 9 * DAY);
  credit('vesu.vikram', 1000, s3.startsAt + 9 * DAY + 5 * HOUR); credit('kinjal.adajan', 9000, s3.startsAt + 15 * DAY);
  // Season 4: Vikram holds #01 for days, then Kinjal takes it 3 hours before "now".
  credit('vesu.vikram', 10000, s4.startsAt + DAY); credit('vesu.vikram', 8500, s4.startsAt + 5 * DAY);
  credit('kinjal.adajan', 9000, s4.startsAt + 2 * DAY); credit('kinjal.adajan', 8000, s4.startsAt + 6 * DAY);
  credit('kinjal.adajan', 7500, SIM_NOW - 3 * HOUR); credit('diamondwala', 15500, s4.startsAt + 4 * DAY);
  // The signed-in demo member: ranked in Seasons 1–4.
  credit(VIEWER, 1500, s1.startsAt + 8 * DAY); credit(VIEWER, 3000, s2.startsAt + 9 * DAY); credit(VIEWER, 4000, s3.startsAt + 7 * DAY);
  credit(VIEWER, 2000, s4.startsAt + 3 * DAY); credit(VIEWER, 1000, SIM_NOW - 20 * HOUR);

  // Simulated Respect: a handful per day, including some duplicates the engine rejects.
  const ids = members.map((m) => m.id);
  for (let t = s1.startsAt + 6 * HOUR; t < SIM_NOW; t += 4 * HOUR) {
    const giver = ids[Math.floor(rnd() * ids.length)];
    const receiver = rnd() < 0.3 ? 'kinjal.adajan' : rnd() < 0.2 ? 'worli.w' : ids[Math.floor(rnd() * ids.length)];
    events.push({ type: 'respect', giver, receiver, at: t });
  }
  // Simulated follow graph and rivals.
  const follows = new Map<string, Set<string>>();
  for (const m of members) {
    const same = members.filter((x) => x.cityId === m.cityId && x.id !== m.id);
    const set = new Set<string>();
    for (let k = 0; k < 4; k++) set.add(same[Math.floor(rnd() * same.length)].id);
    if (rnd() < 0.5) set.add('worli.w');
    set.delete(m.id); follows.set(m.id, set);
  }
  const rivals = new Map<string, string[]>([[VIEWER, ['vesu.vikram', 'vesu.queen', 'pal.prince']]]);
  return { members, profile, events, follows, rivals };
}

const LOG = buildLog();
export const SIM: EngineResult = runEngine(LOG.members, SIM_SEASONS, LOG.events, SIM_NOW);
const CURRENT = SIM.seasons.find((s) => s.startsAt <= SIM_NOW && !s.closed)!;

function pub(id: string, seasonScore?: number): PublicMember {
  const { p, city, memberNo } = LOG.profile.get(id)!;
  const c = cityById(city)!;
  const lifetime = SIM.credits.filter((x) => x.memberId === id).reduce((a, x) => a + x.amount, 0);
  const masked = p[1] === null;
  return {
    username: p[0], displayName: p[1], masked, publicLabel: p[0], title: masked ? null : p[3], flexLine: masked ? null : p[4],
    cityId: city, state: c.state, locality: p[2], memberNo: masked ? null : memberNo,
    seasonScore: seasonScore ?? (boardAt(SIM, CURRENT.id, 'india', SIM_NOW).find((r) => r.memberId === id)?.score ?? 0),
    lifetimeTier: lifetimeTier(lifetime),
  };
}
const seasonLabel = (id: number) => `Season ${id}`;

function toBoard(scope: Scope, now: Ranked[], prev: Ranked[] | null, opts: { limit?: number; query?: string } = {}, unit?: 'count'): Board {
  const prevRank = new Map((prev ?? []).map((r) => [r.memberId, r.rank]));
  const all: BoardRow[] = now.map((r) => ({ rank: r.rank, member: pub(r.memberId, unit ? undefined : r.score), movement: prev ? movement(r.rank, prevRank.get(r.memberId)) : null, score: unit ? r.score : undefined }));
  const q = opts.query?.trim().toLowerCase();
  const filtered = q ? all.filter((r) => [r.member.publicLabel, r.member.displayName ?? '', r.member.locality].some((v) => v.toLowerCase().includes(q))) : all;
  return { scope, unit, rows: filtered.slice(0, opts.limit ?? 100), total: all.length, viewerRow: all.find((r) => r.member.username === VIEWER) ?? null };
}
async function forViewer(b: Board): Promise<Board> {
  return (await demoViewerOn()) ? b : { ...b, viewerRow: null };
}

export const demoSource: DataSource = {
  availability: 'demo',
  now: () => new Date(SIM_NOW),
  season: (): SeasonInfo => {
    const base = seasonFor(new Date(CURRENT.startsAt), null);
    return { ...base, number: CURRENT.id, startsAt: new Date(CURRENT.startsAt), endsAt: new Date(CURRENT.endsAt), label: seasonLabel(CURRENT.id),
      short: `S${String(CURRENT.id).padStart(2, '0')} / ${monthShort(base.month).toUpperCase()} '${String(base.year).slice(2)}` };
  },
  async board(scope, opts = {}) {
    const k = scopeToKey(scope);
    return forViewer(toBoard(scope, boardAt(SIM, CURRENT.id, k, SIM_NOW), boardAt(SIM, CURRENT.id, k, SIM_NOW - DAY), opts));
  },
  async hallOfFame(scope, opts = {}) {
    const k = scopeToKey(scope);
    const life = new Map<string, { score: number; reachedAt: number }>();
    for (const c of SIM.credits) { const p = life.get(c.memberId); life.set(c.memberId, { score: (p?.score ?? 0) + c.amount, reachedAt: c.at }); }
    const ids = LOG.members.filter((m) => boardKeys(m).includes(k)).map((m) => m.id);
    const ranked = rankScores(life, ids);
    const b = toBoard(scope, ranked, null, opts);
    b.rows = b.rows.map((r) => ({ ...r, score: ranked.find((x) => x.memberId === r.member.username)!.score }));
    if (b.viewerRow) b.viewerRow = { ...b.viewerRow, score: life.get(VIEWER)?.score };
    return forViewer(b);
  },
  async respectBoard(scope, opts = {}) {
    return toBoard(scope, engineRespectBoard(SIM, CURRENT.id, scopeToKey(scope)), null, opts, 'count');
  },
  async events(scope, limit) {
    const b = await this.board(scope, { limit: 100 });
    return b.rows.filter((r) => r.movement && ['up', 'down', 'new', 'took'].includes(r.movement.kind))
      .sort((a, c) => (c.movement!.kind === 'took' ? 99 : c.movement!.by) - (a.movement!.kind === 'took' ? 99 : a.movement!.by))
      .slice(0, limit)
      .map((r): BoardEvent => ({ kind: r.movement!.kind as BoardEvent['kind'], member: r.member, rank: r.rank, by: r.movement!.by, scope, at: new Date(SIM_NOW) }));
  },
  async member(username) { return LOG.profile.has(username) ? pub(username) : null; },
  async standings(username) {
    const m = SIM.members.get(username);
    if (!m) return [];
    return (['locality', 'city', 'state', 'india'] as Level[]).map((level): Standing => {
      const scope: Scope = { level, cityId: m.cityId, locality: m.locality };
      const b = boardAt(SIM, CURRENT.id, scopeToKey(scope), SIM_NOW);
      return { level, scope, rank: b.find((r) => r.memberId === username)?.rank ?? null, of: b.length };
    });
  },
  async viewer() {
    if (!(await demoViewerOn())) return null;
    const m = SIM.members.get(VIEWER)!;
    const b = await this.board({ level: 'city', cityId: m.cityId, locality: m.locality });
    const record = SIM.seasons.filter((s) => s.closed).reverse().map((s) => {
      const f = SIM.frozen.get(s.id)!;
      const cityRank = f.get(`city:${m.cityId}`)?.find((r) => r.memberId === VIEWER)?.rank ?? null;
      const locRank = f.get(`locality:${m.cityId}:${m.locality}`)?.find((r) => r.memberId === VIEWER)?.rank ?? null;
      const base = seasonFor(new Date(s.startsAt), null);
      return { seasonLabel: seasonLabel(s.id), monthLabel: `${monthShort(base.month)} ${base.year}`, cityRank, localityRank: locRank, note: null };
    });
    const ach = await this.achievements(VIEWER);
    return {
      member: pub(VIEWER), lifetimeScore: SIM.credits.filter((x) => x.memberId === VIEWER).reduce((a, x) => a + x.amount, 0),
      memberSince: 'Aug 2026', standings: await this.standings(VIEWER), record,
      insignia: ach.map((a) => ({ id: `${a.id}-${a.at.getTime()}`, name: a.label, meaning: a.detail })),
      cityMovement: b.viewerRow?.movement ?? null,
    } satisfies ViewerSeal;
  },
  async cities() {
    const tot = (t: number) => CITIES.map((c) => ({ c, t: boardAt(SIM, CURRENT.id, `city:${c.id}`, t).reduce((a, r) => a + r.score, 0) })).sort((a, b) => b.t - a.t);
    const now = tot(SIM_NOW), prev = tot(SIM_NOW - DAY);
    return now.map(({ c, t }, i): CitySummary => {
      const b = boardAt(SIM, CURRENT.id, `city:${c.id}`, SIM_NOW);
      return { cityId: c.id, members: b.length, seasonTotal: t, leader: b[0] ? pub(b[0].memberId) : null, rank: i + 1, previousRank: prev.findIndex((p) => p.c.id === c.id) + 1 };
    });
  },
  async archive() {
    return SIM.seasons.filter((s) => s.closed).reverse().map((s): ArchiveSeason => {
      const f = SIM.frozen.get(s.id)!;
      const base = seasonFor(new Date(s.startsAt), null);
      const champions = [...CITIES.map((c) => ({ cityId: c.id, k: `city:${c.id}` })), { cityId: 'india', k: 'india' }]
        .filter((x) => f.get(x.k)?.[0]).map((x) => ({ cityId: x.cityId, member: pub(f.get(x.k)![0].memberId) }));
      return { seasonLabel: seasonLabel(s.id), monthLabel: `${monthName(base.month)} ${base.year}`, year: base.year, startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt), champions };
    });
  },
  async throneHistory({ scope, username, limit = 50 }) {
    const k = scope ? scopeToKey(scope) : null;
    return SIM.reigns
      .filter((r) => (!k || r.board === k) && (!username || r.memberId === username))
      .sort((a, b) => b.from - a.from).slice(0, limit)
      .map((r): ReignView => ({
        seasonLabel: seasonLabel(r.seasonId), scope: keyToScope(r.board), boardName: keyName(r.board), member: pub(r.memberId),
        from: new Date(r.from), to: r.to ? new Date(r.to) : null, endReason: r.endReason, hours: Math.round(((r.to ?? SIM_NOW) - r.from) / HOUR),
        current: r.to === null && r.seasonId === CURRENT.id,
        untouchable: SIM.achievements.some((a) => a.id === 'untouchable' && a.memberId === r.memberId && a.board === r.board && a.seasonId === r.seasonId && a.at >= r.from && a.at <= (r.to ?? SIM_NOW)),
        revenge: SIM.achievements.some((a) => a.id === 'revenge-taken' && a.memberId === r.memberId && a.board === r.board && a.at === r.from),
      }));
  },
  async crownMoments(scope, since) {
    const k = scopeToKey(scope);
    return SIM.crownEvents.filter((e) => e.board === k && e.at >= since.getTime() && e.at <= SIM_NOW).sort((a, b) => b.at - a.at)
      .map((e): CrownMomentView => ({ seasonLabel: seasonLabel(e.seasonId), scope: keyToScope(e.board), boardName: keyName(e.board), from: e.from ? pub(e.from) : null, to: pub(e.to), at: new Date(e.at) }));
  },
  async achievements(username) {
    return SIM.achievements.filter((a) => a.memberId === username && a.at <= SIM_NOW).sort((a, b) => b.at - a.at)
      .map((a): AchievementView => ({ id: a.id, label: a.label, detail: humanizeDetail(a.detail || ACHIEVEMENT_RULES[a.id]), at: new Date(a.at), seasonLabel: a.seasonId ? seasonLabel(a.seasonId) : null, boardName: a.board ? keyName(a.board) : null }));
  },
  async social(username) {
    if (!LOG.profile.has(username)) return null;
    const followers = [...LOG.follows.values()].filter((s) => s.has(username)).length;
    const respect = SIM.respects.filter((r) => r.receiver === username && r.at >= CURRENT.startsAt).length;
    const rivalIds = LOG.rivals.get(username) ?? [];
    const india = boardAt(SIM, CURRENT.id, 'india', SIM_NOW);
    const rivals = rivalIds.map((id): BoardRow => { const m = SIM.members.get(id)!; const b = boardAt(SIM, CURRENT.id, `city:${m.cityId}`, SIM_NOW); const r = b.find((x) => x.memberId === id); return { rank: r?.rank ?? 0, member: pub(id, r?.score ?? india.find((x) => x.memberId === id)?.score ?? 0), movement: null }; });
    return { followers, following: LOG.follows.get(username)?.size ?? 0, respectThisSeason: respect, rivals } satisfies SocialSummary;
  },
};
