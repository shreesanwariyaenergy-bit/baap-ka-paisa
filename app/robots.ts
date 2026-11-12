import type { MetadataRoute } from 'next';
import { indexingAllowed } from '@/lib/flags';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';
// Blocked for every crawler until BKP_ALLOW_INDEXING=true (public launch approval).
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/me', '/seal', '/join', '/signin', '/auth/', '/api/'] }], host: siteUrl() ?? undefined };
}
