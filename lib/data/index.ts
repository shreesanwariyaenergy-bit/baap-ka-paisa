import 'server-only';
import { cache } from 'react';
import { dataSourceName, seasonOneMonth, supabaseConfig } from '../config';
import { demoSource } from './demo';
import { unavailableSource } from './unavailable';
import { loadSeason, supabaseSource } from './supabase';
import type { DataSource } from './types';
import { currentAccount } from '../supabase-server';

/** One data source per request. The live source loads the season row once so every component agrees. */
export const getDataSource = cache(async (): Promise<DataSource> => {
  const name = dataSourceName();
  if (name === 'demo') return demoSource;
  if (name === 'supabase') {
    const cfg = supabaseConfig();
    if (cfg) { const acct = await currentAccount(); return supabaseSource(cfg, await loadSeason(cfg), acct?.token ?? null); }
  }
  return unavailableSource(seasonOneMonth());
});
export type * from './types';

/** True when there is a season whose rankings can be shown (demo data, or a live open/closed season). */
export function rankingsOpen(ds: DataSource): boolean {
  return ds.availability !== 'unavailable' && ds.season().number !== null;
}
