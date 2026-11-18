import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, canonicalOrigin } from '@/lib/seo';

// Canonical production addresses only (never a preview or deployment address). No lastmod: these pages are rendered
// live on every request and there is no reliable "last changed" date to report.
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = canonicalOrigin();
  return PUBLIC_PAGES.map((path) => ({ url: path === '/' ? `${origin}/` : `${origin}${path}` }));
}
