// The Closing: the final stretch of a practice season, replayed as a live event.
// The server owns the clock and every figure. State for any moment is produced by running the same
// season engine (anti-snipe included) over the events up to that moment. Invented members only.
import { DAY, HOUR, MINUTE, boardAt, runEngine, type EngineEvent, type EngineMember, type SeasonDef } from './engine/engine';
import { publicDeclarations, runCallouts, toOvertake, type DeclareEvent } from './engine/callout';

export const CLOSING_SPEED = 45;                       // practice minutes per real minute
const START = new Date('2026-12-01T00:00:00+05:30').getTime();
const END = new Date('2026-12-31T23:59:00+05:30').getTime();
export const CLOSING_SEASON: SeasonDef = { id: 97, startsAt: START, scheduledEnd: END };
export const CLOSING_OPENS = END - 20 * MINUTE;        // where the replay begins
const BOARD = 'city:surat';
export const CLOSING_MEMBERS: (EngineMember & { name: string })[] = [
  ['cl.riya', 'Riya Kapadia', 'Vesu'], ['cl.aman', 'Aman Shroff', 'Adajan'], ['cl.zoya', 'Zoya Mistry', 'Pal'],
  ['cl.kabir', 'Kabir Jariwala', 'Athwa'], ['cl.meher', 'Meher Gandhi', 'Piplod'], ['cl.dev', 'Dev Rana', 'Vesu'],
].map(([id, name, locality]) => ({ id, name, cityId: 'surat', state: 'GJ', locality }));
const NAME = new Map(CLOSING_MEMBERS.map((m) => [m.id, m.name]));
const c = (id: string, memberId: string, amount: number, at: number): EngineEvent => ({ type: 'credit', id, memberId, amount, at });
const m = (min: number) => END + min * MINUTE;
/** The season so far, then the scripted final stretch. Times in the stretch are minutes relative to the scheduled close. */
const EVENTS: EngineEvent[] = [
  c('p1', 'cl.riya', 42000, START + 21 * DAY), c('p2', 'cl.aman', 38500, START + 23 * DAY), c('p3', 'cl.zoya', 31000, START + 24 * DAY),
  c('p4', 'cl.kabir', 24000, START + 25 * DAY), c('p5', 'cl.meher', 12000, START + 26 * DAY), c('p6', 'cl.dev', 6000, START + 27 * DAY),
  c('f1', 'cl.meher', 2000, m(-18)), c('f2', 'cl.kabir', 8000, m(-16)), c('f3', 'cl.aman', 4000, m(-12)), c('f4', 'cl.riya', 1000, m(-7)),
  c('f5', 'cl.zoya', 12500, m(-2)), c('f6', 'cl.riya', 1000, m(4)), c('f7', 'cl.aman', 2000, m(21)), c('f8', 'cl.zoya', 1500, m(38)),
  c('f9', 'cl.riya', 1500, m(52)), c('f10', 'cl.zoya', 500, m(68)), c('f11', 'cl.aman', 5000, m(80)),
];
const DECLARES: DeclareEvent[] = [
  { id: 'cd1', at: END - 3 * DAY, challenger: 'cl.aman', board: BOARD, line: 1 },
  { id: 'cd2', at: END - 2 * DAY, challenger: 'cl.kabir', board: BOARD, line: 0 },
  { id: 'cd3', at: END - 30 * HOUR, challenger: 'cl.zoya', board: BOARD, line: 3 },
];

export interface ClosingTick { at: number; clock: string; kind: 'entry' | 'overtake' | 'defend' | 'move' | 'refused'; text: string; extended: boolean }
export interface ClosingState {
  phase: 'idle' | 'live' | 'extended' | 'closed';
  /** Practice-season instant this state describes, and the real milliseconds until the server's close. */
  at: number; clock: string; scheduledClose: string; closesAt: string; remainingMs: number; realRemainingMs: number;
  extensions: number; extendedBy: number; lastExtensionAt: number | null;
  holder: { name: string; score: number } | null;
  /** One ₹500 step past the holder: what #01 costs a new entrant at this instant. Indicative. */
  price: number;
  board: { rank: number; name: string; score: number; toTake: number }[];
  ticker: ClosingTick[];
  declarations: { no: string; challenger: string; line: string; status: 'standing' | 'won' | 'throne-moved' | 'lapsed' }[];
  thronesChanged: number;
  verdict: { winner: string; score: number; margin: number; runnerUp: string | null; closedAt: string; extensions: number; changes: number; refused: number } | null;
}
const clock = (t: number) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(t);

/** Authoritative state at a practice-season instant. Pure: same instant, same answer. */
export function closingStateAt(at: number): ClosingState {
  const res = runEngine(CLOSING_MEMBERS, [CLOSING_SEASON], EVENTS.filter((e) => e.at <= at), at);
  const s = res.seasons[0];
  const rows = boardAt(res, s.id, BOARD, at);
  const top = rows[0];
  const closed = at >= s.endsAt;
  const changes = res.crownEvents.filter((e) => e.board === BOARD && e.at >= CLOSING_OPENS);
  const accepted = new Set(res.credits.map((x) => x.id));
  const ticker: ClosingTick[] = EVENTS.filter((e): e is Extract<EngineEvent, { type: 'credit' }> => e.type === 'credit' && e.at >= CLOSING_OPENS && e.at <= at).map((e) => {
    const name = NAME.get(e.memberId)!, amt = `₹${e.amount.toLocaleString('en-IN')}`;
    const took = changes.find((x) => x.byEvent === e.id);
    const extended = s.extensions.some((x) => x.byEvent === e.id);
    if (!accepted.has(e.id)) return { at: e.at, clock: clock(e.at), kind: 'refused' as const, extended: false, text: `${name} sends ${amt}. Refused: the board is closed.` };
    if (took) return { at: e.at, clock: clock(e.at), kind: 'overtake' as const, extended, text: `${name} adds ${amt} and TAKES THE THRONE${took.from ? ` from ${NAME.get(took.from)}` : ''}.` };
    const before = boardAt(res, s.id, BOARD, e.at - 1), after = boardAt(res, s.id, BOARD, e.at);
    const r0 = before.find((x) => x.memberId === e.memberId)?.rank ?? before.length + 1, r1 = after.find((x) => x.memberId === e.memberId)!.rank;
    if (r1 === 1) return { at: e.at, clock: clock(e.at), kind: 'defend' as const, extended, text: `${name} adds ${amt} to defend the throne.` };
    return { at: e.at, clock: clock(e.at), kind: r1 < r0 ? 'move' as const : 'entry' as const, extended, text: r1 < r0 ? `${name} adds ${amt} and climbs to #${r1}.` : `${name} adds ${amt}. It passes nobody.` };
  }).reverse();
  const decl = publicDeclarations(runCallouts(res, DECLARES));
  const remaining = Math.max(0, s.endsAt - at);
  return {
    phase: closed ? 'closed' : s.extensions.length ? 'extended' : 'live',
    at, clock: clock(at), scheduledClose: clock(s.scheduledEnd), closesAt: clock(s.endsAt), remainingMs: remaining, realRemainingMs: Math.ceil(remaining / CLOSING_SPEED),
    extensions: s.extensions.length, extendedBy: Math.round((s.endsAt - s.scheduledEnd) / MINUTE), lastExtensionAt: s.extensions.at(-1)?.at ?? null,
    holder: top ? { name: NAME.get(top.memberId)!, score: top.score } : null,
    price: toOvertake(top?.score ?? 0, 0),
    board: rows.slice(0, 6).map((r) => ({ rank: r.rank, name: NAME.get(r.memberId)!, score: r.score, toTake: r.rank === 1 ? 0 : toOvertake(top!.score, r.score) })),
    ticker,
    declarations: decl.map((d) => ({ no: `D/P/${String(d.seq).padStart(3, '0')}`, challenger: NAME.get(d.challenger)!, line: d.line, status: d.status as ClosingState['declarations'][number]['status'] })),
    thronesChanged: changes.length,
    verdict: closed && top ? { winner: NAME.get(top.memberId)!, score: top.score, margin: top.score - (rows[1]?.score ?? 0), runnerUp: rows[1] ? NAME.get(rows[1].memberId)! : null,
      closedAt: clock(s.endsAt), extensions: s.extensions.length, changes: changes.length, refused: ticker.filter((t) => t.kind === 'refused').length } : null,
  };
}
/** Map real time since the replay started to a practice-season instant. A little past the close, then it stays there. */
export function closingInstant(startedAtReal: number, nowReal: number): number {
  return Math.min(CLOSING_OPENS + Math.max(0, nowReal - startedAtReal) * CLOSING_SPEED, END + 2 * HOUR + 10 * MINUTE);
}
