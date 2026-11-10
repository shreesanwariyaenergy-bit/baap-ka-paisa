import 'server-only';
// Server-side configuration. Payment flags are read here only so the UI can say payments are off;
// this codebase contains no payment provider integration.
export type DataSourceName = 'demo' | 'unavailable';

export function dataSourceName(): DataSourceName {
  const v = process.env.BKP_DATA_SOURCE;
  if (v === 'demo' || v === 'unavailable') return v;
  return process.env.NODE_ENV === 'production' ? 'unavailable' : 'demo';
}

export const seasonOneMonth = () => process.env.BKP_SEASON_ONE_MONTH ?? null;

/** Always false in this build: live payments need legal, provider and CA approval first. */
export const paymentsEnabled = () => false;
