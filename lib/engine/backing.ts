// Backing: one free, locked pledge per member per season.
// A backing never touches scores or ranks. It is read from the engine's result, never written into it.
//
// Rules
//   1. A member may back one contender per season. The first accepted backing is final: it cannot be
//      moved, withdrawn or repeated.
//   2. Only while the season is open (including an anti-snipe extension).
//   3. The contender must already be on the board that season. You cannot back yourself.
//   4. When a season closes, everyone who backed the member who finished #01 on that member's city
//      board is awarded "Backed the Crown" for that season, permanently.
//   5. Nothing is paid, won or transferred. Backing counts are public.
import { boardAt, scoresAt, type Achievement, type EngineResult, type SeasonState } from './engine';

export interface BackEvent { id: string; at: number; backer: string; target: string }
export interface Backing { seasonId: number; backer: string; target: string; at: number }
export type BackRefusal = 'not-a-member' | 'unknown-contender' | 'self' | 'season-not-open' | 'not-a-contender' | 'already-backed';
export const REFUSAL_TEXT: Record<BackRefusal, string> = {
  'not-a-member': 'Create your profile to back someone.',
  'unknown-contender': 'That member does not exist.',
  self: 'You cannot back yourself.',
  'season-not-open': 'Backing is only open while a season is running.',
  'not-a-contender': 'They are not on the board this season, so there is nothing to back yet.',
  'already-backed': 'Your backing for this season is already given and locked.',
};
export interface BackedCrown extends Omit<Achievement, 'id'> { id: 'backed-the-crown'; target: string }
export interface BackingResult {
  accepted: Backing[];
  rejected: { event: BackEvent; reason: BackRefusal }[];
  /** One per backer per closed season whose pick finished #01 in their city. */
  awards: BackedCrown[];
}

// Open at that moment in time (a season that has since closed was still open for backings made during it).
const seasonAt = (res: EngineResult, at: number): SeasonState | undefined => res.seasons.find((s) => at >= s.startsAt && at < s.endsAt);

/** May `backer` back `target` at time `at`, given the backings already accepted? */
export function canBack(res: EngineResult, accepted: Backing[], backer: string, target: string, at: number): { ok: true; seasonId: number } | { ok: false; reason: BackRefusal } {
  if (!res.members.has(backer)) return { ok: false, reason: 'not-a-member' };
  if (!res.members.has(target)) return { ok: false, reason: 'unknown-contender' };
  if (backer === target) return { ok: false, reason: 'self' };
  const s = seasonAt(res, at);
  if (!s) return { ok: false, reason: 'season-not-open' };
  if (accepted.some((b) => b.seasonId === s.id && b.backer === backer)) return { ok: false, reason: 'already-backed' };
  if (!(scoresAt(res, s.id, at).get(target)?.score ?? 0)) return { ok: false, reason: 'not-a-contender' };
  return { ok: true, seasonId: s.id };
}

/** Finished #01 on their own city board in a closed season. */
export function cityCrown(res: EngineResult, seasonId: number): Map<string, string> {
  const out = new Map<string, string>(); // cityId -> memberId
  const frozen = res.frozen.get(seasonId);
  if (!frozen) return out;
  for (const [key, rows] of frozen) if (key.startsWith('city:') && rows[0]) out.set(key.slice(5), rows[0].memberId);
  return out;
}

export function runBacking(res: EngineResult, events: BackEvent[]): BackingResult {
  const accepted: Backing[] = [], rejected: BackingResult['rejected'] = [];
  for (const e of [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) {
    if (e.at > res.now) continue;
    const c = canBack(res, accepted, e.backer, e.target, e.at);
    if (c.ok) accepted.push({ seasonId: c.seasonId, backer: e.backer, target: e.target, at: e.at });
    else rejected.push({ event: e, reason: c.reason });
  }
  const awards: BackedCrown[] = [];
  for (const s of res.seasons.filter((x) => x.closed)) {
    const crowned = new Set(cityCrown(res, s.id).values());
    for (const b of accepted) if (b.seasonId === s.id && crowned.has(b.target)) {
      const city = res.members.get(b.target)!.cityId;
      awards.push({ id: 'backed-the-crown', memberId: b.backer, target: b.target, label: 'Backed the Crown', detail: `Backed the #01 of ${city} at the Season ${s.id} finale`, at: s.endsAt, seasonId: s.id, board: `city:${city}` });
    }
  }
  return { accepted, rejected, awards };
}

export const backersOf = (r: BackingResult, seasonId: number, target: string) => r.accepted.filter((b) => b.seasonId === seasonId && b.target === target).length;
export const pickOf = (r: BackingResult, seasonId: number, backer: string) => r.accepted.find((b) => b.seasonId === seasonId && b.backer === backer) ?? null;

/** Contenders on a city board ordered by backers (ties: better rank first). Never used for ranking. */
export function mostBacked(res: EngineResult, r: BackingResult, seasonId: number, cityId: string, at: number): { memberId: string; backers: number; rank: number }[] {
  return boardAt(res, seasonId, `city:${cityId}`, at).map((row) => ({ memberId: row.memberId, backers: backersOf(r, seasonId, row.memberId), rank: row.rank }))
    .filter((x) => x.backers > 0).sort((a, b) => b.backers - a.backers || a.rank - b.rank);
}
