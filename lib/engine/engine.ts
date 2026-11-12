// BAAP KA PAISA season engine. Pure, deterministic and server-side only.
// It replays an ordered event log and derives everything the product shows:
// season status and anti-snipe extensions, rankings on all four boards, #01 changes (Crown Moments),
// throne reigns, frozen season results and automatic achievements.
// The same rules are enforced for live data by the database (supabase/migrations); this module is
// the reference implementation used by the simulation and its tests.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const IST = 5.5 * HOUR;
export const ANTI_SNIPE_WINDOW = 15 * MINUTE;
export const ANTI_SNIPE_STEP = 15 * MINUTE;
export const ANTI_SNIPE_MAX = 2 * HOUR;
export const ENTRY_MINIMUM = 1000;
export const STEP = 500;
export const UNTOUCHABLE_HOURS = 72;
export const FOUNDING_LIMIT = 500;

export interface EngineMember { id: string; cityId: string; state: string; locality: string; }
export interface SeasonDef { id: number; startsAt: number; scheduledEnd: number; }
export type EngineEvent =
  | { type: 'credit'; id: string; memberId: string; amount: number; at: number }
  | { type: 'respect'; giver: string; receiver: string; at: number };

export type BoardKey = string; // 'india' | 'state:GJ' | 'city:surat' | 'locality:surat:Vesu'
export type BoardLevel = 'locality' | 'city' | 'state' | 'india';

export interface SeasonState {
  id: number; startsAt: number; scheduledEnd: number; endsAt: number;
  extensions: { at: number; newEnd: number; byEvent: string }[];
  closed: boolean;
}
export interface Ranked { memberId: string; rank: number; score: number; reachedAt: number; }
export interface CrownEvent { seasonId: number; board: BoardKey; from: string | null; to: string; at: number; byEvent: string; }
export interface Reign { seasonId: number; board: BoardKey; memberId: string; from: number; to: number | null; endReason: 'overtaken' | 'season-end' | null; }
export interface Achievement { memberId: string; id: AchievementId; label: string; detail: string; at: number; seasonId?: number; board?: BoardKey; }
export type AchievementId = 'founding-500' | 'pioneer' | 'season-crown' | 'untouchable' | 'longest-reign' | 'revenge-taken' | 'climber-of-week' | 'streak' | 'most-respected' | 'backed-the-crown';
export interface Rejection { event: EngineEvent; reason: string; }

export const ACHIEVEMENT_RULES: Record<AchievementId, string> = {
  'founding-500': 'One of the first 500 members ever to rank in their city. Never issued again.',
  pioneer: 'First member ever to rank in a locality. One per locality, forever.',
  'season-crown': 'Finished a season as #01 on a board (locality, city, state or India).',
  untouchable: 'Held a city #01 for 72 hours without interruption.',
  'longest-reign': 'Holds the record for the longest continuous city #01 reign in their city.',
  'revenge-taken': 'Took back a #01 within 24 hours of losing it.',
  'climber-of-week': 'Biggest city rank climb in a completed week (Monday to Sunday, IST).',
  streak: 'Ranked in consecutive seasons. Shown as Streak ×N.',
  'most-respected': 'Finished a season #01 on the free Respect board.',
  'backed-the-crown': 'Gave their one backing of the season to the member who finished #01 in their city.',
};

export const boardKeys = (m: EngineMember): BoardKey[] => [`locality:${m.cityId}:${m.locality}`, `city:${m.cityId}`, `state:${m.state}`, 'india'];
export const levelOf = (k: BoardKey): BoardLevel => (k === 'india' ? 'india' : (k.split(':')[0] as BoardLevel));
const inBoard = (m: EngineMember, k: BoardKey) => boardKeys(m).includes(k);

/** Calendar day in IST, used for one-Respect-per-day. */
export const istDay = (t: number) => Math.floor((t + IST) / DAY);
/** Monday 00:00 IST of the week containing t. */
export function istWeekStart(t: number): number {
  const local = t + IST; const day = Math.floor(local / DAY); const dow = (day + 3) % 7; // 1970-01-01 was a Thursday
  return (day - dow) * DAY - IST;
}

export function rankScores(scores: Map<string, { score: number; reachedAt: number }>, memberIds: string[]): Ranked[] {
  return memberIds
    .map((id) => ({ id, s: scores.get(id) }))
    .filter((x): x is { id: string; s: { score: number; reachedAt: number } } => !!x.s && x.s.score > 0)
    .sort((a, b) => b.s.score - a.s.score || a.s.reachedAt - b.s.reachedAt || a.id.localeCompare(b.id))
    .map((x, i) => ({ memberId: x.id, rank: i + 1, score: x.s.score, reachedAt: x.s.reachedAt }));
}

export interface EngineResult {
  now: number;
  members: Map<string, EngineMember>;
  seasons: SeasonState[];
  credits: Extract<EngineEvent, { type: 'credit' }>[]; // accepted, in order, tagged with seasonId below
  creditSeason: Map<string, number>;
  respects: Extract<EngineEvent, { type: 'respect' }>[];
  crownEvents: CrownEvent[];
  reigns: Reign[];
  frozen: Map<number, Map<BoardKey, Ranked[]>>;
  achievements: Achievement[];
  rejected: Rejection[];
}

export function seasonStatus(s: SeasonState, at: number): 'upcoming' | 'open' | 'closed' {
  if (at < s.startsAt) return 'upcoming';
  if (s.closed || at >= s.endsAt) return 'closed';
  return 'open';
}

export function runEngine(members: EngineMember[], seasonDefs: SeasonDef[], events: EngineEvent[], now: number): EngineResult {
  const byId = new Map(members.map((m) => [m.id, m]));
  const seasons: SeasonState[] = seasonDefs.slice().sort((a, b) => a.startsAt - b.startsAt)
    .map((d) => ({ ...d, endsAt: d.scheduledEnd, extensions: [], closed: false }));
  const scores = new Map<number, Map<string, { score: number; reachedAt: number }>>();
  const res: EngineResult = { now, members: byId, seasons, credits: [], creditSeason: new Map(), respects: [], crownEvents: [], reigns: [], frozen: new Map(), achievements: [], rejected: [] };
  const firstEver = new Map<string, number>(); // member -> first accepted credit time
  const cityFounders = new Map<string, number>();
  const pioneers = new Set<string>();
  const respectKey = new Set<string>();
  const award = (a: Achievement) => res.achievements.push(a);

  const ordered = events.slice().sort((a, b) => a.at - b.at);
  const closeDue = (t: number) => {
    for (const s of seasons) if (!s.closed && s.startsAt <= t && t >= s.endsAt) closeSeason(s);
  };

  function closeSeason(s: SeasonState) {
    s.closed = true;
    const sc = scores.get(s.id) ?? new Map();
    const keys = new Set<BoardKey>();
    for (const id of sc.keys()) boardKeys(byId.get(id)!).forEach((k) => keys.add(k));
    const frozen = new Map<BoardKey, Ranked[]>();
    for (const k of keys) {
      const ranked = rankScores(sc, members.filter((m) => inBoard(m, k)).map((m) => m.id));
      frozen.set(k, ranked);
      if (ranked[0]) award({ memberId: ranked[0].memberId, id: 'season-crown', label: 'Season Crown', detail: `#01 at the Season ${s.id} finale`, at: s.endsAt, seasonId: s.id, board: k });
    }
    res.frozen.set(s.id, frozen);
    for (const r of res.reigns) if (r.seasonId === s.id && r.to === null) { r.to = s.endsAt; r.endReason = 'season-end'; checkUntouchable(r); }
    // Streak: consecutive seasons ranked, ending with this one.
    const ranked = [...sc.entries()].filter(([, v]) => v.score > 0).map(([id]) => id);
    const idx = seasons.indexOf(s);
    for (const id of ranked) {
      let n = 1;
      for (let i = idx - 1; i >= 0; i--) { const prev = scores.get(seasons[i].id); if (prev?.get(id)?.score) n++; else break; }
      if (n >= 2) award({ memberId: id, id: 'streak', label: `Streak ×${n}`, detail: `Ranked in ${n} seasons in a row`, at: s.endsAt, seasonId: s.id });
    }
    // Most Respected: #01 on this season's Respect board.
    const counts = new Map<string, number>();
    for (const r of res.respects) if (r.at >= s.startsAt && r.at < s.endsAt) counts.set(r.receiver, (counts.get(r.receiver) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (top) award({ memberId: top[0], id: 'most-respected', label: 'Most Respected', detail: `#01 on the Respect board in Season ${s.id}`, at: s.endsAt, seasonId: s.id });
  }

  function checkUntouchable(r: Reign) {
    if (levelOf(r.board) !== 'city') return;
    const end = r.to ?? now;
    if (end - r.from >= UNTOUCHABLE_HOURS * HOUR && !res.achievements.some((a) => a.id === 'untouchable' && a.memberId === r.memberId && a.seasonId === r.seasonId && a.board === r.board)) {
      award({ memberId: r.memberId, id: 'untouchable', label: 'Untouchable', detail: `Held ${r.board.split(':')[1]} #01 for 72 hours straight`, at: r.from + UNTOUCHABLE_HOURS * HOUR, seasonId: r.seasonId, board: r.board });
    }
  }

  for (const ev of ordered) {
    if (ev.at > now) break;
    closeDue(ev.at);
    if (ev.type === 'respect') {
      const k = `${ev.giver}>${ev.receiver}@${istDay(ev.at)}`;
      if (ev.giver === ev.receiver) { res.rejected.push({ event: ev, reason: 'cannot-respect-self' }); continue; }
      if (!byId.has(ev.giver) || !byId.has(ev.receiver)) { res.rejected.push({ event: ev, reason: 'unknown-member' }); continue; }
      if (respectKey.has(k)) { res.rejected.push({ event: ev, reason: 'one-respect-per-profile-per-day' }); continue; }
      respectKey.add(k); res.respects.push(ev); continue;
    }
    const m = byId.get(ev.memberId);
    if (!m) { res.rejected.push({ event: ev, reason: 'unknown-member' }); continue; }
    const s = seasons.find((x) => ev.at >= x.startsAt && ev.at < x.endsAt && !x.closed);
    if (!s) { res.rejected.push({ event: ev, reason: 'no-open-season' }); continue; }
    if (!Number.isInteger(ev.amount) || ev.amount <= 0 || ev.amount % STEP !== 0) { res.rejected.push({ event: ev, reason: 'amount-not-multiple-of-500' }); continue; }
    const sc = scores.get(s.id) ?? new Map(); scores.set(s.id, sc);
    const prev = sc.get(m.id);
    if (!prev && ev.amount < ENTRY_MINIMUM) { res.rejected.push({ event: ev, reason: 'entry-minimum-1000' }); continue; }

    const keys = boardKeys(m);
    const boardMembers = new Map(keys.map((k) => [k, members.filter((x) => inBoard(x, k)).map((x) => x.id)]));
    const before = new Map(keys.map((k) => [k, rankScores(sc, boardMembers.get(k)!)]));
    sc.set(m.id, { score: (prev?.score ?? 0) + ev.amount, reachedAt: ev.at });
    res.credits.push(ev); res.creditSeason.set(ev.id, s.id);
    const after = new Map(keys.map((k) => [k, rankScores(sc, boardMembers.get(k)!)]));

    // Founding 500 and Pioneer (first ever credit of this member).
    if (!firstEver.has(m.id)) {
      firstEver.set(m.id, ev.at);
      const n = (cityFounders.get(m.cityId) ?? 0) + 1; cityFounders.set(m.cityId, n);
      if (n <= FOUNDING_LIMIT) award({ memberId: m.id, id: 'founding-500', label: 'Founding 500', detail: `Founding member no. ${n} of 500 in ${m.cityId}`, at: ev.at });
      const lk = `${m.cityId}:${m.locality}`;
      if (!pioneers.has(lk)) { pioneers.add(lk); award({ memberId: m.id, id: 'pioneer', label: `Pioneer of ${m.locality}`, detail: `First member ever to rank in ${m.locality}`, at: ev.at }); }
    }

    // Overtake: someone who was ahead of this member is now behind. India covers everyone.
    const indiaBefore = before.get('india')!;
    const myBefore = indiaBefore.find((r) => r.memberId === m.id)?.rank ?? Infinity;
    const aheadBefore = new Set(indiaBefore.filter((r) => r.rank < myBefore).map((r) => r.memberId));
    const myAfter = after.get('india')!.find((r) => r.memberId === m.id)!.rank;
    const overtook = after.get('india')!.some((r) => r.rank > myAfter && aheadBefore.has(r.memberId));
    if (overtook && ev.at >= s.endsAt - ANTI_SNIPE_WINDOW) {
      const newEnd = Math.min(s.endsAt + ANTI_SNIPE_STEP, s.scheduledEnd + ANTI_SNIPE_MAX);
      if (newEnd > s.endsAt) { s.endsAt = newEnd; s.extensions.push({ at: ev.at, newEnd, byEvent: ev.id }); }
    }

    // #01 changes per board: Crown Moments and throne reigns.
    for (const k of keys) {
      const oldTop = before.get(k)![0]?.memberId ?? null;
      const newTop = after.get(k)![0].memberId;
      if (oldTop === newTop) continue;
      res.crownEvents.push({ seasonId: s.id, board: k, from: oldTop, to: newTop, at: ev.at, byEvent: ev.id });
      const open = res.reigns.find((r) => r.seasonId === s.id && r.board === k && r.to === null);
      if (open) { open.to = ev.at; open.endReason = 'overtaken'; checkUntouchable(open); }
      // Revenge Taken: this member lost #01 on this board within the last 24 hours.
      const lost = res.reigns.find((r) => r.board === k && r.memberId === newTop && r.endReason === 'overtaken' && r.to !== null && ev.at - r.to <= DAY);
      if (lost) award({ memberId: newTop, id: 'revenge-taken', label: 'Revenge Taken', detail: `Took back #01 within 24 hours`, at: ev.at, seasonId: s.id, board: k });
      res.reigns.push({ seasonId: s.id, board: k, memberId: newTop, from: ev.at, to: null, endReason: null });
    }
  }
  closeDue(now);
  for (const r of res.reigns) if (r.to === null) checkUntouchable(r);

  // Longest Reign: per city, the holder of the longest continuous city #01 reign (current record).
  const byCity = new Map<string, Reign>();
  for (const r of res.reigns) {
    if (levelOf(r.board) !== 'city') continue;
    const len = (r.to ?? now) - r.from; const best = byCity.get(r.board);
    if (!best || len > (best.to ?? now) - best.from) byCity.set(r.board, r);
  }
  for (const [k, r] of byCity) award({ memberId: r.memberId, id: 'longest-reign', label: 'Longest Reign', detail: `Record city #01 reign in ${k.split(':')[1]}: ${Math.round(((r.to ?? now) - r.from) / HOUR)} hours`, at: r.from, seasonId: r.seasonId, board: k });

  // Climber of the Week: completed IST weeks, per city, biggest city-rank improvement.
  awardClimbers(res);
  return res;
}

/** Season scores as they stood at time t (replays accepted credits). */
export function scoresAt(res: EngineResult, seasonId: number, t: number): Map<string, { score: number; reachedAt: number }> {
  const out = new Map<string, { score: number; reachedAt: number }>();
  for (const c of res.credits) {
    if (c.at > t || res.creditSeason.get(c.id) !== seasonId) continue;
    const p = out.get(c.memberId); out.set(c.memberId, { score: (p?.score ?? 0) + c.amount, reachedAt: c.at });
  }
  return out;
}

export function boardAt(res: EngineResult, seasonId: number, k: BoardKey, t: number): Ranked[] {
  const ids = [...res.members.values()].filter((m) => inBoard(m, k)).map((m) => m.id);
  return rankScores(scoresAt(res, seasonId, t), ids);
}

function awardClimbers(res: EngineResult) {
  const cities = new Set([...res.members.values()].map((m) => m.cityId));
  for (const s of res.seasons) {
    const end = Math.min(s.endsAt, res.now);
    for (let w = istWeekStart(s.startsAt); w + 7 * DAY <= end; w += 7 * DAY) {
      const weekEnd = w + 7 * DAY;
      for (const c of cities) {
        const k = `city:${c}`;
        const startBoard = boardAt(res, s.id, k, w - 1);
        const endBoard = boardAt(res, s.id, k, weekEnd - 1);
        let best: { id: string; jump: number } | null = null;
        for (const r of endBoard) {
          const was = startBoard.find((x) => x.memberId === r.memberId)?.rank ?? startBoard.length + 1;
          const jump = was - r.rank;
          if (jump > 0 && (!best || jump > best.jump)) best = { id: r.memberId, jump };
        }
        if (best) res.achievements.push({ memberId: best.id, id: 'climber-of-week', label: 'Climber of the Week', detail: `Up ${best.jump} places in ${c}, week of ${new Date(w + 5.5 * HOUR).toISOString().slice(0, 10)}`, at: weekEnd, seasonId: s.id, board: k });
      }
    }
  }
}

/** Respect board for a season: respects received, highest first; ties by who reached the count first. */
export function respectBoard(res: EngineResult, seasonId: number, k: BoardKey): Ranked[] {
  const s = res.seasons.find((x) => x.id === seasonId);
  if (!s) return [];
  const sc = new Map<string, { score: number; reachedAt: number }>();
  for (const r of res.respects) {
    if (r.at < s.startsAt || r.at >= s.endsAt || r.at > res.now) continue;
    const p = sc.get(r.receiver); sc.set(r.receiver, { score: (p?.score ?? 0) + 1, reachedAt: r.at });
  }
  return rankScores(sc, [...res.members.values()].filter((m) => inBoard(m, k)).map((m) => m.id));
}

/** Rivals: up to 5, never yourself, no duplicates. */
export function addRival(current: string[], me: string, rival: string): { ok: true; rivals: string[] } | { ok: false; reason: string } {
  if (rival === me) return { ok: false, reason: 'You cannot add yourself as a rival.' };
  if (current.includes(rival)) return { ok: false, reason: 'Already a rival.' };
  if (current.length >= 5) return { ok: false, reason: 'You can add up to 5 rivals.' };
  return { ok: true, rivals: [...current, rival] };
}
