// Season calendar. Blueprint: a season runs from the 1st of the month 00:00 IST to the last day 23:59 IST,
// plus any anti-snipe extension (decided by the backend, not here). All calculations use Asia/Kolkata.
import { monthName, monthShort } from './format';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface SeasonInfo {
  /** Null until the launch month is configured. Never invented. */
  number: number | null;
  year: number;
  month: number; // 0-11
  startsAt: Date;
  /** Scheduled close, before any anti-snipe extension. */
  endsAt: Date;
  /** Live seasons only: the close before any anti-snipe extension, and the season's state. */
  scheduledEnd?: Date;
  status?: 'open' | 'closed';
  label: string; // "Season 4" or "November 2026"
  monthLabel: string; // "November 2026"
  short: string; // "S04 / NOV '26" or "NOV '26"
}

/** Calendar month in IST for a given instant. */
export function istMonth(at: Date): { year: number; month: number } {
  const d = new Date(at.getTime() + IST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** Midnight IST on the 1st of a month, as a UTC instant. */
export function istMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS);
}

export function seasonFor(at: Date, seasonOneMonth?: string | null): SeasonInfo {
  const { year, month } = istMonth(at);
  const startsAt = istMonthStart(year, month);
  // Scheduled close is 23:59 IST on the last day: one minute before next month's start.
  const endsAt = new Date(istMonthStart(year, month + 1).getTime() - 60_000);
  let number: number | null = null;
  const m = seasonOneMonth?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const n = (year - Number(m[1])) * 12 + (month - (Number(m[2]) - 1)) + 1;
    number = n >= 1 ? n : null;
  }
  const monthLabel = `${monthName(month)} ${year}`;
  const yy = String(year).slice(2);
  return {
    number, year, month, startsAt, endsAt, monthLabel,
    label: number ? `Season ${number}` : monthLabel,
    short: number ? `S${String(number).padStart(2, '0')} / ${monthShort(month).toUpperCase()} '${yy}` : `${monthShort(month).toUpperCase()} '${yy}`,
  };
}

export function timeLeft(season: SeasonInfo, now: Date): { days: number; hours: number; closed: boolean } {
  const ms = season.endsAt.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, closed: true };
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000), closed: false };
}
