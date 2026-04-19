import type { Moment } from '@/lib/types';

export interface MomentDisplay extends Moment {
  /** Time string, e.g. "4:32 PM" */
  time?: string;
  /** Place/location name */
  place?: string;
  /** Weather description, e.g. "33\u00b0 sunny" */
  weather?: string;
  /** Linked expense */
  expense?: { label: string; amt: string };
  /** Emoji-keyed reaction counts */
  reactions?: Record<string, number>;
  /** Voice note metadata — presence means author recorded one */
  voice?: { duration: number };
  /** Single-letter author key, e.g. "P" */
  authorKey?: string;
}

/** People map keyed by initial or full name. */
export type PeopleMap = Record<string, { name: string; color: string }>;
