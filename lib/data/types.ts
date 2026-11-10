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
}

export interface Board {
  scope: Scope;
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

export type Availability = 'live' | 'demo' | 'unavailable';

export interface DataSource {
  availability: Availability;
  /** "As of" clock used for season maths. Real time, or a fixed clock for demo data. */
  now(): Date;
  season(): SeasonInfo;
  board(scope: Scope, opts?: { limit?: number; query?: string }): Promise<Board>;
  events(scope: Scope, limit: number): Promise<BoardEvent[]>;
  member(username: string): Promise<PublicMember | null>;
  standings(username: string): Promise<Standing[]>;
  /** Null when nobody is signed in or sign-in is not connected. */
  viewer(): Promise<ViewerSeal | null>;
  cities(): Promise<CitySummary[]>;
  archive(): Promise<ArchiveSeason[]>;
}
