import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHomeScreen } from '@/hooks/useHomeScreen';
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
import { useUserSegment } from '@/contexts/UserSegmentContext';
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
import DailyTrackerStrip from '@/components/home/DailyTrackerStrip';
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
  getDailyTrackerEnabled,
  setDailyTrackerEnabled,
  getDailyExpenseSummary,
  addDailyExpense,
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
import { getQuickTrips } from '@/lib/quickTrips';
import { fetchDestinationPhotos } from '@/lib/google-places';
import type { Flight, GroupMember, LifetimeStats, Moment, Place, Trip } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';
import { setHotelCoords } from '@/lib/config';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';
import { getTripDayMetrics, inferFlightLeg, sortFlightsByTime } from '@/lib/tripState';

const DEST_PHOTO_CACHE_KEY = 'hero:destination-photos';

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
    loaderDone,
    showLoader,
    refreshing,
    error,
    debugInfo,
    hotelPhotos,
    heroLocation,
    isPlaneTransport,
    showFlightFeatures,
    isTestMode,
    segment,
    load,
    refresh,
    setRefreshing,
    setSavedPlaces,
    setManualPhaseOverride,
    clearManualPhaseOverride,
    setShowLoader,
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
  }, []);

  // Realtime vote updates from other members
  useVoteSubscription(
    trip?.id ?? null,
    useCallback((placeId: string, voteByMember: Record<string, any>, vote: any) => {
      setSavedPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, voteByMember, vote } : p)));
    }, []),
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
    [trip?.startDate, trip?.endDate],
  );

  // Countdown computation
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(
    () => getTripDayMetrics(trip, clockNow),
    [trip?.id, trip?.startDate, trip?.endDate, trip?.status, clockNow],
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
            onAddQuickTrip={() => router.push('/quick-trip-create')}
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

    // First-time user — welcoming empty state
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
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentLt} />}
        >
          <EmptyState
            icon={Compass}
            title="Your next adventure starts here"
            subtitle="Plan a trip, track your budget, capture moments, and discover amazing places."
            actionLabel="Plan a Trip"
            onAction={() => router.push('/onboarding')}
            secondaryLabel="Join a friend's trip"
            onSecondary={() => router.push('/join-trip')}
          />
          <TouchableOpacity
            style={{
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 12,
              paddingHorizontal: 20,
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => router.push('/(tabs)/discover')}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={colors.accent} strokeWidth={2} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Discover places to visit</Text>
          </TouchableOpacity>
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
