import type { Moment } from '@/lib/types';

export interface MomentDisplay extends Moment {
  time?: string;
  place?: string;
  weather?: string;
  expense?: { label: string; amt: string };
  reactions?: Record<string, number>;
  voice?: { duration: number };
  authorKey?: string;
}
