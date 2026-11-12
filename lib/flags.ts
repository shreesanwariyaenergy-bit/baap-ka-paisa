import 'server-only';
// Launch switches. Everything that touches real members, money or search engines is off unless
// an environment variable turns it on, so a missing setting can never open something by accident.
import { cookies } from 'next/headers';
import { dataSourceName } from './config';

export type RegistrationMode = 'open' | 'testers' | 'closed';
export const TESTER_COOKIE = 'bkp_tester';

/** BKP_REGISTRATION: open | testers | closed. Live default is closed. Demo is always open (nothing is stored). */
export function registrationMode(): RegistrationMode {
  if (dataSourceName() !== 'supabase') return 'open';
  const v = process.env.BKP_REGISTRATION;
  if (v === 'open') return 'open';
  if (v === 'testers' && testerCode()) return 'testers';
  return 'closed';
}
/** BKP_TESTER_CODE: shared access code for internal testers (at least 8 characters). */
export function testerCode(): string | null {
  const c = process.env.BKP_TESTER_CODE?.trim();
  return c && c.length >= 8 ? c : null;
}
export function codeMatches(input: string | undefined | null): boolean {
  const code = testerCode();
  if (!code || !input || input.length !== code.length) return false;
  let diff = 0;
  for (let i = 0; i < code.length; i++) diff |= code.charCodeAt(i) ^ input.charCodeAt(i);
  return diff === 0;
}
/** May this visitor create a profile right now? */
export async function canRegister(): Promise<boolean> {
  const mode = registrationMode();
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  try { return codeMatches((await cookies()).get(TESTER_COOKIE)?.value); } catch { return false; }
}
/** Paid rank purchases. Needs both switches and stays off: no payment code exists in this app. */
export const paymentsEnabled = () => process.env.PAYMENTS_ENABLED === 'true' && process.env.RANK_PURCHASES_ENABLED === 'true';
/** Search engines stay blocked until BKP_ALLOW_INDEXING=true. */
export const indexingAllowed = () => process.env.BKP_ALLOW_INDEXING === 'true';
/** BKP_SEASON_MODE=test labels the running season as a test season across the site. */
export const testSeason = () => process.env.BKP_SEASON_MODE === 'test';
