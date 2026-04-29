import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAllUserTrips, supabase } from './supabase';
import type { Trip } from './types';

export type UserStatus =
  | 'new'       // No trips ever
  | 'planning'  // Has planning trip
  | 'active'    // Has active trip
  | 'completed' // Just completed (within 24h)
  | 'returning'; // Has completed trips, no active/planning

const CACHE_KEY = '@user_status';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface StatusResult {
  status: UserStatus;
  activeTrip: Trip | null;
  completedTrips: Trip[];
  planningTrips: Trip[];
  draftTrips: Trip[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Derive the user's lifecycle status from Supabase trips.
 * ALWAYS fetches from Supabase first — local cache is only used as offline fallback.
 *
 * Retries twice on both empty results AND errors — auth token race on cold start
 * can cause RLS to reject queries briefly after app launch.
 */
export async function deriveUserStatus(userId: string): Promise<StatusResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt === 1 ? 800 : 1500;
      console.log(`[deriveUserStatus] attempt ${attempt + 1}/${3} after ${delay}ms delay`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      // Ensure Supabase auth is ready before querying
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        console.log(`[deriveUserStatus] auth not ready on attempt ${attempt + 1}`);
        lastError = authError ?? new Error('Auth not ready');
        continue;
      }

      const trips = await getAllUserTrips(userId);
      console.log(`[deriveUserStatus] attempt ${attempt + 1}: ${trips.length} trips`);

      if (trips.length === 0 && attempt < 2) {
        // Might be auth race — retry
        continue;
      }

      const activeTrips = trips.filter(
        (t) => t.status === 'Active' && !t.deletedAt && !t.archivedAt,
      );
      const activeTrip = activeTrips[0] || null;

      const planningTrips = trips.filter(
        (t) =>
          t.status === 'Planning' && !t.deletedAt && !t.archivedAt && !t.isDraft,
      );

      const draftTrips = trips.filter(
        (t) => t.isDraft === true && !t.deletedAt,
      );

      const completedTrips = trips
        .filter((t) => t.status === 'Completed' && !t.deletedAt)
        .sort(
          (a, b) =>
            new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
        );

      let status: UserStatus;

      if (activeTrip) {
        status = 'active';
      } else if (planningTrips.length > 0) {
        status = 'planning';
      } else if (completedTrips.length > 0) {
        const lastCompleted = completedTrips[0];
        const hoursSinceCompletion =
          (Date.now() - new Date(lastCompleted.endDate).getTime()) / 3_600_000;
        status = hoursSinceCompletion < 24 ? 'completed' : 'returning';
      } else if (draftTrips.length > 0) {
        status = 'planning'; // User has a draft — still in planning phase
      } else {
        status = 'new';
      }

      const result: StatusResult = {
        status,
        activeTrip,
        completedTrips,
        planningTrips,
        draftTrips,
        isLoading: false,
        error: null,
      };

      // Cache for offline fallback
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ...result, cachedAt: Date.now() }),
      );

      console.log(`[deriveUserStatus] final status: ${status}`);
      return result;
    } catch (error) {
      console.log(`[deriveUserStatus] attempt ${attempt + 1} error:`, error);
      lastError = error as Error;
    }
  }

  // All attempts failed — fallback to cache or 'new'
  console.log('[deriveUserStatus] all attempts failed, falling back');
  const cached = await getCachedStatus();
  if (cached) {
    return { ...cached, isLoading: false, error: lastError };
  }
  return {
    status: 'new',
    activeTrip: null,
    completedTrips: [],
    planningTrips: [],
    draftTrips: [],
    isLoading: false,
    error: lastError,
  };
}

async function getCachedStatus(): Promise<StatusResult | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Force a refresh — call after trip creation / completion / archive. */
export async function refreshUserStatus(userId: string): Promise<StatusResult> {
  await AsyncStorage.removeItem(CACHE_KEY);
  return deriveUserStatus(userId);
}
