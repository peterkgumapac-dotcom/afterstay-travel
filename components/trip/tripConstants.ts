import type { useTheme } from '@/constants/ThemeContext';
import type { Flight } from '@/lib/types';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';
import { colors as themeColors } from '@/constants/theme';

// ---------- TYPES ----------

export type ThemeColors = ReturnType<typeof useTheme>['colors'];

export interface FlightDisplayData {
  dir: string;
  airline: string;
  code: string;
  num: string;
  ref: string;
  logo: string;
  date: string;
  dep: string;
  arr: string;
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  dur: string;
  bags: { who: string; bag: string }[];
  status: string;
}

export interface PastTripDisplay {
  tripId?: string;
  flag: string;
  dest: string;
  country: string;
  dates: string;
  nights: number;
  spent: number;
  miles: number;
  rating: number;
  hasMemory?: boolean;
  heroImageUrl?: string;
  isDraft?: boolean;
  lifecycleStatus?: 'Planning' | 'Active' | 'Completed' | 'Draft' | 'Archived';
}

// ---------- CONSTANTS ----------

export const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];
export const FILE_COLORS = ['#a64d1e', '#c66a36', '#b8892b', '#d9a441', '#8a5a2b'];

// ---------- MAPPERS ----------

function safeTime(v: string | undefined | null): string {
  if (!v || typeof v !== 'string') return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return formatTimePHT(v);
}

function safeDate(v: string | undefined | null): string {
  if (!v || typeof v !== 'string') return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDatePHT(v);
}

export function mapFlightToDisplay(f: Flight): FlightDisplayData {
  const code = f.flightNumber?.split(' ')[0] ?? '';
  const num = f.flightNumber?.split(' ')[1] ?? f.flightNumber ?? '';
  return {
    dir: f.direction,
    airline: f.airline ?? '',
    code,
    num,
    ref: f.bookingRef ?? '',
    logo: f.direction === 'Outbound' ? themeColors.text2 : themeColors.danger,
    date: safeDate(f.departTime),
    dep: safeTime(f.departTime),
    arr: safeTime(f.arriveTime),
    from: f.from ?? '—',
    fromCity: f.from ?? '',
    to: f.to ?? '—',
    toCity: f.to ?? '',
    dur: '',
    bags: f.baggage ? [{ who: f.passenger ?? '', bag: f.baggage }] : [],
    status: 'Confirmed',
  };
}
