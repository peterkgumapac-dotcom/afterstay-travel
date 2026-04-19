import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnticipationHero } from '@/components/home/AnticipationHero';
import { ArrivedCard } from '@/components/home/ArrivedCard';
import { CountdownCard } from '@/components/home/CountdownCard';
import { FlightCard } from '@/components/home/FlightCard';
import { FlightProgressCard } from '@/components/home/FlightProgressCard';
import { TripActiveCard } from '@/components/home/TripActiveCard';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { NearbySection } from '@/components/home/NearbySection';
import ProfileRow from '@/components/home/ProfileRow';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { FLIGHTS } from '@/lib/flightData';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  getActiveTrip,
  getExpenseSummary,
  getFlights,
  getGroupMembers,
  getMoments,
} from '@/lib/supabase';
import type { Flight, GroupMember, Moment, Trip } from '@/lib/types';
import { formatDatePHT, safeParse } from '@/lib/utils';

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
    paddingTop: 24,
    paddingBottom: 12,
  },
  kicker: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.16 * 9.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
});

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const [phase, setPhase] = useState<TripPhase>('upcoming');
  const [totalSpent, setTotalSpent] = useState(0);
  const [userName, setUserName] = useState('Peter');
  const [userAvatar, setUserAvatar] = useState<string>();

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const t = await getActiveTrip();
      setTrip(t);
      await cacheSet('trip:active', t);
      if (t) {
        const [fs, ms, members] = await Promise.all([
          getFlights(t.id).catch(() => [] as Flight[]),
          getMoments(t.id).catch(() => [] as Moment[]),
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
        ]);
        setFlights(fs);
        setMoments(ms);
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
          if (override) {
            setPhase(override);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.fullCenter}>
        <ActivityIndicator color={colors.accentLt} />
        <Text style={styles.loadingText}>Loading your trip...</Text>
      </SafeAreaView>
    );
  }

  if (error || !trip) {
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

  // Hero gallery photos
  const hotelPhotos: string[] = (() => {
    if (!trip.hotelPhotos) return FALLBACK_PHOTOS;
    try {
      const parsed = JSON.parse(trip.hotelPhotos);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : FALLBACK_PHOTOS;
    } catch {
      return FALLBACK_PHOTOS;
    }
  })();

  // Date range label
  const dateRange = `${formatDatePHT(trip.startDate)} \u2013 ${formatDatePHT(trip.endDate)}`;

  // Countdown computation
  const tripStartMs = safeParse(trip.startDate).getTime();
  const tripEndMs = safeParse(trip.endDate).getTime();
  const nowMs = Date.now();
  const totalDays = Math.max(
    1,
    Math.ceil((tripEndMs - tripStartMs) / 86400000) + 1,
  );

  const countdown = (() => {
    if (nowMs < tripStartMs) {
      return { status: 'upcoming' as const, totalDays };
    }
    if (nowMs > tripEndMs + 86400000) {
      return { status: 'completed' as const, totalDays };
    }
    const dayNumber = Math.floor((nowMs - tripStartMs) / 86400000) + 1;
    return { status: 'active' as const, dayNumber, totalDays };
  })();

  // Quick access tiles
  const quickAccessTiles = [
    { id: 'checkin', iconName: 'checkin', label: 'Check-in', value: trip.checkIn || '3:00 PM' },
    { id: 'checkout', iconName: 'checkout', label: 'Checkout', value: trip.checkOut || '12:00 PM' },
    { id: 'wifi', iconName: 'wifi', label: 'WiFi', value: trip.wifiSsid || 'Not set' },
    { id: 'door', iconName: 'door', label: 'Door code', value: trip.doorCode ? '\u2022\u2022\u2022\u2022' : '\u2014' },
  ];

  // Room info
  const roomInfo = trip.roomType
    ? `${trip.roomType} \u00D7 2 \u00B7 ${totalDays} nights \u00B7 Apr 20 \u2013 27`
    : undefined;

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
        <ProfileRow userName={userName} avatarUrl={userAvatar} />

        {/* 2. Hero slideshow */}
        <AnticipationHero
          photos={hotelPhotos}
          hotelName={trip.accommodation}
          destination={trip.destination || 'Boracay, Philippines'}
          dateRange={dateRange}
          verified={true}
          roomInfo={roomInfo}
          bookingRef={trip.bookingRef ? `Agoda #${trip.bookingRef}` : undefined}
        />

        {/* 3. Phase card */}
        <View style={styles.phaseSection}>
          {phase === 'inflight' ? (
            <FlightProgressCard onLanded={landFlight} />
          ) : phase === 'arrived' ? (
            <ArrivedCard onStart={goExplore} />
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
            />
          ) : (
            <CountdownCard
              tripStartISO={
                flights.find((f) => f.direction === 'Outbound')?.departTime ??
                FLIGHTS.outbound.depart.timeISO
              }
              status={countdown.status}
              dayNumber={
                countdown.status === 'active'
                  ? countdown.dayNumber
                  : undefined
              }
              totalDays={countdown.totalDays}
              dateLabel={
                flights.find((f) => f.direction === 'Outbound')?.departTime
                  ? formatDatePHT(
                      flights.find((f) => f.direction === 'Outbound')!
                        .departTime,
                    )
                  : FLIGHTS.outbound.dateShort
              }
              onBoard={boardFlight}
            />
          )}
        </View>

        {/* 4. Weather — shown in active phase as "Boracay right now" */}
        {phase === 'active' && (
          <>
            <SectionHeader kicker="Weather" title="Boracay right now" />
            <WeatherForecastCard />
          </>
        )}

        {/* 5. Flight card */}
        <SectionHeader
          kicker={phase === 'active' ? 'Transit \u00B7 Return' : 'Transit \u00B7 Outbound'}
          title={phase === 'active' ? 'Flight home to Manila' : 'Flight to Caticlan'}
        />
        <FlightCard direction={phase === 'active' ? 'return' : 'outbound'} />

        {/* 4b. Weather — shown in non-active phase as "Boracay this week" */}
        {phase !== 'active' && (
          <>
            <SectionHeader kicker="Weather" title="Boracay this week" />
            <WeatherForecastCard />
          </>
        )}

        {/* 6. Quick access */}
        <SectionHeader
          kicker="Stay \u00B7 Quick access"
          title="Everything for check-in"
        />
        <QuickAccessGrid tiles={quickAccessTiles} />

        {/* 7. Moments preview */}
        <SectionHeader kicker="Moments \u00B7 Day 1" title="Trip so far" />

        {/* 8. Nearby */}
        <SectionHeader kicker="Nearby" title="Around the hotel" />
        <NearbySection />

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
      paddingBottom: 14,
    },
  });
