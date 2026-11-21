import { afterEach, describe, expect, it, vi } from 'vitest';
const req: { host?: string } = {};
vi.mock('next/headers', () => ({ headers: async () => new Map(req.host ? [['host', req.host]] : []) }));
import { CANONICAL_ORIGIN, PUBLIC_PAGES, canonicalOrigin, indexingAllowed, noindexMetadata, pageMetadata } from '@/lib/seo';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

afterEach(() => { vi.unstubAllEnvs(); req.host = undefined; });
const production = (host = 'baapkapaisa.com') => { vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('BKP_SITE_URL', 'https://baapkapaisa.com'); req.host = host; };

describe('search indexing', () => {
  it('is allowed only in production on the canonical host', async () => {
    production(); expect(await indexingAllowed()).toBe(true);
  });
  it('stays off for previews, local development and other hosts', async () => {
    production(); vi.stubEnv('VERCEL_ENV', 'preview'); expect(await indexingAllowed()).toBe(false);
    vi.stubEnv('VERCEL_ENV', ''); expect(await indexingAllowed()).toBe(false);
    production('baap-ka-paisa.vercel.app'); expect(await indexingAllowed()).toBe(false);
    production('baap-ka-paisa-git-main-x.vercel.app'); expect(await indexingAllowed()).toBe(false);
    production(''); expect(await indexingAllowed()).toBe(false);
  });
  it('can be switched off in production', async () => {
    production(); vi.stubEnv('BKP_ALLOW_INDEXING', 'false'); expect(await indexingAllowed()).toBe(false);
  });
  it('robots.txt blocks everything unless indexing is allowed, and never blocks pages that carry noindex', async () => {
    expect(await robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
    production();
    const r = await robots();
    expect(r.sitemap).toBe('https://baapkapaisa.com/sitemap.xml');
    expect(r.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] }]);
  });
});

describe('sitemap and metadata', () => {
  it('lists only canonical production addresses, once each, without query strings or private pages', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.length).toBe(PUBLIC_PAGES.length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) { expect(u.startsWith(`${CANONICAL_ORIGIN}/`)).toBe(true); expect(u).not.toMatch(/[?#]|vercel\.app|\/(api|auth|me|join|signin|u|vs|bill|declare|legal|rank-up|closing|simulator)\b/); }
    expect(sitemap().every((e) => !('lastModified' in e))).toBe(true);
  });
  it('the canonical origin is the production domain even where BKP_SITE_URL is not set (previews)', () => {
    vi.stubEnv('BKP_SITE_URL', ''); expect(canonicalOrigin()).toBe('https://baapkapaisa.com');
  });
  it('page metadata carries a canonical path and matching Open Graph fields; noindex pages keep links followed', () => {
    const m = pageMetadata({ title: 'Cities', description: 'd', path: '/cities' });
    expect(m.alternates?.canonical).toBe('/cities');
    expect(m.openGraph).toMatchObject({ url: '/cities', title: 'Cities | BAAP KA PAISA', description: 'd' });
    expect(noindexMetadata('Sign in').robots).toEqual({ index: false, follow: true });
  });
});
