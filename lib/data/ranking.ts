// Pure ranking rules from the Product Blueprint, used by the demo data source and its tests.
// In production the backend owns ranking; this module must never run in the browser to decide a rank.
import type { Movement } from './types';

export interface Entry { id: string; score: number; reachedAt: number; }

/** Season Score, highest first. Ties go to whoever reached the score first. Zero scores are not on the board. */
export function rankEntries<T extends Entry>(entries: T[]): T[] {
  return entries.filter((e) => e.score > 0).sort((a, b) => b.score - a.score || a.reachedAt - b.reachedAt || a.id.localeCompare(b.id));
}

export function movement(rank: number, previousRank: number | undefined): Movement {
  if (previousRank === undefined) return { kind: rank === 1 ? 'took' : 'new', by: 0 };
  if (rank === 1) return previousRank === 1 ? { kind: 'defending', by: 0 } : { kind: 'took', by: previousRank - 1 };
  if (previousRank === rank) return { kind: 'held', by: 0 };
  return previousRank > rank ? { kind: 'up', by: previousRank - rank } : { kind: 'down', by: rank - previousRank };
}

/** Amount needed to pass a target: their score + ₹500, minus what you already have (blueprint "How an overtake works"). */
export function amountToPass(myScore: number, targetScore: number): number {
  return Math.max(0, targetScore + 500 - myScore);
}

export const LIFETIME_TIERS = [
  { name: 'Black', min: 500000 },
  { name: 'Gold', min: 100000 },
  { name: 'Silver', min: 25000 },
  { name: 'Bronze', min: 5000 },
] as const;

export function lifetimeTier(lifetime: number): 'Bronze' | 'Silver' | 'Gold' | 'Black' | null {
  return LIFETIME_TIERS.find((t) => lifetime >= t.min)?.name ?? null;
}

/**
 * Preview only: where a member would land on a board if their Season Score became `newScore`.
 * Anyone already at or above that score stays ahead (they reached it first). The backend decides real ranks.
 */
export function projectedRank(others: { username: string; score: number }[], me: string, newScore: number): number {
  return 1 + others.filter((o) => o.username !== me && o.score >= newScore).length;
}

/** Blueprint amounts: first entry at least ₹1,000, every payment a multiple of ₹500. */
export function validTopUp(currentScore: number, add: number): string | null {
  if (!Number.isInteger(add) || add <= 0) return 'Enter an amount.';
  if (add % 500 !== 0) return 'Amounts go up in steps of ₹500.';
  if (currentScore === 0 && add < 1000) return 'Entering a season starts at ₹1,000.';
  if (add > 1000000) return 'That is above the preview limit of ₹10,00,000.';
  return null;
}
