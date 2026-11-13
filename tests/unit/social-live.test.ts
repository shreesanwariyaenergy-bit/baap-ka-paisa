import { beforeEach, describe, expect, it, vi } from 'vitest';
// The live path of every social button: it must call social_action() and nothing else.
const rpc = vi.fn();
const client = new Proxy({ rpc }, { get: (t, k) => { if (k === 'rpc') return t.rpc; if (k === 'then') return undefined; throw new Error(`unexpected Supabase call: ${String(k)}`); } });
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: vi.fn() }) }));
vi.mock('@/lib/supabase-server', () => ({ supabaseAuth: async () => client }));
vi.mock('@/lib/data', () => ({ getDataSource: async () => ({ availability: 'live', now: () => new Date(), viewer: async () => ({ member: { username: 'me' } }), member: async () => ({ username: 'them' }), social: async () => null }) }));
import { socialAction, socialState } from '@/app/actions';

beforeEach(() => { rpc.mockReset(); });
const ok = { data: [{ following: true, rival: false, respected_today: true }], error: null };

describe('live social actions', () => {
  it.each(['follow', 'unfollow', 'respect', 'rival', 'unrival'] as const)('%s goes through social_action only', async (kind) => {
    rpc.mockResolvedValue(ok);
    const r = await socialAction(kind, 'them');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('social_action', { p_action: kind, p_target: 'them' });
    expect(r).toMatchObject({ ok: true, state: { following: true, rival: false, respectedToday: true } });
  });
  it('reads the current state through the same function', async () => {
    rpc.mockResolvedValue(ok);
    expect(await socialState('them')).toEqual({ following: true, rival: false, respectedToday: true });
    expect(rpc).toHaveBeenCalledWith('social_action', { p_action: 'state', p_target: 'them' });
  });
  it('turns database refusals into plain messages and never reports success', async () => {
    const cases: [string, string, RegExp][] = [
      ['23505', 'You already gave Respect to this member today', /already gave Respect/],
      ['23514', 'A member can have up to 5 rivals', /already have 5 rivals/],
      ['PGRST202', 'Could not find the function public.social_action', /being switched on/],
      ['XX000', 'something unexpected', /did not go through/],
    ];
    for (const [code, message, expected] of cases) {
      rpc.mockResolvedValue({ data: null, error: { code, message } });
      const r = await socialAction('respect', 'them');
      expect(r.ok).toBe(false); expect(r.message).toMatch(expected);
    }
  });
});

describe('live blocks, backing and declarations go through their database functions only', () => {
  it('blocking and unblocking a challenger', async () => {
    const { blockChallenger } = await import('@/app/actions');
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await blockChallenger('them', true)).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith('block_challenger', { p_name: 'them', p_block: true });
    expect((await blockChallenger('them', false)).message).toBe('Unblocked.');
  });
  it('backing: one call, and a locked backing is reported plainly', async () => {
    const { backAction } = await import('@/app/actions');
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await backAction('them')).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith('back_member', { p_target: 'them' });
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'Your backing for this season is already given and locked' } });
    expect((await backAction('them')).message).toMatch(/already given and locked/);
  });
  it('before the migrations exist, every button says "being switched on" and nothing is reported as done', async () => {
    const { backAction, blockChallenger } = await import('@/app/actions');
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    for (const r of [await backAction('them'), await blockChallenger('them', true), await socialAction('follow', 'them')]) { expect(r.ok).toBe(false); expect(r.message).toMatch(/being switched on/); }
  });
});
