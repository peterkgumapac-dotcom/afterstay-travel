import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHomeScreen } from '@/hooks/useHomeScreen';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BookOpen, Camera, ReceiptText, ScanLine, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

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
import ReturningUserHome from '@/components/home/ReturningUserHome';
import DailyTrackerStrip from '@/components/home/DailyTrackerStrip';
import { ExploreMemoriesCard } from '@/components/home/ExploreMemoriesCard';
import { TripReadinessCard } from '@/components/home/TripReadinessCard';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { DailyTrackerSheet } from '@/components/budget/DailyTrackerSheet';
import ProfileRow from '@/components/home/ProfileRow';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
import {
  archiveTrip,
  setDailyTrackerEnabled,
  addDailyExpense,
} from '@/lib/supabase';
import type { Flight, Trip } from '@/lib/types';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';
import { getTripDayMetrics, inferFlightLeg, sortFlightsByTime } from '@/lib/tripState';

/* ── Section header matching prototype's GroupHeader ── */
function SectionHeader({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={sectionHeaderStyles.container}>
      <View>
        <Text style={[sectionHeaderStyles.kicker, { color: colors.text3 }]}>{kicker}</Text>
        <Text style={[sectionHeaderStyles.title, { color: colors.text }]}>{title}</Text>
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

function cleanLocationText(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function shortLocationLabel(value: string) {
  const normalized = cleanLocationText(value);
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : normalized;
}

function resolvePlanningLocation(trip: Trip, flights: Flight[]) {
  const destination = cleanLocationText(trip.destination);
  if (destination) {
    return { query: destination, label: shortLocationLabel(destination), source: 'destination' as const };
  }

  const address = cleanLocationText(trip.address);
  if (address) {
    return { query: address, label: shortLocationLabel(address), source: 'stay' as const };
  }

  const accommodation = cleanLocationText(trip.accommodation);
  if (accommodation) {
    return { query: accommodation, label: accommodation, source: 'stay' as const };
  }

  const sortedFlights = sortFlightsByTime(flights);
  const outbound = sortedFlights.find(
    (flight) => inferFlightLeg(flight, flights) === 'outbound' && cleanLocationText(flight.to),
  );
  if (outbound?.to) {
    const label = shortLocationLabel(outbound.to);
    return { query: outbound.to, label, source: 'flight' as const };
  }

  const returnFlight = sortedFlights.find(
    (flight) => inferFlightLeg(flight, flights) === 'return' && cleanLocationText(flight.from),
  );
  if (returnFlight?.from) {
    const label = shortLocationLabel(returnFlight.from);
    return { query: returnFlight.from, label, source: 'flight' as const };
  }

  return { query: '', label: '', source: 'none' as const };
}

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
          <Text style={[sectionHeaderStyles.kicker, { color: colors.text3 }]}>{kicker}</Text>
          <Text style={[sectionHeaderStyles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <Text style={{ color: colors.text3, fontSize: 12, fontWeight: '600' }}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open && children}
    </View>
  );
}

function HomePrimaryAction({
  icon: Icon,
  title,
  subtitle,
  onPress,
  primary = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        onboardingStyles.actionCard,
        { backgroundColor: primary ? colors.accent : colors.card, borderColor: primary ? colors.accent : colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.76}
    >
      <View style={[onboardingStyles.actionIcon, { backgroundColor: primary ? 'rgba(255,255,255,0.18)' : colors.accentDim }]}>
        <Icon size={18} color={primary ? colors.white : colors.accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[onboardingStyles.actionTitle, { color: primary ? colors.white : colors.text }]}>{title}</Text>
        <Text style={[onboardingStyles.actionSubtitle, { color: primary ? 'rgba(255,255,255,0.78)' : colors.text3 }]}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function HowAfterStayWorks() {
  const { colors } = useTheme();
  const steps = [
    { icon: ScanLine, title: 'Scan', body: 'Import flights, hotels, dates, and booking details.' },
    { icon: Users, title: 'Invite', body: 'Bring companions into the same trip plan.' },
    { icon: ReceiptText, title: 'Budget', body: 'Track spend, scan receipts, and split costs.' },
    { icon: Camera, title: 'Moments', body: 'Save personal and group memories as you travel.' },
  ];
  return (
    <View style={[onboardingStyles.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[onboardingStyles.howKicker, { color: colors.text3 }]}>How AfterStay works</Text>
      <Text style={[onboardingStyles.howTitle, { color: colors.text }]}>One trip, four simple layers</Text>
      <View style={onboardingStyles.howGrid}>
        {steps.map(({ icon: Icon, title, body }) => (
          <View key={title} style={onboardingStyles.howItem}>
            <View style={[onboardingStyles.howIcon, { backgroundColor: colors.accentDim }]}>
              <Icon size={15} color={colors.accent} strokeWidth={2} />
            </View>
            <Text style={[onboardingStyles.howItemTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[onboardingStyles.howBody, { color: colors.text3 }]}>{body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const onboardingStyles = StyleSheet.create({
  firstTripScroll: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 120,
    gap: 14,
  },
  welcomeBlock: {
    paddingVertical: 10,
  },
  welcomeKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  welcomeBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  howCard: {
    marginTop: 4,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  howKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  howTitle: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  howGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  howItem: {
    width: '47%',
    minHeight: 118,
  },
  howIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  howItemTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  howBody: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
});

export default function HomeScreenWithBoundary() {
  return (
    <TabErrorBoundary name="Home">
      <HomeScreenMemo />
    </TabErrorBoundary>
  );
}

const HomeScreenMemo = React.memo(HomeScreen);

function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const h = useHomeScreen();
  const {
    trip,
    phase,
    hasPhaseOverride,
    flights,
    phaseFlight,
    moments,
    savedPlaces,
    members,
    totalSpent,
    todaySpent,
    todayCount,
    dailyTrackerOn,
    dailyTrackerTotal,
    dailyTrackerCount,
    dailyTrackerByCat,
    setDailyTrackerOn,
    pastTrips,
    draftTrips,
    upcomingTrips,
    activeTrips,
    quickTrips,
    allTrips,
    lifetimeStats,
    returningMoments,
    returningMembers,
    returningSavedPlaces,
    userName,
    userAvatar,
    user,
    loading,
    historyHydrated,
    loaderDone,
    showLoader,
    refreshing,
    error,
    debugInfo,
    hotelPhotos,
    heroLocation,
    showFlightFeatures,
    isTestMode,
    load,
    refresh,
    setSavedPlaces,
    setManualPhaseOverride,
    clearManualPhaseOverride,
  } = h;

  // UI-only state (not data)
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDailySheet, setShowDailySheet] = useState(false);
  const [showVotingSheet, setShowVotingSheet] = useState(false);
  const { setVisible: setTabBarVisible } = useTabBarVisibility();

  // REMOVED: all data state, load(), cache-first effect, focus listener, test mode effects
  // These now live in useHomeScreen() hook

  // Data state, effects, test mode — all in useHomeScreen hook above

  // Resolve current user's group member ID
  const currentMemberId = useMemo(() => members.find((m) => m.userId === user?.id)?.id ?? '', [members, user?.id]);

  // Places needing group votes
  const pendingVotePlaces = useMemo(
    () =>
      savedPlaces.filter((p) => {
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
    setSavedPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, voteByMember: votes } : p)));
  }, [setSavedPlaces]);

  // Realtime vote updates from other members
  useVoteSubscription(
    trip?.id ?? null,
    useCallback((placeId: string, voteByMember: Record<string, any>, vote: any) => {
      setSavedPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, voteByMember, vote } : p)));
    }, [setSavedPlaces]),
  );

  // Hide tab bar during initial load
  useEffect(() => {
    const isInitialLoading = loading || (showLoader && !loaderDone);
    setTabBarVisible(!isInitialLoading);
  }, [loading, showLoader, loaderDone, setTabBarVisible]);

  const boardFlight = useCallback(async () => {
    await setManualPhaseOverride('inflight');
  }, [setManualPhaseOverride]);

  const landFlight = useCallback(async () => {
    await setManualPhaseOverride('arrived');
  }, [setManualPhaseOverride]);

  const goExplore = useCallback(async () => {
    await setManualPhaseOverride('active');
  }, [setManualPhaseOverride]);

  // Date range label (hotelPhotos now comes from hook)
  const dateRange = useMemo(
    () => (trip ? `${formatDatePHT(trip.startDate)} \u2013 ${formatDatePHT(trip.endDate)}` : ''),
    [trip],
  );

  // Countdown computation
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(
    () => getTripDayMetrics(trip, clockNow),
    [trip, clockNow],
  );
  const totalNights = countdown.totalDays;
  const openTripOverview = useCallback(
    (section?: 'flights') => {
      if (trip?.id) {
        router.push({
          pathname: '/trip-overview',
          params: section ? { tripId: trip.id, section } : { tripId: trip.id },
        } as never);
      } else {
        router.push('/trip-overview' as never);
      }
    },
    [router, trip?.id],
  );

  // Notification count for bell badge
  const notifProps = useMemo(
    () => ({
      tripStatus: countdown.status,
      dayOfTrip: countdown.status === 'active' ? (countdown.dayNumber ?? 1) : 1,
      totalDays: countdown.totalDays,
      daysLeft: countdown.daysLeft,
      spent: totalSpent,
      budget: trip?.budgetLimit ?? 0,
      savedPlaces,
      members,
      destination: trip?.destination ?? '',
    }),
    [countdown, totalSpent, trip?.budgetLimit, trip?.destination, savedPlaces, members],
  );
  // Single notification state — shared with both badge count and sheet
  const { notifications: dbNotifications, unreadCount: dbUnread, markRead, markAllRead } = useNotifications();
  const notifCount = useNotificationCount(notifProps, dbUnread);

  // Room info
  const roomInfo = useMemo(
    () => (trip?.roomType ? `${trip.roomType} × 2 · ${totalNights} nights · ${dateRange}` : undefined),
    [trip?.roomType, totalNights, dateRange],
  );

  const planningLocation = useMemo(
    () => (trip ? resolvePlanningLocation(trip, flights) : { query: '', label: '', source: 'none' as const }),
    [trip, flights],
  );
  const planningLocationTitle =
    planningLocation.source === 'destination'
      ? `Top 5 in ${planningLocation.label}`
      : planningLocation.label
        ? `Top 5 near ${planningLocation.label}`
        : 'Unlock local picks';

  // Show branded loader until both: 3s minimum passed AND data loaded
  // In test mode, skip loader entirely — mock data is synchronous
  if (!isTestMode && (!loaderDone || loading)) {
    return (
      <AfterStayLoader
        message="Loading your trip..."
        steps={[
          'Checking active trip',
          'Loading flights and companions',
          'Preparing budget and places',
          'Refreshing your travel story',
        ]}
      />
    );
  }

  // Hook already returns test-mode-aware values for pastTrips, draftTrips, etc.

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
    // In test mode, segment is the sole gate (ignore real trip data)
    const hasHistory =
      pastTrips.length > 0 ||
      upcomingTrips.length > 0 ||
      activeTrips.length > 0 ||
      quickTrips.length > 0 ||
      draftTrips.length > 0 ||
      allTrips.some((t) => !t.deletedAt && !t.isDraft);
    if (!isTestMode && !historyHydrated && !hasHistory) {
      return (
        <AfterStayLoader
          message="Checking your travel history..."
          steps={[
            'Looking for active trips',
            'Checking past and upcoming trips',
            'Preparing your travel home',
          ]}
        />
      );
    }
    if (hasHistory) {
      const displayName = userName || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
      const handle =
        user?.email?.split('@')[0] ||
        (displayName.length > 0 ? displayName.toLowerCase().replace(/\s+/g, '') : 'traveler');
      return (
        <View style={{ flex: 1 }}>
          <ReturningUserHome
            userName={displayName}
            userId={user?.id}
            userHandle={handle}
            avatarUrl={userAvatar}
            notificationCount={notifCount}
            pastTrips={pastTrips}
            draftTrips={draftTrips}
            upcomingTrips={upcomingTrips}
            activeTrips={activeTrips}
            quickTrips={quickTrips}
            lifetimeStats={lifetimeStats}
            recentMoments={returningMoments}
            recentMembers={returningMembers}
            savedPlaces={returningSavedPlaces}
            onPlanTrip={() => router.push('/onboarding')}
            onTripPress={(id) => router.push(`/trip-recap?tripId=${id}`)}
            onDraftTripPress={(id) => router.push({ pathname: '/trip-overview', params: { tripId: id } } as never)}
            onUpcomingTripPress={(id) => router.push({ pathname: '/(tabs)/trip', params: { tripId: id } })}
            onArchiveDraft={async (id) => {
              try {
                await archiveTrip(id);
                load({ force: true });
              } catch {
                Alert.alert('Error', 'Something went wrong. Please try again.');
              }
            }}
            onQuickTripPress={(id) => router.push(`/quick-trip-detail?quickTripId=${id}`)}
            onAddQuickTrip={() => router.push('/quick-trip-create?allowNoPhotos=1')}
            onAddMoment={() => router.push(`/add-moment?tripId=${pastTrips[0]?.id ?? ''}`)}
            onBellPress={() => setShowNotifications(true)}
            onSeeAllTrips={() => router.push('/(tabs)/trip')}
            refreshing={refreshing}
            onRefresh={refresh}
            dailyTrackerSlot={
              <DailyTrackerStrip
                enabled={dailyTrackerOn}
                todayTotal={dailyTrackerTotal}
                todayCount={dailyTrackerCount}
                byCategory={dailyTrackerByCat}
                currency="PHP"
                onPress={() => router.push('/(tabs)/budget' as never)}
                onAddPress={() => setShowDailySheet(true)}
                onEnable={async () => {
                  await setDailyTrackerEnabled(true).catch(() => {});
                  setDailyTrackerOn(true);
                }}
              />
            }
            exploreMemoriesSlot={
              <ExploreMemoriesCard
                variant={pastTrips[0] ? 'afterTrip' : 'inspiration'}
                tripId={pastTrips[0]?.id}
              />
            }
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
          {dailyTrackerOn && (
            <DailyTrackerSheet
              visible={showDailySheet}
              onClose={() => setShowDailySheet(false)}
              onSave={async (input) => {
                try {
                  await addDailyExpense(input);
                  load({ silent: true });
                } catch {
                  Alert.alert('Error', 'Something went wrong. Please try again.');
                }
              }}
            />
          )}
        </View>
      );
    }

    // First-time user — welcome + retention path, not a dead empty page
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ProfileRow
          userName={userName || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''}
          userId={user?.id}
          avatarUrl={userAvatar}
          notificationCount={notifCount}
          onBellPress={() => setShowNotifications(true)}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={onboardingStyles.firstTripScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentLt} />}
        >
          <View style={onboardingStyles.welcomeBlock}>
            <Text style={[onboardingStyles.welcomeKicker, { color: colors.text3 }]}>Welcome to AfterStay</Text>
            <Text style={[onboardingStyles.welcomeTitle, { color: colors.text }]}>Start with a booking, or just explore.</Text>
            <Text style={[onboardingStyles.welcomeBody, { color: colors.text2 }]}>
              Scan a trip, join a companion, or browse real moments from other travelers while your next plan takes shape.
            </Text>
          </View>

          <HomePrimaryAction
            icon={BookOpen}
            title="Plan a trip"
            subtitle="Create your travel hub for flights, stays, budget, essentials, and memories."
            primary
            onPress={() => router.push('/onboarding')}
          />
          <HomePrimaryAction
            icon={Users}
            title="Join a friend's trip"
            subtitle="Enter an invite code and see the shared plan without duplicate setup."
            onPress={() => router.push('/join-trip')}
          />
          <HomePrimaryAction
            icon={Camera}
            title="Capture a quick trip"
            subtitle="Save a day out, meal, or spontaneous memory without full planning."
            onPress={() => router.push('/quick-trip-create?allowNoPhotos=1' as never)}
          />

          <ExploreMemoriesCard />
          <HowAfterStayWorks />
          {__DEV__ && debugInfo.length > 0 && (
            <Text style={{ marginTop: 12, color: colors.text3, fontSize: 10, fontFamily: 'monospace' }}>
              {debugInfo}
            </Text>
          )}
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentLt} />}
      >
        {/* 1. Top bar */}
        <ProfileRow
          userName={userName}
          userId={user?.id}
          avatarUrl={userAvatar}
          tripLabel={trip.destination ? `${trip.destination} trip` : undefined}
          notificationCount={notifCount}
          onBellPress={() => setShowNotifications(true)}
        />

        {/* 2. Hero slideshow */}
        <AnticipationHero
          photos={hotelPhotos}
          hotelName={trip.accommodation}
          destination={heroLocation || planningLocation.query || trip.destination || ''}
          dateRange={dateRange}
          verified={true}
          roomInfo={roomInfo}
          bookingRef={trip.bookingRef ? `Agoda #${trip.bookingRef}` : undefined}
          members={members}
          resolveDestinationFallback={false}
          onViewTrip={() => openTripOverview()}
        />

        {/* 2b. Daily Tracker strip */}
        <DailyTrackerStrip
          enabled={dailyTrackerOn}
          todayTotal={dailyTrackerTotal}
          todayCount={dailyTrackerCount}
          byCategory={dailyTrackerByCat}
          currency={trip.costCurrency ?? 'PHP'}
          onPress={() => router.push('/(tabs)/budget' as never)}
          onAddPress={() => setShowDailySheet(true)}
          onEnable={async () => {
            await setDailyTrackerEnabled(true).catch(() => {});
            setDailyTrackerOn(true);
          }}
        />

        {/* 3. Phase card */}
        <View style={styles.phaseSection}>
          <Animated.View key={phase} entering={FadeIn.duration(350)} exiting={FadeOut.duration(200)}>
            {phase === 'inflight' ? (
              (() => {
                return (
                  <FlightProgressCard
                    onLanded={landFlight}
                    fromCode={phaseFlight?.from}
                    fromCity={phaseFlight?.from === 'MNL' ? 'Manila' : phaseFlight?.from}
                    toCode={phaseFlight?.to}
                    toCity={phaseFlight?.to === 'MPH' ? 'Caticlan' : phaseFlight?.to}
                    etaLabel={phaseFlight?.arriveTime ? formatTimePHT(phaseFlight.arriveTime) : undefined}
                    departIso={phaseFlight?.departTime}
                    arriveIso={phaseFlight?.arriveTime}
                  />
                );
              })()
            ) : phase === 'arrived' ? (
              <ArrivedCard destination={trip.destination} hotelName={trip.accommodation} onStart={goExplore} />
            ) : phase === 'active' ? (
              <TripActiveCard
                trip={trip}
                dayOfTrip={countdown.status === 'active' ? (countdown.dayNumber ?? 1) : 1}
                totalDays={countdown.totalDays}
                daysLeft={countdown.daysLeft}
                budgetStatus={(() => {
                  const b = trip.budgetLimit ?? 0;
                  if (b <= 0) return 'cruising';
                  const pctSpent = totalSpent / b;
                  const pctTime =
                    (countdown.status === 'active' ? (countdown.dayNumber ?? 1) : 1) / countdown.totalDays;
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
                placesCount={savedPlaces.length}
                totalSpent={totalSpent}
                currency={trip.costCurrency ?? 'PHP'}
                onViewMemory={() => router.push({ pathname: '/trip-memory', params: { tripId: trip.id } } as never)}
                onShare={() => router.push({ pathname: '/trip-recap', params: { tripId: trip.id } } as never)}
              />
            ) : phase === 'planning' ? (
              /* DRAFT — no confirmed booking yet */
              <View style={styles.draftCard}>
                <Text style={styles.draftTitle}>{trip.destination ?? 'Your trip'}</Text>
                <Text style={styles.draftDates}>
                  {formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}
                </Text>
                <Text style={styles.draftHint}>
                  Upload your booking confirmation to unlock countdown, flights, and weather
                </Text>
                <TouchableOpacity
                  style={styles.draftUploadBtn}
                  onPress={() => router.push({ pathname: '/scan-trip', params: { tripId: trip.id } } as never)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.draftUploadText}>Upload Booking</Text>
                </TouchableOpacity>
              </View>
            ) : phase === 'upcoming' ? (
              <CountdownCard
                tripStartISO={phaseFlight?.departTime ?? trip.startDate}
                status={'upcoming'}
                dayNumber={undefined}
                totalDays={countdown.totalDays}
                dateLabel={
                  phaseFlight?.departTime ? formatDatePHT(phaseFlight.departTime) : formatDatePHT(trip.startDate)
                }
                onBoard={boardFlight}
              />
            ) : null}
          </Animated.View>
          {hasPhaseOverride && phase !== 'completed' && phase !== 'planning' && phase !== 'upcoming' ? (
            <TouchableOpacity style={styles.resetPhaseBtn} onPress={clearManualPhaseOverride} activeOpacity={0.75}>
              <Text style={styles.resetPhaseText}>Reset to schedule</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {trip && phase === 'completed' ? (
          <ExploreMemoriesCard variant="afterTrip" tripId={trip.id} />
        ) : null}

        {/* Smart nudges moved to bell icon → NotificationsSheet */}

        {/* 3b. Trip readiness — always visible so travelers can see what is missing */}
        {trip && phase !== 'completed' && (
          <TripReadinessCard
            trip={trip}
            flights={flights}
            members={members}
            savedPlaces={savedPlaces}
            onScanBooking={() => router.push({ pathname: '/scan-trip', params: { tripId: trip.id } } as never)}
            onAction={(key) => {
              switch (key) {
                case 'flights':
                  openTripOverview('flights');
                  break;
                case 'accommodation':
                  openTripOverview();
                  break;
                case 'members':
                  router.push('/add-member' as never);
                  break;
                case 'places':
                  router.push('/(tabs)/discover' as never);
                  break;
                case 'budget':
                  router.push('/(tabs)/budget' as never);
                  break;
                default:
                  openTripOverview();
              }
            }}
          />
        )}

        {/* 3c. Top picks — keep this high on the page so planning does not dead-end */}
        {planningLocation.query ? (
          <>
            <SectionHeader kicker="Curated for you" title={planningLocationTitle} />
            <HomeTopPicks destination={planningLocation.query} hotelName={trip.accommodation || undefined} />
          </>
        ) : (
          <>
            <SectionHeader kicker="Curated for you" title={planningLocationTitle} />
            <View style={styles.discoverFallbackCard}>
              <Text style={styles.discoverFallbackTitle}>Add a destination or booking to unlock local picks</Text>
              <Text style={styles.discoverFallbackBody}>
                Scan your hotel or flight details so AfterStay can suggest places near where you are actually going.
              </Text>
              <View style={styles.discoverFallbackActions}>
                <TouchableOpacity
                  style={styles.discoverPrimaryBtn}
                  onPress={() => router.push({ pathname: '/scan-trip', params: { tripId: trip.id } } as never)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.discoverPrimaryText}>Scan Booking</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.discoverSecondaryBtn}
                  onPress={() => openTripOverview()}
                  activeOpacity={0.75}
                >
                  <Text style={styles.discoverSecondaryText}>Edit Trip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* 3d. Quick access tiles — check-in, checkout, WiFi, door code */}
        {trip.accommodation && (
          <>
            <SectionHeader kicker="Stay" title="Quick access" />
            <QuickAccessGrid trip={trip} />
          </>
        )}

        {/* 4. Moments preview — first after trip card */}
        <SectionHeader
          kicker={`Moments · Day ${countdown.status === 'active' ? (countdown.dayNumber ?? 1) : 1}`}
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
          title={
            phase === 'active'
              ? `${trip.destination ?? 'Destination'} right now`
              : `${trip.destination ?? 'Destination'} this week`
          }
        >
          <WeatherForecastCard destination={trip.destination} />
        </CollapsibleSection>

        {/* 6. Flight card — only for plane transport or existing flights */}
        {showFlightFeatures &&
          (() => {
            const visibleFlights = sortFlightsByTime(flights)
              .map((flight) => ({ flight, direction: inferFlightLeg(flight, flights) }))
              .filter((item, index, arr) => arr.findIndex((other) => other.flight.id === item.flight.id) === index);
            const fallbackDirection = phase === 'active' ? 'return' : 'outbound';
            const firstFlight = visibleFlights[0]?.flight;
            const title =
              visibleFlights.length > 1
                ? 'Trip flights'
                : `Flight to ${firstFlight?.to ?? (phase === 'active' ? 'Home' : (trip.destination ?? 'Destination'))}`;
            return (
              <>
                <SectionHeader
                  kicker={`Transit · ${visibleFlights.length > 1 ? 'Round trip' : fallbackDirection === 'return' ? 'Return' : 'Outbound'}`}
                  title={title}
                />
                <View style={styles.flightStack}>
                  {visibleFlights.length > 0 ? (
                    visibleFlights.map(({ flight, direction }) => (
                      <FlightCard
                        key={flight.id}
                        flight={flight}
                        direction={direction}
                        onAddFlight={() => openTripOverview('flights')}
                      />
                    ))
                  ) : (
                    <FlightCard direction={fallbackDirection} onAddFlight={() => openTripOverview('flights')} />
                  )}
                </View>
              </>
            );
          })()}

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
      {dailyTrackerOn && (
        <DailyTrackerSheet
          visible={showDailySheet}
          onClose={() => setShowDailySheet(false)}
          onSave={async (input) => {
            try {
              await addDailyExpense(input);
              load({ silent: true });
            } catch (e) {
              if (__DEV__) console.warn('[Home] add daily expense failed:', e);
            }
          }}
        />
      )}
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
    resetPhaseBtn: {
      alignSelf: 'center',
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetPhaseText: {
      color: colors.text2,
      fontSize: 12,
      fontWeight: '700',
    },
    flightStack: {
      gap: 12,
    },
    draftCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    draftTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    draftDates: {
      fontSize: 13,
      color: colors.text2,
      marginBottom: 12,
    },
    draftHint: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 18,
    },
    draftUploadBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 13,
      paddingHorizontal: 28,
      borderRadius: 14,
    },
    draftUploadText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    discoverFallbackCard: {
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      gap: 10,
    },
    discoverFallbackTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    discoverFallbackBody: {
      color: colors.text3,
      fontSize: 12,
      lineHeight: 18,
    },
    discoverFallbackActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    discoverPrimaryBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 11,
      backgroundColor: colors.accent,
    },
    discoverPrimaryText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    discoverSecondaryBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card2,
    },
    discoverSecondaryText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
  });
