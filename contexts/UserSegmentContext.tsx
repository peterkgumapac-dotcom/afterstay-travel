/**
 * UserSegmentContext — single source of truth for the user's lifecycle state.
 * Wraps the tab layout so all tabs share segment, profile, and active trip data
 * without each tab independently re-fetching.
 *
 * FIX: Status is now derived from Supabase trips on every launch instead of
 * relying on local cache or the stale profile.userSegment field.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/lib/auth';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  deriveUserStatus,
  refreshUserStatus,
  type UserStatus,
} from '@/lib/userStatus';
import { getLifetimeStats, getProfile, type Profile } from '@/lib/supabase';
import type { LifetimeStats, Trip, UserSegment } from '@/lib/types';

// ── Context value ────────────────────────────────────────────────────

// ── Dev override (test mode) ─────────────────────────────────────────

const DEV_OVERRIDE_KEY = 'dev:segment-override';
const DEV_ALLOWED_EMAIL = 'peterkgumapac@gmail.com';

/** Set a segment override for testing. Pass null to clear. */
export async function setSegmentOverride(segment: UserSegment | null): Promise<void> {
  if (segment) {
    await AsyncStorage.setItem(DEV_OVERRIDE_KEY, segment);
  } else {
    await AsyncStorage.removeItem(DEV_OVERRIDE_KEY);
  }
}

/** Read the current segment override (null = no override). */
export async function getSegmentOverride(): Promise<UserSegment | null> {
  const val = await AsyncStorage.getItem(DEV_OVERRIDE_KEY);
  if (val && ['new', 'planning', 'active', 'returning'].includes(val)) {
    return val as UserSegment;
  }
  return null;
}

// ── Context value ────────────────────────────────────────────────────

interface UserSegmentState {
  /** The user's lifecycle segment — derived from Supabase trips */
  segment: UserSegment;
  /** Full profile (includes tripCount, completedTripCount, etc.) */
  profile: Profile | null;
  /** The user's current active/planning trip (null if none) */
  activeTrip: Trip | null;
  /** All completed trips */
  pastTrips: Trip[];
  /** Trips in 'Planning' status (drafts) */
  draftTrips: Trip[];
  /** Lifetime aggregate stats */
  lifetimeStats: LifetimeStats | null;
  /** True during initial load */
  loading: boolean;
  /** True when a dev override is active */
  isTestMode: boolean;
  /** Re-fetch everything (e.g. after creating a trip) */
  refresh: () => Promise<void>;
}

const defaultState: UserSegmentState = {
  segment: 'new',
  profile: null,
  activeTrip: null,
  pastTrips: [],
  draftTrips: [],
  lifetimeStats: null,
  loading: true,
  isTestMode: false,
  refresh: async () => {},
};

const Ctx = createContext<UserSegmentState>(defaultState);

// ── Cache keys ───────────────────────────────────────────────────────

const CK_PROFILE = 'userseg:profile';
const CK_SEGMENT = 'userseg:segment';
const CK_ACTIVE = 'userseg:active-trip';

// ── Helpers ──────────────────────────────────────────────────────────

function toSegment(status: UserStatus): UserSegment {
  return status === 'completed' ? 'returning' : status;
}

// ── Provider ─────────────────────────────────────────────────────────

export function UserSegmentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<UserSegmentState, 'refresh'>>(defaultState);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({ ...defaultState, loading: false });
      return;
    }

    // 1. Instant from cache
    const [cachedProfile, cachedSegment, cachedTrip] = await Promise.all([
      cacheGet<Profile>(CK_PROFILE),
      cacheGet<UserSegment>(CK_SEGMENT),
      cacheGet<Trip>(CK_ACTIVE),
    ]);

    if (cachedSegment && mounted.current) {
      setState((prev) => ({
        ...prev,
        segment: cachedSegment,
        profile: cachedProfile ?? prev.profile,
        activeTrip: cachedTrip ?? prev.activeTrip,
        loading: false,
      }));
    }

    // 2. Fresh from server — derive from actual trip data
    try {
      const [result, profile] = await Promise.all([
        deriveUserStatus(user.id),
        getProfile(user.id).catch(() => null),
      ]);

      const realSegment = toSegment(result.status);

      // Check for dev override (only for allowed email)
      let segment = realSegment;
      let isTestMode = false;
      if (user.email === DEV_ALLOWED_EMAIL) {
        const override = await getSegmentOverride();
        if (override) {
          segment = override;
          isTestMode = true;
        }
      }

      // Fetch lifetime stats for returning users
      let lifetimeStats: LifetimeStats | null = null;
      if (realSegment !== 'new') {
        lifetimeStats = await getLifetimeStats(user.id).catch(() => null);
      }

      if (!mounted.current) return;

      setState({
        segment,
        profile,
        activeTrip: result.activeTrip,
        pastTrips: result.completedTrips,
        draftTrips: result.planningTrips,
        lifetimeStats,
        loading: false,
        isTestMode,
      });

      // Update cache
      await Promise.all([
        profile ? cacheSet(CK_PROFILE, profile) : Promise.resolve(),
        cacheSet(CK_SEGMENT, segment),
        result.activeTrip
          ? cacheSet(CK_ACTIVE, result.activeTrip)
          : cacheSet(CK_ACTIVE, null),
      ]);
    } catch {
      if (mounted.current) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, [user?.id]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  const value: UserSegmentState = {
    ...state,
    refresh: load,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useUserSegment(): UserSegmentState {
  return useContext(Ctx);
}
