import type { LifetimeStats, Moment, Trip } from './types';

export interface CountryVisited {
  code: string;
  name: string;
  flag: string;
}

export interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  icon: string;
}

interface ProfileStatsInput {
  trips: Trip[];
  moments?: Moment[];
}

const COUNTRY_CODES: Record<string, string> = {
  Philippines: 'PH',
  Thailand: 'TH',
  Vietnam: 'VN',
  Indonesia: 'ID',
  Singapore: 'SG',
  Japan: 'JP',
  Korea: 'KR',
  'South Korea': 'KR',
  'United States': 'US',
};

const COUNTRY_FLAGS: Record<string, string> = {
  PH: '🇵🇭',
  TH: '🇹🇭',
  VN: '🇻🇳',
  ID: '🇮🇩',
  SG: '🇸🇬',
  JP: '🇯🇵',
  KR: '🇰🇷',
  US: '🇺🇸',
};

function visibleTrip(trip: Trip): boolean {
  return !trip.deletedAt && !trip.isDraft && !trip.archivedAt;
}

function tripNights(trip: Trip): number {
  if (trip.nights > 0) return trip.nights;
  if (trip.totalNights && trip.totalNights > 0) return trip.totalNights;
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Number.isFinite(nights) ? Math.max(0, nights) : 0;
}

function tripCountry(trip: Trip): string | undefined {
  if (trip.country) return trip.country;
  const parts = (trip.destination || trip.name || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

function countryCode(name: string): string {
  return COUNTRY_CODES[name] ?? name.slice(0, 2).toUpperCase();
}

export function buildProfileStatsFromTrips({ trips, moments = [] }: ProfileStatsInput): LifetimeStats {
  const visible = trips.filter(visibleTrip);
  const countries = new Set<string>();

  for (const trip of visible) {
    const country = tripCountry(trip);
    if (country) countries.add(country);
  }

  return {
    totalTrips: visible.length,
    totalCountries: countries.size,
    totalNights: visible.reduce((sum, trip) => sum + tripNights(trip), 0),
    totalMiles: 0,
    totalSpent: visible.reduce((sum, trip) => sum + (trip.totalSpent ?? trip.cost ?? 0), 0),
    homeCurrency: 'PHP',
    totalMoments: moments.filter((moment) => !!moment.photo).length,
    countriesList: [...countries],
    earliestTripDate: visible
      .map((trip) => trip.startDate)
      .filter(Boolean)
      .sort()[0],
  };
}

export function buildCountriesVisited(stats: LifetimeStats): CountryVisited[] {
  return stats.countriesList.map((name) => {
    const code = countryCode(name);
    return {
      code,
      name,
      flag: COUNTRY_FLAGS[code] ?? '🌍',
    };
  });
}

export function buildAchievementBadges(stats: LifetimeStats): AchievementBadge[] {
  const badges: AchievementBadge[] = [];

  if (stats.totalCountries >= 1) {
    badges.push({
      key: 'explorer',
      title: 'Explorer',
      description: `Visited ${stats.totalCountries} ${stats.totalCountries === 1 ? 'country' : 'countries'}`,
      icon: 'compass',
    });
  }
  if (stats.totalMiles >= 6214 || stats.totalTrips >= 5) {
    badges.push({
      key: 'globetrotter',
      title: 'Globetrotter',
      description: `Traveled ${Math.round(stats.totalMiles * 1.60934).toLocaleString()}+ km`,
      icon: 'plane',
    });
  }
  if (stats.totalMoments >= 1) {
    badges.push({
      key: 'memory_maker',
      title: 'Memory Maker',
      description: `Shared ${stats.totalMoments} ${stats.totalMoments === 1 ? 'photo' : 'photos'}`,
      icon: 'camera',
    });
  }

  return badges.slice(0, 3);
}

export function buildTopTrip(trips: Trip[]): Trip | null {
  const completed = trips.filter((trip) => visibleTrip(trip) && trip.status === 'Completed');
  if (completed.length === 0) return null;

  return [...completed].sort((a, b) => {
    const aScore = tripNights(a) * 1000 + (a.totalSpent ?? 0);
    const bScore = tripNights(b) * 1000 + (b.totalSpent ?? 0);
    return bScore - aScore;
  })[0];
}

export function formatProfileCurrency(value: number): string {
  if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₱${Math.round(value / 1000)}k`;
  return `₱${Math.round(value).toLocaleString()}`;
}
