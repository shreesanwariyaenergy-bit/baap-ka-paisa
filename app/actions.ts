'use server';
// Server actions for onboarding, profile editing and social actions.
// Nothing here creates an account or writes to the database: sign-up and sign-in are not open.
import { getDataSource } from '@/lib/data';
import { validateProfile, type Errors, type ProfileInput } from '@/lib/profile-rules';
import { addRival, istDay } from '@/lib/engine/engine';
import { readDemoDeclares, readDemoPick, readDemoSocial, writeDemoDeclares, writeDemoPick, writeDemoSocial } from '@/lib/demo-social';
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

const SOCIAL_NOT_READY = 'Follow, Respect and rivals are being switched on. Please check back soon.';

/** Live: the signed-in member's relationship to another member, or null when signed out or not switched on yet. */
export async function socialState(target: string): Promise<{ following: boolean; rival: boolean; respectedToday: boolean } | null> {
  const sb = await supabaseAuth();
  if (!sb) return null;
  const { data, error } = await sb.rpc('social_action', { p_action: 'state', p_target: target });
  if (error) return null;
  const r = (Array.isArray(data) ? data[0] : data) as { following: boolean; rival: boolean; respected_today: boolean } | undefined;
  return r ? { following: r.following, rival: r.rival, respectedToday: r.respected_today } : null;
}

export interface SocialResult { ok: boolean; message: string; state?: { following: boolean; rival: boolean; respectedToday: boolean } }

export async function socialAction(kind: 'follow' | 'unfollow' | 'respect' | 'rival' | 'unrival', target: string): Promise<SocialResult> {
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  if (!viewer) return { ok: false, message: 'Sign in to follow, give Respect or add rivals.' };
  if (ds.availability !== 'demo') {
    const sb = await supabaseAuth();
    const { data, error } = await sb!.rpc('social_action', { p_action: kind, p_target: target });
    if (error) {
      const m = error.message;
      const message = /find the function|does not exist in the schema|PGRST202/i.test(`${error.code} ${m}`) || error.code === '42883' ? SOCIAL_NOT_READY
        : /up to 5 rivals/.test(m) ? 'You already have 5 rivals. Remove one first.'
        : /already gave Respect/.test(m) ? 'You already gave Respect to this member today. One per profile per day.'
        : /That is you|does not exist|Create your profile|Sign in/.test(m) ? `${m}.` : 'That did not go through. Please try again.';
      return { ok: false, message };
    }
    const r = (Array.isArray(data) ? data[0] : data) as { following: boolean; rival: boolean; respected_today: boolean };
    revalidatePath(`/u/${target}`);
    const done = { follow: 'Following. You are in their Army.', unfollow: 'Unfollowed.', respect: 'Respect given. You can give it again tomorrow.', rival: 'Added to your rivals.', unrival: 'Removed from your rivals.' }[kind];
    return { ok: true, message: done, state: { following: r.following, rival: r.rival, respectedToday: r.respected_today } };
  }
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

export interface BackResult { ok: boolean; message: string; locked?: { name: string } }
/** Give this season's one backing. Demo prototype: stored on this browser only. Final once given. */
export async function backAction(target: string): Promise<BackResult> {
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  if (!viewer) return { ok: false, message: 'Sign in to back a contender.' };
  if (ds.availability !== 'demo') {
    const sb = await supabaseAuth();
    const { error } = await sb!.rpc('back_member', { p_target: target });
    if (error) {
      const m = `${error.code} ${error.message}`;
      return { ok: false, message: /PGRST202|find the function/i.test(m) ? 'Backing is being switched on. Please check back soon.'
        : /already given/.test(m) ? 'Your backing for this season is already given and locked.' : /not on the board/.test(m) ? 'They are not on the board this season, so there is nothing to back yet.'
        : /only open while/.test(m) ? 'Backing is only open while a season is running.' : /yourself|does not exist|Create your profile|Sign in/.test(error.message) ? `${error.message}.` : 'That did not go through. Please try again.' };
    }
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Locked for the season.' };
  }
  const { DEMO_BACKING, SIM } = await import('@/lib/data/demo');
  const { canBack, runBacking, REFUSAL_TEXT } = await import('@/lib/engine/backing');
  const me = viewer.member.username, now = ds.now().getTime();
  const existing = await readDemoPick();
  const accepted = runBacking(SIM, existing && existing.seasonId === DEMO_BACKING.seasonId ? [...DEMO_BACKING.events, { id: 'mine', at: Math.min(existing.at, now), backer: me, target: existing.target }] : DEMO_BACKING.events).accepted;
  const check = canBack(SIM, accepted, me, target, now);
  if (!check.ok) return { ok: false, message: REFUSAL_TEXT[check.reason] };
  await writeDemoPick({ seasonId: check.seasonId, target, at: now });
  const m = await ds.member(target);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Locked for the season (demo: kept on this browser only).', locked: { name: m ? (m.masked ? m.publicLabel : m.displayName ?? m.username) : target } };
}

export interface DeclareResult { ok: boolean; message: string; id?: string }
/** Declare for a city throne. Demo prototype: stored on this browser only; nobody is notified. */
export async function declareAction(cityId: string, line: number): Promise<DeclareResult> {
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  if (!viewer) return { ok: false, message: 'Sign in to declare.' };
  if (viewer.member.cityId !== cityId) return { ok: false, message: 'You can only declare for a board you are on.' };
  if (ds.availability !== 'demo') {
    const sb = await supabaseAuth();
    const { data, error } = await sb!.rpc('declare_for', { p_level: 'city', p_line: Number.isInteger(line) ? line : 0 });
    if (error) {
      const m = `${error.code} ${error.message}`;
      return { ok: false, message: /PGRST202|find the function/i.test(m) ? 'Declarations are being switched on. Please check back soon.'
        : /already standing|72 hours|3 declarations|Nobody holds|already hold|cannot declare|only open while/.test(error.message) ? `${error.message}.` : 'That did not go through. Please try again.' };
    }
    revalidatePath('/', 'layout');
    return { ok: true, id: String(data), message: 'Declared.' };
  }
  if (!cityById(cityId)) return { ok: false, message: 'Unknown city.' };
  const { DEMO_DECLARE, SIM } = await import('@/lib/data/demo');
  const { canDeclare, runCallouts, DECLARE_REFUSAL, LINES } = await import('@/lib/engine/callout');
  const me = viewer.member.username, now = ds.now().getTime(), board = `city:${cityId}`;
  const mine = await readDemoDeclares();
  const existing = runCallouts(SIM, [...DEMO_DECLARE.events, ...mine.map((d) => ({ id: d.id, at: Math.min(d.at, now), challenger: me, board: d.board, line: d.line }))]).declarations;
  const check = canDeclare(SIM, existing, [], me, board, now);
  if (!check.ok) return { ok: false, message: DECLARE_REFUSAL[check.reason] };
  const id = `dv${now.toString(36)}${mine.length}`;
  await writeDemoDeclares([...mine, { id, at: now, board, line: Number.isInteger(line) && line >= 0 && line < LINES.length ? line : 0 }]);
  revalidatePath('/', 'layout');
  return { ok: true, id, message: 'Declared.' };
}
