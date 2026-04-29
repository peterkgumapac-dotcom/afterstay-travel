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
import { getMockDataForKey, parseMockKey, MOCK_LABELS, type MockSegmentData, type MockKey } from '@/lib/mockData';

// ── Context value ────────────────────────────────────────────────────

// ── Dev override (test mode) ─────────────────────────────────────────

const DEV_OVERRIDE_KEY = 'dev:segment-override';
const DEV_ALLOWED_EMAIL = 'peterkgumapac@gmail.com';

/** Set a mock key override for testing. Pass null to clear. */
export async function setSegmentOverride(key: MockKey | null): Promise<void> {
  if (key) {
    await AsyncStorage.setItem(DEV_OVERRIDE_KEY, key);
  } else {
    await AsyncStorage.removeItem(DEV_OVERRIDE_KEY);
  }
}

/** Read the current mock key override (null = no override). */
export async function getSegmentOverride(): Promise<MockKey | null> {
  const val = await AsyncStorage.getItem(DEV_OVERRIDE_KEY);
  if (!val) return null;
  // Validate it's a known mock key
  const valid = ['new', 'planning', 'active:upcoming', 'active:inflight', 'active:arrived', 'active:active', 'returning'];
  if (valid.includes(val)) return val as MockKey;
  // Legacy: bare 'active' → 'active:active'
  if (val === 'active') return 'active:active';
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
  /** Mock data for the active test segment (null when not in test mode) */
  mockData: MockSegmentData | null;
  /** The active mock key label (null when not in test mode) */
  mockKeyLabel: string | null;
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
  mockData: null,
  mockKeyLabel: null,
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
      let mockKey: MockKey | null = null;
      if (user.email === DEV_ALLOWED_EMAIL) {
        mockKey = await getSegmentOverride();
        if (mockKey) {
          const parsed = parseMockKey(mockKey);
          segment = parsed.segment;
          isTestMode = true;
        }
      } else {
        // Clear test mode if email is no longer whitelisted
        await setSegmentOverride(null);
      }

      // Fetch lifetime stats for returning users
      let lifetimeStats: LifetimeStats | null = null;
      if (realSegment !== 'new') {
        lifetimeStats = await getLifetimeStats(user.id).catch(() => null);
      }

      if (!mounted.current) return;

      // When dev override is active, replace trip data with mock data
      let mockData: MockSegmentData | null = null;
      let activeTrip = result.activeTrip;
      let pastTrips = result.completedTrips;
      let draftTrips = result.planningTrips;
      let finalStats = lifetimeStats;

      if (isTestMode && mockKey) {
        mockData = getMockDataForKey(mockKey);
        activeTrip = mockData.trip;
        pastTrips = mockData.pastTrips;
        draftTrips = mockData.draftTrips;
        finalStats = mockData.lifetimeStats;
      }

      setState({
        segment,
        profile,
        activeTrip,
        pastTrips,
        draftTrips,
        lifetimeStats: finalStats,
        loading: false,
        isTestMode,
        mockData,
        mockKeyLabel: mockKey ? MOCK_LABELS[mockKey] : null,
      });

      // Update cache
      await Promise.all([
        profile ? cacheSet(CK_PROFILE, profile) : Promise.resolve(),
        cacheSet(CK_SEGMENT, segment),
        result.activeTrip
          ? cacheSet(CK_ACTIVE, result.activeTrip)
          : cacheSet(CK_ACTIVE, null),
      ]);
    } catch (err) {
      if (__DEV__) console.warn('[UserSegment] load failed:', err);
      if (mounted.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          // If fetch fails during test mode, disable it to prevent stale state
          ...(prev.isTestMode ? { isTestMode: false, mockData: null, mockKeyLabel: null } : {}),
        }));
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
