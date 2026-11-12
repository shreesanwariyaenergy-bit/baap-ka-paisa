// Typed boundary between the website and whatever supplies ranking data.
// Ranks arrive already computed by the data source (server side). The UI never sorts to decide a rank.
import type { Level, Scope, StateCode } from '../geo';
import type { SeasonInfo } from '../season';

/** Only fields that are safe to show publicly. No phone, address, date of birth or contact details. */
export interface PublicMember {
  username: string;
  /** Null while the member is in Mystery mode. */
  displayName: string | null;
  masked: boolean;
  /** Mystery-mode label such as ANON-07; equals username for masked members. */
  publicLabel: string;
  title: string | null;
  flexLine: string | null;
  cityId: string;
  state: StateCode;
  locality: string;
  /** Permanent member number. Never changes with rank. Null when hidden by Mystery mode. */
  memberNo: number | null;
  seasonScore: number; // rupees, display only
  lifetimeTier: 'Bronze' | 'Silver' | 'Gold' | 'Black' | null;
}

export type MovementKind = 'up' | 'down' | 'held' | 'new' | 'took' | 'defending';
export interface Movement { kind: MovementKind; by: number; }

export interface BoardRow {
  rank: number;
  member: PublicMember;
  movement: Movement | null; // null when the source has no 24-hour history
  /** Value shown in the score column when it is not the Season Score (Hall of Fame shows Lifetime Score). */
  score?: number;
}

export interface Board {
  scope: Scope;
  /** What the score column holds: rupees (default) or a count (Respect board). */
  unit?: 'inr' | 'count';
  rows: BoardRow[]; // top rows, at most `limit`
  total: number; // honest count of everyone on this board
  /** The signed-in member's own row on this board, when they are on it. */
  viewerRow: BoardRow | null;
}

export interface BoardEvent {
  kind: 'took' | 'up' | 'down' | 'new';
  member: PublicMember;
  rank: number;
  by: number;
  scope: Scope;
  at: Date;
}

export interface Standing { level: Level; scope: Scope; rank: number | null; of: number; }

export interface SealRecord { seasonLabel: string; monthLabel: string; cityRank: number | null; localityRank: number | null; note: string | null; }
export interface Insignia { id: string; name: string; meaning: string; }

/** The signed-in member's own view. Includes their private-but-own figures (e.g. Lifetime Score). */
export interface ViewerSeal {
  member: PublicMember;
  lifetimeScore: number;
  memberSince: string; // "Aug 2026"
  standings: Standing[];
  record: SealRecord[];
  insignia: Insignia[];
  cityMovement: Movement | null;
}

export interface CitySummary { cityId: string; members: number; seasonTotal: number; leader: PublicMember | null; rank: number; previousRank: number | null; }

export interface ArchiveSeason {
  seasonLabel: string;
  monthLabel: string;
  year: number;
  startsAt: Date;
  endsAt: Date;
  /** Final #01 per city, plus India. These are past champions, never the live crown. */
  champions: { cityId: string | 'india'; member: PublicMember }[];
}

export interface ReignView {
  seasonLabel: string; scope: Scope; boardName: string; member: PublicMember;
  from: Date; to: Date | null; endReason: 'overtaken' | 'season-end' | null; hours: number;
  current: boolean; untouchable: boolean; revenge: boolean;
}
export interface CrownMomentView { seasonLabel: string; scope: Scope; boardName: string; from: PublicMember | null; to: PublicMember; at: Date; }
export interface AchievementView { id: string; label: string; detail: string; at: Date; seasonLabel: string | null; boardName: string | null; }
export interface SocialSummary { followers: number; following: number; respectThisSeason: number; rivals: BoardRow[]; }

/** Backing: one free, locked pledge per member per season. Never affects rank. */
export interface BackingView {
  /** A season is running and backing can be given. */
  open: boolean;
  seasonLabel: string;
  /** Members backing this member this season. Public. */
  backers: number;
  /** On the board this season, so can be backed. */
  contender: boolean;
  /** Who this member backs this season (locked), with the pick's current city rank. */
  pick: { member: PublicMember; cityRank: number | null; cityOf: number; gapToFirst: number; since: Date } | null;
  /** Past seasons, newest first. */
  history: { seasonLabel: string; member: PublicMember; finalRank: number | null; crowned: boolean }[];
}
export interface BackedRow { member: PublicMember; backers: number; rank: number }

export type Availability = 'live' | 'demo' | 'unavailable';

export interface DataSource {
  availability: Availability;
  /** "As of" clock used for season maths. Real time, or a fixed clock for demo data. */
  now(): Date;
  season(): SeasonInfo;
  board(scope: Scope, opts?: { limit?: number; query?: string }): Promise<Board>;
  /** Lifetime Score ranking across all seasons. Never resets. */
  hallOfFame(scope: Scope, opts?: { limit?: number }): Promise<Board>;
  events(scope: Scope, limit: number): Promise<BoardEvent[]>;
  member(username: string): Promise<PublicMember | null>;
  standings(username: string): Promise<Standing[]>;
  /** Null when nobody is signed in or sign-in is not connected. */
  viewer(): Promise<ViewerSeal | null>;
  cities(): Promise<CitySummary[]>;
  /** Free Respect board for the current season (one Respect per profile per day). */
  respectBoard(scope: Scope, opts?: { limit?: number }): Promise<Board>;
  /** Reigns of #01 holders. Filter by board, or by member. Newest first. */
  throneHistory(filter: { scope?: Scope; username?: string; limit?: number }): Promise<ReignView[]>;
  /** #01 changes on a board since a time (for the Crown Moment). Newest first. */
  crownMoments(scope: Scope, since: Date): Promise<CrownMomentView[]>;
  achievements(username: string): Promise<AchievementView[]>;
  social(username: string): Promise<SocialSummary | null>;
  archive(): Promise<ArchiveSeason[]>;
  /** Null where Backing is not switched on (the live site, until approved). */
  backing(username: string): Promise<BackingView | null>;
  /** Contenders in a city by number of backers. A popularity list, never a ranking input. */
  mostBacked(cityId: string, limit: number): Promise<BackedRow[]>;
}
