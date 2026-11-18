import type { MetadataRoute } from 'next';
import { canonicalOrigin, indexingAllowed } from '@/lib/seo';

export const dynamic = 'force-dynamic';
// Production on https://baapkapaisa.com: crawl everything except API and auth callback routes, and read the sitemap.
// Pages that must stay out of search results are not blocked here; they carry noindex so crawlers can read it.
// Previews, local development and other hosts (baap-ka-paisa.vercel.app): nothing may be crawled.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await indexingAllowed())) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] }], sitemap: `${canonicalOrigin()}/sitemap.xml` };
}
