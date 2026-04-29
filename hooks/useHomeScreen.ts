/**
 * useHomeScreen — all state, data fetching, caching, and test-mode logic
 * for the Home screen. The component becomes pure render.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '@/lib/auth';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  getActiveTrip,
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
import { setHotelCoords } from '@/lib/config';
import { safeParse, MS_PER_DAY } from '@/lib/utils';
import type { Flight, GroupMember, LifetimeStats, Moment, Place, Trip } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';

export type TripPhase = 'planning' | 'upcoming' | 'inflight' | 'arrived' | 'active' | 'completed';

const DEST_PHOTO_CACHE_KEY = 'hero:destination-photos';

export function useHomeScreen() {
  const { user } = useAuth();
  const { segment, isTestMode, mockData } = useUserSegment();
  const navigation = useNavigation();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;
  const didInitialLoad = useRef(false);

  // ── Raw state ──
  const [_rawTrip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [_rawPhase, setPhaseRaw] = useState<TripPhase>('upcoming');
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
  const [rSavedPlaces, setRSavedPlaces] = useState<Place[]>([]);
  const [rStats, setRStats] = useState<LifetimeStats | null>(null);
  const [rAllTrips, setRAllTrips] = useState<Trip[]>([]);
  const [debugInfo, setDebugInfo] = useState('');

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
      return Array.isArray(p) ? p.filter((u: unknown) => typeof u === 'string' && (u as string).startsWith('http')) : [];
    } catch { return []; }
  }, [_rawTrip?.hotelPhotos]);

  const [destPhotos, setDestPhotos] = useState<string[]>([]);
  useEffect(() => {
    if (parsedHotelPhotos.length > 0 || !_rawTrip?.destination) return;
    let cancelled = false;
    (async () => {
      const cached = await cacheGet<string[]>(DEST_PHOTO_CACHE_KEY);
      if (cached?.length && !cancelled) { setDestPhotos(cached); return; }
      const photos = await fetchDestinationPhotos(_rawTrip.destination).catch(() => []);
      if (!cancelled && photos.length > 0) { setDestPhotos(photos); await cacheSet(DEST_PHOTO_CACHE_KEY, photos); }
    })();
    return () => { cancelled = true; };
  }, [parsedHotelPhotos.length, _rawTrip?.destination]);

  const hotelPhotos = parsedHotelPhotos.length > 0 ? parsedHotelPhotos : destPhotos;

  // ── Main loader ──
  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    if (testModeRef.current) { setLoading(false); setRefreshing(false); return; }
    const { force = false, silent = false } = opts ?? {};
    try {
      if (!silent) setLoading(true);
      setError(undefined);

      let t = await getHomeActiveTripPromise(force);
      if (!t && !force) { await new Promise(r => setTimeout(r, 800)); t = await getActiveTrip(true); }
      if (!t && !force) { await new Promise(r => setTimeout(r, 1500)); t = await getActiveTrip(true); }
      setTrip(t);
      if (t) { await cacheSet('trip:active', t); if (t.hotelLat && t.hotelLng) setHotelCoords(t.hotelLat, t.hotelLng); }

      if (t) {
        const [fs, ms, mems, places] = await Promise.all([
          getHomeFlightsPromise(t.id, force).catch(() => [] as Flight[]),
          getHomeMomentsPromise(t.id, force).catch(() => [] as Moment[]),
          getHomeMembersPromise(t.id, force).catch(() => [] as GroupMember[]),
          getHomePlacesPromise(t.id, force).catch(() => [] as Place[]),
        ]);
        setFlights(fs); setMoments(ms); setMembers(mems); setSavedPlaces(places);
        await cacheSet(`flights:${t.id}`, fs);

        const primary = mems.find(m => m.role === 'Primary');
        if (primary) { setUserName(primary.name); if (primary.profilePhoto) setUserAvatar(primary.profilePhoto); }

        // Phase computation
        const outbound = fs.find(f => f.direction === 'Outbound');
        if (outbound) {
          const departMs = safeParse(outbound.departTime).getTime();
          const arriveMs = safeParse(outbound.arriveTime).getTime();
          const nowMs = Date.now();
          const cachedTid = await cacheGet<string>('trip:phase:tripId');
          if (cachedTid && cachedTid !== t.id) await cacheSet('trip:phase:override', null);
          await cacheSet('trip:phase:tripId', t.id);
          const ovr = await cacheGet<TripPhase>('trip:phase:override');
          const computed: TripPhase = nowMs < departMs ? 'upcoming' : nowMs < arriveMs ? 'inflight' : nowMs < arriveMs + 4 * 3600000 ? 'arrived' : 'active';
          if (ovr && ovr === computed) setPhaseRaw(ovr);
          else if (ovr) { await cacheSet('trip:phase:override', null); setPhaseRaw(computed); }
          else setPhaseRaw(computed);
        }

        const allExp = await getHomeExpensesPromise(t.id, force).catch(() => []);
        setTotalSpent(allExp.reduce((s, e) => s + e.amount, 0));
        const todayIso = new Date().toISOString().slice(0, 10);
        const te = allExp.filter(e => e.date === todayIso);
        setTodaySpent(te.reduce((s, e) => s + e.amount, 0));
        setTodayCount(te.length);

        const tripEnd = safeParse(t.endDate).getTime() + MS_PER_DAY;
        if (t.status === 'Completed' || Date.now() > tripEnd) setPhaseRaw('completed');
        else if (!outbound) {
          const daysAway = (safeParse(t.startDate).getTime() - Date.now()) / MS_PER_DAY;
          setPhaseRaw(daysAway > 7 ? 'planning' : 'upcoming');
        }
      }

      // Daily tracker
      const trackerOn = await getDailyTrackerEnabled().catch(() => false);
      setDailyTrackerOn(trackerOn);
      if (trackerOn) {
        const ds = await getDailyExpenseSummary(new Date().toISOString().slice(0, 10)).catch(() => null);
        if (ds) { setDailyTrackerTotal(ds.total); setDailyTrackerCount(ds.count); setDailyTrackerByCat(ds.byCategory); }
        else { setDailyTrackerTotal(0); setDailyTrackerCount(0); setDailyTrackerByCat({}); }
      }

      // Returning-user data
      const [allTripsData, quick, stats] = await Promise.all([
        getHomeAllTripsPromise(force).catch(() => [] as Trip[]),
        getHomeQuickTripsPromise(force).catch(() => [] as QuickTrip[]),
        getHomeLifetimeStatsPromise(force).catch(() => null),
      ]);
      setDebugInfo(`User: ${user?.id?.slice(0, 8) ?? 'none'} · Trips: ${allTripsData.length}`);
      const now = Date.now();
      setRPastTrips(allTripsData.filter(tr => tr.status === 'Completed' && !tr.deletedAt && (tr.endDate ? new Date(tr.endDate).getTime() + 86400000 < now : false)));
      setRDraftTrips(allTripsData.filter(tr => tr.isDraft === true && !tr.deletedAt));
      setRUpcomingTrips(allTripsData.filter(tr => tr.status === 'Planning' && !tr.isDraft && !tr.deletedAt && !tr.archivedAt));
      setRActiveTrips(allTripsData.filter(tr => tr.status === 'Active' && !tr.deletedAt && !tr.archivedAt));
      setRQuickTrips(quick);
      setRStats(stats);
      setRAllTrips(allTripsData);

      const completed = allTripsData.filter(tr => tr.status === 'Completed' && !tr.deletedAt);
      if (completed.length > 0) {
        const ids = completed.slice(0, 3).map(tr => tr.id);
        const momR = await Promise.all(ids.map(id => getHomeMomentsPromise(id, force).catch(() => [] as Moment[])));
        setRMoments(momR.flat().filter(m => m.photo?.startsWith('http')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10));
        const saved = await getHomePlacesPromise(completed[0].id, force).catch(() => [] as Place[]);
        setRSavedPlaces(saved.filter(p => p.saved));
      }

      if (user) {
        const { getProfile } = await import('@/lib/supabase');
        const profile = await getProfile(user.id).catch(() => null);
        if (profile?.fullName) { setUserName(profile.fullName.split(' ')[0]); if (profile.avatarUrl) setUserAvatar(profile.avatarUrl); }
        else { setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? ''); if (user.user_metadata?.avatar_url) setUserAvatar(user.user_metadata.avatar_url); }
      }

      if (!t) { setFlights([]); setMoments([]); }
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unable to load trip');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Toggle-off recovery ──
  const prevTestMode = useRef(isTestMode);
  useEffect(() => {
    if (prevTestMode.current && !isTestMode) load({ force: true });
    prevTestMode.current = isTestMode;
  }, [isTestMode]);

  // ── Cache-first init ──
  useEffect(() => {
    if (testModeRef.current) { setLoaderDone(true); setLoading(false); didInitialLoad.current = true; return; }
    const ct = getHomeActiveTripCached();
    if (ct !== undefined) {
      setTrip(ct);
      const id = ct?.id;
      if (id) {
        const cf = getHomeFlightsCached(id); if (cf) setFlights(cf);
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
      const ca = getHomeAllTripsCached();
      if (ca) {
        const now = Date.now();
        setRPastTrips(ca.filter(t => t.status === 'Completed' && !t.deletedAt && (t.endDate ? new Date(t.endDate).getTime() + 86400000 < now : false)));
        setRDraftTrips(ca.filter(t => t.isDraft === true && !t.deletedAt));
        setRUpcomingTrips(ca.filter(t => t.status === 'Planning' && !t.isDraft && !t.deletedAt && !t.archivedAt));
        setRActiveTrips(ca.filter(t => t.status === 'Active' && !t.deletedAt && !t.archivedAt));
        setRAllTrips(ca);
      }
      const cq = getHomeQuickTripsCached(); if (cq) setRQuickTrips(cq);
      const cs = getHomeLifetimeStatsCached(); if (cs) setRStats(cs);
      setLoaderDone(true); setLoading(false);
      load({ silent: true });
    } else { load(); }
    didInitialLoad.current = true;
  }, [load]);

  // ── Focus refresh ──
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (!didInitialLoad.current || testModeRef.current) return;
      const tripId = _rawTrip?.id;
      if (!tripId) return;
      Promise.all([
        getHomeActiveTripPromise(true),
        getHomeExpensesPromise(tripId, true).catch(() => []),
      ]).then(([ft, ae]) => {
        if (ft) setTrip(ft);
        setTotalSpent(ae.reduce((s, e) => s + e.amount, 0));
        const ti = new Date().toISOString().slice(0, 10);
        const te = ae.filter(e => e.date === ti);
        setTodaySpent(te.reduce((s, e) => s + e.amount, 0));
        setTodayCount(te.length);
      }).catch(() => {});
    });
    return unsub;
  }, [navigation, _rawTrip?.id]);

  // ── 3s branded loader minimum ──
  useEffect(() => {
    if (!loading) return;
    setShowLoader(true);
    const t = setTimeout(() => setLoaderDone(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(() => { setRefreshing(true); load({ force: true }); }, [load]);

  // Override flights/moments/members/savedPlaces in test mode too
  const effectiveFlights = isTestMode ? (mockData?.flights ?? []) as Flight[] : flights;
  const effectiveMoments = isTestMode ? (mockData?.moments ?? []) as Moment[] : moments;
  const effectiveMembers = isTestMode ? (mockData?.members ?? []) as GroupMember[] : members;
  const effectiveSavedPlaces = isTestMode ? (mockData?.places ?? []) as Place[] : savedPlaces;

  return {
    // Core (test-mode-aware)
    trip, phase, flights: effectiveFlights, moments: effectiveMoments, savedPlaces: effectiveSavedPlaces, members: effectiveMembers,
    // Budget
    totalSpent, todaySpent, todayCount,
    // Daily tracker
    dailyTrackerOn, dailyTrackerTotal, dailyTrackerCount, dailyTrackerByCat, setDailyTrackerOn,
    // Returning (test-mode-aware)
    pastTrips, draftTrips, upcomingTrips, activeTrips, quickTrips, allTrips, lifetimeStats,
    returningMoments: isTestMode ? (mockData?.moments ?? []) as Moment[] : rMoments,
    returningSavedPlaces: isTestMode ? (mockData?.places?.filter(p => p.saved) ?? []) as Place[] : rSavedPlaces,
    // User
    userName, userAvatar, user,
    // UI state
    loading, loaderDone, showLoader, refreshing, error, debugInfo,
    // Photos
    hotelPhotos,
    // Derived
    isPlaneTransport, showFlightFeatures,
    // Test mode
    isTestMode, segment,
    // Actions
    load, refresh, setRefreshing, setSavedPlaces, setPhase: setPhaseRaw, setShowLoader,
  };
}
