'use server';
// Server actions for onboarding, profile editing and social actions.
// Nothing here creates an account or writes to the database: sign-up and sign-in are not open.
import { getDataSource } from '@/lib/data';
import { validateProfile, type Errors, type ProfileInput } from '@/lib/profile-rules';
import { addRival, istDay } from '@/lib/engine/engine';
import { readDemoSocial, writeDemoSocial } from '@/lib/demo-social';
import { cityById } from '@/lib/geo';
import { supabaseAuth } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export interface FormResult { ok: boolean; errors: Errors; message: string; preview?: ProfileInput & { anonLabel?: string; cityName?: string } }

function readProfile(fd: FormData): ProfileInput {
  const s = (k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : undefined; };
  return { username: s('username')?.toLowerCase(), displayName: s('displayName'), dateOfBirth: s('dateOfBirth'), cityId: s('cityId'), locality: s('locality'),
    title: s('title'), flexLine: s('flexLine'), instagram: s('instagram')?.replace(/^@/, ''), snapchat: s('snapchat')?.replace(/^@/, ''),
    socialVisibility: s('socialVisibility'), mystery: fd.get('mystery') === 'on' };
}

export async function previewSignup(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  const p = readProfile(fd);
  const ds = await getDataSource();
  const errors = validateProfile(p, 'join', ds.availability === 'demo' ? ds.now() : new Date());
  if (!errors.username && p.username && (await ds.member(p.username))) errors.username = 'That username is taken.';
  if (Object.keys(errors).length) return { ok: false, errors, message: 'Fix the highlighted fields.' };
  return {
    ok: true, errors: {}, preview: { ...p, cityName: cityById(p.cityId)?.name, anonLabel: p.mystery ? 'ANON-xx (assigned when you join)' : undefined },
    message: 'Your profile passed every check. Sign-up is not open yet, so nothing was saved and no account was created.',
  };
}

export async function saveProfile(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  const p = readProfile(fd);
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  if (!viewer) return { ok: false, errors: {}, message: 'Sign in to edit your profile.' };
  const errors = validateProfile(p, 'edit');
  if (Object.keys(errors).length) return { ok: false, errors, message: 'Fix the highlighted fields.' };
  if (ds.availability === 'demo') return { ok: true, errors: {}, preview: p, message: 'Demo: your changes passed every check, but demo profiles are not saved.' };
  const sb = await supabaseAuth();
  const { error } = await sb!.rpc('update_my_profile', { p_display_name: p.displayName, p_title: p.title ?? '', p_flex_line: p.flexLine ?? '', p_mystery: !!p.mystery });
  if (error) return { ok: false, errors: {}, message: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, errors: {}, preview: p, message: 'Saved. Socials are not stored yet; they arrive with handle verification.' };
}

export interface SocialResult { ok: boolean; message: string; state?: { following: boolean; rival: boolean; respectedToday: boolean } }

export async function socialAction(kind: 'follow' | 'unfollow' | 'respect' | 'rival' | 'unrival', target: string): Promise<SocialResult> {
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  if (!viewer) return { ok: false, message: 'Sign in to follow, give Respect or add rivals.' };
  if (ds.availability !== 'demo') return { ok: false, message: 'Follow, Respect and rivals open with the first season.' };
  const me = viewer.member.username;
  const member = await ds.member(target);
  if (!member) return { ok: false, message: 'That member does not exist.' };
  if (member.username === me) return { ok: false, message: 'That is you.' };
  const defaults = { follows: [], rivals: (await ds.social(me))?.rivals.map((r) => r.member.username) ?? [], respected: {} };
  const st = await readDemoSocial(defaults);
  const today = istDay(ds.now().getTime());
  let message = '';
  if (kind === 'follow') { if (!st.follows.includes(target)) st.follows.push(target); message = `You joined ${member.masked ? member.publicLabel : member.displayName}'s Army (demo).`; }
  if (kind === 'unfollow') { st.follows = st.follows.filter((x) => x !== target); message = 'Unfollowed (demo).'; }
  if (kind === 'respect') {
    if (st.respected[target] === today) return { ok: false, message: 'You already gave Respect to this member today. One per profile per day.', state: { following: st.follows.includes(target), rival: st.rivals.includes(target), respectedToday: true } };
    st.respected[target] = today; message = 'Respect given (demo). You can give it again tomorrow.';
  }
  if (kind === 'rival') {
    const r = addRival(st.rivals, me, target);
    if (!r.ok) return { ok: false, message: r.reason, state: { following: st.follows.includes(target), rival: st.rivals.includes(target), respectedToday: st.respected[target] === today } };
    st.rivals = r.rivals; message = 'Added to your rivals (demo).';
  }
  if (kind === 'unrival') { st.rivals = st.rivals.filter((x) => x !== target); message = 'Removed from your rivals (demo).'; }
  await writeDemoSocial(st);
  return { ok: true, message, state: { following: st.follows.includes(target), rival: st.rivals.includes(target), respectedToday: st.respected[target] === today } };
}
