// Declarations: a member formally and publicly declares for a throne.
// A declaration changes nothing on the board. It is a public record of intent, resolved only by what
// the board itself later shows. There is no free text anywhere: every word comes from the register or
// from a fixed list, so a declaration cannot carry abuse, a false name or a private detail.
//
// Rules
//   1. Only against the current #01 of a board, while the season is open. Never against yourself.
//   2. One standing declaration per challenger per board. COOLDOWN between any two declarations by the
//      same member, and at most SEASON_LIMIT per member per season.
//   3. A holder can block a challenger: that challenger can no longer declare against them, and their
//      standing declarations against that holder are withdrawn from public view.
//   4. A moderator can remove any declaration. Removed declarations keep their number (no reuse).
//   5. Outcome is read from the board: the challenger takes that throne -> "won"; someone else takes it
//      or the holder is otherwise replaced -> "throne-moved"; the season closes first -> "lapsed".
import { HOUR, boardAt, scoresAt, type BoardKey, type EngineResult, type SeasonState } from './engine';

export const COOLDOWN = 72 * HOUR;
export const SEASON_LIMIT = 3;
/** The only wording a challenger can choose. Index 0 is the default. */
export const LINES = ['I am coming for this throne.', 'Enjoy it while it lasts.', 'This city has the wrong name at the top.', 'You were only keeping it warm.'] as const;

export interface DeclareEvent { id: string; at: number; challenger: string; board: BoardKey; line?: number }
export interface Block { holder: string; challenger: string; at: number }
export type DeclareRefusal = 'not-a-member' | 'season-not-open' | 'vacant' | 'self' | 'blocked' | 'already-standing' | 'cooldown' | 'season-limit';
export const DECLARE_REFUSAL: Record<DeclareRefusal, string> = {
  'not-a-member': 'Create your profile to declare.',
  'season-not-open': 'Declarations are only open while a season is running.',
  vacant: 'Nobody holds this throne. There is no one to declare against: just take it.',
  self: 'You already hold this throne.',
  blocked: 'You cannot declare against this member.',
  'already-standing': 'Your declaration for this throne is already standing.',
  cooldown: 'You declared recently. A member may declare once every 72 hours.',
  'season-limit': `A member may make ${SEASON_LIMIT} declarations per season. You have used them.`,
};
export type DeclarationStatus = 'standing' | 'won' | 'throne-moved' | 'lapsed' | 'withdrawn' | 'removed';
export interface TimelineEntry { at: number; kind: 'declared' | 'holder-added' | 'challenger-added' | 'won' | 'throne-moved' | 'lapsed'; amount?: number; gap: number; by?: string }
export interface Declaration {
  id: string; seq: number; seasonId: number; board: BoardKey; challenger: string; holder: string; at: number; line: string;
  /** Snapshot when declared. */
  holderScore: number; challengerScore: number; required: number;
  status: DeclarationStatus; resolvedAt: number | null;
  timeline: TimelineEntry[];
}

/** What it takes to pass a leader: one ₹500 step beyond them; a first entry is at least ₹1,000. */
export function toOvertake(leaderScore: number, myScore: number): number {
  return Math.max(myScore > 0 ? 500 : 1000, leaderScore - myScore + 500);
}
const openSeason = (res: EngineResult, at: number): SeasonState | undefined => res.seasons.find((s) => at >= s.startsAt && at < s.endsAt);

function resolve(res: EngineResult, d: Pick<Declaration, 'seasonId' | 'board' | 'challenger' | 'at'>, asOf: number): { status: 'standing' | 'won' | 'throne-moved' | 'lapsed'; at: number | null } {
  const change = res.crownEvents.filter((e) => e.seasonId === d.seasonId && e.board === d.board && e.at > d.at && e.at <= asOf).sort((a, b) => a.at - b.at)[0];
  if (change) return { status: change.to === d.challenger ? 'won' : 'throne-moved', at: change.at };
  const s = res.seasons.find((x) => x.id === d.seasonId)!;
  return asOf >= s.endsAt ? { status: 'lapsed', at: s.endsAt } : { status: 'standing', at: null };
}

export function canDeclare(res: EngineResult, existing: Declaration[], blocks: Block[], challenger: string, board: BoardKey, at: number):
  { ok: true; seasonId: number; holder: string; holderScore: number; challengerScore: number; required: number } | { ok: false; reason: DeclareRefusal } {
  if (!res.members.has(challenger)) return { ok: false, reason: 'not-a-member' };
  const s = openSeason(res, at);
  if (!s) return { ok: false, reason: 'season-not-open' };
  const top = boardAt(res, s.id, board, at)[0];
  if (!top) return { ok: false, reason: 'vacant' };
  if (top.memberId === challenger) return { ok: false, reason: 'self' };
  if (blocks.some((b) => b.holder === top.memberId && b.challenger === challenger && b.at <= at)) return { ok: false, reason: 'blocked' };
  const mine = existing.filter((d) => d.challenger === challenger && d.status !== 'removed');
  if (mine.some((d) => d.seasonId === s.id && d.board === board && resolve(res, d, at).status === 'standing' && d.status !== 'withdrawn')) return { ok: false, reason: 'already-standing' };
  if (mine.some((d) => at - d.at < COOLDOWN)) return { ok: false, reason: 'cooldown' };
  if (mine.filter((d) => d.seasonId === s.id).length >= SEASON_LIMIT) return { ok: false, reason: 'season-limit' };
  const challengerScore = scoresAt(res, s.id, at).get(challenger)?.score ?? 0;
  return { ok: true, seasonId: s.id, holder: top.memberId, holderScore: top.score, challengerScore, required: toOvertake(top.score, challengerScore) };
}

export interface CalloutResult { declarations: Declaration[]; rejected: { event: DeclareEvent; reason: DeclareRefusal }[] }

export function runCallouts(res: EngineResult, events: DeclareEvent[], blocks: Block[] = [], removed: ReadonlySet<string> = new Set()): CalloutResult {
  const declarations: Declaration[] = [], rejected: CalloutResult['rejected'] = [];
  const seq = new Map<string, number>();
  for (const e of [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) {
    if (e.at > res.now) continue;
    const c = canDeclare(res, declarations, blocks, e.challenger, e.board, e.at);
    if (!c.ok) { rejected.push({ event: e, reason: c.reason }); continue; }
    const k = `${c.seasonId}|${e.board}`; const n = (seq.get(k) ?? 0) + 1; seq.set(k, n);
    declarations.push({ id: e.id, seq: n, seasonId: c.seasonId, board: e.board, challenger: e.challenger, holder: c.holder, at: e.at, line: LINES[e.line ?? 0] ?? LINES[0],
      holderScore: c.holderScore, challengerScore: c.challengerScore, required: c.required, status: 'standing', resolvedAt: null, timeline: [] });
  }
  for (const d of declarations) {
    const r = resolve(res, d, res.now);
    const until = r.at ?? res.now;
    let h = d.holderScore, ch = d.challengerScore;
    d.timeline.push({ at: d.at, kind: 'declared', gap: h - ch });
    for (const cr of res.credits) {
      if (res.creditSeason.get(cr.id) !== d.seasonId || cr.at <= d.at || cr.at > until) continue;
      if (cr.memberId === d.holder) { h += cr.amount; d.timeline.push({ at: cr.at, kind: 'holder-added', amount: cr.amount, gap: h - ch }); }
      else if (cr.memberId === d.challenger) { ch += cr.amount; d.timeline.push({ at: cr.at, kind: 'challenger-added', amount: cr.amount, gap: h - ch }); }
    }
    if (r.status !== 'standing') {
      const by = r.status === 'throne-moved' ? res.crownEvents.find((e) => e.seasonId === d.seasonId && e.board === d.board && e.at === r.at)?.to : undefined;
      // The move that takes the throne is the last word, not a separate entry.
      if (r.status === 'won' && d.timeline.at(-1)?.at === r.at) d.timeline.pop();
      d.timeline.push({ at: r.at!, kind: r.status, gap: h - ch, by });
    }
    d.status = removed.has(d.id) ? 'removed'
      : r.status === 'standing' && blocks.some((b) => b.holder === d.holder && b.challenger === d.challenger) ? 'withdrawn' : r.status;
    d.resolvedAt = r.at;
  }
  return { declarations, rejected };
}
/** What the public may see: removed and withdrawn declarations are never listed. */
export const publicDeclarations = (r: CalloutResult) => r.declarations.filter((d) => d.status !== 'removed' && d.status !== 'withdrawn');
