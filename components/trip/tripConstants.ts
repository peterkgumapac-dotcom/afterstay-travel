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
  flag: string;
  dest: string;
  country: string;
  dates: string;
  nights: number;
  spent: number;
  miles: number;
  rating: number;
}

// ---------- CONSTANTS ----------

export const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];
export const FILE_COLORS = ['#a64d1e', '#c66a36', '#b8892b', '#d9a441', '#8a5a2b'];

// ---------- MAPPERS ----------

export function mapFlightToDisplay(f: Flight): FlightDisplayData {
  const code = f.flightNumber.split(' ')[0] ?? '';
  const num = f.flightNumber.split(' ')[1] ?? f.flightNumber;
  return {
    dir: f.direction,
    airline: f.airline,
    code,
    num,
    ref: f.bookingRef ?? '',
    logo: f.direction === 'Outbound' ? themeColors.text2 : themeColors.danger,
    date: formatDatePHT(f.departTime),
    dep: formatTimePHT(f.departTime),
    arr: formatTimePHT(f.arriveTime),
    from: f.from,
    fromCity: f.from,
    to: f.to,
    toCity: f.to,
    dur: '',
    bags: f.baggage ? [{ who: f.passenger ?? '', bag: f.baggage }] : [],
    status: 'Confirmed',
  };
}
