import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { DailyTrackerSheet } from '@/components/budget/DailyTrackerSheet';
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

import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';

export default function HomeScreenWithBoundary() {
  return (
    <TabErrorBoundary name="Home">
      <HomeScreen />
    </TabErrorBoundary>
  );
}

function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const h = useHomeScreen();
  const {
    trip, phase, flights, moments, savedPlaces, members,
    totalSpent, todaySpent, todayCount,
    dailyTrackerOn, dailyTrackerTotal, dailyTrackerCount, dailyTrackerByCat, setDailyTrackerOn,
    pastTrips, draftTrips, upcomingTrips, activeTrips, quickTrips, allTrips, lifetimeStats,
    returningMoments, returningSavedPlaces,
    userName, userAvatar, user,
    loading, loaderDone, showLoader, refreshing, error, debugInfo,
    hotelPhotos, isPlaneTransport, showFlightFeatures,
    isTestMode, segment,
    load, refresh, setRefreshing, setSavedPlaces, setPhase, setShowLoader,
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

  // Hide tab bar during initial load
  useEffect(() => {
    const isInitialLoading = loading || (showLoader && !loaderDone);
    setTabBarVisible(!isInitialLoading);
  }, [loading, showLoader, loaderDone, setTabBarVisible]);

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

  // Date range label (hotelPhotos now comes from hook)
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
  // In test mode, skip loader entirely — mock data is synchronous
  if (!isTestMode && (!loaderDone || loading)) {
    return <AfterStayLoader />;
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
      allTrips.some(t => !t.deletedAt && !t.isDraft);
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
            pastTrips={pastTrips}
            draftTrips={draftTrips}
            upcomingTrips={upcomingTrips}
            activeTrips={activeTrips}
            quickTrips={quickTrips}
            lifetimeStats={lifetimeStats}
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
            onAddMoment={() => router.push(`/add-moment?tripId=${pastTrips[0]?.id ?? ''}`)}
            onBellPress={() => setShowNotifications(true)}
            onSeeAllTrips={() => router.push('/(tabs)/trip')}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load({ force: true }); }}
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
                } catch {}
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
          avatarUrl={userAvatar}
          notificationCount={notifCount}
          onBellPress={() => setShowNotifications(true)}
        />
        <ScrollView
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load({ force: true }); }}
              tintColor={colors.accentLt}
            />
          }
        >
          <EmptyState
            icon={Compass}
            title="Your next adventure starts here"
            subtitle="Plan a trip, track your budget, capture moments, and discover amazing places."
            actionLabel="Plan a Trip"
            onAction={() => router.push('/onboarding')}
            secondaryLabel="Join a friend's trip"
            onSecondary={() => router.push('/onboarding')}
          />
          <TouchableOpacity
            style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
            onPress={() => router.push('/(tabs)/discover')}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={colors.accent} strokeWidth={2} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
              Discover places to visit
            </Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
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
