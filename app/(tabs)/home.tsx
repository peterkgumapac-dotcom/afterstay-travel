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
import { CountdownCard } from '@/components/home/CountdownCard';
import { FlightCard } from '@/components/home/FlightCard';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { NearbySection } from '@/components/home/NearbySection';
import ProfileRow from '@/components/home/ProfileRow';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { colors, radius, spacing } from '@/constants/theme';
import { FLIGHTS } from '@/lib/flightData';
import { cacheGet, cacheSet } from '@/lib/cache';
import {
  getActiveTrip,
  getExpenseSummary,
  getFlights,
  getGroupMembers,
  getMoments,
  getPackingList,
  getTripFiles,
} from '@/lib/notion';
import type { Flight, GroupMember, Moment, Trip } from '@/lib/types';
import { formatDatePHT } from '@/lib/utils';

const FALLBACK_PHOTOS = [
  'https://www.canyon.ph/wp-content/uploads/2023/01/CHRBoracay-Rooms-Executive-Suite-01.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/06/Family-Room-cover.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/06/CHRBoracay-Rooms-Deluxe-Double-01.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/04/CHRBoracay-Rooms-Deluxe-King-01.jpg',
  'https://www.canyon.ph/wp-content/uploads/2023/01/CHRBoracay-Rooms-Deluxe-w-Pool-01.jpg',
];

export default function HomeScreen() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const [userName, setUserName] = useState('Traveler');
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

        const primary = members.find(m => m.role === 'Primary');
        if (primary) {
          setUserName(primary.name);
          if (primary.profilePhoto) setUserAvatar(primary.profilePhoto);
        }
      } else {
        setFlights([]);
        setMoments([]);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load trip');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    cacheGet<Trip | null>('trip:active').then(async cached => {
      if (!alive || !cached) return;
      setTrip(cached);
      const cachedFlights = await cacheGet<Flight[]>(`flights:${cached.id}`);
      if (alive && cachedFlights) setFlights(cachedFlights);
      if (alive) setLoading(false);
    });
    load();
    return () => { alive = false; };
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

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
        <Text style={styles.errorText}>{error ?? 'No active trip found in Notion.'}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => { setLoading(true); load(); }}
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
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : FALLBACK_PHOTOS;
    } catch {
      return FALLBACK_PHOTOS;
    }
  })();

  // Date range label
  const dateRange = `${formatDatePHT(trip.startDate)} \u2013 ${formatDatePHT(trip.endDate)}`;

  // Countdown computation
  const tripStartMs = new Date(trip.startDate).getTime();
  const tripEndMs = new Date(trip.endDate).getTime();
  const nowMs = Date.now();
  const totalDays = Math.max(1, Math.ceil((tripEndMs - tripStartMs) / 86400000) + 1);

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
    { id: 'door', iconName: 'door', label: 'Door Code', value: trip.doorCode ? '\u2022\u2022\u2022\u2022' : '\u2014' },
  ];

  // Room info
  const roomInfo = trip.roomType
    ? `${trip.roomType} \u00D7 2 \u00B7 ${totalDays} nights \u00B7 ${dateRange}`
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
        <ProfileRow userName={userName} avatarUrl={userAvatar} />

        <AnticipationHero
          photos={hotelPhotos}
          hotelName={trip.accommodation}
          destination={trip.destination || 'Boracay, Philippines'}
          dateRange={dateRange}
          verified={true}
          roomInfo={roomInfo}
          bookingRef={trip.bookingRef ? `Agoda #${trip.bookingRef}` : undefined}
        />

        <CountdownCard
          tripStartISO={FLIGHTS.outbound.depart.timeISO}
          status={countdown.status}
          dayNumber={countdown.status === 'active' ? countdown.dayNumber : undefined}
          totalDays={countdown.totalDays}
          dateLabel={FLIGHTS.outbound.dateShort}
        />

        <FlightCard direction="outbound" />

        <WeatherForecastCard />

        <QuickAccessGrid tiles={quickAccessTiles} />

        <NearbySection />
      </ScrollView>
      <FloatingActionButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: radius.md,
  },
  retryText: { color: colors.white, fontWeight: '700' },
});
