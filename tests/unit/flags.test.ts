import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (k: string) => (k === 'bkp_tester' ? { value: jar.code } : undefined) }), headers: async () => new Map() }));
const jar: { code?: string } = {};
import { canRegister, codeMatches, indexingAllowed, paymentsEnabled, registrationMode } from '@/lib/flags';
import { siteUrl } from '@/lib/site';
import { sendEmail } from '@/lib/email';

afterEach(() => { vi.unstubAllEnvs(); jar.code = undefined; });
const live = () => { vi.stubEnv('BKP_DATA_SOURCE', 'supabase'); vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'k'); };

describe('launch switches', () => {
  it('registration is closed on the live site unless switched on', async () => {
    live(); vi.stubEnv('BKP_REGISTRATION', '');
    expect(registrationMode()).toBe('closed'); expect(await canRegister()).toBe(false);
    vi.stubEnv('BKP_REGISTRATION', 'open'); expect(await canRegister()).toBe(true);
  });
  it('tester mode needs a code of 8+ characters and the matching cookie', async () => {
    live(); vi.stubEnv('BKP_REGISTRATION', 'testers'); vi.stubEnv('BKP_TESTER_CODE', 'short');
    expect(registrationMode()).toBe('closed');
    vi.stubEnv('BKP_TESTER_CODE', 'long-enough-code');
    expect(registrationMode()).toBe('testers'); expect(await canRegister()).toBe(false);
    jar.code = 'wrong-enough-code'; expect(await canRegister()).toBe(false);
    jar.code = 'long-enough-code'; expect(await canRegister()).toBe(true);
    expect(codeMatches('')).toBe(false);
  });
  it('demo registration is a test run and always available', () => { vi.stubEnv('BKP_DATA_SOURCE', 'demo'); expect(registrationMode()).toBe('open'); });
  it('payments and indexing are off by default', () => {
    expect(paymentsEnabled()).toBe(false); expect(indexingAllowed()).toBe(false);
    vi.stubEnv('PAYMENTS_ENABLED', 'true'); expect(paymentsEnabled()).toBe(false);
  });
  it('site address is taken from one setting and validated', () => {
    vi.stubEnv('BKP_SITE_URL', ''); expect(siteUrl()).toBeNull();
    vi.stubEnv('BKP_SITE_URL', 'http://insecure.test'); expect(siteUrl()).toBeNull();
    vi.stubEnv('BKP_SITE_URL', 'https://baap-ka-paisa.vercel.app/'); expect(siteUrl()).toBe('https://baap-ka-paisa.vercel.app');
  });
  it('email sends nothing until a provider is configured, then posts once', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'e1' }), { status: 200 }));
    expect(await sendEmail({ to: 'a@test.invalid', subject: 's', text: 't' }, f as unknown as typeof fetch)).toEqual({ sent: false, reason: 'not-configured' });
    expect(f).not.toHaveBeenCalled();
    vi.stubEnv('BKP_EMAIL_PROVIDER', 'resend'); vi.stubEnv('BKP_EMAIL_API_KEY', 'k'); vi.stubEnv('BKP_EMAIL_FROM', 'BKP <x@test.invalid>');
    expect(await sendEmail({ to: 'a@test.invalid', subject: 's', text: 't' }, f as unknown as typeof fetch)).toEqual({ sent: true, id: 'e1' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
