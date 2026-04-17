import { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnticipationHero } from '@/components/home/AnticipationHero';
import { BudgetAlertStrip } from '@/components/home/BudgetAlertStrip';
// import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { GettingThereLink } from '@/components/home/GettingThereLink';
import { GlanceStrip } from '@/components/home/GlanceStrip';
import ProfileRow from '@/components/home/ProfileRow';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { WeatherForecastCard } from '@/components/home/WeatherForecastCard';
import { colors, radius, spacing } from '@/constants/theme';
import { FLIGHTS } from '@/lib/flightData';
import { useRotatingQuote } from '@/hooks/useRotatingQuote';
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

  // Stats data
  const [userName, setUserName] = useState('Traveler');
  const [userAvatar, setUserAvatar] = useState<string>();
  const [budgetStats, setBudgetStats] = useState({ spent: 0, total: 0 });
  const [packingStats, setPackingStats] = useState({ packed: 0, total: 0 });
  const [filesCount, setFilesCount] = useState(0);

  const quote = useRotatingQuote(trip?.destination || '');

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const t = await getActiveTrip();
      setTrip(t);
      await cacheSet('trip:active', t);
      if (t) {
        const [fs, ms, members, expenses, packing, files] = await Promise.all([
          getFlights(t.id).catch(() => [] as Flight[]),
          getMoments(t.id).catch(() => [] as Moment[]),
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
          getExpenseSummary(t.id).catch(() => ({ total: 0, byCategory: {}, count: 0 })),
          getPackingList(t.id).catch(() => []),
          getTripFiles(t.id).catch(() => []),
        ]);
        setFlights(fs);
        setMoments(ms);
        await cacheSet(`flights:${t.id}`, fs);

        // User name from primary member
        const primary = members.find(m => m.role === 'Primary');
        if (primary) {
          setUserName(primary.name);
          if (primary.profilePhoto) setUserAvatar(primary.profilePhoto);
        }

        // Budget stats — exclude accommodation
        const dailyTotal = expenses.byCategory
          ? Object.entries(expenses.byCategory)
              .filter(([cat]) => cat !== 'Accommodation')
              .reduce((sum, [, amt]) => sum + (amt as number), 0)
          : 0;
        setBudgetStats({
          spent: dailyTotal,
          total: t.budgetLimit ?? 0,
        });

        // Packing stats
        setPackingStats({
          packed: packing.filter((p: any) => p.packed).length,
          total: packing.length,
        });

        // Files count
        setFilesCount(files.length);
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
        <ActivityIndicator color={colors.green2} />
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
      const diff = tripStartMs - nowMs;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return { status: 'upcoming' as const, days, hours, minutes, totalDays };
    }
    if (nowMs > tripEndMs + 86400000) {
      return { status: 'completed' as const, totalDays };
    }
    const dayNumber = Math.floor((nowMs - tripStartMs) / 86400000) + 1;
    return { status: 'active' as const, dayNumber, totalDays };
  })();

  // Quick access tiles
  const quickAccessTiles = [
    { id: 'wifi', iconName: 'wifi', label: 'WiFi', value: trip.wifiSsid || 'Not set' },
    { id: 'door', iconName: 'door', label: 'Door Code', value: trip.doorCode ? '\u2022\u2022\u2022\u2022' : '\u2014' },
    { id: 'checkin', iconName: 'checkin', label: 'Check-in', value: trip.checkIn || '3:00 PM' },
    { id: 'checkout', iconName: 'checkout', label: 'Checkout', value: trip.checkOut || '12:00 PM' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.green2}
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
          countdown={countdown}
          quote={quote}
          tripStartISO={FLIGHTS.outbound.depart.timeISO}
        />

        <BudgetAlertStrip />

        <WeatherForecastCard />

        <GlanceStrip
          budgetSpent={budgetStats.spent}
          budgetTotal={budgetStats.total}
          packingPacked={packingStats.packed}
          packingTotal={packingStats.total}
          filesCount={filesCount}
          photosCount={moments.length}
        />

        <GettingThereLink />

        <QuickAccessGrid tiles={quickAccessTiles} />
      </ScrollView>
      {/* <FloatingActionButton /> */}
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
    backgroundColor: colors.green,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.md,
  },
  retryText: { color: colors.white, fontWeight: '700' },
});
