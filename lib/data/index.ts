import 'server-only';
import { dataSourceName, seasonOneMonth } from '../config';
import { demoSource } from './demo';
import { unavailableSource } from './unavailable';
import type { DataSource } from './types';

export function getDataSource(): DataSource {
  return dataSourceName() === 'demo' ? demoSource : unavailableSource(seasonOneMonth());
}
export type * from './types';
