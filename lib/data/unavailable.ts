import 'server-only';
// Used when no BAAP KA PAISA backend is connected. Returns honest empty states and never invents data.
import { seasonFor } from '../season';
import type { DataSource } from './types';

export function unavailableSource(seasonOneMonth?: string | null): DataSource {
  return {
    availability: 'unavailable',
    now: () => new Date(),
    season: () => seasonFor(new Date(), seasonOneMonth),
    async board(scope) { return { scope, rows: [], total: 0, viewerRow: null }; },
    async hallOfFame(scope) { return { scope, rows: [], total: 0, viewerRow: null }; },
    async events() { return []; },
    async member() { return null; },
    async standings() { return []; },
    async viewer() { return null; },
    async cities() { return []; },
    async archive() { return []; },
    async respectBoard(scope) { return { scope, unit: 'count', rows: [], total: 0, viewerRow: null }; },
    async throneHistory() { return []; },
    async crownMoments() { return []; },
    async achievements() { return []; },
    async social() { return null; },
  };
}
