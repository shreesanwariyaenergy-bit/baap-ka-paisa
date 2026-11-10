import 'server-only';
// Server-side configuration. This codebase contains no payment provider integration.
export type DataSourceName = 'demo' | 'supabase' | 'unavailable';

export function dataSourceName(): DataSourceName {
  const v = process.env.BKP_DATA_SOURCE;
  if (v === 'demo' || v === 'supabase' || v === 'unavailable') return v;
  return process.env.NODE_ENV === 'production' ? 'unavailable' : 'demo';
}

/** Supabase URL and publishable key. The publishable key is safe for public reads; no service-role key is used anywhere. */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) return null;
  return { url, key };
}

export const seasonOneMonth = () => process.env.BKP_SEASON_ONE_MONTH ?? null;

/** Always false in this build: live payments need legal, provider and CA approval first. */
export const paymentsEnabled = () => false;
