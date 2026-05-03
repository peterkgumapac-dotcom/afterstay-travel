/**
 * UserSegmentContext — single source of truth for the user's lifecycle state.
 * Wraps the tab layout so all tabs share segment, profile, and active trip data
 * without each tab independently re-fetching.
 *
 * FIX: Status is now derived from Supabase trips on every launch instead of
 * relying on local cache or the stale profile.userSegment field.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ProfileCompletionSheet } from '@/components/shared/ProfileCompletionSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/lib/auth';
import { cacheGetForUser, cacheSetForUser } from '@/lib/cache';
import {
  deriveUserStatus,
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
  const valid: MockKey[] = [
    'new',
    'profile:missing',
    'profile:incomplete',
    'planning:draft',
    'planning:no_hotel',
    'planning:ready',
    'active:upcoming',
    'active:inflight',
    'active:arrived',
    'active:active',
    'completed:recent',
    'returning',
    'history:quick',
    'cache:empty',
  ];
  if ((valid as string[]).includes(val)) return val as MockKey;
  // Legacy: bare 'planning' → 'planning:draft'
  if (val === 'planning') return 'planning:draft';
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

function userCacheKey(base: string, userId: string): string {
  return `${base}:${userId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getProfileWithRetry(userId: string): Promise<Profile | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const profile = await getProfile(userId).catch(() => null);
    if (profile) return profile;
    if (attempt < 2) await delay(350);
  }
  return null;
}

// ── Provider ─────────────────────────────────────────────────────────

export function UserSegmentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<UserSegmentState, 'refresh'>>(defaultState);
  const [freshProfileChecked, setFreshProfileChecked] = useState(false);
  const mounted = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setFreshProfileChecked(false);
      setState({ ...defaultState, loading: false });
      return;
    }

    const userId = user.id;
    currentUserIdRef.current = userId;
    setFreshProfileChecked(false);
    setState((prev) => (
      prev.profile && prev.profile.id !== userId
        ? { ...defaultState, loading: true }
        : { ...prev, loading: true }
    ));

    // 1. Instant from cache
    const [cachedProfile, cachedSegment, cachedTrip] = await Promise.all([
      cacheGetForUser<Profile>(userCacheKey(CK_PROFILE, userId), userId),
      cacheGetForUser<UserSegment>(userCacheKey(CK_SEGMENT, userId), userId),
      cacheGetForUser<Trip>(userCacheKey(CK_ACTIVE, userId), userId),
    ]);
    const scopedCachedProfile = cachedProfile?.id === userId ? cachedProfile : null;

    if (cachedSegment && mounted.current && currentUserIdRef.current === userId) {
      setState((prev) => ({
        ...prev,
        segment: cachedSegment,
        profile: scopedCachedProfile ?? prev.profile,
        activeTrip: cachedTrip !== undefined ? cachedTrip : prev.activeTrip,
        loading: false,
      }));
    }

    // 2. Fresh from server — derive from actual trip data
    try {
      const [result, profile] = await Promise.all([
        deriveUserStatus(userId),
        getProfileWithRetry(userId),
      ]);
      const resolvedProfile = profile ?? scopedCachedProfile ?? null;

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
        lifetimeStats = await getLifetimeStats(userId).catch(() => null);
      }

      if (!mounted.current || currentUserIdRef.current !== userId) return;
      setFreshProfileChecked(true);

      // When dev override is active, replace trip data with mock data
      let mockData: MockSegmentData | null = null;
      let activeTrip = result.activeTrip;
      let pastTrips = result.completedTrips;
      let draftTrips = result.draftTrips;
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
        profile: resolvedProfile,
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
        resolvedProfile ? cacheSetForUser(userCacheKey(CK_PROFILE, userId), resolvedProfile, userId) : Promise.resolve(),
        cacheSetForUser(userCacheKey(CK_SEGMENT, userId), segment, userId),
        result.activeTrip
          ? cacheSetForUser(userCacheKey(CK_ACTIVE, userId), result.activeTrip, userId)
          : cacheSetForUser(userCacheKey(CK_ACTIVE, userId), null, userId),
      ]);
    } catch (err) {
      if (__DEV__) console.warn('[UserSegment] load failed:', err);
      if (mounted.current && currentUserIdRef.current === userId) {
        setFreshProfileChecked(false);
        setState((prev) => ({
          ...prev,
          loading: false,
          // If fetch fails during test mode, disable it to prevent stale state
          ...(prev.isTestMode ? { isTestMode: false, mockData: null, mockKeyLabel: null } : {}),
        }));
      }
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    mounted.current = true;
    currentUserIdRef.current = user?.id ?? null;
    load();
    return () => { mounted.current = false; };
  }, [load, user?.id]);

  const value: UserSegmentState = {
    ...state,
    refresh: load,
  };

  const needsHandle = freshProfileChecked
    && !state.loading
    && !!user
    && !state.isTestMode
    && !!state.profile
    && !state.profile.handle;
  const displayName = state.profile?.fullName ?? user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '';

  return (
    <Ctx.Provider value={value}>
      {children}
      {needsHandle && (
        <ProfileCompletionSheet
          visible={true}
          userId={user!.id}
          displayName={displayName}
          onComplete={() => {
            // Refresh profile to pick up new handle
            load();
          }}
        />
      )}
    </Ctx.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useUserSegment(): UserSegmentState {
  return useContext(Ctx);
}
