import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Compass, MapPin, Plane, Trash2, Users, X } from 'lucide-react-native';

import { useAuth } from '@/lib/auth';
import GroupVotingSheet from '@/components/discover/GroupVotingSheet';
import { useVoteSubscription } from '@/hooks/useVoteSubscription';
import AfterStayLoader from '@/components/AfterStayLoader';
import { AnticipationHero } from '@/components/home/AnticipationHero';
import { TopPicksSection as HomeTopPicks } from '@/components/discover/TopPicksSection';
import NotificationsSheet, { useNotificationCount } from '@/components/home/NotificationsSheet';
import { useNotifications } from '@/hooks/useNotifications';
import { HomeMomentsPreview } from '@/components/home/HomeMomentsPreview';
import { ArrivedCard } from '@/components/home/ArrivedCard';
import { CountdownCard } from '@/components/home/CountdownCard';
import { FlightCard } from '@/components/home/FlightCard';
import { FlightProgressCard } from '@/components/home/FlightProgressCard';
import { TripActiveCard } from '@/components/home/TripActiveCard';
import { TripCompletedCard } from '@/components/home/TripCompletedCard';
import EmptyState from '@/components/shared/EmptyState';
import ReturningUserHome from '@/components/home/ReturningUserHome';
import LivingPostcardLoader from '@/components/loader/LivingPostcardLoader';
import ProfileRow from '@/components/home/ProfileRow';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  supabase,
  getAllUserTrips,
  getActiveTrip,
  getExpenses,
  getFlights,
  getGroupMembers,
  getLifetimeStats,
  getMoments,
  getSavedPlaces,
  archiveTrip,
  discardDraftTrip,
  softDeleteTrip,
  restoreTrip,
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
} from '@/hooks/useHomeData';
import { getQuickTrips } from '@/lib/quickTrips';
import { fetchDestinationPhotos } from '@/lib/google-places';
import type { Flight, GroupMember, LifetimeStats, Moment, Place, Trip } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';
import { setHotelCoords } from '@/lib/config';
import { formatDatePHT, formatTimePHT, safeParse, MS_PER_DAY } from '@/lib/utils';

type TripPhase = 'planning' | 'upcoming' | 'inflight' | 'arrived' | 'active' | 'completed';

const DEST_PHOTO_CACHE_KEY = 'hero:destination-photos';

/* ── Section header matching prototype's GroupHeader ── */
function SectionHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={sectionHeaderStyles.container}>
      <View>
        <Text style={[sectionHeaderStyles.kicker, { color: colors.text3 }]}>
          {kicker}
        </Text>
        <Text style={[sectionHeaderStyles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.16 * 10,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.6,
  },
});

function CollapsibleSection({
  kicker,
  title,
  defaultOpen = true,
  children,
}: {
  kicker: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={sectionHeaderStyles.container}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${open ? 'collapse' : 'expand'}`}
      >
        <View>
          <Text style={[sectionHeaderStyles.kicker, { color: colors.text3 }]}>
            {kicker}
          </Text>
          <Text style={[sectionHeaderStyles.title, { color: colors.text }]}>
            {title}
          </Text>
        </View>
        <Text style={{ color: colors.text3, fontSize: 12, fontWeight: '600' }}>
          {open ? 'Hide' : 'Show'}
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const didInitialLoad = useRef(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);
  const { setVisible: setTabBarVisible } = useTabBarVisibility();
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [error, setError] = useState<string>();

  const [phase, setPhase] = useState<TripPhase>('upcoming');
  const [totalSpent, setTotalSpent] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string>();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showVotingSheet, setShowVotingSheet] = useState(false);
  const [returningPastTrips, setReturningPastTrips] = useState<Trip[]>([]);
  const [returningDraftTrips, setReturningDraftTrips] = useState<Trip[]>([]);
  const [returningUpcomingTrips, setReturningUpcomingTrips] = useState<Trip[]>([]);
  const [returningActiveTrips, setReturningActiveTrips] = useState<Trip[]>([]);
  const [returningQuickTrips, setReturningQuickTrips] = useState<QuickTrip[]>([]);
  const [returningMoments, setReturningMoments] = useState<Moment[]>([]);
  const [returningSavedPlaces, setReturningSavedPlaces] = useState<Place[]>([]);
  const [returningStats, setReturningStats] = useState<LifetimeStats | null>(null);
  const [returningAllTrips, setReturningAllTrips] = useState<Trip[]>([]);
  const { user } = useAuth();

  // Resolve current user's group member ID
  const currentMemberId = useMemo(
    () => members.find((m) => m.userId === user?.id)?.id ?? '',
    [members, user?.id],
  );

  // Places needing group votes
  const pendingVotePlaces = useMemo(
    () => savedPlaces.filter((p) => {
      if (p.vote !== 'Pending') return false;
      const votes = p.voteByMember ?? {};
      return Object.keys(votes).length < members.length;
    }),
    [savedPlaces, members],
  );

  // Transport gating: show flight features only for plane transport or when unset
  const isPlaneTransport = !trip?.transport || trip.transport === 'plane';
  const hasFlights = flights.length > 0;
  const showFlightFeatures = isPlaneTransport || hasFlights;

  const handleGroupVoteTap = useCallback(() => {
    setShowVotingSheet(true);
  }, []);

  const handleVoteUpdated = useCallback((placeId: string, votes: Record<string, any>) => {
    setSavedPlaces((prev) =>
      prev.map((p) => (p.id === placeId ? { ...p, voteByMember: votes } : p)),
    );
  }, []);

  // Realtime vote updates from other members
  useVoteSubscription(trip?.id ?? null, useCallback(
    (placeId: string, voteByMember: Record<string, any>, vote: any) => {
      setSavedPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, voteByMember, vote } : p)),
      );
    },
    [],
  ));

  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const { force = false, silent = false } = opts ?? {};
    try {
      if (!silent) setLoading(true);
      setError(undefined);
      // DEBUG: log current user and auth state
      const { data: authData } = await supabase.auth.getUser();
      console.log('[DEBUG] Current user ID:', authData?.user?.id);
      console.log('[DEBUG] User email:', authData?.user?.email);
      let t = await getHomeActiveTripPromise(force);
      // Retry twice if RLS returned 0 rows (auth token race)
      if (!t && !force) {
        await new Promise(r => setTimeout(r, 800));
        t = await getActiveTrip(true);
      }
      if (!t && !force) {
        await new Promise(r => setTimeout(r, 1500));
        t = await getActiveTrip(true);
      }
      // Always sync trip state with getActiveTrip result so completed
      // trips don't stay stuck in state after they're archived
      setTrip(t);
      if (t) {
        await cacheSet('trip:active', t);
        if (t.hotelLat && t.hotelLng) setHotelCoords(t.hotelLat, t.hotelLng);
      }
      if (t) {
        const [fs, ms, members, places] = await Promise.all([
          getHomeFlightsPromise(t.id, force).catch((e) => { if (__DEV__) console.warn('[Home] flights error:', e); return [] as Flight[]; }),
          getHomeMomentsPromise(t.id, force).catch((e) => { if (__DEV__) console.warn('[Home] moments error:', e); return [] as Moment[]; }),
          getHomeMembersPromise(t.id, force).catch((e) => { if (__DEV__) console.warn('[Home] members error:', e); return [] as GroupMember[]; }),
          getHomePlacesPromise(t.id, force).catch(() => [] as Place[]),
        ]);
        if (__DEV__) console.log(`[Home] loaded: ${fs.length} flights, ${ms.length} moments, ${members.length} members`);
        setFlights(fs);
        setMoments(ms);
        setMembers(members);
        setSavedPlaces(places);
        await cacheSet(`flights:${t.id}`, fs);

        const primary = members.find((m) => m.role === 'Primary');
        if (primary) {
          setUserName(primary.name);
          if (primary.profilePhoto) setUserAvatar(primary.profilePhoto);
        }

        // Compute trip phase from flight data
        const outbound = fs.find((f) => f.direction === 'Outbound');
        if (outbound) {
          const departMs = safeParse(outbound.departTime).getTime();
          const arriveMs = safeParse(outbound.arriveTime).getTime();
          const nowMs = Date.now();

          // Clear stale phase override if trip changed
          const cachedTripId = await cacheGet<string>('trip:phase:tripId');
          if (cachedTripId && cachedTripId !== t.id) {
            await cacheSet('trip:phase:override', null);
          }
          await cacheSet('trip:phase:tripId', t.id);

          const override = await cacheGet<TripPhase>('trip:phase:override');
          // Only use override if it makes sense for current time
          // (e.g., don't stay "upcoming" if flight already departed)
          const computedPhase: TripPhase =
            nowMs < departMs ? 'upcoming' :
            nowMs < arriveMs ? 'inflight' :
            nowMs < arriveMs + 4 * 3600000 ? 'arrived' : 'active';

          if (override && override === computedPhase) {
            setPhase(override);
          } else if (override) {
            // Override is stale — clear it and use computed
            await cacheSet('trip:phase:override', null);
            setPhase(computedPhase);
          } else if (nowMs < departMs) {
            setPhase('upcoming');
          } else if (nowMs >= departMs && nowMs < arriveMs) {
            setPhase('inflight');
          } else if (nowMs >= arriveMs && nowMs < arriveMs + 4 * 3600000) {
            setPhase('arrived');
          } else {
            setPhase('active');
          }
        }

        // Fetch expenses once — compute summary + today's totals locally
        const allExpenses = await getHomeExpensesPromise(t.id, force).catch(() => []);
        setTotalSpent(allExpenses.reduce((sum, e) => sum + e.amount, 0));

        const todayIso = new Date().toISOString().slice(0, 10);
        const todayExps = allExpenses.filter((e) => e.date === todayIso);
        setTodaySpent(todayExps.reduce((sum, e) => sum + e.amount, 0));
        setTodayCount(todayExps.length);
        // Check if trip is completed (status or past end date)
        const tripEnd = safeParse(t.endDate).getTime() + MS_PER_DAY; // end of last day
        if (t.status === 'Completed' || Date.now() > tripEnd) {
          setPhase('completed');
        } else if (!outbound) {
          // If no outbound flight, determine phase from trip dates
          const tripStart = safeParse(t.startDate).getTime();
          const daysAway = (tripStart - Date.now()) / MS_PER_DAY;
          setPhase(daysAway > 7 ? 'planning' : 'upcoming');
        }
      }

      // Always fetch returning-user data — needed for ReturningUserHome
      // even when an active trip exists (e.g. My Trips tab navigation)
      const [allTrips, quick, stats] = await Promise.all([
        getHomeAllTripsPromise(force).catch((e) => { console.log('[DEBUG] getAllUserTrips error:', e); return [] as Trip[]; }),
        getHomeQuickTripsPromise(force).catch(() => [] as QuickTrip[]),
        getHomeLifetimeStatsPromise(force).catch(() => null),
      ]);
      console.log('[DEBUG] All trips count:', allTrips.length);
      const now = Date.now();
      // Properly separate trips by lifecycle status
      const drafts = allTrips.filter(t => t.isDraft === true && !t.deletedAt);
      const upcoming = allTrips.filter(t =>
        t.status === 'Planning' && !t.isDraft && !t.deletedAt && !t.archivedAt
      );
      const active = allTrips.filter(t =>
        t.status === 'Active' && !t.deletedAt && !t.archivedAt
      );
      const completed = allTrips.filter(tripItem => {
        if (tripItem.status !== 'Completed' || tripItem.deletedAt) return false;
        const end = tripItem.endDate ? new Date(tripItem.endDate).getTime() + 86400000 : 0;
        return end > 0 && now > end;
      });
      // Keep past trips for stats but don't show inline on home
      setReturningPastTrips(completed);
      setReturningDraftTrips(drafts);
      setReturningUpcomingTrips(upcoming);
      setReturningActiveTrips(active);
      setReturningQuickTrips(quick);
      setReturningStats(stats);
      setReturningAllTrips(allTrips);

      // Fetch recent moments + saved places from recent completed trips
      if (completed.length > 0) {
        const recentTripIds = completed.slice(0, 3).map(t => t.id);
        const momentsResults = await Promise.all(
          recentTripIds.map(id => getHomeMomentsPromise(id, force).catch(() => [] as Moment[]))
        );
        const allMoments = momentsResults
          .flat()
          .filter(m => m.photo?.startsWith('http'))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);
        setReturningMoments(allMoments);

        const [recentSaved] = await Promise.all([
          getHomePlacesPromise(completed[0].id, force).catch(() => [] as Place[]),
        ]);
        setReturningSavedPlaces(recentSaved.filter(p => p.saved));
      }
      // Resolve user name from profiles table first, then auth metadata fallback
      if (user) {
        const { getProfile } = await import('@/lib/supabase');
        const profile = await getProfile(user.id).catch(() => null);
        if (profile?.fullName) {
          setUserName(profile.fullName.split(' ')[0]);
          if (profile.avatarUrl) setUserAvatar(profile.avatarUrl);
        } else {
          setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? '');
          if (user.user_metadata?.avatar_url) setUserAvatar(user.user_metadata.avatar_url);
        }
      }

      if (!t) {
        setFlights([]);
        setMoments([]);
      }
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unable to load trip');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Cache-first: if we have cached data, restore it instantly and refresh in background
    const cachedTrip = getHomeActiveTripCached();
    if (cachedTrip !== undefined) {
      setTrip(cachedTrip);
      const cachedTripId = cachedTrip?.id;
      if (cachedTripId) {
        const cachedFlights = getHomeFlightsCached(cachedTripId);
        const cachedMoments = getHomeMomentsCached(cachedTripId);
        const cachedMembers = getHomeMembersCached(cachedTripId);
        const cachedPlaces = getHomePlacesCached(cachedTripId);
        if (cachedFlights) setFlights(cachedFlights);
        if (cachedMoments) setMoments(cachedMoments);
        if (cachedMembers) setMembers(cachedMembers);
        if (cachedPlaces) setSavedPlaces(cachedPlaces);
        const cachedExpenses = getHomeExpensesCached(cachedTripId);
        if (cachedExpenses) {
          setTotalSpent(cachedExpenses.reduce((sum, e) => sum + e.amount, 0));
          const todayIso = new Date().toISOString().slice(0, 10);
          const todayExps = cachedExpenses.filter((e) => e.date === todayIso);
          setTodaySpent(todayExps.reduce((sum, e) => sum + e.amount, 0));
          setTodayCount(todayExps.length);
        }
      }
      const cachedAllTrips = getHomeAllTripsCached();
      if (cachedAllTrips) {
        const now = Date.now();
        const drafts = cachedAllTrips.filter(t => t.isDraft === true && !t.deletedAt);
        const upcoming = cachedAllTrips.filter(t =>
          t.status === 'Planning' && !t.isDraft && !t.deletedAt && !t.archivedAt
        );
        const active = cachedAllTrips.filter(t =>
          t.status === 'Active' && !t.deletedAt && !t.archivedAt
        );
        const completed = cachedAllTrips.filter(tripItem => {
          if (tripItem.status !== 'Completed' || tripItem.deletedAt) return false;
          const end = tripItem.endDate ? new Date(tripItem.endDate).getTime() + 86400000 : 0;
          return end > 0 && now > end;
        });
        setReturningPastTrips(completed);
        setReturningDraftTrips(drafts);
        setReturningUpcomingTrips(upcoming);
        setReturningActiveTrips(active);
        setReturningAllTrips(cachedAllTrips);
      }
      const cachedQuickTrips = getHomeQuickTripsCached();
      if (cachedQuickTrips) setReturningQuickTrips(cachedQuickTrips);
      const cachedStats = getHomeLifetimeStatsCached();
      if (cachedStats) setReturningStats(cachedStats);
      // Skip the 3s branded loader when cached data is available
      setLoaderDone(true);
      // Refresh in background
      load({ silent: true });
    } else {
      load();
    }
    didInitialLoad.current = true;
    return () => { alive = false; };
  }, [load]);

  // Refresh budget + trip data when tab gets focus (e.g. after editing budget)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!didInitialLoad.current) return; // skip first mount
      const tripId = trip?.id;
      if (!tripId) return;
      // Lightweight background refresh — no loading states
      Promise.all([
        getHomeActiveTripPromise(true),
        getHomeExpensesPromise(tripId, true).catch(() => []),
      ]).then(([freshTrip, allExpenses]) => {
        if (freshTrip) setTrip(freshTrip);
        setTotalSpent(allExpenses.reduce((sum, e) => sum + e.amount, 0));
        const todayIso = new Date().toISOString().slice(0, 10);
        const todayExps = allExpenses.filter((e) => e.date === todayIso);
        setTodaySpent(todayExps.reduce((sum, e) => sum + e.amount, 0));
        setTodayCount(todayExps.length);
      }).catch(() => {});
    });
    return unsubscribe;
  }, [navigation, trip?.id]);

  // Always show branded loader for at least 3 seconds on cold start
  useEffect(() => {
    if (!loading) return;
    setShowLoader(true);
    // Minimum 3s loader — ensures fresh data arrives before content shows
    const t = setTimeout(() => setLoaderDone(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Hide tab bar during initial load
  useEffect(() => {
    const isInitialLoading = loading || (showLoader && !loaderDone);
    setTabBarVisible(!isInitialLoading);
  }, [loading, showLoader, loaderDone, setTabBarVisible]);

  const onRefresh = () => {
    setRefreshing(true);
    load({ force: true });
  };

  const boardFlight = useCallback(async () => {
    setPhase('inflight');
    await cacheSet('trip:phase:override', 'inflight');
  }, []);

  const landFlight = useCallback(async () => {
    setPhase('arrived');
    await cacheSet('trip:phase:override', 'arrived');
  }, []);

  const goExplore = useCallback(async () => {
    setPhase('active');
    await cacheSet('trip:phase:override', 'active');
  }, []);

  // Hero gallery photos — must be above early returns (hooks order)
  // Priority: hotel photos from DB → destination photos from Google Places (cached)
  const parsedHotelPhotos = useMemo<string[]>(() => {
    if (!trip?.hotelPhotos) return [];
    try {
      const parsed = JSON.parse(trip.hotelPhotos);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
    } catch {
      return [];
    }
  }, [trip?.hotelPhotos]);

  const [destinationPhotos, setDestinationPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (parsedHotelPhotos.length > 0 || !trip?.destination) return;

    let cancelled = false;
    const loadDestPhotos = async () => {
      // Check cache first
      const cached = await cacheGet<string[]>(DEST_PHOTO_CACHE_KEY);
      if (cached && cached.length > 0 && !cancelled) {
        setDestinationPhotos(cached);
        return;
      }
      // Fetch from Google Places
      const photos = await fetchDestinationPhotos(trip.destination);
      if (!cancelled && photos.length > 0) {
        setDestinationPhotos(photos);
        await cacheSet(DEST_PHOTO_CACHE_KEY, photos);
      }
    };
    loadDestPhotos();
    return () => { cancelled = true; };
  }, [parsedHotelPhotos.length, trip?.destination]);

  const hotelPhotos = parsedHotelPhotos.length > 0 ? parsedHotelPhotos : destinationPhotos;

  // Date range label
  const dateRange = useMemo(
    () => trip ? `${formatDatePHT(trip.startDate)} \u2013 ${formatDatePHT(trip.endDate)}` : '',
    [trip?.startDate, trip?.endDate],
  );

  // Countdown computation
  const tripStartMs = trip ? safeParse(trip.startDate).getTime() : 0;
  const tripEndMs = trip ? safeParse(trip.endDate).getTime() : 0;
  const nowMs = Date.now();
  const totalNights = Math.max(
    1,
    tripStartMs && tripEndMs ? Math.ceil((tripEndMs - tripStartMs) / MS_PER_DAY) : 1,
  );
  const totalDays = totalNights;

  const countdown = useMemo(() => {
    if (!tripStartMs) return { status: 'upcoming' as const, totalDays };
    if (nowMs < tripStartMs) {
      return { status: 'upcoming' as const, totalDays };
    }
    if (nowMs > tripEndMs + MS_PER_DAY) {
      return { status: 'completed' as const, totalDays };
    }
    const dayNumber = Math.floor((nowMs - tripStartMs) / MS_PER_DAY) + 1;
    return { status: 'active' as const, dayNumber, totalDays };
  }, [nowMs, tripStartMs, tripEndMs, totalDays]);

  // Notification count for bell badge
  const notifProps = useMemo(() => ({
    dayOfTrip: countdown.status === 'active' ? countdown.dayNumber ?? 1 : 1,
    totalDays: countdown.totalDays,
    daysLeft: countdown.totalDays - (countdown.status === 'active' ? countdown.dayNumber ?? 1 : 0),
    spent: totalSpent,
    budget: trip?.budgetLimit ?? 0,
    savedPlaces,
    members,
    destination: trip?.destination ?? '',
  }), [countdown, totalSpent, trip?.budgetLimit, trip?.destination, savedPlaces, members]);
  // Single notification state — shared with both badge count and sheet
  const { notifications: dbNotifications, unreadCount: dbUnread, markRead, markAllRead } = useNotifications();
  const notifCount = useNotificationCount(notifProps, dbUnread);

  // Room info
  const roomInfo = useMemo(
    () => trip?.roomType
      ? `${trip.roomType} × 2 · ${totalNights} nights · ${dateRange}`
      : undefined,
    [trip?.roomType, totalNights, dateRange],
  );

  // Show branded loader until both: 3s minimum passed AND data loaded
  if (!loaderDone || loading) {
    return <AfterStayLoader />;
  }

  if (!trip) {
    // Actual network error — show retry
    if (error) {
      return (
        <SafeAreaView style={styles.fullCenter}>
          <Text style={styles.errorTitle}>Couldn't load trip</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retry}
            onPress={() => {
              setLoading(true);
              load({ force: true });
            }}
            accessibilityLabel="Retry loading trip"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </SafeAreaView>
      );
    }
    // Returning user — has ANY trips (past, upcoming, active, archived, drafts, quick trips)
    const hasHistory =
      returningPastTrips.length > 0 ||
      returningUpcomingTrips.length > 0 ||
      returningActiveTrips.length > 0 ||
      returningQuickTrips.length > 0 ||
      returningDraftTrips.length > 0 ||
      returningAllTrips.some(t => !t.deletedAt && !t.isDraft);
    if (hasHistory) {
      const displayName = userName || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
      const handle = user?.email?.split('@')[0] || (displayName.length > 0 ? displayName.toLowerCase().replace(/\s+/g, '') : 'traveler');
      return (
        <View style={{ flex: 1 }}>
          <ReturningUserHome
            userName={displayName}
            userHandle={handle}
            avatarUrl={userAvatar}
            notificationCount={notifCount}
            pastTrips={[]} /* Moved to My Trips screen */
            draftTrips={returningDraftTrips}
            upcomingTrips={returningUpcomingTrips}
            activeTrips={returningActiveTrips}
            quickTrips={returningQuickTrips}
            lifetimeStats={returningStats}
            recentMoments={returningMoments}
            savedPlaces={returningSavedPlaces}
            onPlanTrip={() => router.push('/onboarding')}
            onTripPress={(id) => router.push(`/trip-recap?tripId=${id}`)}
            onDraftTripPress={(id) => router.push({ pathname: '/(tabs)/trip', params: { tripId: id } })}
            onUpcomingTripPress={(id) => router.push({ pathname: '/(tabs)/trip', params: { tripId: id } })}
            onArchiveDraft={async (id) => {
              try {
                await archiveTrip(id);
                load({ force: true });
              } catch {}
            }}
            onQuickTripPress={(id) => router.push(`/quick-trip-detail?quickTripId=${id}`)}
            onAddQuickTrip={() => router.push('/quick-trip-create')}
            onAddMoment={() => router.push(`/add-moment?tripId=${returningPastTrips[0]?.id ?? ''}`)}
            onBellPress={() => setShowNotifications(true)}
            onSeeAllTrips={() => router.push('/(tabs)/trip')}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load({ force: true }); }}
          />
          <NotificationsSheet
            visible={showNotifications}
            onClose={() => setShowNotifications(false)}
            onGroupVoteTap={handleGroupVoteTap}
            dbNotifications={dbNotifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            {...notifProps}
          />
        </View>
      );
    }

    // First-time user — welcoming empty state
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ProfileRow
          userName={userName || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''}
          avatarUrl={userAvatar}
          notificationCount={notifCount}
          onBellPress={() => setShowNotifications(true)}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <EmptyState
            icon={Compass}
            title="Your next adventure starts here"
            subtitle="Create a trip to unlock your dashboard — add flights, budget, places, and more."
            actionLabel="Get Started"
            onAction={() => router.push('/onboarding')}
            secondaryLabel="Join a friend's trip"
            onSecondary={() => router.push('/onboarding')}
          />
        </View>
        <NotificationsSheet
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          onGroupVoteTap={handleGroupVoteTap}
          dbNotifications={dbNotifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          {...notifProps}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentLt}
          />
        }
      >
        {/* 1. Top bar */}
        <ProfileRow
          userName={userName}
          avatarUrl={userAvatar}
          tripLabel={trip.destination ? `${trip.destination} trip` : undefined}
          notificationCount={notifCount}
          onBellPress={() => setShowNotifications(true)}
        />

        {/* 2. Hero slideshow */}
        <AnticipationHero
          photos={hotelPhotos}
          hotelName={trip.accommodation}
          destination={trip.destination || ''}
          dateRange={dateRange}
          verified={true}
          roomInfo={roomInfo}
          bookingRef={trip.bookingRef ? `Agoda #${trip.bookingRef}` : undefined}
          members={members}
        />

        {/* 3. Phase card */}
        <View style={styles.phaseSection}>
          <Animated.View
            key={phase}
            entering={FadeIn.duration(350)}
            exiting={FadeOut.duration(200)}
          >
            {phase === 'inflight' ? (
              (() => {
                const outbound = flights.find((f) => f.direction === 'Outbound');
                return (
                  <FlightProgressCard
                    onLanded={landFlight}
                    fromCode={outbound?.from}
                    fromCity={outbound?.from === 'MNL' ? 'Manila' : outbound?.from}
                    toCode={outbound?.to}
                    toCity={outbound?.to === 'MPH' ? 'Caticlan' : outbound?.to}
                    etaLabel={outbound?.arriveTime ? formatTimePHT(outbound.arriveTime) : undefined}
                    departIso={outbound?.departTime}
                    arriveIso={outbound?.arriveTime}
                  />
                );
              })()
            ) : phase === 'arrived' ? (
              <ArrivedCard
                destination={trip.destination}
                hotelName={trip.accommodation}
                onStart={goExplore}
              />
            ) : phase === 'active' ? (
              <TripActiveCard
                trip={trip}
                dayOfTrip={
                  countdown.status === 'active'
                    ? countdown.dayNumber ?? 1
                    : 1
                }
                totalDays={countdown.totalDays}
                daysLeft={
                  countdown.totalDays -
                  (countdown.status === 'active'
                    ? countdown.dayNumber ?? 1
                    : 0)
                }
                budgetStatus={(() => {
                  const b = trip.budgetLimit ?? 0;
                  if (b <= 0) return 'cruising';
                  const pctSpent = totalSpent / b;
                  const pctTime = (countdown.status === 'active' ? (countdown.dayNumber ?? 1) : 1) / countdown.totalDays;
                  if (pctSpent > 1) return 'over';
                  if (pctSpent > pctTime * 1.15) return 'low';
                  return 'cruising';
                })()}
                spent={totalSpent}
                budget={trip.budgetLimit ?? 0}
                todaySpent={todaySpent}
                todayCount={todayCount}
              />
            ) : phase === 'completed' ? (
              <TripCompletedCard
                destination={trip.destination}
                nights={trip.nights}
                momentCount={moments.length}
                onViewMemory={() => router.push({ pathname: '/trip-memory', params: { tripId: trip.id } } as never)}
              />
            ) : phase === 'planning' ? (
              <View style={styles.planningCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={styles.planningEmoji}>🗺️</Text>
                    <Text style={styles.planningTitle}>Planning your trip</Text>
                    <Text style={styles.planningSubtitle}>
                      {trip.destination} · {formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ padding: 6, marginTop: -4, marginRight: -4 }}
                    onPress={() => {
                      const isDraft = trip.isDraft;
                      Alert.alert(
                        isDraft ? 'Delete draft?' : 'Archive this trip?',
                        isDraft
                          ? 'This draft trip will be permanently removed.'
                          : 'It will move to your past trips without generating a memory.',
                        [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: isDraft ? 'Delete' : 'Archive',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                if (isDraft) {
                                  await discardDraftTrip(trip.id);
                                } else {
                                  await archiveTrip(trip.id);
                                }
                                load({ force: true });
                              } catch (e: any) {
                                Alert.alert('Error', e?.message ?? 'Could not remove trip');
                              }
                            },
                          },
                        ],
                      );
                    }}
                    activeOpacity={0.7}
                    accessibilityLabel={trip.isDraft ? 'Delete draft' : 'Archive trip'}
                  >
                    <X size={18} color={colors.text3} />
                  </TouchableOpacity>
                </View>
                <View style={styles.planningNudges}>
                  {showFlightFeatures && (
                    <Pressable style={styles.nudgeRow} onPress={() => router.push('/(tabs)/trip')}>
                      <Plane size={16} color={colors.accent} />
                      <Text style={styles.nudgeText}>Add your flights</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.nudgeRow} onPress={() => router.push('/invite')}>
                    <Users size={16} color={colors.accent} />
                    <Text style={styles.nudgeText}>Invite travel companions</Text>
                  </Pressable>
                  <Pressable style={styles.nudgeRow} onPress={() => router.push('/(tabs)/discover')}>
                    <MapPin size={16} color={colors.accent} />
                    <Text style={styles.nudgeText}>Discover places to visit</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <CountdownCard
                tripStartISO={
                  flights.find((f) => f.direction === 'Outbound')?.departTime ??
                  trip.startDate
                }
                status={'upcoming'}
                dayNumber={undefined}
                totalDays={countdown.totalDays}
                dateLabel={
                  flights.find((f) => f.direction === 'Outbound')?.departTime
                    ? formatDatePHT(
                        flights.find((f) => f.direction === 'Outbound')!
                          .departTime,
                      )
                    : formatDatePHT(trip.startDate)
                }
                onBoard={boardFlight}
              />
            )}
          </Animated.View>
        </View>

        {/* Smart nudges moved to bell icon → NotificationsSheet */}

        {/* 4. Moments preview — first after trip card */}
        <SectionHeader
          kicker={`Moments · Day ${countdown.status === 'active' ? countdown.dayNumber ?? 1 : 1}`}
          title="Trip so far"
        />
        <HomeMomentsPreview
          moments={moments}
          members={members}
          onViewAll={() => router.push('/moments-slideshow' as never)}
        />

        {/* 5. Weather — collapsible */}
        <CollapsibleSection
          kicker="Weather"
          title={phase === 'active'
            ? `${trip.destination ?? 'Destination'} right now`
            : `${trip.destination ?? 'Destination'} this week`}
        >
          <WeatherForecastCard destination={trip.destination} />
        </CollapsibleSection>

        {/* 6. Flight card — only for plane transport or existing flights */}
        {showFlightFeatures && (() => {
          const activeFlight = phase === 'active'
            ? flights.find((f) => f.direction === 'Return')
            : flights.find((f) => f.direction === 'Outbound');
          const dirLabel = phase === 'active' ? 'Return' : 'Outbound';
          const destCity = activeFlight?.to ?? (phase === 'active' ? 'Home' : trip.destination ?? 'Destination');
          return (
            <>
              <SectionHeader
                kicker={`Transit · ${dirLabel}`}
                title={`Flight to ${destCity}`}
              />
              <FlightCard
                flight={activeFlight}
                direction={phase === 'active' ? 'return' : 'outbound'}
              />
            </>
          );
        })()}

        {/* 7. Top Picks — collapsible */}
        {trip.destination && (
          <CollapsibleSection
            kicker="Curated for you"
            title={`Top picks in ${trip.destination}`}
          >
            <HomeTopPicks
              destination={trip.destination}
              hotelName={trip.accommodation || undefined}
            />
          </CollapsibleSection>
        )}

        {/* Bottom spacer for FAB clearance */}
        <View style={{ height: 80 }} />
      </ScrollView>
      <NotificationsSheet
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onGroupVoteTap={handleGroupVoteTap}
        dbNotifications={dbNotifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        {...notifProps}
      />
      <GroupVotingSheet
        visible={showVotingSheet}
        onClose={() => setShowVotingSheet(false)}
        place={pendingVotePlaces[0] ?? null}
        pendingPlaces={pendingVotePlaces}
        members={members}
        currentMemberId={currentMemberId}
        onVoteUpdated={handleVoteUpdated}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    fullCenter: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
    },
    loadingText: { color: colors.text2, fontSize: 13 },
    errorTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    errorText: { color: colors.text2, fontSize: 13, textAlign: 'center' },
    retry: {
      marginTop: spacing.md,
      backgroundColor: colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 16,
    },
    retryText: { color: colors.white, fontWeight: '700' },
    phaseSection: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    planningCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    planningEmoji: {
      fontSize: 36,
      marginBottom: 12,
    },
    planningTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    planningSubtitle: {
      fontSize: 13,
      color: colors.text2,
      marginBottom: 20,
    },
    planningNudges: {
      width: '100%',
      gap: 12,
    },
    nudgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.accentDim,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    nudgeText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.accent,
    },
  });
