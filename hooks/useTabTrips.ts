import { useCallback } from 'react';
import {
  getCachedPromise,
  getCachedData,
  invalidateTripCache,
} from '@/lib/tabDataCache';
import {
  getActiveTrip,
  getAllUserTrips,
  getPastTrips,
  getLifetimeStats,
  getExpenseSummary,
} from '@/lib/supabase';
import { getQuickTrips } from '@/lib/quickTrips';
import type { Trip, LifetimeStats } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';

/* ─── Keys ─── */
const ACTIVE_TRIP_KEY = 'activeTrip';
const ALL_TRIPS_KEY = 'trips:all';
const PAST_TRIPS_KEY = 'trips:past';
const QUICK_TRIPS_KEY = 'trips:quick';
const LIFETIME_STATS_KEY = 'trips:lifetimeStats';
const EXPENSE_SUMMARY_KEY = 'trips:expenseSummary';

/* ─── Active Trip ─── */

export function getActiveTripPromise(forceRefresh = false) {
  return getCachedPromise<Trip | null>(ACTIVE_TRIP_KEY, getActiveTrip, {
    forceRefresh,
    ttlMs: 2 * 60 * 1000, // 2 min
  });
}

export function getActiveTripCached() {
  return getCachedData<Trip | null>(ACTIVE_TRIP_KEY);
}

/* ─── All Trips ─── */

export function getAllTripsPromise(forceRefresh = false, includeDeleted = false) {
  const key = includeDeleted ? `${ALL_TRIPS_KEY}:withDeleted` : ALL_TRIPS_KEY;
  return getCachedPromise<Trip[]>(key, () => getAllUserTrips(undefined, includeDeleted), {
    forceRefresh,
    ttlMs: 5 * 60 * 1000, // 5 min
  });
}

export function getAllTripsCached(includeDeleted = false) {
  const key = includeDeleted ? `${ALL_TRIPS_KEY}:withDeleted` : ALL_TRIPS_KEY;
  return getCachedData<Trip[]>(key);
}

/* ─── Past Trips ─── */

export function getPastTripsPromise(forceRefresh = false) {
  return getCachedPromise<Trip[]>(PAST_TRIPS_KEY, () => getPastTrips(''), {
    forceRefresh,
    ttlMs: 5 * 60 * 1000,
  });
}

export function getPastTripsCached() {
  return getCachedData<Trip[]>(PAST_TRIPS_KEY);
}

/* ─── Quick Trips ─── */

export function getQuickTripsPromise(forceRefresh = false) {
  return getCachedPromise<QuickTrip[]>(QUICK_TRIPS_KEY, getQuickTrips, {
    forceRefresh,
    ttlMs: 5 * 60 * 1000,
  });
}

export function getQuickTripsCached() {
  return getCachedData<QuickTrip[]>(QUICK_TRIPS_KEY);
}

/* ─── Lifetime Stats ─── */

export function getLifetimeStatsPromise(forceRefresh = false) {
  return getCachedPromise<LifetimeStats | null>(LIFETIME_STATS_KEY, () => getLifetimeStats(), {
    forceRefresh,
    ttlMs: 10 * 60 * 1000, // 10 min
  });
}

export function getLifetimeStatsCached() {
  return getCachedData<LifetimeStats | null>(LIFETIME_STATS_KEY);
}

/* ─── Expense Summary ─── */

export function getExpenseSummaryPromise(tripId?: string, forceRefresh = false) {
  const key = tripId ? `trips:expenseSummary:${tripId}` : EXPENSE_SUMMARY_KEY;
  return getCachedPromise(key, () => getExpenseSummary(tripId), {
    forceRefresh,
    ttlMs: 2 * 60 * 1000,
  });
}

export function getExpenseSummaryCached(tripId?: string) {
  const key = tripId ? `trips:expenseSummary:${tripId}` : EXPENSE_SUMMARY_KEY;
  return getCachedData<{ total: number; byCategory: Record<string, number>; count: number }>(key);
}

/* ─── Helpers ─── */

export function useInvalidateTrips() {
  return useCallback(() => {
    invalidateTripCache();
  }, []);
}
