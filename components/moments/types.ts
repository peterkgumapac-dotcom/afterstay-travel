import type { Moment } from '@/lib/types';

export interface MomentDisplay extends Moment {
  /** Place/location name */
  place?: string;
  /** Single-letter author key, e.g. "P" */
  authorKey?: string;
  /** Color assigned to this author from PeopleMap */
  authorColor?: string;
  /** Avatar URL of the uploader */
  authorAvatar?: string;
  /** Whether the current user uploaded this moment */
  isMine?: boolean;
  /** Number of members who favorited this moment */
  favoriteCount?: number;
  /** Whether the current user has favorited this moment */
  isFavorited?: boolean;
  /** Number of comments on this moment */
  commentCount?: number;
}

/** People map keyed by initial or full name. */
export type PeopleMap = Record<string, { name: string; color: string; avatar?: string }>;
