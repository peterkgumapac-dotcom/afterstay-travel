import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { X } from 'lucide-react-native';

import {
  getExpenses,
  getExpenseSummary,
  getFlights,
  getGroupMembers,
  getMoments,
  getSavedPlaces,
  getTripById,
  getTripMemory,
} from '@/lib/supabase';
import { generateTripMemory } from '@/lib/anthropic';
import type {
  GroupMember,
  Moment,
  TripMemory,
  TripMemoryExpenses,
  TripMemoryPlace,
  TripMemoryStats,
  TripMemoryVibe,
} from '@/lib/types';

import ProgressBar from '@/components/wrapped/ProgressBar';
import CoverCard from '@/components/wrapped/CoverCard';
import DurationCard from '@/components/wrapped/DurationCard';
import CrewCard from '@/components/wrapped/CrewCard';
import MomentsCard from '@/components/wrapped/MomentsCard';
import TopPlacesCard from '@/components/wrapped/TopPlacesCard';
import BudgetCard from '@/components/wrapped/BudgetCard';
import SpendingCard from '@/components/wrapped/SpendingCard';
import VibeCard from '@/components/wrapped/VibeCard';
import HighlightsCard from '@/components/wrapped/HighlightsCard';
import ShareCard from '@/components/wrapped/ShareCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Phase = 'loading' | 'generating' | 'ready' | 'error';

interface WrappedData {
  destination: string;
  startDate: string;
  endDate: string;
  nights: number;
  accommodation: string;
  heroPhotoUrl?: string;
  members: GroupMember[];
  moments: Moment[];
  featuredPhotoUrls: string[];
  totalMoments: number;
  places: TripMemoryPlace[];
  expenses: TripMemoryExpenses;
  stats: TripMemoryStats;
  vibe: TripMemoryVibe;
}

export default function TripWrappedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const flatListRef = useRef<FlatList>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<WrappedData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      setPhase('loading');

      // 1. Fetch all raw trip data in parallel
      const [trip, moments, expenses, expSummary, places, flights, members] = await Promise.all([
        getTripById(tripId),
        getMoments(tripId),
        getExpenses(tripId),
        getExpenseSummary(tripId),
        getSavedPlaces(tripId),
        getFlights(tripId),
        getGroupMembers(tripId),
      ]);

      if (!trip) throw new Error('Trip not found');

      // 2. Check for existing AI memory or generate one
      setPhase('generating');
      let memory: TripMemory | null = await getTripMemory(tripId);

      let stats: TripMemoryStats;
      let vibe: TripMemoryVibe;
      let expensesSummary: TripMemoryExpenses;
      let placesSummary: TripMemoryPlace[];

      if (memory) {
        stats = memory.statsCard;
        vibe = memory.vibeAnalysis;
        expensesSummary = memory.expenseSummary;
        placesSummary = memory.placesSummary;
      } else {
        // Generate AI content
        const aiResult = await generateTripMemory({
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          nights: trip.nights,
          accommodation: trip.accommodation,
          memberNames: members.map((m) => m.name),
          moments: moments.slice(0, 50).map((m) => ({
            date: m.date,
            caption: m.caption,
            location: m.location,
            tags: m.tags,
          })),
          places: places.slice(0, 30).map((p) => ({
            name: p.name,
            category: p.category,
            vote: p.vote ?? 'Pending',
            rating: p.rating,
            notes: p.notes,
          })),
          expenses: expenses.slice(0, 20).map((e) => ({
            description: e.description,
            amount: e.amount,
            category: e.category,
            date: e.date,
          })),
          flights: flights.map((f) => ({
            direction: f.direction,
            from: f.from ?? '',
            to: f.to ?? '',
            airline: f.airline ?? '',
          })),
        });

        stats = aiResult.statsCard;
        vibe = aiResult.vibeAnalysis;

        // Build expense summary from raw data
        const sortedExp = [...expenses].sort((a, b) => b.amount - a.amount);
        const byCat: Record<string, number> = {};
        for (const e of expenses) {
          byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
        }
        const topCats = Object.entries(byCat)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([category, amount]) => ({ category, amount }));

        expensesSummary = {
          total: expSummary.total,
          currency: trip.costCurrency ?? 'PHP',
          topCategories: topCats,
          biggestSplurge: sortedExp[0]
            ? { description: sortedExp[0].description, amount: sortedExp[0].amount }
            : undefined,
          dailyAverage: trip.nights > 0 ? expSummary.total / trip.nights : expSummary.total,
        };

        placesSummary = places.slice(0, 10).map((p) => ({
          name: p.name,
          category: p.category,
          rating: p.rating,
          vote: p.vote ?? 'Pending',
        }));
      }

      // 3. Resolve photo URLs for featured moments
      const photosWithUrls = moments
        .filter((m) => m.photo)
        .slice(0, 6);
      const featuredPhotoUrls = photosWithUrls.map((m) => m.photo!);

      // Hero photo — best scored moment
      const heroMoment = moments
        .filter((m) => m.photo)
        .sort((a, b) => {
          const scoreA = (a.caption && a.caption !== 'Untitled' ? 2 : 0) + (a.location ? 1 : 0) + (a.tags.length > 0 ? 1 : 0);
          const scoreB = (b.caption && b.caption !== 'Untitled' ? 2 : 0) + (b.location ? 1 : 0) + (b.tags.length > 0 ? 1 : 0);
          return scoreB - scoreA;
        })[0];
      const heroPhotoUrl = heroMoment?.photo;

      setData({
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        nights: trip.nights,
        accommodation: trip.accommodation,
        heroPhotoUrl,
        members,
        moments,
        featuredPhotoUrls,
        totalMoments: moments.length,
        places: placesSummary,
        expenses: expensesSummary,
        stats,
        vibe,
      });
      setPhase('ready');
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load recap');
      setPhase('error');
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const TOTAL_CARDS = 10;

  const renderCard = useCallback(
    ({ index }: { item: number; index: number }) => {
      if (!data) return <View style={{ width: SCREEN_W, height: SCREEN_H }} />;

      switch (index) {
        case 0:
          return (
            <CoverCard
              destination={data.destination}
              startDate={data.startDate}
              endDate={data.endDate}
              heroPhotoUrl={data.heroPhotoUrl}
            />
          );
        case 1:
          return (
            <DurationCard
              nights={data.nights}
              accommodation={data.accommodation}
              destination={data.destination}
            />
          );
        case 2:
          return (
            <CrewCard
              members={data.members.map((m) => ({
                name: m.name,
                profilePhoto: m.profilePhoto,
              }))}
            />
          );
        case 3:
          return (
            <MomentsCard
              totalMoments={data.totalMoments}
              photoUrls={data.featuredPhotoUrls}
            />
          );
        case 4:
          return <TopPlacesCard places={data.places} />;
        case 5:
          return (
            <BudgetCard
              total={data.expenses.total}
              currency={data.expenses.currency}
              dailyAverage={data.expenses.dailyAverage}
              nights={data.nights}
            />
          );
        case 6:
          return (
            <SpendingCard
              topCategories={data.expenses.topCategories}
              total={data.expenses.total}
              currency={data.expenses.currency}
            />
          );
        case 7:
          return (
            <VibeCard
              dominantMood={data.vibe.dominantMood}
              topTags={data.vibe.topTags}
              vibeDescription={data.vibe.vibeDescription}
            />
          );
        case 8:
          return <HighlightsCard stats={data.stats} />;
        case 9:
          return (
            <ShareCard
              destination={data.destination}
              startDate={data.startDate}
              endDate={data.endDate}
              nights={data.nights}
              momentCount={data.totalMoments}
              placesCount={data.places.length}
              totalSpent={data.expenses.total}
              currency={data.expenses.currency}
              memberCount={data.members.length}
            />
          );
        default:
          return null;
      }
    },
    [data],
  );

  const cardData = useMemo(() => Array.from({ length: TOTAL_CARDS }, (_, i) => i), []);

  if (phase === 'loading' || phase === 'generating') {
    return (
      <View style={[styles.center, { backgroundColor: '#0a0806' }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#d8ab7a" />
        <Text style={styles.loadingText}>
          {phase === 'generating' ? 'Creating your recap...' : 'Loading trip data...'}
        </Text>
      </View>
    );
  }

  if (phase === 'error' || !data) {
    return (
      <View style={[styles.center, { backgroundColor: '#0a0806' }]}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>{errorMsg || 'Something went wrong'}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Progress bar overlay */}
      <View style={[styles.progressOverlay, { top: insets.top }]}>
        <ProgressBar total={TOTAL_CARDS} current={currentIndex} />
      </View>

      {/* Close button overlay */}
      <Pressable
        style={[styles.closeOverlay, { top: insets.top + 28 }]}
        onPress={() => router.back()}
        accessibilityLabel="Close recap"
        accessibilityRole="button"
        hitSlop={12}
      >
        <X size={22} color="rgba(255,255,255,0.8)" />
      </Pressable>

      {/* Story cards */}
      <FlatList
        ref={flatListRef}
        data={cardData}
        renderItem={renderCard}
        keyExtractor={(item) => String(item)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        decelerationRate="fast"
        snapToInterval={SCREEN_W}
        snapToAlignment="start"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0806',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: 'rgba(241,235,226,0.6)',
    marginTop: 8,
  },
  errorText: {
    fontSize: 15,
    color: 'rgba(241,235,226,0.6)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#d8ab7a',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a0806',
  },
  closeBtn: {
    marginTop: 8,
  },
  closeBtnText: {
    fontSize: 14,
    color: 'rgba(241,235,226,0.5)',
  },
  progressOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeOverlay: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
