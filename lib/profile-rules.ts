// Profile and onboarding rules from the Product Blueprint. Run on the server for every submission.
import { CITIES, cityById } from './geo';

export const TITLES = ['Founder', 'Co-founder', 'Creator', 'Entrepreneur', 'Doctor', 'Lawyer', 'CA', 'Student', 'Athlete', 'Artist', 'Investor', 'Other'] as const;
export const SOCIAL_VISIBILITY = ['everyone', 'followers', 'nobody'] as const;
export type SocialVisibility = (typeof SOCIAL_VISIBILITY)[number];

const RESERVED = new Set(['admin', 'support', 'help', 'baapkapaisa', 'baap.ka.paisa', 'official', 'moderator', 'system', 'anon', 'me', 'seal']);
// Small starter list; production moderation needs a reviewed list and a report queue.
const BLOCKED_WORDS = ['fuck', 'shit', 'bitch', 'chutiya', 'madarchod', 'bhenchod', 'randi', 'gandu'];

export interface ProfileInput {
  username?: string; displayName?: string; dateOfBirth?: string; cityId?: string; locality?: string;
  title?: string; flexLine?: string; instagram?: string; snapchat?: string; socialVisibility?: string; mystery?: boolean;
}
export type Errors = Partial<Record<keyof ProfileInput, string>>;

/** Age on a given date in IST, from a YYYY-MM-DD date of birth. */
export function ageOn(dob: string, today: Date): number | null {
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const ist = new Date(today.getTime() + 5.5 * 3_600_000);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = ist.getUTCFullYear() - y;
  if (ist.getUTCMonth() + 1 < mo || (ist.getUTCMonth() + 1 === mo && ist.getUTCDate() < d)) age--;
  return age;
}

export function checkUsername(u: string): string | null {
  if (!/^[a-z0-9._]{3,24}$/.test(u)) return 'Use 3–24 characters: lowercase letters, numbers, dots or underscores.';
  if (/^[._]|[._]$/.test(u) || u.includes('..')) return 'Usernames cannot start or end with a dot or underscore, or repeat dots.';
  if (/^anon[-.]?\d/i.test(u) || RESERVED.has(u)) return 'That username is reserved.';
  return null;
}

/** Flex lines: 40 characters, no contact details, no links, no abuse. */
export function checkFlexLine(t: string): string | null {
  if (t.length > 40) return 'Keep it to 40 characters.';
  if (/(\+?91[\s-]?)?[6-9]\d{9}/.test(t.replace(/\s/g, ''))) return 'Phone numbers are not allowed.';
  if (/(https?:\/\/|www\.|\.com\b|\.in\b|@)/i.test(t)) return 'Links, emails and handles are not allowed here.';
  const lower = t.toLowerCase();
  if (BLOCKED_WORDS.some((w) => lower.includes(w))) return 'That wording is not allowed. Keep it friendly.';
  return null;
}

export function checkHandle(h: string): string | null {
  if (!h) return null;
  return /^[a-zA-Z0-9._]{1,30}$/.test(h) ? null : 'Handles use letters, numbers, dots and underscores (up to 30).';
}

/** Validate a profile. `mode` "join" requires every onboarding field; "edit" validates what is present. */
export function validateProfile(p: ProfileInput, mode: 'join' | 'edit', today = new Date()): Errors {
  const e: Errors = {};
  if (mode === 'join' || p.username !== undefined) { const r = checkUsername(p.username ?? ''); if (r) e.username = r; }
  if (mode === 'join' || p.displayName !== undefined) {
    const n = (p.displayName ?? '').trim();
    if (n.length < 1 || n.length > 40) e.displayName = 'Display name must be 1–40 characters.';
    else if (!/^[\p{L} .'-]+$/u.test(n)) e.displayName = 'Use letters, spaces, dots, apostrophes or hyphens.';
    else if (checkFlexLine(n)) e.displayName = 'That wording is not allowed. Keep it friendly.';
  }
  if (mode === 'join') {
    const age = ageOn(p.dateOfBirth ?? '', today);
    if (age === null) e.dateOfBirth = 'Enter your date of birth.';
    else if (age < 18) e.dateOfBirth = 'BAAP KA PAISA is for people aged 18 and over.';
    else if (age > 110) e.dateOfBirth = 'Check the year of birth.';
    const c = cityById(p.cityId);
    if (!c) e.cityId = `Choose one of the launch cities: ${CITIES.map((x) => x.name).join(', ')}.`;
    else if (!c.localities.includes(p.locality ?? '')) e.locality = `Choose a locality in ${c.name}.`;
  }
  if (p.title !== undefined && p.title !== '' && !(TITLES as readonly string[]).includes(p.title)) e.title = 'Choose a title from the list.';
  if (p.flexLine !== undefined) { const r = checkFlexLine(p.flexLine); if (r) e.flexLine = r; }
  if (p.instagram !== undefined) { const r = checkHandle(p.instagram); if (r) e.instagram = r; }
  if (p.snapchat !== undefined) { const r = checkHandle(p.snapchat); if (r) e.snapchat = r; }
  if (p.socialVisibility !== undefined && !(SOCIAL_VISIBILITY as readonly string[]).includes(p.socialVisibility)) e.socialVisibility = 'Choose who can see your socials.';
  return e;
}

/** City and locality lock for 90 days after signup (blueprint). */
export function placeLockedUntil(joinedAt: Date): Date { return new Date(joinedAt.getTime() + 90 * 86_400_000); }
