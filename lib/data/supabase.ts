import 'server-only';
// Live data source: calls the read-only Postgres functions in the BAAP KA PAISA Supabase project
// with the publishable key. All ranking happens in the database (see supabase/migrations).
import { CITIES, cityById, scopeName, type Level, type Scope, type StateCode } from '../geo';
import { seasonFor, type SeasonInfo } from '../season';
import { monthName, monthShort } from '../format';
import { lifetimeTier, movement } from './ranking';
import { humanizeDetail } from '../achievements';
import { LINES, toOvertake } from '../engine/callout';
import type { SocialHandles, BackingView, DeclarationView, AchievementView, ArchiveSeason, Board, BoardEvent, BoardRow, CitySummary, CrownMomentView, DataSource, PublicMember, ReignView, SocialSummary, Standing, ViewerSeal } from './types';

interface Cfg { url: string; key: string; }

async function rpcRaw<T>(cfg: Cfg, fn: string, args: Record<string, unknown> = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${token ?? cfg.key}`, 'Content-Type': 'application/json' },
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

export function supabaseSource(base: Cfg, seasonCache: SeasonInfo, token: string | null = null): DataSource {
  // Reads carry the member's own token when signed in, so the database can mark "your row".
  const cfg = base;
  const rpc = <T,>(c: Cfg, fn: string, args: Record<string, unknown> = {}) => rpcRaw<T>(c, fn, args, token);
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
    async viewer() {
      if (!token) return null;
      const me = (await rpc<{ username: string; display_name: string; masked: boolean; anon_label: string | null; title: string | null; flex_line: string | null; city_id: string; state_code: string; locality: string; member_no: number; joined_at: string; lifetime_paise: number; season_score_paise: number }[]>(cfg, 'get_me'))[0];
      if (!me) return null; // account exists but has no member profile yet
      const publicName = me.masked && me.anon_label ? me.anon_label : me.username;
      const lifetime = Math.round(Number(me.lifetime_paise) / 100);
      // Your own view shows your real name and number even in Mystery mode; `masked` tells the UI what others see.
      const member: PublicMember = { username: publicName, displayName: me.display_name, masked: me.masked, publicLabel: publicName, title: me.title, flexLine: me.flex_line,
        cityId: me.city_id, state: me.state_code as StateCode, locality: me.locality, memberNo: me.member_no, seasonScore: Math.round(Number(me.season_score_paise) / 100), lifetimeTier: lifetimeTier(lifetime) };
      const [standings, archive] = await Promise.all([src.standings(publicName), rpc<{ season_id: number; starts_at: string; level: string; scope_key: string; final_rank: number }[]>(cfg, 'get_my_season_record').catch(() => [])]);
      const joined = seasonFor(new Date(me.joined_at), null);
      const bySeason = new Map<number, { starts: string; city: number | null; loc: number | null }>();
      for (const r of archive) { const e = bySeason.get(r.season_id) ?? { starts: r.starts_at, city: null, loc: null }; if (r.level === 'city') e.city = r.final_rank; if (r.level === 'locality') e.loc = r.final_rank; bySeason.set(r.season_id, e); }
      const record = [...bySeason.entries()].sort((a, b) => b[0] - a[0]).map(([id, e]) => { const s = seasonFor(new Date(e.starts), null); return { seasonLabel: `Season ${id}`, monthLabel: `${monthShort(s.month)} ${s.year}`, cityRank: e.city, localityRank: e.loc, note: null }; });
      return { member, lifetimeScore: lifetime, memberSince: `${monthShort(joined.month)} ${joined.year}`, standings, record, insignia: [], cityMovement: null } satisfies ViewerSeal;
    },
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
    // Backing and Declarations read through their own database functions. Until those migrations are
    // applied the functions do not exist: the reads then return "nothing" instead of failing the page.
    async backing(name) {
      const rows = await rpc<{ season_id: number | null; backers: number; contender: boolean; pick_name: string | null; pick_display: string | null; pick_masked: boolean | null; pick_city: string | null; pick_locality: string | null;
        pick_rank: number | null; pick_of: number | null; pick_gap_paise: number | null; pick_since: string | null; history: { season_id: number; name: string; display: string | null; masked: boolean; city: string; final_rank: number | null }[] }[]>(cfg, 'get_backing', { p_name: name }).catch(() => null);
      const r = rows?.[0];
      if (!r) return null;
      return {
        open: r.season_id !== null, seasonLabel: r.season_id ? `Season ${r.season_id}` : seasonCache.label, backers: r.backers, contender: r.contender,
        pick: r.pick_name ? { member: lite(r.pick_name, r.pick_display, !!r.pick_masked, r.pick_city!, r.pick_locality!), cityRank: r.pick_rank, cityOf: r.pick_of ?? 0, gapToFirst: Math.round(Number(r.pick_gap_paise ?? 0) / 100), since: new Date(r.pick_since!) } : null,
        history: r.history.map((h) => ({ seasonLabel: `Season ${h.season_id}`, member: lite(h.name, h.display, h.masked, h.city, ''), finalRank: h.final_rank, crowned: h.final_rank === 1 })),
      } satisfies BackingView;
    },
    async socials(name) {
      const rows = await rpc<{ instagram: string | null; snapchat: string | null; visibility: SocialHandles['visibility']; is_self: boolean }[]>(cfg, 'get_socials', { p_name: name }).catch(() => []);
      const r = rows[0];
      return r && (r.instagram || r.snapchat || r.is_self) ? { instagram: r.instagram, snapchat: r.snapchat, visibility: r.visibility, isSelf: r.is_self } : null;
    },
    async mostBacked(cityId, limit) {
      const rows = await rpc<{ public_name: string; display_name: string | null; masked: boolean; locality: string; backers: number; rank: number }[]>(cfg, 'get_most_backed', { p_city: cityId, p_limit: limit }).catch(() => []);
      return rows.map((r) => ({ member: lite(r.public_name, r.display_name, r.masked, cityId, r.locality), backers: r.backers, rank: r.rank }));
    },
    async declarations({ cityId, username, id }) {
      if (id !== undefined && !/^\d+$/.test(id)) return [];
      type Row = { id: number; seq: number; season_id: number; level: Level; scope_key: string; line: number; declared_at: string; status: DeclarationView['status']; resolved_at: string | null;
        holder_score_paise: number; challenger_score_paise: number; required_paise: number; holder_now_paise: number; challenger_now_paise: number;
        c_name: string; c_display: string | null; c_masked: boolean; c_city: string; c_locality: string; h_name: string; h_display: string | null; h_masked: boolean; h_city: string; h_locality: string;
        taken_by_name: string | null; moves: { at: string; who: 'holder' | 'challenger'; amount_paise: number }[] };
      const rows = await rpc<Row[]>(cfg, 'get_declarations', { p_city: cityId ?? null, p_name: username ?? null, p_id: id ? Number(id) : null }).catch(() => [] as Row[]);
      const rs = (p: number) => Math.round(Number(p) / 100);
      return rows.map((r): DeclarationView => {
        const sc = scopeFromKey(r.level, r.scope_key);
        const code = sc.level === 'india' ? 'IN' : sc.level === 'state' ? r.scope_key : sc.level === 'city' ? (cityById(sc.cityId)?.mark ?? sc.cityId.toUpperCase()) : `${cityById(sc.cityId)?.mark ?? ''}-${sc.locality.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}`;
        let h = rs(r.holder_score_paise), c = rs(r.challenger_score_paise);
        const timeline: DeclarationView['timeline'] = [{ at: new Date(r.declared_at), kind: 'declared', gap: h - c }];
        r.moves.forEach((m, n) => {
          if (m.who === 'holder') h += rs(m.amount_paise); else c += rs(m.amount_paise);
          const last = n === r.moves.length - 1 && r.status === 'won' && m.who === 'challenger';   // the move that takes the throne is the last word
          if (!last) timeline.push({ at: new Date(m.at), kind: m.who === 'holder' ? 'holder-added' : 'challenger-added', amount: rs(m.amount_paise), gap: h - c });
        });
        if (r.status !== 'standing' && r.resolved_at) timeline.push({ at: new Date(r.resolved_at), kind: r.status, gap: h - c, by: r.taken_by_name ? lite(r.taken_by_name, null, /^ANON-/.test(r.taken_by_name), sc.cityId, '') : undefined });
        const hNow = rs(r.holder_now_paise), cNow = rs(r.challenger_now_paise);
        return {
          id: String(r.id), no: `D/S${r.season_id}/${code}/${String(r.seq).padStart(3, '0')}`, seasonLabel: `Season ${r.season_id}`, scope: sc, boardName: scopeName(sc),
          challenger: lite(r.c_name, r.c_display, r.c_masked, r.c_city, r.c_locality), holder: lite(r.h_name, r.h_display, r.h_masked, r.h_city, r.h_locality),
          at: new Date(r.declared_at), line: LINES[r.line] ?? LINES[0], holderScore: rs(r.holder_score_paise), challengerScore: rs(r.challenger_score_paise), required: rs(r.required_paise),
          status: r.status, resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
          current: r.status === 'standing' ? { holderScore: hNow, challengerScore: cNow, required: toOvertake(hNow, cNow) } : null, timeline,
        };
      });
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
  const rows = await rpcRaw<{ id: number; starts_at: string; scheduled_end: string; ends_at: string; status: string }[]>(cfg, 'get_season');
  const r = rows[0];
  const now = new Date();
  if (!r || r.status === 'upcoming') {
    const base = seasonFor(now, null);
    return { ...base, number: null, label: 'Season not open', short: 'NOT OPEN' };
  }
  const start = new Date(r.starts_at);
  const base = seasonFor(start, null);
  return { ...base, number: r.id, startsAt: start, endsAt: new Date(r.ends_at), scheduledEnd: new Date(r.scheduled_end), status: r.status === 'closed' ? 'closed' : 'open', label: `Season ${r.id}`,
    short: `S${String(r.id).padStart(2, '0')} / ${monthShort(base.month).toUpperCase()} '${String(base.year).slice(2)}`,
    monthLabel: `${monthName(base.month)} ${base.year}` };
}
