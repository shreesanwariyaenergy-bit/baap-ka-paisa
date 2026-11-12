// The Gazette: each city's daily front page, written from the register's own records.
// Every line is derived from real board data. Nothing is invented: when nothing happened, it says so.
import type { Board, BoardEvent, CitySummary, CrownMomentView, PublicMember, ReignView } from './data/types';
import type { City } from './geo';
import type { SeasonInfo } from './season';
import { cityById } from './geo';
import { inr } from './format';

export interface Story { kicker: string; headline: string; body: string; href?: string; tone?: 'hot' | 'plain' }
export interface Notice { no: string; text: string; at: Date; winner: string; loser: string | null; held: string | null }
export interface Edition {
  city: City;
  issue: string;       // "Season 4 · No. 10"
  dateline: string;    // "Tuesday 10 November 2026"
  lead: Story;
  stories: Story[];
  notices: Notice[];
  standing: { rank: number; name: string; total: number; isCity: boolean }[];
  /** One line that works as a message when the edition is shared. */
  shareLine: string;
  quiet: boolean;
}
export interface GazetteInput {
  city: City; season: SeasonInfo; now: Date; open: boolean;
  board: Board; reigns: ReignView[]; moments: CrownMomentView[]; events: BoardEvent[];
  cities: CitySummary[]; respect: Board;
}

const DAY = 86_400_000;
export const who = (m: PublicMember) => (m.masked ? m.publicLabel : m.displayName ?? m.username);
const surname = (m: PublicMember) => (m.masked ? m.publicLabel : (m.displayName ?? m.username).trim().split(/\s+/).pop()!);
const profile = (m: PublicMember) => `/u/${encodeURIComponent(m.username)}`;

/** "6 days 4 hours", "3 hours", "under an hour". */
export function heldFor(hours: number): string {
  const h = Math.max(0, Math.floor(hours));
  if (h < 1) return 'under an hour';
  const d = Math.floor(h / 24), r = h % 24;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return d ? (r ? `${part(d, 'day')} ${part(r, 'hour')}` : part(d, 'day')) : part(h, 'hour');
}
const ist = (at: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(at);

export function buildEdition(i: GazetteInput): Edition {
  const { city, season, now, board, reigns, moments, events, cities, respect } = i;
  const C = city.name.toUpperCase();
  const dayNo = Math.max(1, Math.floor((now.getTime() - season.startsAt.getTime()) / DAY) + 1);
  const daysLeft = Math.max(0, Math.ceil((season.endsAt.getTime() - now.getTime()) / DAY));
  const leader = board.rows[0], second = board.rows[1];
  const current = reigns.find((r) => r.current);
  const lastChange = moments[0];
  const stories: Story[] = [];
  let lead: Story;

  if (!i.open) {
    lead = { kicker: 'Before the first season', headline: `THE THRONE OF ${C} HAS NEVER BEEN HELD`, tone: 'hot',
      body: `No name has ever been entered against ${city.name}. When the first season opens, the first entry takes #01 uncontested, and is written into this register permanently as the first to hold the city.` };
  } else if (!leader) {
    lead = { kicker: `Day ${dayNo} of the season`, headline: `THE THRONE OF ${C} IS VACANT`, tone: 'hot',
      body: `${dayNo === 1 ? 'The season has opened and' : `${dayNo} days in,`} nobody has entered ${city.name}. The first entry takes #01 without a fight. The register is waiting for a name.` };
  } else if (lastChange && now.getTime() - lastChange.at.getTime() < DAY) {
    const fallen = reigns.find((r) => !r.current && r.to && Math.abs(r.to.getTime() - lastChange.at.getTime()) < 60_000);
    lead = { kicker: 'Change of throne', headline: `${who(lastChange.to).toUpperCase()} TAKES ${C}`, tone: 'hot', href: profile(lastChange.to),
      body: lastChange.from
        ? `${who(lastChange.from)}'s reign ended at ${ist(lastChange.at, { hour: 'numeric', minute: '2-digit' })} IST${fallen ? ` after ${heldFor(fallen.hours)}` : ''}. The register has been amended. ${surname(lastChange.from)} has until the season closes to take it back.`
        : `The throne was empty. ${who(lastChange.to)} entered at ${ist(lastChange.at, { hour: 'numeric', minute: '2-digit' })} IST and took it uncontested.` };
  } else {
    const days = current ? Math.floor(current.hours / 24) : 0;
    lead = { kicker: 'The throne', headline: days >= 1 ? `DAY ${days + 1}: ${surname(leader.member).toUpperCase()} STILL HOLDS ${C}` : `${surname(leader.member).toUpperCase()} HOLDS ${C}`, href: profile(leader.member),
      body: second
        ? `${who(leader.member)} has held #01${current ? ` for ${heldFor(current.hours)}` : ''}. ${who(second.member)} is ${inr(leader.member.seasonScore - second.member.seasonScore)} behind and has not moved. ${daysLeft} ${daysLeft === 1 ? 'day remains' : 'days remain'}.`
        : `${who(leader.member)} holds #01 and is, for now, the only name on the ${city.name} board. An uncontested throne is still a throne.` };
  }

  if (i.open && leader && second) {
    const gap = leader.member.seasonScore - second.member.seasonScore;
    stories.push({ kicker: 'The gap', headline: gap <= 500 ? `ONE STEP SEPARATES #01 AND #02` : `${inr(gap)} BETWEEN ${surname(second.member).toUpperCase()} AND THE THRONE`,
      body: gap <= 500 ? `A single ${inr(500)} step by ${who(second.member)} changes who holds ${city.name}. The register notes that it has not happened yet.`
        : `${who(second.member)} sits at #02. Closing the distance takes ${Math.ceil((gap + 1) / 500)} steps.`, href: '/board?level=city&city=' + city.id });
  }
  const climber = events.filter((e) => e.kind === 'up' || e.kind === 'new').sort((a, b) => b.by - a.by)[0];
  if (climber) stories.push({ kicker: 'On the move', headline: climber.kind === 'new' ? `NEW NAME: ${who(climber.member).toUpperCase()} ENTERS AT #${climber.rank}` : `${surname(climber.member).toUpperCase()} CLIMBS ${climber.by} TO #${climber.rank}`,
    body: climber.kind === 'new' ? `${who(climber.member)} of ${climber.member.locality} is on the board for the first time this season.` : `${who(climber.member)} of ${climber.member.locality} passed ${climber.by} ${climber.by === 1 ? 'name' : 'names'}. Those names have been informed by the board itself.`, href: profile(climber.member) });

  const ranked = [...cities].sort((a, b) => a.rank - b.rank);
  const mine = ranked.find((c) => c.cityId === city.id);
  if (mine && ranked.some((c) => c.seasonTotal > 0)) {
    const above = ranked.find((c) => c.rank === mine.rank - 1), below = ranked.find((c) => c.rank === mine.rank + 1);
    if (above) stories.push({ kicker: 'City against city', headline: `${C} TRAILS ${cityById(above.cityId)!.name.toUpperCase()} BY ${inr(above.seasonTotal - mine.seasonTotal)}`,
      body: `${city.name} is #${mine.rank} of ${ranked.length} cities this season. ${cityById(above.cityId)!.name} is directly ahead. Cities are ranked by what their members put on the board together.`, href: '/cities' });
    else if (below) stories.push({ kicker: 'City against city', headline: `${C} LEADS INDIA`, body: `${city.name} is the #1 city this season, ${inr(mine.seasonTotal - below.seasonTotal)} ahead of ${cityById(below.cityId)!.name}.`, href: '/cities' });
  }
  const masked = board.rows.find((r) => r.member.masked);
  if (masked) stories.push({ kicker: 'Unidentified', headline: `NOBODY KNOWS WHO ${masked.member.publicLabel} IS`, body: `${masked.member.publicLabel} is #${masked.rank} in ${city.name} and has chosen not to be named. The register knows. The register does not tell.`, href: profile(masked.member) });
  const loved = respect.rows[0];
  if (loved && (loved.score ?? 0) > 0) stories.push({ kicker: 'Cannot be bought', headline: `MOST RESPECTED: ${who(loved.member).toUpperCase()}`, body: `${loved.score} Respect this season. Respect is free, limited to one per person per day, and is the only number here that money does not move.`, href: '/board?view=respect&level=city&city=' + city.id });
  if (i.open && daysLeft <= 7) stories.push({ kicker: 'The closing', headline: daysLeft <= 1 ? 'THE BOARD CLOSES TONIGHT' : `${daysLeft} DAYS TO THE CLOSING`, tone: 'hot',
    body: `At 11:59 pm on the last day the board freezes and whoever holds #01 is entered as Season Crown. An overtake in the final 15 minutes extends the season by 15 minutes.` });

  // Notices: every change of throne this season, numbered in order. reigns arrive newest first.
  const seasonReigns = reigns.filter((r) => r.seasonLabel === season.label || !season.number).slice().reverse();
  const notices: Notice[] = seasonReigns.map((r, n) => {
    const prev = seasonReigns[n - 1];
    const stamp = `${ist(r.from, { day: 'numeric', month: 'short' })}, ${ist(r.from, { hour: 'numeric', minute: '2-digit' })} IST`;
    return {
      no: `${season.number ? `S${season.number}` : 'S'}/${city.mark}/${String(n + 1).padStart(3, '0')}`, at: r.from, winner: who(r.member), loser: prev ? who(prev.member) : null, held: prev ? heldFor(prev.hours) : null,
      text: prev ? `The throne of ${city.name} passed from ${who(prev.member)} to ${who(r.member)} on ${stamp}. ${who(prev.member)} held it for ${heldFor(prev.hours)}.${r.revenge ? ' Recorded as revenge taken.' : ''}`
        : `${who(r.member)} took the vacant throne of ${city.name} on ${stamp}.`,
    };
  }).reverse();

  return {
    city, lead, stories, notices,
    issue: i.open ? `${season.label} · No. ${dayNo}` : 'Before the first season',
    dateline: ist(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    standing: ranked.map((c) => ({ rank: c.rank, name: cityById(c.cityId)!.name, total: c.seasonTotal, isCity: c.cityId === city.id })),
    shareLine: `${lead.headline}. The ${city.name} Gazette, ${season.label}.`,
    quiet: !leader,
  };
}
