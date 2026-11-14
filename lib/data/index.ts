import 'server-only';
import { cache } from 'react';
import { dataSourceName, seasonOneMonth, supabaseConfig } from '../config';
import { demoSource } from './demo';
import { unavailableSource } from './unavailable';
import { loadSeason, prefetchViewer, supabaseSource } from './supabase';
import type { DataSource } from './types';
import { currentAccount } from '../supabase-server';

/**
 * One data source per request, shared by every component of that request. The live source starts loading the
 * season row and (when signed in) the member's own profile at once; nothing waits for them until it is needed.
 */
const createSource = cache(async (): Promise<DataSource> => {
  const name = dataSourceName();
  if (name === 'demo') return demoSource;
  if (name === 'supabase') {
    const cfg = supabaseConfig();
    if (cfg) {
      const seasonP = loadSeason(cfg);
      const acct = await currentAccount();               // local check, no network call
      if (acct) prefetchViewer(cfg, acct.token);
      return supabaseSource(cfg, seasonP, acct?.token ?? null);
    }
  }
  return unavailableSource(seasonOneMonth());
});

/** The request's data source with the season loaded: `season()` can be read straight away. */
export const getDataSource = cache(async (): Promise<DataSource> => {
  const ds = await createSource();
  await ds.ready();
  return ds;
});

/**
 * The same data source before the season row has arrived, so a page can start its own reads in the same round
 * trip as the season instead of after it. Call `await ds.ready()` before `ds.season()` or `rankingsOpen(ds)`.
 */
export const getDataSourceEarly = cache(async (): Promise<DataSource> => createSource());
export type * from './types';

/** True when there is a season whose rankings can be shown (demo data, or a live open/closed season). */
export function rankingsOpen(ds: DataSource): boolean {
  return ds.availability !== 'unavailable' && ds.season().number !== null;
}
