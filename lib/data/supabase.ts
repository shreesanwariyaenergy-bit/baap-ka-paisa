import 'server-only';
// Live data source: calls the read-only Postgres functions in the BAAP KA PAISA Supabase project
// with the publishable key. All ranking happens in the database (see supabase/migrations).
import { CITIES, cityById, scopeName, type Level, type Scope, type StateCode } from '../geo';
import { seasonFor, type SeasonInfo } from '../season';
import { monthName, monthShort } from '../format';
import { movement } from './ranking';
import { humanizeDetail } from '../achievements';
import type { AchievementView, ArchiveSeason, Board, BoardEvent, BoardRow, CitySummary, CrownMomentView, DataSource, PublicMember, ReignView, SocialSummary, Standing } from './types';

interface Cfg { url: string; key: string; }

async function rpc<T>(cfg: Cfg, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Ranking service error (${fn}): ${res.status}`);
  return res.json() as Promise<T>;
}

interface MemberRow { public_name: string; display_name: string | null; masked: boolean; title: string | null; flex_line: string | null; city_id: string; state_code: string; locality: string; member_no: number | null; season_score_paise: number; lifetime_tier: PublicMember['lifetimeTier']; }
interface BoardDbRow extends MemberRow { rank: number; prev_rank: number | null; total: number; is_viewer: boolean; }

const toMember = (r: MemberRow): PublicMember => ({
  username: r.public_name, displayName: r.display_name, masked: r.masked, publicLabel: r.public_name,
  title: r.title, flexLine: r.flex_line, cityId: r.city_id, state: r.state_code as StateCode, locality: r.locality,
  memberNo: r.member_no, seasonScore: Math.round(Number(r.season_score_paise) / 100), lifetimeTier: r.lifetime_tier,
});

/** Database scope key ('india' | state code | city id | 'city/locality') back to a website scope. */
function scopeFromKey(level: Level, key: string): Scope {
  if (level === 'india') return { level, cityId: CITIES[0].id, locality: CITIES[0].localities[0] };
  if (level === 'state') { const c = CITIES.find((x) => x.state === key) ?? CITIES[0]; return { level, cityId: c.id, locality: c.localities[0] }; }
  if (level === 'city') return { level, cityId: key, locality: cityById(key)?.localities[0] ?? '' };
  const [city, loc] = key.split('/'); return { level, cityId: city, locality: loc };
}
/** Minimal public member for lists that do not return full profiles. */
function lite(name: string, display: string | null, masked: boolean, cityId: string, locality: string): PublicMember {
  return { username: name, displayName: display, masked, publicLabel: name, title: null, flexLine: null, cityId, state: (cityById(cityId)?.state ?? 'GJ') as StateCode,
    locality, memberNo: null, seasonScore: 0, lifetimeTier: null };
}

export function supabaseSource(cfg: Cfg, seasonCache: SeasonInfo): DataSource {
  const boardArgs = (s: Scope) => ({ p_level: s.level, p_city: s.level === 'india' ? null : s.cityId, p_locality: s.level === 'locality' ? s.locality : null });

  const src: DataSource = {
    availability: 'live',
    now: () => new Date(),
    season: () => seasonCache,
    async board(scope, opts = {}) {
      const rows = await rpc<BoardDbRow[]>(cfg, 'get_board', { ...boardArgs(scope), p_limit: opts.limit ?? 100, p_query: opts.query || null });
      const limit = opts.limit ?? 100;
      const toRow = (r: BoardDbRow): BoardRow => ({ rank: r.rank, member: toMember(r), movement: movement(r.rank, r.prev_rank ?? undefined) });
      const viewer = rows.find((r) => r.is_viewer);
      // get_board always includes the viewer's own row; keep it out of the top list unless it belongs there.
      const top = rows.filter((r) => r.rank <= limit && (!r.is_viewer || !opts.query));
      let total = rows[0]?.total ?? 0;
      if (opts.query && rows.length === 0) total = (await rpc<BoardDbRow[]>(cfg, 'get_board', { ...boardArgs(scope), p_limit: 1, p_query: null }))[0]?.total ?? 0;
      return { scope, rows: top.map(toRow), total, viewerRow: viewer ? toRow(viewer) : null } satisfies Board;
    },
    async hallOfFame(scope, opts = {}) {
      const limit = opts.limit ?? 100;
      const rows = await rpc<(MemberRow & { rank: number; total: number; is_viewer: boolean; lifetime_paise: number })[]>(cfg, 'get_hall_of_fame', { ...boardArgs(scope), p_limit: limit });
      const toRow = (r: (typeof rows)[number]): BoardRow => ({ rank: r.rank, member: toMember({ ...r, season_score_paise: 0 }), movement: null, score: Math.round(Number(r.lifetime_paise) / 100) });
      const viewer = rows.find((r) => r.is_viewer);
      return { scope, rows: rows.filter((r) => r.rank <= limit).map(toRow), total: rows[0]?.total ?? 0, viewerRow: viewer ? toRow(viewer) : null } satisfies Board;
    },
    async events(scope, limit) {
      const b = await src.board(scope, { limit: 100 });
      return b.rows.filter((r) => r.movement && ['up', 'down', 'new', 'took'].includes(r.movement.kind))
        .sort((a, c) => (c.movement!.kind === 'took' ? 99 : c.movement!.by) - (a.movement!.kind === 'took' ? 99 : a.movement!.by))
        .slice(0, limit)
        .map((r): BoardEvent => ({ kind: r.movement!.kind as BoardEvent['kind'], member: r.member, rank: r.rank, by: r.movement!.by, scope, at: new Date() }));
    },
    async member(name) {
      const rows = await rpc<MemberRow[]>(cfg, 'get_member', { p_name: name });
      return rows[0] ? toMember(rows[0]) : null;
    },
    async standings(name) {
      const m = await src.member(name);
      if (!m) return [];
      const rows = await rpc<{ level: Level; rank: number | null; total: number }[]>(cfg, 'get_standings', { p_name: name });
      return rows.map((r): Standing => ({ level: r.level, scope: { level: r.level, cityId: m.cityId, locality: m.locality }, rank: r.rank, of: r.total }));
    },
    async viewer() { return null; }, // Member sign-in is not built yet.
    async cities() {
      const rows = await rpc<{ city_id: string; members: number; season_total_paise: number; leader_name: string | null; leader_masked: boolean | null; rank: number | null; prev_rank: number | null }[]>(cfg, 'get_city_summaries');
      return rows.filter((r) => r.rank !== null).map((r): CitySummary => ({
        cityId: r.city_id, members: r.members, seasonTotal: Math.round(Number(r.season_total_paise) / 100), leader: null, rank: r.rank!, previousRank: r.prev_rank,
      }));
    },
    async respectBoard(scope, opts = {}) {
      const rows = await rpc<{ rank: number; total: number; public_name: string; display_name: string | null; masked: boolean; city_id: string; state_code: string; locality: string; respect_count: number }[]>(cfg, 'get_respect_board', { ...boardArgs(scope), p_limit: opts.limit ?? 100 });
      return { scope, unit: 'count', total: rows[0]?.total ?? 0, viewerRow: null,
        rows: rows.map((r) => ({ rank: r.rank, movement: null, score: r.respect_count, member: lite(r.public_name, r.display_name, r.masked, r.city_id, r.locality) })) } satisfies Board;
    },
    async throneHistory({ scope, username, limit = 50 }) {
      const rows = await rpc<{ season_id: number; level: Level; scope_key: string; public_name: string; display_name: string | null; masked: boolean; started_at: string; ended_at: string | null; end_reason: ReignView['endReason']; untouchable: boolean; revenge: boolean }[]>(cfg, 'get_throne_history', {
        p_level: scope ? scope.level : null, p_city: scope && scope.level !== 'india' ? scope.cityId : null, p_locality: scope?.level === 'locality' ? scope.locality : null, p_name: username ?? null, p_limit: limit });
      return rows.map((r): ReignView => {
        const sc = scopeFromKey(r.level, r.scope_key);
        const from = new Date(r.started_at); const to = r.ended_at ? new Date(r.ended_at) : null;
        return { seasonLabel: `Season ${r.season_id}`, scope: sc, boardName: scopeName(sc), member: lite(r.public_name, r.display_name, r.masked, sc.cityId, sc.locality),
          from, to, endReason: r.end_reason, hours: Math.round(((to ?? new Date()).getTime() - from.getTime()) / 3_600_000), current: to === null, untouchable: r.untouchable, revenge: r.revenge };
      });
    },
    async crownMoments(scope, since) {
      const rows = await rpc<{ season_id: number; level: Level; scope_key: string; from_name: string | null; from_masked: boolean | null; from_display: string | null; to_name: string; to_masked: boolean; to_display: string | null; at: string }[]>(cfg, 'get_crown_moments', { ...boardArgs(scope), p_since: since.toISOString() });
      return rows.map((r): CrownMomentView => ({ seasonLabel: `Season ${r.season_id}`, scope, boardName: scopeName(scope), at: new Date(r.at),
        from: r.from_name ? lite(r.from_name, r.from_display, !!r.from_masked, scope.cityId, scope.locality) : null, to: lite(r.to_name, r.to_display, r.to_masked, scope.cityId, scope.locality) }));
    },
    async achievements(name) {
      const rows = await rpc<{ achievement: string; label: string; detail: string; season_id: number | null; level: Level | null; scope_key: string | null; awarded_at: string }[]>(cfg, 'get_achievements', { p_name: name });
      return rows.map((r): AchievementView => ({ id: r.achievement, label: r.label, detail: humanizeDetail(r.detail), at: new Date(r.awarded_at), seasonLabel: r.season_id ? `Season ${r.season_id}` : null,
        boardName: r.level && r.scope_key ? scopeName(scopeFromKey(r.level, r.scope_key)) : null }));
    },
    async social(name) {
      const rows = await rpc<{ followers: number; following: number; respect_this_season: number; rival_names: string[] }[]>(cfg, 'get_social', { p_name: name });
      const r = rows[0];
      if (!r) return null;
      const rivals = (await Promise.all(r.rival_names.map((n) => src.member(n)))).filter((m): m is PublicMember => !!m).map((m): BoardRow => ({ rank: 0, member: m, movement: null }));
      return { followers: r.followers, following: r.following, respectThisSeason: r.respect_this_season, rivals } satisfies SocialSummary;
    },
    async archive() {
      const rows = await rpc<{ season_id: number; starts_at: string; ends_at: string; level: string; scope_key: string; public_name: string; display_name: string | null; masked: boolean }[]>(cfg, 'get_archive');
      const bySeason = new Map<number, ArchiveSeason>();
      for (const r of rows) {
        const start = new Date(r.starts_at);
        const s = seasonFor(start, null);
        if (!bySeason.has(r.season_id)) bySeason.set(r.season_id, { seasonLabel: `Season ${r.season_id}`, monthLabel: s.monthLabel, year: s.year, startsAt: start, endsAt: new Date(r.ends_at), champions: [] });
        const city = cityById(r.level === 'india' ? null : r.scope_key);
        bySeason.get(r.season_id)!.champions.push({
          cityId: r.level === 'india' ? 'india' : r.scope_key,
          member: { username: r.public_name, displayName: r.display_name, masked: r.masked, publicLabel: r.public_name, title: null, flexLine: null,
            cityId: city?.id ?? 'surat', state: city?.state ?? 'GJ', locality: '', memberNo: null, seasonScore: 0, lifetimeTier: null },
        });
      }
      return [...bySeason.values()];
    },
  };
  return src;
}

/** Load the current season row once per request so the header and pages agree. */
export async function loadSeason(cfg: Cfg): Promise<SeasonInfo> {
  const rows = await rpc<{ id: number; starts_at: string; scheduled_end: string; ends_at: string; status: string }[]>(cfg, 'get_season');
  const r = rows[0];
  const now = new Date();
  if (!r || r.status === 'upcoming') {
    const base = seasonFor(now, null);
    return { ...base, number: null, label: 'Season not open', short: 'NOT OPEN' };
  }
  const start = new Date(r.starts_at);
  const base = seasonFor(start, null);
  return { ...base, number: r.id, startsAt: start, endsAt: new Date(r.ends_at), label: `Season ${r.id}`,
    short: `S${String(r.id).padStart(2, '0')} / ${monthShort(base.month).toUpperCase()} '${String(base.year).slice(2)}`,
    monthLabel: `${monthName(base.month)} ${base.year}` };
}
