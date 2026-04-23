import type { Moment } from '@/lib/types';

export interface MomentDisplay extends Moment {
  /** Place/location name */
  place?: string;
  /** Single-letter author key, e.g. "P" */
  authorKey?: string;
}

/** People map keyed by initial or full name. */
export type PeopleMap = Record<string, { name: string; color: string }>;
