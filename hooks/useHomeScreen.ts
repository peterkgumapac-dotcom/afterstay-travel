/**
 * useHomeScreen — all state, data fetching, caching, and test-mode logic
 * for the Home screen. The component becomes pure render.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { useAuth } from '@/lib/auth';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { writeWidgetSnapshots, refreshAllWidgets } from '@/widgets/refresh';
import { cacheGet, cacheGetForUser, cacheSet, cacheSetForUser } from '@/lib/cache';
import {
  getDailyTrackerEnabled,
  getDailyExpenseSummary,
} from '@/lib/supabase';
import {
  getHomeActiveTripPromise,
  getHomeActiveTripCached,
  getHomeFlightsCached,
  getHomeMomentsCached,
  getHomeMembersCached,
  getHomePlacesCached,
  getHomeExpensesCached,
  getHomeAllTripsCached,
  getHomeQuickTripsCached,
  getHomeLifetimeStatsCached,
  getHomeAllTripsPromise,
  getHomeQuickTripsPromise,
  getHomeLifetimeStatsPromise,
  getHomeFlightsPromise,
  getHomeMomentsPromise,
  getHomeMembersPromise,
  getHomePlacesPromise,
  getHomeExpensesPromise,
} from '@/hooks/useTabHomeData';
import { fetchDestinationPhotos } from '@/lib/google-places';
import { pickHomeLoadedTrip, pickHomeSeedTrip } from '@/lib/homeStartup';
import { resolveTripMediaLocation } from '@/lib/tripMedia';
import { filterRenderableImageUrls } from '@/lib/imageUrl';
import { setHotelCoords } from '@/lib/config';
import {
  computeTripPhase,
  selectReturnFlight,
  selectUserOutboundFlight,
  type TripPhase,
} from '@/lib/tripState';
import type { Flight, GroupMember, LifetimeStats, Moment, Place, Trip } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';

export type { TripPhase } from '@/lib/tripState';

function resolveHeroLocation(trip: Trip | null, flights: Flight[]) {
  return resolveTripMediaLocation(trip, flights).query;
}

function destinationPhotoCacheKey(destination: string) {
  return `hero:destination-photos:v5:${destination.trim().toLowerCase()}`;
}

const HOME_REQUEST_TIMEOUT_MS = 10000;
const HOME_SLOW_REQUEST_TIMEOUT_MS = 15000;
const HOME_PERSISTED_SEED_TTL_MS = 5 * 60 * 1000;

function splitTripsByLifecycle(allTripsData: Trip[]) {
  return {
    pastTrips: allTripsData.filter(tr => tr.status === 'Completed' && !tr.deletedAt),
    draftTrips: allTripsData.filter(tr => tr.isDraft === true && !tr.deletedAt),
    upcomingTrips: allTripsData.filter(tr => tr.status === 'Planning' && !tr.isDraft && !tr.deletedAt && !tr.archivedAt),
    activeTrips: allTripsData.filter(tr => tr.status === 'Active' && !tr.deletedAt && !tr.archivedAt),
  };
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = HOME_REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
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

type TimedValue<T> =
  | { status: 'ok'; value: T }
  | { status: 'timeout' }
  | { status: 'error'; error: unknown };

type HomeProfileIdentity = {
  fullName?: string | null;
  avatarUrl?: string | null;
};

type HomeAuthIdentity = {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

function resolveAuthIdentity(profile: HomeProfileIdentity | null, user: HomeAuthIdentity | null | undefined) {
  const fullName = profile?.fullName ?? user?.user_metadata?.full_name ?? '';
  const name = fullName.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || '';
  const avatarUrl = profile?.avatarUrl ?? user?.user_metadata?.avatar_url ?? undefined;
  return { name, avatarUrl };
}

function withTimeoutStatus<T>(promise: Promise<T>, ms = HOME_REQUEST_TIMEOUT_MS): Promise<TimedValue<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'timeout' }), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ status: 'ok', value });
      },
      (error) => {
        clearTimeout(timer);
        resolve({ status: 'error', error });
      },
    );
  });
}

export function useHomeScreen() {
  const { user } = useAuth();
  const {
    segment,
    isTestMode,
    mockData,
    activeTrip: segmentActiveTrip,
    pastTrips: segmentPastTrips,
    draftTrips: segmentDraftTrips,
    loading: segmentLoading,
  } = useUserSegment();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;
  const didInitialLoad = useRef(false);
  const lastFocusRefreshAt = useRef(0);
  const loadSeq = useRef(0);
  const userRef = useRef(user);
  const segmentActiveTripRef = useRef<Trip | null>(segmentActiveTrip ?? null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    segmentActiveTripRef.current = segmentActiveTrip ?? null;
  }, [segmentActiveTrip]);

  // ── Raw state ──
  const [_rawTrip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [_rawPhase, setPhaseRaw] = useState<TripPhase>('upcoming');
  const [hasPhaseOverride, setHasPhaseOverride] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [dailyTrackerOn, setDailyTrackerOn] = useState(false);
  const [dailyTrackerTotal, setDailyTrackerTotal] = useState(0);
  const [dailyTrackerCount, setDailyTrackerCount] = useState(0);
  const [dailyTrackerByCat, setDailyTrackerByCat] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string>();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [rPastTrips, setRPastTrips] = useState<Trip[]>([]);
  const [rDraftTrips, setRDraftTrips] = useState<Trip[]>([]);
  const [rUpcomingTrips, setRUpcomingTrips] = useState<Trip[]>([]);
  const [rActiveTrips, setRActiveTrips] = useState<Trip[]>([]);
  const [rQuickTrips, setRQuickTrips] = useState<QuickTrip[]>([]);
  const [rMoments, setRMoments] = useState<Moment[]>([]);
  const [rMembers, setRMembers] = useState<GroupMember[]>([]);
  const [rSavedPlaces, setRSavedPlaces] = useState<Place[]>([]);
  const [rStats, setRStats] = useState<LifetimeStats | null>(null);
  const [rAllTrips, setRAllTrips] = useState<Trip[]>([]);
  const [debugInfo, setDebugInfo] = useState('');

  // React "reset state on prop change" pattern. The auth `user.id` flips
  // before our useEffect cleanup runs, so without this the next render
  // would show the previous account's data (greeting, trip card, members,
  // moments, lifetime stats…) for one frame after switching accounts —
  // the "Hey Peter" residue. Setting state during render makes React
  // discard the in-progress render and re-run with cleared state, so the
  // stale data never reaches the screen.
  const [accountBoundUserId, setAccountBoundUserId] = useState<string | undefined>(user?.id);
  if (accountBoundUserId !== user?.id) {
    setAccountBoundUserId(user?.id);
    setUserName('');
    setUserAvatar(undefined);
    setTrip(null);
    setFlights([]);
    setMoments([]);
    setMembers([]);
    setSavedPlaces([]);
    setTotalSpent(0);
    setTodaySpent(0);
    setTodayCount(0);
    setRPastTrips([]);
    setRDraftTrips([]);
    setRUpcomingTrips([]);
    setRActiveTrips([]);
    setRQuickTrips([]);
    setRMoments([]);
    setRMembers([]);
    setRSavedPlaces([]);
    setRStats(null);
    setRAllTrips([]);
    setDebugInfo('');
    setError(undefined);
  }

  // ── Derived (test-mode-aware — use these for ALL rendering) ──
  const trip = isTestMode ? (mockData?.trip ?? null) : _rawTrip;
  const phase: TripPhase = isTestMode && mockData?.tripPhase ? (mockData.tripPhase as TripPhase) : _rawPhase;
  const pastTrips = isTestMode ? (mockData?.pastTrips ?? []) as Trip[] : rPastTrips;
  const draftTrips = isTestMode ? (mockData?.draftTrips ?? []) as Trip[] : rDraftTrips;
  const upcomingTrips = isTestMode ? [] as Trip[] : rUpcomingTrips;
  const activeTrips = isTestMode ? (trip ? [trip] : []) : rActiveTrips;
  const quickTrips = isTestMode ? [] as QuickTrip[] : rQuickTrips;
  const allTrips = isTestMode ? [...pastTrips, ...draftTrips, ...(trip ? [trip] : [])] : rAllTrips;
  const lifetimeStats = isTestMode ? (mockData?.lifetimeStats ?? null) : rStats;

  const isPlaneTransport = !trip?.transport || trip?.transport === 'plane';
  const showFlightFeatures = isPlaneTransport || flights.length > 0;

  // ── Hotel photos ──
  const parsedHotelPhotos = useMemo(() => {
    if (!_rawTrip?.hotelPhotos) return [];
    try {
      const p = JSON.parse(_rawTrip.hotelPhotos);
      return Array.isArray(p) ? filterRenderableImageUrls(p.filter((u: unknown): u is string => typeof u === 'string')) : [];
    } catch { return []; }
  }, [_rawTrip?.hotelPhotos]);
  const coverPhotos = useMemo(() => {
    const url = _rawTrip?.heroImageUrl?.trim();
    return url ? filterRenderableImageUrls([url]) : [];
  }, [_rawTrip?.heroImageUrl]);

  const [destPhotos, setDestPhotos] = useState<string[]>([]);
  const destPhotoKeyRef = useRef<string | null>(null);
  const heroLocation = useMemo(
    () => resolveHeroLocation(_rawTrip, flights),
    [_rawTrip, flights],
  );
  useEffect(() => {
    if (parsedHotelPhotos.length > 0 || coverPhotos.length > 0) {
      setDestPhotos([]);
      destPhotoKeyRef.current = null;
      return;
    }
    if (!heroLocation) {
      setDestPhotos([]);
      destPhotoKeyRef.current = null;
      return;
    }
    let cancelled = false;
    const cacheKey = destinationPhotoCacheKey(heroLocation);
    (async () => {
      const cached = await cacheGet<string[]>(cacheKey);
      const cachedPhotos = filterRenderableImageUrls(cached ?? []);
      if (cachedPhotos.length && !cancelled) {
        destPhotoKeyRef.current = cacheKey;
        setDestPhotos(cachedPhotos);
        return;
      }
      const photos = filterRenderableImageUrls(await withTimeout(
        fetchDestinationPhotos(heroLocation),
        [] as string[],
        HOME_REQUEST_TIMEOUT_MS,
      ));
      if (!cancelled && photos.length > 0) {
        destPhotoKeyRef.current = cacheKey;
        setDestPhotos(photos);
        await cacheSet(cacheKey, photos);
      } else if (!cancelled && destPhotoKeyRef.current !== cacheKey) {
        setDestPhotos([]);
      }
    })();
    return () => { cancelled = true; };
  }, [coverPhotos.length, heroLocation, parsedHotelPhotos.length]);

  const hotelPhotos =
    parsedHotelPhotos.length > 0 ? parsedHotelPhotos :
    coverPhotos.length > 0 ? coverPhotos :
    destPhotos;

  const clearActiveTripSurface = useCallback(() => {
    setTrip(null);
    setFlights([]);
    setMoments([]);
    setMembers([]);
    setSavedPlaces([]);
    setHotelCoords(0, 0);
    setTotalSpent(0);
    setTodaySpent(0);
    setTodayCount(0);
    const currentUserId = userRef.current?.id;
    if (currentUserId) cacheSetForUser('trip:active', null, currentUserId).catch(() => {});
  }, []);

  const resetHomeSurface = useCallback(() => {
    loadSeq.current += 1;
    clearActiveTripSurface();
    setRPastTrips([]);
    setRDraftTrips([]);
    setRUpcomingTrips([]);
    setRActiveTrips([]);
    setRQuickTrips([]);
    setRMoments([]);
    setRMembers([]);
    setRSavedPlaces([]);
    setRStats(null);
    setRAllTrips([]);
    setDailyTrackerOn(false);
    setDailyTrackerTotal(0);
    setDailyTrackerCount(0);
    setDailyTrackerByCat({});
    setUserName('');
    setUserAvatar(undefined);
    setDebugInfo('');
    setHistoryHydrated(false);
    setError(undefined);
  }, [clearActiveTripSurface]);

  useEffect(() => {
    didInitialLoad.current = false;
    lastFocusRefreshAt.current = 0;
    resetHomeSurface();
    setLoading(!isTestMode);
    setRefreshing(false);
  }, [isTestMode, resetHomeSurface, user?.id]);

  // ── Main loader ──
  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    if (testModeRef.current) { setLoading(false); setRefreshing(false); return; }
    const { force = false, silent = false } = opts ?? {};
    const seq = ++loadSeq.current;
    const requestUserId = userRef.current?.id;
    const isCurrentRequest = () => loadSeq.current === seq && userRef.current?.id === requestUserId;
    try {
      if (!silent) {
        setLoading(true);
        setHistoryHydrated(false);
      }
      setError(undefined);

      const allTripsPromise = withTimeout(
        getHomeAllTripsPromise(force),
        [] as Trip[],
        HOME_SLOW_REQUEST_TIMEOUT_MS,
      );
      const quickTripsPromise = withTimeout(getHomeQuickTripsPromise(force), [] as QuickTrip[]);
      const lifetimeStatsPromise = withTimeout(getHomeLifetimeStatsPromise(force), null);

      const currentUser = userRef.current;
      const profilePromise = currentUser
        ? import('@/lib/supabase')
          .then(({ getProfile }) => withTimeout(getProfile(currentUser.id), null as HomeProfileIdentity | null))
          .catch(() => null as HomeProfileIdentity | null)
        : Promise.resolve(null as HomeProfileIdentity | null);
      const fetchedTrip = await withTimeout(getHomeActiveTripPromise(force), null as Trip | null);
      const t = pickHomeLoadedTrip(fetchedTrip, segmentActiveTripRef.current, force);
      if (!isCurrentRequest()) return;
      if (t) {
        setTrip(t);
        if (requestUserId) await cacheSetForUser('trip:active', t, requestUserId);
        if (t.hotelLat && t.hotelLng) setHotelCoords(t.hotelLat, t.hotelLng);
      } else {
        clearActiveTripSurface();
      }

      if (t) {
        const [fs, mems] = await Promise.all([
          withTimeout(getHomeFlightsPromise(t.id, force), [] as Flight[]),
          withTimeout(getHomeMembersPromise(t.id, force), [] as GroupMember[]),
        ]);
        if (!isCurrentRequest()) return;
        setFlights(fs); setMembers(mems);
        if (requestUserId) await cacheSetForUser(`flights:${t.id}`, fs, requestUserId);

        const cachedTid = requestUserId ? await cacheGetForUser<string>('trip:phase:tripId', requestUserId, 0) : undefined;
        if (requestUserId && cachedTid && cachedTid !== t.id) await cacheSetForUser('trip:phase:override', null, requestUserId);
        if (requestUserId) await cacheSetForUser('trip:phase:tripId', t.id, requestUserId);
        const manualPhase = requestUserId ? await cacheGetForUser<TripPhase | null>('trip:phase:override', requestUserId, 0) : null;
        setHasPhaseOverride(!!manualPhase);
        setPhaseRaw(computeTripPhase({
          trip: t,
          flights: fs,
          members: mems,
          userId: currentUser?.id,
          manualPhase,
        }));

        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }

        InteractionManager.runAfterInteractions(() => {
          if (!isCurrentRequest()) return;
          Promise.all([
            withTimeout(getHomeMomentsPromise(t.id, force), [] as Moment[]),
            withTimeout(getHomePlacesPromise(t.id, force), [] as Place[]),
            withTimeout(getHomeExpensesPromise(t.id, force), []),
          ]).then(([ms, places, allExp]) => {
            if (!isCurrentRequest()) return;
            setMoments(ms);
            setSavedPlaces(places);
            setTotalSpent(allExp.reduce((s, e) => s + e.amount, 0));
            const todayIso = new Date().toISOString().slice(0, 10);
            const te = allExp.filter(e => e.date === todayIso);
            setTodaySpent(te.reduce((s, e) => s + e.amount, 0));
            setTodayCount(te.length);
          }).catch((err) => {
            if (__DEV__) console.warn('[Home] deferred trip details failed:', err);
          });
        });
      }

      // Daily tracker
      const trackerOn = await withTimeout(getDailyTrackerEnabled(), false);
      if (!isCurrentRequest()) return;
      setDailyTrackerOn(trackerOn);
      if (trackerOn) {
        const ds = await withTimeout(getDailyExpenseSummary(new Date().toISOString().slice(0, 10)), null);
        if (ds) { setDailyTrackerTotal(ds.total); setDailyTrackerCount(ds.count); setDailyTrackerByCat(ds.byCategory); }
        else { setDailyTrackerTotal(0); setDailyTrackerCount(0); setDailyTrackerByCat({}); }
      }

      // Returning-user data
      const [allTripsData, quick, stats] = await Promise.all([
        allTripsPromise,
        quickTripsPromise,
        lifetimeStatsPromise,
      ]);
      if (!isCurrentRequest()) return;
      setDebugInfo(`User: ${currentUser?.id?.slice(0, 8) ?? 'none'} · Trips: ${allTripsData.length}`);
      const split = splitTripsByLifecycle(allTripsData);
      setRPastTrips(split.pastTrips);
      setRDraftTrips(split.draftTrips);
      setRUpcomingTrips(split.upcomingTrips);
      setRActiveTrips(split.activeTrips);
      setRQuickTrips(quick);
      setRStats(stats);
      setRAllTrips(allTripsData);
      setHistoryHydrated(true);
      if (!t && !silent) {
        setLoading(false);
        setRefreshing(false);
      }

      const completed = allTripsData.filter(tr => tr.status === 'Completed' && !tr.deletedAt);
      if (completed.length > 0) {
        const ids = completed.slice(0, 3).map(tr => tr.id);
        InteractionManager.runAfterInteractions(() => {
          if (!isCurrentRequest()) return;
          Promise.all([
            Promise.all(ids.map(id => withTimeout(getHomeMomentsPromise(id, force), [] as Moment[]))),
            withTimeout(getHomeMembersPromise(completed[0].id, force), [] as GroupMember[]),
            withTimeout(getHomePlacesPromise(completed[0].id, force), [] as Place[]),
          ]).then(([momR, membersR, saved]) => {
            if (!isCurrentRequest()) return;
            const unique = new Map<string, Moment>();
            for (const m of momR.flat()) {
              if (m.photo?.startsWith('http') && !unique.has(m.id)) unique.set(m.id, m);
            }
            setRMoments([...unique.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10));
            setRMembers(membersR);
            setRSavedPlaces(saved.filter(p => p.saved));
          }).catch(() => {});
        });
      }

      if (currentUser) {
        const profile = await profilePromise;
        if (!isCurrentRequest()) return;
        const identity = resolveAuthIdentity(profile, currentUser);
        setUserName(identity.name);
        setUserAvatar(identity.avatarUrl);
      }

      // Write widget snapshots so headless widget context can read them
      writeWidgetSnapshots().then(() => refreshAllWidgets()).catch(() => {});
    } catch (e: unknown) {
      if (isCurrentRequest() && !silent) {
        setError(e instanceof Error ? e.message : 'Unable to load trip');
        setHistoryHydrated(true);
      }
    } finally {
      if (isCurrentRequest()) {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearActiveTripSurface]);

  // ── Toggle-off recovery ──
  const prevTestMode = useRef(isTestMode);
  useEffect(() => {
    if (prevTestMode.current && !isTestMode) load({ force: true });
    prevTestMode.current = isTestMode;
  }, [isTestMode, load]);

  // ── Cache-first init ──
  useEffect(() => {
    if (testModeRef.current) { setLoaderDone(true); setLoading(false); setHistoryHydrated(true); didInitialLoad.current = true; return; }
    if (didInitialLoad.current) {
      const contextTrip = segmentActiveTrip ?? null;
      const contextTrips = [
        ...(segmentPastTrips ?? []),
        ...(segmentDraftTrips ?? []),
        ...(contextTrip ? [contextTrip] : []),
      ];
      if (contextTrips.length > 0) {
        const split = splitTripsByLifecycle(contextTrips);
        setRPastTrips((prev) => (prev.length > 0 ? prev : split.pastTrips));
        setRDraftTrips((prev) => (prev.length > 0 ? prev : split.draftTrips));
        setRUpcomingTrips((prev) => (prev.length > 0 ? prev : split.upcomingTrips));
        setRActiveTrips((prev) => (prev.length > 0 ? prev : split.activeTrips));
        setRAllTrips((prev) => (prev.length > 0 ? prev : contextTrips));
        setHistoryHydrated(true);
      } else if (!segmentLoading) {
        setHistoryHydrated(true);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const memoryTrip = getHomeActiveTripCached();
      const persistedTrip = memoryTrip === undefined
        ? user?.id
          ? await cacheGetForUser<Trip | null>('trip:active', user.id, HOME_PERSISTED_SEED_TTL_MS)
          : undefined
        : undefined;
      const contextTrip = segmentActiveTrip ?? null;
      const ct = pickHomeSeedTrip(memoryTrip, persistedTrip, contextTrip);
      const hasTripSeed = ct !== undefined && ct !== null;
      const ca = getHomeAllTripsCached();
      const contextTrips = [
        ...(segmentPastTrips ?? []),
        ...(segmentDraftTrips ?? []),
        ...(contextTrip ? [contextTrip] : []),
      ];
      const seededTrips = ca ?? contextTrips;

      if (cancelled) return;

      if (ct !== undefined) {
        setTrip(ct);
      }
      const id = ct?.id;
      if (id) {
        const cf =
          getHomeFlightsCached(id) ??
          (user?.id ? await cacheGetForUser<Flight[]>(`flights:${id}`, user.id, HOME_PERSISTED_SEED_TTL_MS) : undefined);
        if (!cancelled && cf) setFlights(cf);
        const cm = getHomeMomentsCached(id); if (cm) setMoments(cm);
        const cmem = getHomeMembersCached(id); if (cmem) setMembers(cmem);
        const cp = getHomePlacesCached(id); if (cp) setSavedPlaces(cp);
        const ce = getHomeExpensesCached(id);
        if (ce) {
          setTotalSpent(ce.reduce((s, e) => s + e.amount, 0));
          const ti = new Date().toISOString().slice(0, 10);
          const te = ce.filter(e => e.date === ti);
          setTodaySpent(te.reduce((s, e) => s + e.amount, 0));
          setTodayCount(te.length);
        }
      }
      if (seededTrips.length > 0) {
        const split = splitTripsByLifecycle(seededTrips);
        setRPastTrips(split.pastTrips);
        setRDraftTrips(split.draftTrips);
        setRUpcomingTrips(split.upcomingTrips);
        setRActiveTrips(split.activeTrips);
        setRAllTrips(seededTrips);
        setHistoryHydrated(true);
      }
      const cq = getHomeQuickTripsCached(); if (cq) setRQuickTrips(cq);
      const cs = getHomeLifetimeStatsCached(); if (cs) setRStats(cs);
      if (!segmentLoading && seededTrips.length === 0) setHistoryHydrated(true);
      if (hasTripSeed || seededTrips.length > 0 || !segmentLoading) {
        setLoaderDone(true); setLoading(false);
        load({ silent: true });
      } else {
        load();
      }
    })();
    didInitialLoad.current = true;
    return () => { cancelled = true; };
  }, [load, segmentActiveTrip, segmentPastTrips, segmentDraftTrips, segmentLoading]);

  // ── Focus refresh ──
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (!didInitialLoad.current || testModeRef.current) return;
      const tripId = _rawTrip?.id;
      withTimeout(getHomeQuickTripsPromise(true), [] as QuickTrip[])
        .then(setRQuickTrips)
        .catch(() => {});
      const now = Date.now();
      if (now - lastFocusRefreshAt.current < 60_000) return;
      lastFocusRefreshAt.current = now;
      if (!tripId) {
        load({ force: true, silent: true }).catch(() => {});
        return;
      }
      Promise.all([
        withTimeoutStatus(getHomeActiveTripPromise(false)),
        withTimeout(getHomeExpensesPromise(tripId, false), []),
      ]).then(([tripResult, ae]) => {
        if (tripResult.status === 'ok') {
          if (tripResult.value) {
            setTrip(tripResult.value);
          } else {
            clearActiveTripSurface();
            load({ force: true, silent: true }).catch(() => {});
            return;
          }
        }
        setTotalSpent(ae.reduce((s, e) => s + e.amount, 0));
        const ti = new Date().toISOString().slice(0, 10);
        const te = ae.filter(e => e.date === ti);
        setTodaySpent(te.reduce((s, e) => s + e.amount, 0));
        setTodayCount(te.length);
      }).catch(() => {});
    });
    return unsub;
  }, [clearActiveTripSurface, load, navigation, _rawTrip?.id]);

  // ── Brief branded loader minimum ──
  useEffect(() => {
    if (!loading) return;
    setShowLoader(true);
    const t = setTimeout(() => setLoaderDone(true), 900);
    return () => clearTimeout(t);
  }, [loading]);

  const refresh = useCallback(() => {
    if (testModeRef.current) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    const currentTrip = _rawTrip;
    if (!currentTrip?.id) {
      load({ force: true, silent: true });
      return;
    }

    (async () => {
      try {
        const freshTripResult = await withTimeoutStatus(getHomeActiveTripPromise(true));
        const refreshUser = userRef.current;
        let activeTrip: Trip = currentTrip;
        if (freshTripResult.status === 'ok') {
          if (!freshTripResult.value) {
            clearActiveTripSurface();
            await load({ force: true, silent: true });
            return;
          }
          activeTrip = freshTripResult.value;
        }
        setTrip(activeTrip);
        if (activeTrip.hotelLat && activeTrip.hotelLng) setHotelCoords(activeTrip.hotelLat, activeTrip.hotelLng);

        const profilePromise = refreshUser?.id
          ? import('@/lib/supabase')
            .then(({ getProfile }) => withTimeout(getProfile(refreshUser.id), null as HomeProfileIdentity | null))
            .catch(() => null as HomeProfileIdentity | null)
          : Promise.resolve(null as HomeProfileIdentity | null);

        const [fs, mems, allExp, profile] = await Promise.all([
          withTimeout(getHomeFlightsPromise(activeTrip.id, true), [] as Flight[]),
          withTimeout(getHomeMembersPromise(activeTrip.id, true), [] as GroupMember[]),
          withTimeout(getHomeExpensesPromise(activeTrip.id, true), []),
          profilePromise,
        ]);
        setFlights(fs);
        setMembers(mems);
        if (refreshUser?.id) await cacheSetForUser(`flights:${activeTrip.id}`, fs, refreshUser.id);

        if (refreshUser) {
          const identity = resolveAuthIdentity(profile, refreshUser);
          setUserName(identity.name);
          setUserAvatar(identity.avatarUrl);
        }

        const manualPhase = refreshUser?.id ? await cacheGetForUser<TripPhase | null>('trip:phase:override', refreshUser.id, 0) : null;
        setHasPhaseOverride(!!manualPhase);
        setPhaseRaw(computeTripPhase({
          trip: activeTrip,
          flights: fs,
          members: mems,
          userId: refreshUser?.id,
          manualPhase,
        }));

        setTotalSpent(allExp.reduce((s, e) => s + e.amount, 0));
        const todayIso = new Date().toISOString().slice(0, 10);
        const todayExpenses = allExp.filter(e => e.date === todayIso);
        setTodaySpent(todayExpenses.reduce((s, e) => s + e.amount, 0));
        setTodayCount(todayExpenses.length);
        setRefreshing(false);

        Promise.all([
          withTimeout(getHomeMomentsPromise(activeTrip.id, true), [] as Moment[]),
          withTimeout(getHomePlacesPromise(activeTrip.id, true), [] as Place[]),
          withTimeout(getDailyTrackerEnabled(), dailyTrackerOn),
        ]).then(async ([ms, places, trackerOn]) => {
          setMoments(ms);
          setSavedPlaces(places);
          setDailyTrackerOn(trackerOn);
          if (trackerOn) {
            const ds = await withTimeout(getDailyExpenseSummary(todayIso), null);
            if (ds) {
              setDailyTrackerTotal(ds.total);
              setDailyTrackerCount(ds.count);
              setDailyTrackerByCat(ds.byCategory);
            }
          }
        }).catch((err) => {
          if (__DEV__) console.warn('[Home] background refresh failed:', err);
        });

        writeWidgetSnapshots().then(() => refreshAllWidgets()).catch(() => {});
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unable to refresh trip');
      } finally {
        setRefreshing(false);
      }
    })();
  }, [_rawTrip, clearActiveTripSurface, dailyTrackerOn, load]);

  // Override flights/moments/members/savedPlaces in test mode too
  const effectiveFlights = useMemo(
    () => (isTestMode ? (mockData?.flights ?? []) as Flight[] : flights),
    [flights, isTestMode, mockData?.flights],
  );
  const effectiveMoments = useMemo(
    () => (isTestMode ? (mockData?.moments ?? []) as Moment[] : moments),
    [isTestMode, mockData?.moments, moments],
  );
  const effectiveMembers = useMemo(
    () => (isTestMode ? (mockData?.members ?? []) as GroupMember[] : members),
    [isTestMode, members, mockData?.members],
  );
  const effectiveSavedPlaces = useMemo(
    () => (isTestMode ? (mockData?.places ?? []) as Place[] : savedPlaces),
    [isTestMode, mockData?.places, savedPlaces],
  );
  const phaseFlight = useMemo(
    () => selectUserOutboundFlight(effectiveFlights, effectiveMembers, user?.id),
    [effectiveFlights, effectiveMembers, user?.id],
  );
  const returnFlight = useMemo(
    () => selectReturnFlight(effectiveFlights, effectiveMembers, user?.id),
    [effectiveFlights, effectiveMembers, user?.id],
  );

  const recomputeCurrentPhase = useCallback(async () => {
    if (testModeRef.current || !_rawTrip || !isFocused || AppState.currentState !== 'active') return;
    const currentUserId = userRef.current?.id;
    const manualPhase = currentUserId
      ? await cacheGetForUser<TripPhase | null>('trip:phase:override', currentUserId, 0)
      : null;
    setHasPhaseOverride(!!manualPhase);
    setPhaseRaw(computeTripPhase({
      trip: _rawTrip,
      flights,
      members,
      userId: user?.id,
      manualPhase,
    }));
  }, [_rawTrip, flights, isFocused, members, user?.id]);

  const setManualPhaseOverride = useCallback(async (nextPhase: TripPhase) => {
    const currentUserId = userRef.current?.id;
    if (currentUserId) await cacheSetForUser('trip:phase:override', nextPhase, currentUserId);
    setHasPhaseOverride(true);
    setPhaseRaw(nextPhase);
  }, []);

  const clearManualPhaseOverride = useCallback(async () => {
    const currentUserId = userRef.current?.id;
    if (currentUserId) await cacheSetForUser('trip:phase:override', null, currentUserId);
    setHasPhaseOverride(false);
    if (testModeRef.current || !_rawTrip) return;
    setPhaseRaw(computeTripPhase({
      trip: _rawTrip,
      flights,
      members,
      userId: user?.id,
      manualPhase: null,
    }));
  }, [_rawTrip, flights, members, user?.id]);

  useEffect(() => {
    if (!_rawTrip || isTestMode || !isFocused) return;
    recomputeCurrentPhase();
    const timer = setInterval(recomputeCurrentPhase, 15_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recomputeCurrentPhase();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [_rawTrip, isFocused, isTestMode, recomputeCurrentPhase]);

  return {
    // Core (test-mode-aware)
    trip, phase, hasPhaseOverride, flights: effectiveFlights, phaseFlight, returnFlight, moments: effectiveMoments, savedPlaces: effectiveSavedPlaces, members: effectiveMembers,
    // Budget
    totalSpent, todaySpent, todayCount,
    // Daily tracker
    dailyTrackerOn, dailyTrackerTotal, dailyTrackerCount, dailyTrackerByCat, setDailyTrackerOn,
    // Returning (test-mode-aware)
          pastTrips, draftTrips, upcomingTrips, activeTrips, quickTrips, allTrips, lifetimeStats, historyHydrated,
    returningMoments: isTestMode ? (mockData?.moments ?? []) as Moment[] : rMoments,
    returningMembers: isTestMode ? (mockData?.members ?? []) as GroupMember[] : rMembers,
    returningSavedPlaces: isTestMode ? (mockData?.places?.filter(p => p.saved) ?? []) as Place[] : rSavedPlaces,
    // User
    userName, userAvatar, user,
    // UI state
    loading, loaderDone, showLoader, refreshing, error, debugInfo,
    // Photos
    hotelPhotos,
    heroLocation,
    // Derived
    isPlaneTransport, showFlightFeatures,
    // Test mode
    isTestMode, segment,
    // Actions
    load, refresh, setRefreshing, setSavedPlaces, setPhase: setPhaseRaw, setManualPhaseOverride, clearManualPhaseOverride, setShowLoader,
  };
}
