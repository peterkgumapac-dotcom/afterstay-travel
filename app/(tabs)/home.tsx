import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AnticipationHero } from '@/components/home/AnticipationHero';
import { HomeMomentsPreview } from '@/components/home/HomeMomentsPreview';
import { ArrivedCard } from '@/components/home/ArrivedCard';
import { CountdownCard } from '@/components/home/CountdownCard';
import { FlightCard } from '@/components/home/FlightCard';
import { FlightProgressCard } from '@/components/home/FlightProgressCard';
import { TripActiveCard } from '@/components/home/TripActiveCard';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import LivingPostcardLoader from '@/components/loader/LivingPostcardLoader';
import ProfileRow from '@/components/home/ProfileRow';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  getActiveTrip,
  getExpenses,
  getExpenseSummary,
  getFlights,
  getGroupMembers,
  getMoments,
} from '@/lib/supabase';
import type { Flight, GroupMember, Moment, Trip } from '@/lib/types';
import { formatDatePHT, formatTimePHT, safeParse, tripStatusLabel } from '@/lib/utils';

type TripPhase = 'upcoming' | 'inflight' | 'arrived' | 'active';

const FALLBACK_PHOTOS = [
  'https://www.canyon.ph/wp-content/uploads/2023/01/CHRBoracay-Rooms-Executive-Suite-01.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/06/Family-Room-cover.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/06/CHRBoracay-Rooms-Deluxe-Double-01.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/04/CHRBoracay-Rooms-Deluxe-King-01.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/01/CHRBoracay-Rooms-Deluxe-w-Pool-01.jpg',
];

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
  const styles = getStyles(colors);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaderDone, setLoaderDone] = useState(false);
  const { setVisible: setTabBarVisible } = useTabBarVisibility();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const [phase, setPhase] = useState<TripPhase>('upcoming');
  const [totalSpent, setTotalSpent] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string>();
  const [members, setMembers] = useState<GroupMember[]>([]);

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
      }
      if (t) {
        const [fs, ms, members] = await Promise.all([
          getFlights(t.id).catch(() => [] as Flight[]),
          getMoments(t.id).catch(() => [] as Moment[]),
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
        ]);
        setFlights(fs);
        setMoments(ms);
        setMembers(members);
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

        // Fetch expense summary for active phase
        const summary = await getExpenseSummary(t.id).catch(() => ({
          total: 0,
          byCategory: {},
          count: 0,
        }));
        setTotalSpent(summary.total);

        // Today's expenses
        const todayIso = new Date().toISOString().slice(0, 10);
        const allExpenses = await getExpenses(t.id).catch(() => []);
        const todayExps = allExpenses.filter((e) => e.date === todayIso);
        setTodaySpent(todayExps.reduce((sum, e) => sum + e.amount, 0));
        setTodayCount(todayExps.length);
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
    cacheGet<Trip | null>('trip:active').then(async (cached) => {
      if (!alive || !cached) return;
      setTrip(cached);
      const cachedFlights = await cacheGet<Flight[]>(`flights:${cached.id}`);
      if (alive && cachedFlights) setFlights(cachedFlights);
      if (alive) setLoading(false);
    });
    load();
    return () => {
      alive = false;
    };
  }, [load]);

  // Hide tab bar during initial load, show once loader is done
  useEffect(() => {
    const isInitialLoading = loading || !loaderDone;
    setTabBarVisible(!isInitialLoading);
  }, [loading, loaderDone, setTabBarVisible]);

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
  const MS_PER_DAY = 86400000;
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

  // Quick access tiles
  const quickAccessTiles = useMemo(() => [
    { id: 'checkin', iconName: 'checkin', label: 'Check-in', value: trip?.checkIn || '3:00 PM' },
    { id: 'checkout', iconName: 'checkout', label: 'Checkout', value: trip?.checkOut || '12:00 PM' },
    { id: 'wifi', iconName: 'wifi', label: 'WiFi', value: trip?.wifiSsid || 'Not set' },
    { id: 'door', iconName: 'door', label: 'Door code', value: trip?.doorCode ? '\u2022\u2022\u2022\u2022' : '\u2014' },
  ], [trip?.checkIn, trip?.checkOut, trip?.wifiSsid, trip?.doorCode]);

  // Room info
  const roomInfo = useMemo(
    () => trip?.roomType
      ? `${trip.roomType} × 2 · ${totalNights} nights · ${dateRange}`
      : undefined,
    [trip?.roomType, totalNights, dateRange],
  );

  if (loading || !loaderDone) {
    return (
      <LivingPostcardLoader
        destination={trip?.destination ?? 'your trip'}
        name={userName || 'traveler'}
        onDone={() => setLoaderDone(true)}
      />
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.fullCenter}>
        <Text style={styles.errorTitle}>Couldn't load trip</Text>
        <Text style={styles.errorText}>
          {error ?? 'No active trip found.'}
        </Text>
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
        <ProfileRow userName={userName} avatarUrl={userAvatar} tripLabel={trip.destination ? `${trip.destination} trip` : undefined} />

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
                budgetStatus="cruising"
                spent={totalSpent}
                budget={trip.budgetLimit ?? 0}
                todaySpent={todaySpent}
                todayCount={todayCount}
              />
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

        {/* 7. Quick access — collapsible */}
        <CollapsibleSection
          kicker="Stay · Quick access"
          title="Everything for check-in"
          defaultOpen={false}
        >
          <QuickAccessGrid tiles={quickAccessTiles} />
        </CollapsibleSection>

        {/* Bottom spacer */}
        <View style={{ height: 16 }} />
      </ScrollView>
      <FloatingActionButton />
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
  });
