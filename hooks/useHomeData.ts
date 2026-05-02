/**
 * Cache-first data layer for the Home screen.
 *
 * Pattern:
 *   getXxxCached()  → instant cache read (undefined if miss)
 *   getXxxPromise() → fetch + cache write
 *
 * Uses React Query under the hood for background revalidation.
 */
import { queryClient } from '@/lib/queryClient';
import {
  getActiveTrip,
  getAllUserTrips,
  getFlights,
  getMoments,
  getGroupMembers,
  getSavedPlaces,
  getExpenses,
  getLifetimeStats,
} from '@/lib/supabase';
import { getQuickTrips } from '@/lib/quickTrips';
import type { Trip, Flight, Moment, GroupMember, Place, Expense, LifetimeStats } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';

/* ------------------------------------------------------------------ */
// Query keys (must match hooks/useTrips.ts)
/* ------------------------------------------------------------------ */

const keys = {
  activeTrip: ['trips', 'active'],
  allTrips: ['trips', 'list'],
  flights: (tripId: string) => ['flights', tripId],
  moments: (tripId: string) => ['moments', 'trip', tripId],
  members: (tripId: string) => ['members', tripId],
  places: (tripId: string) => ['places', tripId],
  expenses: (tripId: string) => ['expenses', tripId],
  quickTrips: ['quickTrips'],
  lifetimeStats: ['lifetimeStats'],
};

/* ------------------------------------------------------------------ */
// Active Trip
/* ------------------------------------------------------------------ */

export function getHomeActiveTripCached(): Trip | null | undefined {
  return queryClient.getQueryData<Trip | null>(keys.activeTrip);
}

export async function getHomeActiveTripPromise(force = false): Promise<Trip | null> {
  const data = await queryClient.fetchQuery({
    queryKey: keys.activeTrip,
    queryFn: () => getActiveTrip(force),
    staleTime: force ? 0 : 1000 * 60 * 2,
  });
  return data;
}

/* ------------------------------------------------------------------ */
// All Trips
/* ------------------------------------------------------------------ */

export function getHomeAllTripsCached(): Trip[] | undefined {
  return queryClient.getQueryData<Trip[]>(keys.allTrips);
}

export async function getHomeAllTripsPromise(force = false): Promise<Trip[]> {
  return queryClient.fetchQuery({
    queryKey: keys.allTrips,
    queryFn: () => getAllUserTrips(),
    staleTime: force ? 0 : 1000 * 60 * 5,
  });
}

/* ------------------------------------------------------------------ */
// Flights
/* ------------------------------------------------------------------ */

export function getHomeFlightsCached(tripId: string): Flight[] | undefined {
  return queryClient.getQueryData<Flight[]>(keys.flights(tripId));
}

export async function getHomeFlightsPromise(tripId: string, force = false): Promise<Flight[]> {
  return queryClient.fetchQuery({
    queryKey: keys.flights(tripId),
    queryFn: () => getFlights(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

/* ------------------------------------------------------------------ */
// Moments
/* ------------------------------------------------------------------ */

export function getHomeMomentsCached(tripId: string): Moment[] | undefined {
  return queryClient.getQueryData<Moment[]>(keys.moments(tripId));
}

export async function getHomeMomentsPromise(tripId: string, force = false): Promise<Moment[]> {
  return queryClient.fetchQuery({
    queryKey: keys.moments(tripId),
    queryFn: () => getMoments(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

/* ------------------------------------------------------------------ */
// Group Members
/* ------------------------------------------------------------------ */

export function getHomeMembersCached(tripId: string): GroupMember[] | undefined {
  return queryClient.getQueryData<GroupMember[]>(keys.members(tripId));
}

export async function getHomeMembersPromise(tripId: string, force = false): Promise<GroupMember[]> {
  return queryClient.fetchQuery({
    queryKey: keys.members(tripId),
    queryFn: () => getGroupMembers(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

/* ------------------------------------------------------------------ */
// Saved Places
/* ------------------------------------------------------------------ */

export function getHomePlacesCached(tripId: string): Place[] | undefined {
  return queryClient.getQueryData<Place[]>(keys.places(tripId));
}

export async function getHomePlacesPromise(tripId: string, force = false): Promise<Place[]> {
  return queryClient.fetchQuery({
    queryKey: keys.places(tripId),
    queryFn: () => getSavedPlaces(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

/* ------------------------------------------------------------------ */
// Expenses
/* ------------------------------------------------------------------ */

export function getHomeExpensesCached(tripId: string): Expense[] | undefined {
  return queryClient.getQueryData<Expense[]>(keys.expenses(tripId));
}

export async function getHomeExpensesPromise(tripId: string, force = false): Promise<Expense[]> {
  return queryClient.fetchQuery({
    queryKey: keys.expenses(tripId),
    queryFn: () => getExpenses(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

/* ------------------------------------------------------------------ */
// Quick Trips
/* ------------------------------------------------------------------ */

export function getHomeQuickTripsCached(): QuickTrip[] | undefined {
  return queryClient.getQueryData<QuickTrip[]>(keys.quickTrips);
}

export async function getHomeQuickTripsPromise(force = false): Promise<QuickTrip[]> {
  return queryClient.fetchQuery({
    queryKey: keys.quickTrips,
    queryFn: () => getQuickTrips(),
    staleTime: force ? 0 : 1000 * 60 * 5,
  });
}

/* ------------------------------------------------------------------ */
// Lifetime Stats
/* ------------------------------------------------------------------ */

export function getHomeLifetimeStatsCached(): LifetimeStats | null | undefined {
  return queryClient.getQueryData<LifetimeStats | null>(keys.lifetimeStats);
}

export async function getHomeLifetimeStatsPromise(force = false): Promise<LifetimeStats | null> {
  return queryClient.fetchQuery({
    queryKey: keys.lifetimeStats,
    queryFn: () => getLifetimeStats(),
    staleTime: force ? 0 : 1000 * 60 * 5,
  });
}
