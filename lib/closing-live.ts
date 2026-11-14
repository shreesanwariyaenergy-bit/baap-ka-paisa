import 'server-only';
// The Closing for a real season: the same screen as the practice replay, filled from the live board.
// It appears in a season's final 24 hours and stays until a day after the close.
import type { DataSource } from './data/types';
import { cityById, DEFAULT_CITY_ID, type Scope } from './geo';
import { toOvertake } from './engine/callout';
import { who } from './gazette';
import type { ClosingState, ClosingTick } from './closing';

const DAY = 86_400_000;
const clock = (t: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(t);

export async function liveClosingState(ds: DataSource, cityId?: string): Promise<ClosingState | null> {
  const season = ds.season();
  if (ds.availability !== 'live' || season.number === null || !season.scheduledEnd) return null;
  const now = ds.now(), end = season.endsAt, closed = season.status === 'closed';
  if (end.getTime() - now.getTime() > DAY || now.getTime() - end.getTime() > DAY) return null;
  const city = cityById(cityId) ?? cityById((await ds.viewer())?.member.cityId) ?? cityById(DEFAULT_CITY_ID)!;
  const scope: Scope = { level: 'city', cityId: city.id, locality: city.localities[0] };
  const [board, events, decls] = await Promise.all([ds.board(scope, { limit: 6 }), ds.events(scope, 8), ds.declarations({ cityId: city.id })]);
  const top = board.rows[0];
  const extensions = Math.max(0, Math.round((end.getTime() - season.scheduledEnd.getTime()) / (15 * 60_000)));
  const remaining = Math.max(0, end.getTime() - now.getTime());
  const ticker: ClosingTick[] = events.map((e) => ({ at: e.at.getTime(), clock: clock(e.at), extended: false,
    kind: e.kind === 'took' ? 'overtake' as const : e.kind === 'new' ? 'entry' as const : 'move' as const,
    text: e.kind === 'took' ? `${who(e.member)} TAKES THE THRONE.` : e.kind === 'new' ? `${who(e.member)} enters at #${e.rank}.` : e.kind === 'up' ? `${who(e.member)} climbs to #${e.rank}.` : `${who(e.member)} drops to #${e.rank}.` }));
  const season_ = `Season ${season.number}`;
  return {
    phase: closed ? 'closed' : extensions ? 'extended' : 'live', at: now.getTime(), clock: clock(now), scheduledClose: clock(season.scheduledEnd), closesAt: clock(end),
    remainingMs: remaining, realRemainingMs: remaining, extensions, extendedBy: extensions * 15, lastExtensionAt: null,
    holder: top ? { name: who(top.member), score: top.member.seasonScore } : null, price: toOvertake(top?.member.seasonScore ?? 0, 0),
    board: board.rows.map((r) => ({ rank: r.rank, name: who(r.member), score: r.member.seasonScore, toTake: r.rank === 1 ? 0 : toOvertake(top!.member.seasonScore, r.member.seasonScore) })),
    ticker, thronesChanged: events.filter((e) => e.kind === 'took').length,
    declarations: decls.filter((d) => d.seasonLabel === season_ && d.scope.level === 'city').slice(0, 4).map((d) => ({ no: d.no, challenger: who(d.challenger), line: d.line, status: d.status })),
    live: { city: city.name, cityId: city.id, season: season_, settling: !closed && remaining === 0 },
    verdict: closed && top ? { winner: who(top.member), score: top.member.seasonScore, margin: top.member.seasonScore - (board.rows[1]?.member.seasonScore ?? 0), runnerUp: board.rows[1] ? who(board.rows[1].member) : null,
      closedAt: clock(end), extensions, changes: events.filter((e) => e.kind === 'took').length, refused: 0 } : null,
  };
}
