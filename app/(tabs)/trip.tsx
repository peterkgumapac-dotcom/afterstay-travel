import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Map, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';

import AddTripSheet from '@/components/summary/AddTripSheet';
import ShareTravelStats from '@/components/profile/ShareTravelStats';
import type { ConstellationData } from '@/components/profile/TravelConstellationMap';
import EmptyState from '@/components/shared/EmptyState';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
import { SummaryTab } from '@/components/trip/SummaryTab';
import { useTheme } from '@/constants/ThemeContext';
import {
  getHighlights,
  archiveTrip,
  discardDraftTrip,
  softDeleteTrip,
  restoreTrip,
  getProfile,
} from '@/lib/supabase';
import {
  getActiveTripPromise,
  getActiveTripCached,
  getAllTripsPromise,
  getAllTripsCached,
  getQuickTripsPromise,
  getQuickTripsCached,
  getLifetimeStatsPromise,
  getLifetimeStatsCached,
  getExpenseSummaryPromise,
} from '@/hooks/useTabTrips';
import type { QuickTrip } from '@/lib/quickTripTypes';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useAuth } from '@/lib/auth';
import { formatDatePHT, safeParse } from '@/lib/utils';
import type {
  Highlight,
  Trip,
} from '@/lib/types';

// ---------- TYPES ----------

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ---------- CONSTANTS ----------

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];

function formatTravelStatsSpent(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '₱0';
  if (amount >= 1_000_000) return `₱${Math.round(amount / 100_000) / 10}m`;
  if (amount >= 1_000) return `₱${Math.round(amount / 1_000)}k`;
  return `₱${Math.round(amount)}`;
}

interface PastTripDisplay {
  tripId?: string;
  flag: string;
  dest: string;
  country: string;
  dates: string;
  nights: number;
  spent: number;
  miles: number;
  rating: number;
  hasMemory?: boolean;
  isDraft?: boolean;
  lifecycleStatus?: 'Planning' | 'Active' | 'Completed' | 'Draft' | 'Archived';
}

const COUNTRY_FLAGS: Record<string, string> = {
  JP: '\u{1F1EF}\u{1F1F5}',
  VN: '\u{1F1FB}\u{1F1F3}',
  PH: '\u{1F1F5}\u{1F1ED}',
  TH: '\u{1F1F9}\u{1F1ED}',
  SG: '\u{1F1F8}\u{1F1EC}',
  US: '\u{1F1FA}\u{1F1F8}',
  KR: '\u{1F1F0}\u{1F1F7}',
  ID: '\u{1F1EE}\u{1F1E9}',
};

function mapTripToPastDisplay(t: Trip): PastTripDisplay {
  // Prefer computed nights from dates over denormalized totalNights (which may be NULL/0)
  const nights = t.nights > 0 ? t.nights : (t.totalNights ?? 0);
  return {
    tripId: t.id,
    flag: COUNTRY_FLAGS[t.countryCode ?? ''] ?? '\u{1F30D}',
    dest: t.destination ?? t.name,
    country: t.country ?? '',
    dates: `${formatDatePHT(t.startDate)} \u2013 ${formatDatePHT(t.endDate)}`,
    nights,
    spent: t.totalSpent ?? 0,
    miles: 0,
    rating: 0,
    hasMemory: t.status === 'Completed',
    isDraft: t.isDraft,
    lifecycleStatus: t.isDraft ? 'Draft' : t.archivedAt ? 'Archived' : t.status,
  };
}

// ---------- MAIN SCREEN ----------

export default function TripScreenWithBoundary() {
  return (
    <TabErrorBoundary name="Trip">
      <TripScreenMemo />
    </TabErrorBoundary>
  );
}

const TripScreenMemo = React.memo(TripScreen);

function TripScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const userIdRef = useRef<string | undefined>(user?.id);
  const { isTestMode, mockData } = useUserSegment();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;

  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data from Supabase
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTripSpent, setActiveTripSpent] = useState(0);
  const [pastTripsData, setPastTripsData] = useState<Trip[]>([]);
  const [draftTripsData, setDraftTripsData] = useState<Trip[]>([]);
  const [archivedTripsData, setArchivedTripsData] = useState<Trip[]>([]);
  const [quickTripsData, setQuickTripsData] = useState<QuickTrip[]>([]);
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  const loadSeq = useRef(0);
  const [lifetimeStats, setLifetimeStats] = useState<{
    totalTrips: number;
    totalCountries: number;
    totalNights: number;
    totalMiles: number;
    totalSpent: number;
  } | null>(null);

  // React "reset state on prop change" — clear all account-bound trip data
  // synchronously when auth.user.id flips so this screen never flashes the
  // previous account's trips/members/flights for a frame after switching.
  const [accountBoundUserId, setAccountBoundUserId] = useState<string | undefined>(user?.id);
  if (accountBoundUserId !== user?.id) {
    setAccountBoundUserId(user?.id);
    setTrip(null);
    setActiveTripSpent(0);
    setPastTripsData([]);
    setDraftTripsData([]);
    setArchivedTripsData([]);
    setQuickTripsData([]);
    setHighlightsData([]);
    setLifetimeStats(null);
  }

  const resetTripSurface = useCallback(() => {
    setTrip(null);
    setHighlightsData([]);
    setPastTripsData([]);
    setDraftTripsData([]);
    setArchivedTripsData([]);
    setQuickTripsData([]);
    setActiveTripSpent(0);
    setLifetimeStats(null);
    setAddOpen(false);
  }, []);

  useEffect(() => {
    userIdRef.current = user?.id;
    loadSeq.current += 1;
    resetTripSurface();
    setLoading(!isTestMode);
    setRefreshing(false);
  }, [isTestMode, resetTripSurface, user?.id]);

  // Dev test mode: apply mock trip data
  useEffect(() => {
    if (!isTestMode || !mockData) return;
    setTrip(mockData.trip);
    setPastTripsData(mockData.pastTrips as Trip[]);
    setDraftTripsData(mockData.draftTrips as Trip[]);
    setQuickTripsData([]);
    setLifetimeStats(mockData.lifetimeStats ? {
      totalTrips: mockData.lifetimeStats.totalTrips,
      totalCountries: mockData.lifetimeStats.totalCountries,
      totalNights: mockData.lifetimeStats.totalNights,
      totalMiles: mockData.lifetimeStats.totalMiles,
      totalSpent: mockData.lifetimeStats.totalSpent,
    } : null);
    const total = mockData.expenses.reduce((s, e) => s + e.amount, 0);
    setActiveTripSpent(total);
    setLoading(false);
    setRefreshing(false);
  }, [isTestMode, mockData]);

  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    if (testModeRef.current) { setLoading(false); setRefreshing(false); return; }
    const { force = false, silent = false } = opts ?? {};
    const seq = ++loadSeq.current;
    const requestUserId = user?.id;
    const isCurrentRequest = () => loadSeq.current === seq && userIdRef.current === requestUserId;
    try {
      const t = await getActiveTripPromise(force);
      if (!isCurrentRequest()) return;
      setTrip(t);
      if (!t) {
        setActiveTripSpent(0);
      }
      // Load lifetime data + expense summary for active trip
      const [stats, highlights, allTrips, expSummary, qTrips] = await Promise.all([
        getLifetimeStatsPromise(force).catch(() => null),
        getHighlights(user?.id ?? '').catch(() => [] as Highlight[]),
        getAllTripsPromise(force, true).catch(() => [] as Trip[]),
        getExpenseSummaryPromise(undefined, force).catch(() => ({ total: 0, byCategory: {}, count: 0 })),
        getQuickTripsPromise(force).catch(() => [] as QuickTrip[]),
      ]);
      if (!isCurrentRequest()) return;
      if (stats) setLifetimeStats(stats);
      setHighlightsData(highlights);
      setActiveTripSpent(expSummary.total);
      setQuickTripsData(qTrips);

      // Separate trips by lifecycle status
      const drafts = allTrips.filter((t) => t.isDraft === true && !t.deletedAt);
      const archived = allTrips.filter((t) => t.archivedAt != null || t.deletedAt != null);
      const nonDrafts = allTrips.filter((t) => !t.isDraft && !t.deletedAt);

      setDraftTripsData(drafts);
      setArchivedTripsData(archived);

      setPastTripsData(nonDrafts);

      // Backfill spent for legacy trips after first paint so tab switching is not blocked.
      const tripsNeedingSpent = nonDrafts.filter((t) => t.status === 'Completed' && (t.totalSpent ?? 0) <= 0);
      if (tripsNeedingSpent.length > 0) {
        Promise.all(
          tripsNeedingSpent.map(async (t) => {
            try {
              const s = await getExpenseSummaryPromise(t.id);
              return [t.id, s.total] as const;
            } catch {
              return [t.id, t.totalSpent ?? 0] as const;
            }
          }),
        ).then((rows) => {
          if (loadSeq.current !== seq) return;
          const totals = new globalThis.Map(rows);
          setPastTripsData((current) => current.map((t) => {
            const total = totals.get(t.id);
            return total === undefined ? t : { ...t, totalSpent: total };
          }));
        }).catch(() => {
          /* best-effort background backfill */
        });
      }
    } catch (e) {
      if (__DEV__) console.warn('[TripScreen] load trip data failed:', e);
    } finally {
      if (isCurrentRequest()) {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.id]);

  const prevTestModeTrip = useRef(isTestMode);
  useEffect(() => {
    if (prevTestModeTrip.current && !isTestMode) {
      load({ force: true });
    }
    prevTestModeTrip.current = isTestMode;
  }, [isTestMode, load]);

  const refreshSummaryData = useCallback(async () => {
    const [stats, highlights, allTrips, expSummary, qTrips] = await Promise.all([
      getLifetimeStatsPromise(true).catch(() => null),
      getHighlights(user?.id ?? '').catch(() => [] as Highlight[]),
      getAllTripsPromise(true, true).catch(() => [] as Trip[]),
      getExpenseSummaryPromise(undefined, true).catch(() => ({ total: 0, byCategory: {}, count: 0 })),
      getQuickTripsPromise(true).catch(() => [] as QuickTrip[]),
    ]);
    if (stats) setLifetimeStats(stats);
    setHighlightsData(highlights);
    setActiveTripSpent(expSummary.total);
    setQuickTripsData(qTrips);
    const drafts = allTrips.filter((t) => t.isDraft === true && !t.deletedAt);
    const archived = allTrips.filter((t) => t.archivedAt != null || t.deletedAt != null);
    const nonDrafts = allTrips.filter((t) => !t.isDraft && !t.deletedAt);
    setDraftTripsData(drafts);
    setArchivedTripsData(archived);
    setPastTripsData(nonDrafts);
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSummaryData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshSummaryData]);

  useFocusEffect(
    useCallback(() => {
      if (testModeRef.current) return;
      refreshSummaryData().catch((e) => {
        if (__DEV__) console.warn('[TripScreen] summary focus refresh failed:', e);
      });
    }, [refreshSummaryData]),
  );

  useEffect(() => {
    // Cache-first: restore cached data instantly if available
    const cachedTrip = getActiveTripCached();
    const cachedAllTrips = getAllTripsCached(true);
    const cachedQuickTrips = getQuickTripsCached();
    const cachedStats = getLifetimeStatsCached();
    const hasCachedSurface =
      cachedTrip !== undefined ||
      !!cachedAllTrips ||
      !!cachedQuickTrips ||
      !!cachedStats;
    if (cachedTrip !== undefined) {
      setTrip(cachedTrip);
    }
    if (cachedAllTrips) {
      const drafts = cachedAllTrips.filter((t) => t.isDraft === true && !t.deletedAt);
      const archived = cachedAllTrips.filter((t) => t.archivedAt != null || t.deletedAt != null);
      const nonDrafts = cachedAllTrips.filter((t) => !t.isDraft && !t.deletedAt);
      setDraftTripsData(drafts);
      setArchivedTripsData(archived);
      setPastTripsData(nonDrafts);
    }
    if (cachedQuickTrips) setQuickTripsData(cachedQuickTrips);
    if (cachedStats) setLifetimeStats(cachedStats);
    if (hasCachedSurface) setLoading(false);
    load({ silent: hasCachedSurface });
  }, [load]);

  const pastTripsDisplay = useMemo(
    () => pastTripsData.filter(t => t.status === 'Completed').map(mapTripToPastDisplay),
    [pastTripsData],
  );

  const activeTripsDisplay = useMemo(
    () => pastTripsData.filter(t => t.status === 'Active').map(mapTripToPastDisplay),
    [pastTripsData],
  );

  const incomingTripsDisplay = useMemo(
    () => pastTripsData.filter(t => t.status === 'Planning').map(mapTripToPastDisplay),
    [pastTripsData],
  );

  // Summary computed values — include active trip in fallback calculations
  const activeTripNights = useMemo(() => {
    if (!trip) return 0;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [trip]);
  const activeTripCountry = trip?.country || trip?.destination?.split(',').pop()?.trim() || '';

  // Compute real stats from trip data + expenses
  const pastSpentTotal = pastTripsDisplay.reduce((s, t) => s + t.spent, 0);
  const allTripsCount = activeTripsDisplay.length + incomingTripsDisplay.length + pastTripsDisplay.length;

  const totalTrips = lifetimeStats?.totalTrips ?? Math.max(1, allTripsCount);
  const computedSpentTotal = activeTripSpent + pastSpentTotal;
  const totalSpent = Math.max(lifetimeStats?.totalSpent ?? 0, computedSpentTotal);
  const totalNights = (lifetimeStats?.totalNights ?? pastTripsDisplay.reduce((s, t) => s + t.nights, 0)) + activeTripNights;
  const totalMiles = lifetimeStats?.totalMiles ?? 0;
  const countriesCount = lifetimeStats?.totalCountries ?? Math.max(1, new Set([...pastTripsDisplay.map((t) => t.flag), activeTripCountry].filter(Boolean)).size);
  const shareStatsData = useMemo<ConstellationData>(() => {
    const datedTrips = [...pastTripsData, ...(trip ? [trip] : [])]
      .map((t) => safeParse(t.startDate)?.getFullYear())
      .filter((year): year is number => Number.isFinite(year));
    const since = datedTrips.length > 0 ? String(Math.min(...datedTrips)) : String(new Date().getFullYear());
    return {
      destinations: [],
      totalKm: totalMiles,
      since,
      trips: totalTrips,
      places: countriesCount,
      nights: totalNights,
      spent: formatTravelStatsSpent(totalSpent),
    };
  }, [countriesCount, pastTripsData, totalMiles, totalNights, totalSpent, totalTrips, trip]);

  const highlightsForStrip = useMemo(() => {
    if (highlightsData.length > 0) {
      return highlightsData.map((h, i) => ({
        icon: '\u2B50',
        label: h.displayText,
        sub: '',
        tint: MEMBER_COLORS[i % MEMBER_COLORS.length],
      }));
    }
    return [];
  }, [highlightsData]);

  // Profile name for share card
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileHandle, setProfileHandle] = useState<string | undefined>();
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  useEffect(() => {
    if (user?.id) {
      getProfile(user.id).then(p => {
        if (p?.fullName) setProfileName(p.fullName.split(' ')[0]);
        if (p?.handle) setProfileHandle(p.handle);
        if (p?.avatarUrl) setProfileAvatar(p.avatarUrl);
      }).catch(() => {});
    }
  }, [user?.id]);

  // Share
  const [shareStatsVisible, setShareStatsVisible] = useState(false);
  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareStatsVisible(true);
  };

  const handleDeleteDraft = (tripId: string) => {
    Alert.alert(
      'Delete draft?',
      'This draft trip will be permanently removed.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await discardDraftTrip(tripId);
              load({ force: true });
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete draft');
            }
          },
        },
      ],
    );
  };

  const handleSoftDelete = (tripId: string) => {
    Alert.alert(
      'Delete trip?',
      'It will move to Archived where you can restore it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await softDeleteTrip(tripId);
              load({ force: true });
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete trip');
            }
          },
        },
      ],
    );
  };

  const handleRestore = (tripId: string) => {
    Alert.alert(
      'Restore trip?',
      'This trip will reappear in your main lists.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await restoreTrip(tripId);
              load({ force: true });
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not restore trip');
            }
          },
        },
      ],
    );
  };

  const handleArchiveIncoming = (tripId: string) => {
    Alert.alert(
      'Archive this trip?',
      'It will move to your past trips without generating a memory.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveTrip(tripId);
              load({ force: true });
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not archive trip');
            }
          },
        },
      ],
    );
  };

  // Show full empty state only when there are truly no trips at all
  const hasAnyTrips =
    !!trip ||
    pastTripsData.length > 0 ||
    archivedTripsData.length > 0 ||
    quickTripsData.length > 0 ||
    draftTripsData.length > 0;
  if (!trip && !loading && !hasAnyTrips) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back to Home">
              <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>My Trips</Text>
          </View>
        </View>
        <EmptyState
          icon={Map}
          title="Plan your first trip"
          subtitle="Your trips, flights, packing lists, and travel files will all live here. Start planning to unlock everything."
          actionLabel="Plan a Trip"
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentLt}
          />
        }
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back to Home">
              <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>My Trips</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Share travel stats" onPress={handleShare}>
              <Share2 size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <SummaryTab
          totalMiles={totalMiles}
          totalTrips={totalTrips}
          countriesCount={countriesCount}
          totalNights={totalNights}
          totalSpent={totalSpent}
          highlights={highlightsForStrip}
          activeTrips={activeTripsDisplay}
          incomingTrips={incomingTripsDisplay}
          pastTrips={pastTripsDisplay}
          draftTrips={draftTripsData}
          archivedTrips={archivedTripsData}
          quickTrips={quickTripsData}
          colors={colors}
          onAddTrip={() => setAddOpen(true)}
          onTripPress={(tripId, cardStatus) => {
            const section = cardStatus === 'past' || cardStatus === 'archived' ? 'recap' : 'details';
            router.push({ pathname: '/trip-overview', params: { tripId, section } } as never);
          }}
          onQuickTripPress={(id) => router.push({ pathname: '/quick-trip-detail', params: { quickTripId: id } } as never)}
          onAddQuickTrip={() => router.push('/quick-trip-create?allowNoPhotos=1' as never)}
          onDeleteTrip={handleSoftDelete}
          onDeleteDraft={handleDeleteDraft}
          onArchiveTrip={handleArchiveIncoming}
          onEditTrip={(tripId) => router.push({ pathname: '/trip-overview', params: { tripId, section: 'settings' } } as never)}
          onViewRecap={(tripId) => router.push({ pathname: '/trip-overview', params: { tripId, section: 'recap' } } as never)}
          onRescanTrip={(tripId) => router.push({ pathname: '/scan-trip', params: { tripId } } as never)}
          onInviteTrip={(tripId) => router.push({ pathname: '/trip-overview', params: { tripId, section: 'companions' } } as never)}
          onRestoreTrip={handleRestore}
        />

        {/* Bottom spacer -- keep outside tabs */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add trip bottom sheet */}
      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Share Travel Stats sheet */}
      <ShareTravelStats
        visible={shareStatsVisible}
        data={shareStatsData}
        displayName={profileName ?? 'My'}
        handle={profileHandle}
        avatarUrl={profileAvatar}
        onClose={() => setShareStatsVisible(false)}
      />
    </SafeAreaView>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingBottom: 120,
    },

    // Top bar
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    topBarTitle: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.66,
      color: colors.text,
    },
    topBarRight: {
      flexDirection: 'row',
      gap: 8,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Active pill
    pillWrapper: {
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      paddingVertical: 6,
      paddingLeft: 8,
      paddingRight: 12,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 999,
    },
    activePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
      letterSpacing: 0.44,
    },

    // Segmented control
    segWrapper: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 16,
    },
    segmented: {
      flexDirection: 'row',
      padding: 3,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 2,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 9,
      alignItems: 'center',
    },
    segBtnActive: {
      backgroundColor: colors.card,
    },
    segText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
      letterSpacing: -0.12,
    },
    segTextActive: {
      color: colors.text,
    },

    // Ghost action link
    ghostAction: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },

    // List container (members, past trips)
    listContainer: {
      paddingHorizontal: 16,
      gap: 8,
    },

    // Section padding
    sectionPadding: {
      paddingHorizontal: 16,
    },

    // Member row
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    memberAvatar: {
      width: 38,
      height: 38,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberInit: {
      color: colors.bg,
      fontSize: 13,
      fontWeight: '600',
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    youBadge: {
      fontSize: 10,
      color: colors.accent,
      fontWeight: '600',
    },
    memberRole: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    memberChatBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Accommodation
    accomCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 18,
    },
    accomHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    accomThumb: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden' as const,
    },
    accomHeaderInfo: {
      flex: 1,
    },
    accomTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    accomAddr: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    accomGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    accomGridLabel: {
      color: colors.text3,
      fontSize: 10,
      letterSpacing: 0.8,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    accomGridValue: {
      color: colors.text,
      marginTop: 3,
      fontWeight: '600',
      fontSize: 12,
    },
    accomFooter: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    syncBtn: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
      alignItems: 'center',
      justifyContent: 'center',
    },
    syncBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    paidChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    paidChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },

    // Flights list
    flightsList: {
      paddingHorizontal: 16,
      gap: 10,
    },
    fullFlightsList: {
      paddingHorizontal: 16,
      gap: 12,
    },

    // Packing
    packingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    packingCount: {
      fontSize: 12,
      color: colors.text3,
    },
    packingCountAccent: {
      color: colors.accent,
      fontWeight: '600',
    },
    addItemBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    addItemBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    addItemRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    addItemInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    packingList: {
      paddingHorizontal: 16,
      gap: 6,
    },
    packingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    packingItemText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    packingItemDone: {
      textDecorationLine: 'line-through',
    },
    packingByChip: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      backgroundColor: colors.card2,
      borderRadius: 99,
    },
    packingByText: {
      fontSize: 10,
      color: colors.text3,
      fontWeight: '600',
    },

    // Files
    filesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    filesCount: {
      fontSize: 12,
      color: colors.text3,
    },
    uploadBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    uploadBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    filesList: {
      paddingHorizontal: 16,
      gap: 8,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    fileIcon: {
      width: 40,
      height: 44,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
      minWidth: 0,
    },
    fileName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    fileMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    downloadBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Add past trip
    addPastTripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: colors.border2,
      borderStyle: 'dashed',
      borderRadius: 14,
    },
    addPastTripIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPastTripInfo: {
      flex: 1,
    },
    addPastTripTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    addPastTripSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },

    // Moments placeholder
    momentsPadding: {
      padding: 20,
      alignItems: 'center',
    },
    placeholderText: {
      color: colors.text3,
      fontSize: 13,
    },

    // Bottom spacer
    bottomSpacer: {
      height: 20,
    },

    // Member edit sheet
    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheetContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      paddingTop: 20,
      paddingHorizontal: 20,
    },
    sheetHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    sheetSub: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 4,
    },
    sheetActions: {
      gap: 2,
    },
    sheetBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 16,
      backgroundColor: colors.bg,
      borderRadius: 12,
      marginBottom: 6,
    },
    sheetBtnText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    sheetBtnAccent: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accent,
    },
    sheetBtnMeta: {
      fontSize: 12,
      color: colors.text3,
    },
    sheetClose: {
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 8,
      backgroundColor: colors.bg,
      borderRadius: 12,
    },
    sheetCloseText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text2,
    },
    sheetInput: {
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 12,
    },
    sheetSaveBtn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sheetSaveBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.bg,
    },

    // Trip options menu sheet
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    menuSheet: {
      backgroundColor: colors.canvas,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingBottom: 36,
      maxHeight: '88%',
    },
    menuHandle: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 8,
    },
    menuHandleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.text3,
    },
    menuHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    menuHeaderCopy: {
      flex: 1,
      minWidth: 0,
    },
    menuCloseIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    menuSubtitle: {
      fontSize: 12,
      color: colors.text3,
      marginBottom: 4,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
    },
    menuIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuRowText: {
      flex: 1,
    },
    menuRowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    menuRowSub: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 1,
    },
    menuCancelBtn: {
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuCancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text2,
    },
  });
