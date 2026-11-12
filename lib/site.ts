import 'server-only';
import { headers } from 'next/headers';

/** The configured public address (BKP_SITE_URL, https, no trailing slash), or null until one is set. */
export function siteUrl(): string | null {
  const site = process.env.BKP_SITE_URL?.trim().replace(/\/$/, '');
  return site && /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(site) ? site : null;
}
/** Address for links sent to a person (email confirmation): the configured site, else the address they are using. */
export async function linkOrigin(): Promise<string> {
  const site = siteUrl();
  if (site) return site;
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}
