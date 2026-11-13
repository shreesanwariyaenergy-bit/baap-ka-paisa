// The strongest true claim a member can make, and the throne-time board.
// Everything is derived from recorded standings, reigns and achievements. Nothing is self-declared.
import type { AchievementView, ReignView, Standing } from './data/types';
import { LEVEL_LABEL, scopeName, type Level } from './geo';
import { heldFor } from './gazette';

export interface Claim { headline: string; proof: string; kind: 'holds' | 'crown' | 'reign' | 'feat' | 'rank' | 'backed' | 'first' }
const WIDTH: Record<Level, number> = { india: 4, state: 3, city: 2, locality: 1 };
const place = (s: Standing) => (s.level === 'india' ? 'India' : scopeName(s.scope));

/** Order: holding #01 now > a Season Crown > time on a throne > a recorded feat > best current rank > backed the crown > firsts. */
export function strongestClaim(i: { standings: Standing[]; achievements: AchievementView[]; reigns: ReignView[] }): Claim | null {
  const held = i.standings.filter((s) => s.rank === 1).sort((a, b) => WIDTH[b.level] - WIDTH[a.level])[0];
  // Holding a city or wider comes first; holding only a locality ranks below past Season Crowns.
  if (held && (held.level !== 'locality' || !i.achievements.some((x) => x.id === 'season-crown'))) return { kind: 'holds', headline: `Holds ${place(held)}`, proof: `Current #01 of ${held.of} on the ${place(held)} ${LEVEL_LABEL[held.level].toLowerCase()} board` };
  const crowns = i.achievements.filter((a) => a.id === 'season-crown');
  if (crowns.length) return { kind: 'crown', headline: crowns.length > 1 ? `Season Crown ×${crowns.length}` : `Season Crown${crowns[0].boardName ? `, ${crowns[0].boardName}` : ''}`, proof: crowns[0].detail };
  const reign = [...i.reigns].filter((r) => r.scope.level !== 'locality' && r.hours >= 24).sort((a, b) => b.hours - a.hours)[0];
  if (reign) return { kind: 'reign', headline: `Held ${reign.boardName} for ${heldFor(reign.hours)}`, proof: `${reign.seasonLabel}, recorded in the throne history` };
  const feat = i.achievements.find((a) => a.id === 'untouchable') ?? i.achievements.find((a) => a.id === 'revenge-taken') ?? i.achievements.find((a) => a.id === 'most-respected');
  if (feat) return { kind: 'feat', headline: feat.label, proof: feat.detail };
  const ranked = i.standings.filter((s) => s.rank !== null);
  // The best current rank: a podium on any board beats a deep rank on a wide one; ties go to the wider board.
  const best = [...ranked].sort((a, b) => (a.rank! <= 3 ? 0 : a.rank! <= 10 ? 1 : 2) - (b.rank! <= 3 ? 0 : b.rank! <= 10 ? 1 : 2) || (a.rank! <= 10 || b.rank! <= 10 ? WIDTH[b.level] - WIDTH[a.level] : a.rank! - b.rank!) || a.rank! - b.rank!)[0];
  if (best && best.rank! <= 10) return { kind: 'rank', headline: `#${String(best.rank).padStart(2, '0')} in ${place(best)}`, proof: `Of ${best.of} on the ${LEVEL_LABEL[best.level].toLowerCase()} board, right now` };
  const backed = i.achievements.filter((a) => a.id === 'backed-the-crown');
  if (backed.length) return { kind: 'backed', headline: backed.length > 1 ? `Backed the Crown ×${backed.length}` : 'Backed the Crown', proof: backed[0].detail };
  const first = i.achievements.find((a) => a.id === 'pioneer') ?? i.achievements.find((a) => a.id === 'founding-500');
  if (first) return { kind: 'first', headline: first.label, proof: first.detail };
  if (best) return { kind: 'rank', headline: `#${String(best.rank).padStart(2, '0')} in ${place(best)}`, proof: `Of ${best.of} on the ${LEVEL_LABEL[best.level].toLowerCase()} board, right now` };
  return null;
}

export interface ThroneTime { username: string; name: string; hours: number; reigns: number; longest: number; holding: boolean }
/** Total time each member has held #01 on one board, longest first. Money cannot buy this instantly. */
export function throneTime(reigns: ReignView[]): ThroneTime[] {
  const by = new Map<string, ThroneTime>();
  for (const r of reigns) {
    const e = by.get(r.member.username) ?? { username: r.member.username, name: r.member.masked ? r.member.publicLabel : r.member.displayName ?? r.member.username, hours: 0, reigns: 0, longest: 0, holding: false };
    e.hours += r.hours; e.reigns += 1; e.longest = Math.max(e.longest, r.hours); e.holding ||= r.current;
    by.set(r.member.username, e);
  }
  return [...by.values()].sort((a, b) => b.hours - a.hours || b.longest - a.longest || a.name.localeCompare(b.name));
}

/** What the #01 spot costs right now: one step past the leader. Derived from the board, not a new rule. */
export function priceOfThrone(leaderScore: number | null, myScore = 0): number {
  if (!leaderScore) return 1000;                       // vacant: the entry minimum takes it
  return Math.max(myScore ? 500 : 1000, leaderScore - myScore + 500);
}

export interface DethronedBand { boardName: string; by: string; byUsername: string; at: Date; hoursAgo: number; hoursLeft: number }
/**
 * The band a member wears for 24 hours after losing a #01 they held. It comes off early only if they
 * take that throne back. Widest board first. Derived from the throne record; nothing is stored.
 */
export function dethronedBand(reigns: ReignView[], taken: { boardName: string; from: { username: string } | null; to: { username: string; displayName: string | null; masked: boolean; publicLabel: string }; at: Date }[], now: Date): DethronedBand | null {
  const lost = reigns.filter((r) => r.endReason === 'overtaken' && r.to && now.getTime() - r.to.getTime() < 24 * 3_600_000 && now.getTime() >= r.to.getTime())
    .filter((r) => !reigns.some((x) => x.boardName === r.boardName && x.from.getTime() >= r.to!.getTime()))   // took it back: the band is off
    .sort((a, b) => WIDTH[b.scope.level] - WIDTH[a.scope.level] || b.to!.getTime() - a.to!.getTime())[0];
  if (!lost) return null;
  const ev = taken.find((t) => t.boardName === lost.boardName && Math.abs(t.at.getTime() - lost.to!.getTime()) < 60_000);
  if (!ev) return null;
  const hoursAgo = Math.floor((now.getTime() - lost.to!.getTime()) / 3_600_000);
  return { boardName: lost.boardName, by: ev.to.masked ? ev.to.publicLabel : ev.to.displayName ?? ev.to.username, byUsername: ev.to.username, at: lost.to!, hoursAgo, hoursLeft: Math.max(1, 24 - hoursAgo) };
}
