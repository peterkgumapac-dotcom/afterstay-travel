import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { Compass, MapPin, Plane, Users } from 'lucide-react-native';

import { useAuth } from '@/lib/auth';
import GroupVotingSheet from '@/components/discover/GroupVotingSheet';
import { useVoteSubscription } from '@/hooks/useVoteSubscription';
import AfterStayLoader from '@/components/AfterStayLoader';
import { AnticipationHero } from '@/components/home/AnticipationHero';
import { TopPicksSection as HomeTopPicks } from '@/components/discover/TopPicksSection';
import NotificationsSheet, { useNotificationCount } from '@/components/home/NotificationsSheet';
import { HomeMomentsPreview } from '@/components/home/HomeMomentsPreview';
import { ArrivedCard } from '@/components/home/ArrivedCard';
import { CountdownCard } from '@/components/home/CountdownCard';
import { FlightCard } from '@/components/home/FlightCard';
import { FlightProgressCard } from '@/components/home/FlightProgressCard';
import { TripActiveCard } from '@/components/home/TripActiveCard';
import EmptyState from '@/components/shared/EmptyState';
import LivingPostcardLoader from '@/components/loader/LivingPostcardLoader';
import ProfileRow from '@/components/home/ProfileRow';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  getActiveTrip,
  getExpenses,
  getFlights,
  getGroupMembers,
  getMoments,
  getSavedPlaces,
} from '@/lib/supabase';
import type { Flight, GroupMember, Moment, Place, Trip } from '@/lib/types';
import { setHotelCoords } from '@/lib/config';
import { formatDatePHT, formatTimePHT, safeParse, MS_PER_DAY } from '@/lib/utils';

type TripPhase = 'planning' | 'upcoming' | 'inflight' | 'arrived' | 'active';

// No fallback photos — hero shows gradient when trip has no hotel photos
const FALLBACK_PHOTOS: string[] = [];

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

  const load = useCallback(async (force = false) => {
    try {
      setError(undefined);
      let t = await getActiveTrip(force);
      // Retry twice if RLS returned 0 rows (auth token race)
      if (!t && !force) {
        await new Promise(r => setTimeout(r, 800));
        t = await getActiveTrip(true);
      }
      if (!t && !force) {
        await new Promise(r => setTimeout(r, 1500));
        t = await getActiveTrip(true);
      }
      // Only update state if we got a trip — never overwrite cache with null
      if (t) {
        setTrip(t);
        await cacheSet('trip:active', t);
        if (t.hotelLat && t.hotelLng) setHotelCoords(t.hotelLat, t.hotelLng);
      }
      if (t) {
        const [fs, ms, members, places] = await Promise.all([
          getFlights(t.id).catch((e) => { if (__DEV__) console.warn('[Home] flights error:', e); return [] as Flight[]; }),
          getMoments(t.id).catch((e) => { if (__DEV__) console.warn('[Home] moments error:', e); return [] as Moment[]; }),
          getGroupMembers(t.id).catch((e) => { if (__DEV__) console.warn('[Home] members error:', e); return [] as GroupMember[]; }),
          getSavedPlaces(t.id).catch(() => [] as Place[]),
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
        const allExpenses = await getExpenses(t.id).catch(() => []);
        setTotalSpent(allExpenses.reduce((sum, e) => sum + e.amount, 0));

        const todayIso = new Date().toISOString().slice(0, 10);
        const todayExps = allExpenses.filter((e) => e.date === todayIso);
        setTodaySpent(todayExps.reduce((sum, e) => sum + e.amount, 0));
        setTodayCount(todayExps.length);
        // If no outbound flight, determine phase from trip dates
        if (!outbound) {
          const tripStart = safeParse(t.startDate).getTime();
          const daysAway = (tripStart - Date.now()) / MS_PER_DAY;
          setPhase(daysAway > 7 ? 'planning' : 'upcoming');
        }
      } else {
        setFlights([]);
        setMoments([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load trip');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load();
    didInitialLoad.current = true;
    return () => { alive = false; };
  }, [load]);

  // Refresh budget + trip data when tab gets focus (e.g. after editing budget)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!didInitialLoad.current) return; // skip first mount
      const tripId = trip?.id;
      if (!tripId) return;
      // Lightweight refresh — just expenses + trip (for budgetLimit changes)
      Promise.all([
        getActiveTrip(),
        getExpenses(tripId).catch(() => []),
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
    load();
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
  const hotelPhotos = useMemo<string[]>(() => {
    if (!trip?.hotelPhotos) return FALLBACK_PHOTOS;
    try {
      const parsed = JSON.parse(trip.hotelPhotos);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : FALLBACK_PHOTOS;
    } catch {
      return FALLBACK_PHOTOS;
    }
  }, [trip?.hotelPhotos]);

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
  const notifCount = useNotificationCount(notifProps);

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
              load();
            }}
            accessibilityLabel="Retry loading trip"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </SafeAreaView>
      );
    }
    // No trip — welcoming empty state
    return (
      <SafeAreaView style={styles.fullCenter}>
        <EmptyState
          icon={Compass}
          title="Your next adventure starts here"
          subtitle="Create a trip to unlock your dashboard — add flights, budget, places, and more."
          actionLabel="Get Started"
          onAction={() => router.push('/onboarding')}
          secondaryLabel="Join a friend's trip"
          onSecondary={() => router.push('/onboarding')}
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
            ) : phase === 'planning' ? (
              <View style={styles.planningCard}>
                <Text style={styles.planningEmoji}>🗺️</Text>
                <Text style={styles.planningTitle}>Planning your trip</Text>
                <Text style={styles.planningSubtitle}>
                  {trip.destination} · {formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}
                </Text>
                <View style={styles.planningNudges}>
                  <Pressable style={styles.nudgeRow} onPress={() => router.push('/(tabs)/trip')}>
                    <Plane size={16} color={colors.accent} />
                    <Text style={styles.nudgeText}>Add your flights</Text>
                  </Pressable>
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

        {/* 6. Flight card */}
        {(() => {
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
