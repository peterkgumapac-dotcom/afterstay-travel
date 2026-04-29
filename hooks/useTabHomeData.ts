import {
  getCachedPromise,
  getCachedData,
  invalidateCache,
} from '@/lib/tabDataCache';
import {
  getActiveTrip,
  getFlights,
  getMoments,
  getGroupMembers,
  getSavedPlaces,
  getExpenses,
  getLifetimeStats,
  getAllUserTrips,
} from '@/lib/supabase';
import { getQuickTrips } from '@/lib/quickTrips';
import type { Trip, Flight, Moment, GroupMember, Place, LifetimeStats } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';

/* ─── Cache keys ─── */
const KEYS = {
  activeTrip: 'home:activeTrip',
  flights: (tripId: string) => `home:flights:${tripId}`,
  moments: (tripId: string) => `home:moments:${tripId}`,
  members: (tripId: string) => `home:members:${tripId}`,
  places: (tripId: string) => `home:places:${tripId}`,
  expenses: (tripId: string) => `home:expenses:${tripId}`,
  allTrips: 'home:allTrips',
  quickTrips: 'home:quickTrips',
  lifetimeStats: 'home:lifetimeStats',
} as const;

/* ─── Individual fetchers with cache ─── */

export function getHomeActiveTripPromise(forceRefresh = false) {
  return getCachedPromise<Trip | null>(KEYS.activeTrip, getActiveTrip, {
    forceRefresh,
    ttlMs: 2 * 60 * 1000,
  });
}

export function getHomeFlightsPromise(tripId: string, forceRefresh = false) {
  return getCachedPromise<Flight[]>(KEYS.flights(tripId), () => getFlights(tripId), {
    forceRefresh,
    ttlMs: 3 * 60 * 1000,
  });
}

export function getHomeMomentsPromise(tripId: string, forceRefresh = false) {
  return getCachedPromise<Moment[]>(KEYS.moments(tripId), () => getMoments(tripId), {
    forceRefresh,
    ttlMs: 3 * 60 * 1000,
  });
}

export function getHomeMembersPromise(tripId: string, forceRefresh = false) {
  return getCachedPromise<GroupMember[]>(KEYS.members(tripId), () => getGroupMembers(tripId), {
    forceRefresh,
    ttlMs: 5 * 60 * 1000,
  });
}

export function getHomePlacesPromise(tripId: string, forceRefresh = false) {
  return getCachedPromise<Place[]>(KEYS.places(tripId), () => getSavedPlaces(tripId), {
    forceRefresh,
    ttlMs: 3 * 60 * 1000,
  });
}

export function getHomeExpensesPromise(tripId: string, forceRefresh = false) {
  return getCachedPromise(KEYS.expenses(tripId), () => getExpenses(tripId), {
    forceRefresh,
    ttlMs: 2 * 60 * 1000,
  });
}

export function getHomeAllTripsPromise(forceRefresh = false) {
  return getCachedPromise<Trip[]>(KEYS.allTrips, () => getAllUserTrips(''), {
    forceRefresh,
    ttlMs: 5 * 60 * 1000,
  });
}

export function getHomeQuickTripsPromise(forceRefresh = false) {
  return getCachedPromise<QuickTrip[]>(KEYS.quickTrips, getQuickTrips, {
    forceRefresh,
    ttlMs: 5 * 60 * 1000,
  });
}

export function getHomeLifetimeStatsPromise(forceRefresh = false) {
  return getCachedPromise<LifetimeStats | null>(KEYS.lifetimeStats, () => getLifetimeStats(''), {
    forceRefresh,
    ttlMs: 10 * 60 * 1000,
  });
}

/* ─── Cached data accessors ─── */

export function getHomeActiveTripCached(): Trip | null | undefined {
  return getCachedData<Trip | null>(KEYS.activeTrip);
}

export function getHomeFlightsCached(tripId: string): Flight[] | undefined {
  return getCachedData<Flight[]>(KEYS.flights(tripId));
}

export function getHomeMomentsCached(tripId: string): Moment[] | undefined {
  return getCachedData<Moment[]>(KEYS.moments(tripId));
}

export function getHomeMembersCached(tripId: string): GroupMember[] | undefined {
  return getCachedData<GroupMember[]>(KEYS.members(tripId));
}

export function getHomePlacesCached(tripId: string): Place[] | undefined {
  return getCachedData<Place[]>(KEYS.places(tripId));
}

export function getHomeExpensesCached(tripId: string) {
  return getCachedData<import('@/lib/types').Expense[]>(KEYS.expenses(tripId));
}

export function getHomeAllTripsCached(): Trip[] | undefined {
  return getCachedData<Trip[]>(KEYS.allTrips);
}

export function getHomeQuickTripsCached(): QuickTrip[] | undefined {
  return getCachedData<QuickTrip[]>(KEYS.quickTrips);
}

export function getHomeLifetimeStatsCached(): LifetimeStats | null | undefined {
  return getCachedData<LifetimeStats | null>(KEYS.lifetimeStats);
}

/* ─── Pre-warm cache (call on app init / sign-in) ─── */

export async function preloadHomeData(): Promise<void> {
  try {
    await getHomeActiveTripPromise();
  } catch {
    // silently fail
  }
}

/* ─── Invalidation ─── */

export function invalidateHomeCache(): void {
  invalidateCache('home:');
}
