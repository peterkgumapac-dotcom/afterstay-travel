/**
 * UserSegmentContext — single source of truth for the user's lifecycle state.
 * Wraps the tab layout so all tabs share segment, profile, and active trip data
 * without each tab independently re-fetching.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  getActiveTrip,
  getAllUserTrips,
  getLifetimeStats,
  getProfile,
  type Profile,
} from '@/lib/supabase';
import type { LifetimeStats, Trip, UserSegment } from '@/lib/types';

// ── Context value ────────────────────────────────────────────────────

interface UserSegmentState {
  /** The user's lifecycle segment — derived from the DB profile */
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
  refresh: async () => {},
};

const Ctx = createContext<UserSegmentState>(defaultState);

// ── Cache keys ───────────────────────────────────────────────────────

const CK_PROFILE = 'userseg:profile';
const CK_SEGMENT = 'userseg:segment';
const CK_ACTIVE = 'userseg:active-trip';

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

    // 2. Fresh from server
    try {
      const [profile, active] = await Promise.all([
        getProfile(user.id),
        getActiveTrip().catch(() => null),
      ]);

      const segment: UserSegment = profile?.userSegment ?? (active ? 'active' : 'new');

      // Always fetch all trips + stats — drafts and past trips must be
      // available even when an active trip exists ( ReturningUserHome )
      const [allTrips, stats] = await Promise.all([
        getAllUserTrips('').catch(() => [] as Trip[]),
        getLifetimeStats('').catch(() => null),
      ]);
      const pastTrips = allTrips.filter((t) => t.status === 'Completed');
      const draftTrips = allTrips.filter((t) => t.status === 'Planning');
      const lifetimeStats = stats;

      if (!mounted.current) return;

      setState({
        segment,
        profile,
        activeTrip: active,
        pastTrips,
        draftTrips,
        lifetimeStats,
        loading: false,
      });

      // Update cache
      await Promise.all([
        cacheSet(CK_PROFILE, profile),
        cacheSet(CK_SEGMENT, segment),
        active ? cacheSet(CK_ACTIVE, active) : cacheSet(CK_ACTIVE, null),
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
