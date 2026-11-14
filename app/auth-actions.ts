'use server';
// Account creation, sign-in and sign-out.
// Live mode (BKP_DATA_SOURCE=supabase): real Supabase Auth accounts and member profiles.
// Demo mode: a labelled test run; no account is created and nothing is stored.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { dataSourceName } from '@/lib/config';
import { validateProfile, type Errors, type ProfileInput } from '@/lib/profile-rules';
import { DEMO_VIEWER_COOKIE, supabaseAuth } from '@/lib/supabase-server';
import { cityById } from '@/lib/geo';
import { TESTER_COOKIE, canRegister, codeMatches, registrationMode } from '@/lib/flags';
import { linkOrigin } from '@/lib/site';

export type RegErrors = Errors & { email?: string; password?: string; confirm?: string; adult?: string; terms?: string };
export interface RegInput extends ProfileInput { email?: string; password?: string; confirm?: string; adult?: boolean; terms?: boolean; hasAccount?: boolean; referredBy?: string }
export interface RegResult {
  ok: boolean; errors: RegErrors; message: string;
  outcome?: 'created' | 'confirm-email' | 'test-mode';
  memberNo?: number | null; publicName?: string;
}

function checkAccount(i: RegInput): RegErrors {
  const e: RegErrors = {};
  if (i.hasAccount) return e;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.email ?? '')) e.email = 'Enter a valid email address.';
  const p = i.password ?? '';
  if (p.length < 8) e.password = 'Use at least 8 characters.';
  else if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) e.password = 'Include at least one letter and one number.';
  if (!e.password && i.confirm !== p) e.confirm = 'Passwords do not match.';
  return e;
}
// "Today" for the age check: the demo's fixed clock, otherwise real time. Only the demo needs the data source,
// so live registration no longer waits on a season read just to validate a form.
const today = async () => (dataSourceName() === 'demo' ? (await getDataSource()).now() : new Date());
async function checkProfile(i: RegInput): Promise<RegErrors> {
  const all = validateProfile(i, 'join', await today());
  const e: RegErrors = { username: all.username, displayName: all.displayName, cityId: all.cityId, locality: all.locality, flexLine: all.flexLine, title: all.title };
  if (!e.username && i.username) {
    const taken = dataSourceName() === 'supabase'
      ? !(await (await supabaseAuth())!.rpc('username_available', { p_username: i.username })).data
      : !!(await (await getDataSource()).member(i.username));
    if (taken) e.username = 'That username is taken.';
  }
  return e;
}
async function checkEligibility(i: RegInput): Promise<RegErrors> {
  const e: RegErrors = { dateOfBirth: validateProfile(i, 'join', await today()).dateOfBirth };
  if (!i.adult) e.adult = 'Confirm that you are 18 or older.';
  if (!i.terms) e.terms = 'Accept the Terms and Privacy Notice to continue.';
  return e;
}
const clean = <T extends object>(e: T) => Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as T;

/** Server-side check of one registration step, so errors appear before the final submit. */
export async function validateStep(step: 1 | 2 | 3, i: RegInput): Promise<RegErrors> {
  return clean(step === 1 ? checkAccount(i) : step === 2 ? await checkProfile(i) : await checkEligibility(i));
}

async function createMemberFrom(p: ProfileInput): Promise<{ memberNo: number; publicName: string } | { error: string }> {
  const sb = (await supabaseAuth())!;
  const { data, error } = await sb.rpc('create_member', {
    p_username: p.username, p_display_name: p.displayName, p_date_of_birth: p.dateOfBirth, p_city: p.cityId, p_locality: p.locality,
    p_title: p.title || null, p_flex_line: p.flexLine || null, p_mystery: !!p.mystery,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  await sb.auth.updateUser({ data: { pending_profile: null } });
  return { memberNo: Number(row.member_no), publicName: row.public_name };
}

const CLOSED = 'Registration is not open yet. It opens with the public launch.';

/** Internal testers: exchange the access code for a cookie that unlocks registration on this device. */
export async function enterTesterCode(_prev: { message: string } | null, fd: FormData): Promise<{ message: string }> {
  if (registrationMode() !== 'testers') return { message: 'Tester access is not in use right now.' };
  const code = String(fd.get('code') ?? '').trim();
  if (!codeMatches(code)) return { message: 'That code is not valid.' };
  (await cookies()).set(TESTER_COOKIE, code, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect('/join');
}

export async function register(i: RegInput): Promise<RegResult> {
  if (!(await canRegister())) return { ok: false, errors: {}, message: CLOSED };
  const [prof, elig] = await Promise.all([checkProfile(i), checkEligibility(i)]);
  const errors = clean({ ...checkAccount(i), ...prof, ...elig });
  if (Object.keys(errors).length) return { ok: false, errors, message: 'Some details need fixing.' };
  const profile: ProfileInput = { username: i.username, displayName: i.displayName?.trim(), dateOfBirth: i.dateOfBirth, cityId: i.cityId, locality: i.locality, title: i.title, flexLine: i.flexLine?.trim(), mystery: !!i.mystery };

  if (dataSourceName() !== 'supabase') {
    return { ok: true, errors: {}, outcome: 'test-mode', memberNo: null, publicName: i.username,
      message: 'Test mode: every check passed, but this preview site does not create accounts. Nothing was stored.' };
  }
  const sb = (await supabaseAuth())!;
  if (!i.hasAccount) {
    const origin = await linkOrigin();
    const { data, error } = await sb.auth.signUp({ email: i.email!, password: i.password!, options: { emailRedirectTo: `${origin}/auth/callback`, data: { pending_profile: profile, ...(i.referredBy && /^[a-z0-9._]{3,24}$/.test(i.referredBy) ? { referred_by: i.referredBy } : {}) } } });
    if (error) {
      const msg = /registered|exists/i.test(error.message) ? 'An account with this email already exists. Sign in instead.'
        : /rate|too many/i.test(error.message) ? 'Too many sign-ups right now. Please try again in a few minutes.'
        : /disabled|not allowed/i.test(error.message) ? 'Sign-up is switched off in the authentication settings.'
        : error.message;
      return { ok: false, errors: /email/i.test(msg) ? { email: msg } : {}, message: msg };
    }
    if (!data.session) {
      return { ok: true, errors: {}, outcome: 'confirm-email', memberNo: null, publicName: i.username,
        message: `We sent a confirmation link to ${i.email}. Open it, then sign in: your profile is created the moment you do.` };
    }
  }
  const made = await createMemberFrom(profile);
  if ('error' in made) return { ok: false, errors: /username/i.test(made.error) ? { username: made.error } : {}, message: made.error };
  return { ok: true, errors: {}, outcome: 'created', memberNo: made.memberNo, publicName: made.publicName, message: 'Your profile is live.' };
}

/** After sign-in or email confirmation: create the member profile saved at sign-up, if it is still pending. */
export async function ensureMember(): Promise<'ready' | 'needs-profile' | 'signed-out'> {
  const sb = await supabaseAuth();
  if (!sb) return 'signed-out';
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return 'signed-out';
  const { data } = await sb.rpc('get_me');
  if (Array.isArray(data) && data.length) return 'ready';
  const pending = user.user_metadata?.pending_profile as ProfileInput | undefined;
  if (pending?.username && registrationMode() !== 'closed') { const made = await createMemberFrom(pending); if (!('error' in made)) return 'ready'; }
  return 'needs-profile';
}

export interface SignInResult { ok: boolean; message: string }
export async function signIn(_prev: SignInResult | null, fd: FormData): Promise<SignInResult> {
  if (dataSourceName() !== 'supabase') {
    (await cookies()).set(DEMO_VIEWER_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/seal');
  }
  const email = String(fd.get('email') ?? '').trim(); const password = String(fd.get('password') ?? '');
  if (!email || !password) return { ok: false, message: 'Enter your email and password.' };
  const sb = (await supabaseAuth())!;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: /confirm/i.test(error.message) ? 'Confirm your email first: open the link we sent you, then sign in.' : 'That email and password do not match an account.' };
  const state = await ensureMember();
  redirect(state === 'needs-profile' ? '/join?complete=1' : '/seal');
}

export interface PasswordResult { ok: boolean; message: string }
/** Sends a reset link. The reply is the same whether or not the email has an account. */
export async function requestPasswordReset(_prev: PasswordResult | null, fd: FormData): Promise<PasswordResult> {
  const email = String(fd.get('email') ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  const sb = await supabaseAuth();
  if (!sb) return { ok: true, message: 'Demo site: no email is sent here.' };
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await linkOrigin()}/auth/callback?next=/reset` });
  if (error && /rate|too many|seconds/i.test(error.message)) return { ok: false, message: 'Too many requests right now. Please try again in a few minutes.' };
  return { ok: true, message: `If ${email} has an account, a reset link is on its way. Open it on this device.` };
}

/** Sets a new password for the account signed in through a reset link. */
export async function setNewPassword(_prev: PasswordResult | null, fd: FormData): Promise<PasswordResult> {
  const password = String(fd.get('password') ?? ''); const confirm = String(fd.get('confirm') ?? '');
  const e = checkAccount({ email: 'x@x.xx', password, confirm });
  if (e.password || e.confirm) return { ok: false, message: e.password ?? e.confirm! };
  const sb = await supabaseAuth();
  if (!sb) return { ok: false, message: 'Demo site: there is no password to change.' };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: 'This reset link has expired. Request a new one.' };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, message: /different|same/i.test(error.message) ? 'Choose a password you have not used before.' : 'That did not go through. Request a new reset link.' };
  const state = await ensureMember();
  redirect(state === 'needs-profile' ? '/join?complete=1' : '/seal');
}

export async function signOut() {
  const sb = await supabaseAuth();
  if (sb) await sb.auth.signOut();
  (await cookies()).delete(DEMO_VIEWER_COOKIE);
  redirect('/');
}

export async function cityLabel(id: string) { return cityById(id)?.name ?? ''; }
