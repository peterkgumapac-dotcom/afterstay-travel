import { useCallback } from 'react';
import {
  getCachedPromise,
  getCachedData,
  invalidateCache,
} from '@/lib/tabDataCache';
import { getMoments, getGroupMembers, getSavedPlaces } from '@/lib/supabase';
import type { Moment, GroupMember, Place } from '@/lib/types';

/* ─── Keys ─── */
const momentsKey = (tripId: string) => `moments:${tripId}`;
const membersKey = (tripId: string) => `members:${tripId}`;
const placesKey = (tripId: string) => `places:${tripId}`;
const LOAD_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), LOAD_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, () => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

/* ─── Moments ─── */

export function getMomentsPromise(tripId: string | undefined, forceRefresh = false) {
  if (!tripId) return Promise.resolve([] as Moment[]);
  return getCachedPromise<Moment[]>(momentsKey(tripId), () => getMoments(tripId), {
    forceRefresh,
    ttlMs: 3 * 60 * 1000, // 3 min
  });
}

export function getMomentsCached(tripId: string | undefined): Moment[] | undefined {
  if (!tripId) return undefined;
  return getCachedData<Moment[]>(momentsKey(tripId));
}

/* ─── Group Members ─── */

export function getGroupMembersPromise(tripId: string | undefined, forceRefresh = false) {
  if (!tripId) return Promise.resolve([] as GroupMember[]);
  return getCachedPromise<GroupMember[]>(membersKey(tripId), () => getGroupMembers(tripId), {
    forceRefresh,
    ttlMs: 5 * 60 * 1000,
  });
}

export function getGroupMembersCached(tripId: string | undefined): GroupMember[] | undefined {
  if (!tripId) return undefined;
  return getCachedData<GroupMember[]>(membersKey(tripId));
}

/* ─── Saved Places ─── */

export function getSavedPlacesPromise(tripId: string | undefined, forceRefresh = false) {
  if (!tripId) return Promise.resolve([] as Place[]);
  return getCachedPromise<Place[]>(placesKey(tripId), () => getSavedPlaces(tripId), {
    forceRefresh,
    ttlMs: 3 * 60 * 1000,
  });
}

export function getSavedPlacesCached(tripId: string | undefined): Place[] | undefined {
  if (!tripId) return undefined;
  return getCachedData<Place[]>(placesKey(tripId));
}

/* ─── Combined loader for a trip ─── */

export interface TripMomentsData {
  moments: Moment[];
  members: GroupMember[];
  places: Place[];
}

export async function loadTripMomentsData(
  tripId: string,
  forceRefresh = false
): Promise<TripMomentsData> {
  const [moments, members, places] = await Promise.all([
    withTimeout(getMomentsPromise(tripId, forceRefresh), [] as Moment[]),
    withTimeout(getGroupMembersPromise(tripId, forceRefresh), [] as GroupMember[]),
    withTimeout(getSavedPlacesPromise(tripId, forceRefresh), [] as Place[]),
  ]);
  return { moments, members, places };
}

export function getTripMomentsDataCached(tripId: string): Partial<TripMomentsData> {
  return {
    moments: getMomentsCached(tripId),
    members: getGroupMembersCached(tripId),
    places: getSavedPlacesCached(tripId),
  };
}

/* ─── Helpers ─── */

export function useInvalidateMoments() {
  return useCallback((tripId?: string) => {
    if (tripId) {
      invalidateCache(`moments:${tripId}`);
      invalidateCache(`members:${tripId}`);
      invalidateCache(`places:${tripId}`);
    } else {
      invalidateCache('moments:');
      invalidateCache('members:');
      invalidateCache('places:');
    }
  }, []);
}
