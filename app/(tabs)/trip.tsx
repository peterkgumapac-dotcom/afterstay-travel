import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ArrowLeft, Archive, CheckCircle, Map, MoreHorizontal, Pencil, Settings, Share2, Trash2, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useRouter } from 'expo-router';

import AddTripSheet from '@/components/summary/AddTripSheet';
import ShareTravelStats from '@/components/profile/ShareTravelStats';
import { PETER_DATA, AARON_DATA } from '@/components/profile/TravelConstellationMap';
import EmptyState from '@/components/shared/EmptyState';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
import { OverviewTab } from '@/components/trip/OverviewTab';
import { mapFlightToDisplay, type FlightDisplayData } from '@/components/trip/tripConstants';
import { SummaryTab } from '@/components/trip/SummaryTab';
import { EssentialsTab } from '@/components/trip/EssentialsTab';
import FileViewerSheet from '@/components/trip/FileViewerSheet';
import { useTheme } from '@/constants/ThemeContext';
import { colors as themeColors } from '@/constants/theme';
import {
  addPackingItem,
  deletePackingItem,
  getActiveTrip,
  getExpenseSummary,
  getFlights,
  getGroupMembers,
  getPackingList,
  getTripFiles,
  getLifetimeStats,
  getHighlights,
  getAllUserTrips,
  getPastTrips,
  togglePacked,
  updatePackingItem,
  updateMemberEmail,
  updateMemberPhone,
  updateMemberPhoto,
  updateTripProperty,
  getOrCreateInviteCode,
  removeGroupMember,
  finishTrip,
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
import { buildTripCalendarUrl } from '@/lib/calendarInvite';
import { getQuickTrips } from '@/lib/quickTrips';
import type { QuickTrip } from '@/lib/quickTripTypes';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useAuth } from '@/lib/auth';
import { formatDatePHT, formatTimePHT, safeParse } from '@/lib/utils';
import type {
  Flight,
  GroupMember,
  Highlight,
  PackingItem,
  Trip,
  TripFile,
} from '@/lib/types';

// ---------- TYPES ----------

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const TAB_KEYS = [
  'overview',
  'summary',
  'guide',
  'essentials',
] as const;
type TabKey = (typeof TAB_KEYS)[number];

// ---------- CONSTANTS ----------

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];
const FILE_COLORS = ['#a64d1e', '#c66a36', '#b8892b', '#d9a441', '#8a5a2b'];

// FlightDisplayData + mapFlightToDisplay imported from tripConstants (safe null guards)

interface PackingGroup {
  [category: string]: { t: string; by: string; d: boolean; id: string }[];
}

function groupPackingItems(items: PackingItem[]): PackingGroup {
  const groups: PackingGroup = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ t: item.item, by: item.owner ?? '', d: item.packed, id: item.id });
  }
  return groups;
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

// ---------- PULSING DOT ----------

function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 1 + (1 - opacity.value) * 0.6 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 99,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

// ---------- GROUP HEADER ----------

function GroupHeader({
  kicker,
  title,
  action,
  colors,
}: {
  kicker?: string;
  title: string;
  action?: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={groupHeaderStyles.container}>
      <View>
        {kicker ? (
          <Text
            style={[groupHeaderStyles.kicker, { color: colors.text3 }]}
          >
            {kicker}
          </Text>
        ) : null}
        <Text style={[groupHeaderStyles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

const groupHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.6,
    marginTop: 3,
    lineHeight: 23,
  },
});

// ---------- MINI FLIGHT CARD ----------

function getTerminalInfo(airline: string, iata: string): string | null {
  const a = airline.toLowerCase();
  if (iata === 'MNL') {
    if (a.includes('cebu pacific')) return 'Terminal 3 (NAIA)';
    if (a.includes('airasia')) return 'Terminal 3 (NAIA)';
    if (a.includes('philippine airlines') || a.includes('pal')) return 'Terminal 2 (NAIA)';
  }
  if (iata === 'MPH') return 'Godofredo P. Ramos Airport';
  return null;
}

function MiniFlightCard({
  f,
  colors,
}: {
  f: FlightDisplayData;
  colors: ThemeColors;
}) {
  const styles = miniFlightStyles(colors);
  const depTerminal = getTerminalInfo(f.airline, f.from);
  const arrTerminal = getTerminalInfo(f.airline, f.to);

  const copyRef = () => {
    Clipboard.setStringAsync(f.ref);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', `Booking ref ${f.ref} copied to clipboard`);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.logo, { backgroundColor: f.logo }]}>
            <Text style={styles.logoText}>{f.code}</Text>
          </View>
          <View>
            <Text style={styles.dirLabel}>{f.dir}</Text>
            <Text style={styles.flightInfo}>
              {f.airline} {'\u00B7'} {f.code} {f.num}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={copyRef} activeOpacity={0.7}>
          <Text style={styles.refText}>Ref {f.ref} {'\u2398'}</Text>
        </TouchableOpacity>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View>
          <Text style={styles.iataCode}>{f.from}</Text>
          <Text style={styles.timeText}>{f.dep}</Text>
          {depTerminal && <Text style={styles.terminalText}>{depTerminal}</Text>}
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.durText}>{f.dur}</Text>
          <Text style={[styles.terminalText, { marginTop: 2 }]}>{f.date}</Text>
        </View>
        <View style={styles.routeRight}>
          <Text style={styles.iataCode}>{f.to}</Text>
          <Text style={styles.timeText}>{f.arr}</Text>
          {arrTerminal && <Text style={styles.terminalText}>{arrTerminal}</Text>}
        </View>
      </View>
    </View>
  );
}

const miniFlightStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 14,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: colors.ink,
      fontSize: 9,
      fontWeight: '600',
    },
    dirLabel: {
      fontSize: 10,
      color: colors.text3,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    flightInfo: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
      marginTop: 1,
    },
    refText: {
      fontSize: 10,
      color: colors.text3,
      letterSpacing: 0.2,
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iataCode: {
      fontSize: 18,
      fontWeight: '500',
      color: colors.text,
      letterSpacing: -0.54,
    },
    timeText: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    durText: {
      fontSize: 9,
      color: colors.text3,
    },
    routeRight: {
      alignItems: 'flex-end',
    },
    terminalText: {
      fontSize: 9,
      color: colors.accent,
      marginTop: 2,
      fontWeight: '500',
    },
  });

// ---------- FULL FLIGHT CARD ----------

function FullFlightCard({
  f,
  colors,
}: {
  f: FlightDisplayData;
  colors: ThemeColors;
}) {
  const styles = fullFlightStyles(colors);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.logo, { backgroundColor: f.logo }]}>
            <Text style={styles.logoText}>{f.code}</Text>
          </View>
          <View>
            <Text style={styles.dirLabel}>{f.dir}</Text>
            <Text style={styles.airlineName}>{f.airline}</Text>
            <Text style={styles.flightRef}>
              {f.code} {f.num} {'\u00B7'} Ref {f.ref}
            </Text>
          </View>
        </View>
        <View style={styles.statusChip}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{f.status}</Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View>
          <Text style={styles.iataCode}>{f.from}</Text>
          <Text style={styles.depTime}>{f.dep}</Text>
          <Text style={styles.cityDate}>
            {f.fromCity} {'\u00B7'} {f.date}
          </Text>
        </View>
        <View style={styles.planeCol}>
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
          >
            <Path
              d="M17.8 19.2L16.5 17.2 14 16l-2 3-2-3-2.5 1.2-1.3 2L2 17l1.5-2L8 13l-2-8 2 1 4 6 4-6 2-1-2 8 4.5 2L22 17z"
              stroke={colors.text3}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.durText}>{f.dur}</Text>
        </View>
        <View style={styles.routeRight}>
          <Text style={styles.iataCode}>{f.to}</Text>
          <Text style={styles.arrTime}>{f.arr}</Text>
          <Text style={styles.cityDate}>
            {f.toCity} {'\u00B7'} {f.date}
          </Text>
        </View>
      </View>

      {/* Baggage */}
      <View style={styles.baggageSection}>
        <Text style={styles.baggageLabel}>BAGGAGE</Text>
        <View style={styles.baggageList}>
          {f.bags.map((b) => (
            <View key={b.who} style={styles.baggageRow}>
              <Text style={styles.baggageWho}>{b.who}</Text>
              <Text style={styles.baggageBag}>{b.bag}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const fullFlightStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 18,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: '600',
    },
    dirLabel: {
      fontSize: 10,
      color: colors.text3,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    airlineName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 1,
    },
    flightRef: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 1,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 99,
      backgroundColor: colors.accent,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    iataCode: {
      fontSize: 26,
      fontWeight: '500',
      color: colors.text,
      letterSpacing: -0.78,
    },
    depTime: {
      fontSize: 12,
      color: colors.text2,
      fontWeight: '600',
      marginTop: 3,
    },
    arrTime: {
      fontSize: 12,
      color: colors.text2,
      fontWeight: '600',
      marginTop: 3,
    },
    cityDate: {
      fontSize: 10,
      color: colors.text3,
    },
    planeCol: {
      alignItems: 'center',
    },
    durText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text3,
      marginTop: 4,
    },
    routeRight: {
      alignItems: 'flex-end',
    },
    baggageSection: {
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    baggageLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
      marginBottom: 8,
    },
    baggageList: {
      gap: 4,
    },
    baggageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    baggageWho: {
      fontSize: 12,
      color: colors.text2,
    },
    baggageBag: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
    },
  });

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
  const { isTestMode, mockData } = useUserSegment();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [editMember, setEditMember] = useState<GroupMember | null>(null);
  const [editField, setEditField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Data from Supabase
  const [trip, setTrip] = useState<Trip | null>(null);

  // Default to "My Trips" when no active trip (first mount)
  const didSetDefaultTab = useRef(false);
  useEffect(() => {
    if (didSetDefaultTab.current) return;
    if (!loading && !trip) { setActiveTab('summary'); didSetDefaultTab.current = true; }
    else if (!loading && trip) { didSetDefaultTab.current = true; }
  }, [loading, trip]);

  const [membersData, setMembersData] = useState<GroupMember[]>([]);
  const isPrimary = useMemo(() => {
    if (!user?.id || membersData.length === 0) return true; // default to primary for safety
    const me = membersData.find((m) => m.userId === user.id);
    return me?.role === 'Primary';
  }, [user?.id, membersData]);
  const [flightsData, setFlightsData] = useState<Flight[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [editingPackingId, setEditingPackingId] = useState<string | null>(null);
  const [editingPackingText, setEditingPackingText] = useState('');
  const [filesData, setFilesData] = useState<TripFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TripFile | null>(null);
  const [activeTripSpent, setActiveTripSpent] = useState(0);
  const [pastTripsData, setPastTripsData] = useState<Trip[]>([]);
  const [draftTripsData, setDraftTripsData] = useState<Trip[]>([]);
  const [archivedTripsData, setArchivedTripsData] = useState<Trip[]>([]);
  const [quickTripsData, setQuickTripsData] = useState<QuickTrip[]>([]);
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  const [lifetimeStats, setLifetimeStats] = useState<{
    totalTrips: number;
    totalCountries: number;
    totalNights: number;
    totalMiles: number;
    totalSpent: number;
  } | null>(null);

  // Dev test mode: apply mock trip data
  useEffect(() => {
    if (!isTestMode || !mockData) return;
    setTrip(mockData.trip);
    setMembersData(mockData.members as GroupMember[]);
    setFlightsData(mockData.flights as Flight[]);
    setPackingItems(mockData.packing as PackingItem[]);
    setFilesData([]);
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

  const prevTestModeTrip = useRef(isTestMode);
  useEffect(() => {
    if (prevTestModeTrip.current && !isTestMode) {
      load({ force: true });
    }
    prevTestModeTrip.current = isTestMode;
  }, [isTestMode]);

  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    if (testModeRef.current) { setLoading(false); setRefreshing(false); return; }
    const { force = false, silent = false } = opts ?? {};
    try {
      const t = await getActiveTripPromise(force);
      setTrip(t);
      if (t) {
        const [ms, fs, pk, tf] = await Promise.all([
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
          getFlights(t.id).catch(() => [] as Flight[]),
          getPackingList(t.id).catch(() => [] as PackingItem[]),
          getTripFiles(t.id).catch(() => [] as TripFile[]),
        ]);
        setMembersData(ms);
        setFlightsData(fs);
        setPackingItems(pk);
        setFilesData(tf);
      }
      // Load lifetime data + expense summary for active trip
      const [stats, highlights, allTrips, expSummary, qTrips] = await Promise.all([
        getLifetimeStatsPromise(force).catch(() => null),
        getHighlights(user?.id ?? '').catch(() => [] as Highlight[]),
        getAllTripsPromise(force, true).catch(() => [] as Trip[]),
        getExpenseSummaryPromise(undefined, force).catch(() => ({ total: 0, byCategory: {}, count: 0 })),
        getQuickTripsPromise(force).catch(() => [] as QuickTrip[]),
      ]);
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

      // Backfill spent for trips missing total_spent (legacy data)
      const enriched = await Promise.all(
        nonDrafts.map(async (t) => {
          if ((t.totalSpent ?? 0) > 0) return t;
          try {
            const s = await getExpenseSummary(t.id);
            return { ...t, totalSpent: s.total } as Trip;
          } catch {
            return t;
          }
        }),
      );
      setPastTripsData(enriched);
    } catch (e) {
      if (__DEV__) console.warn('[TripScreen] load trip data failed:', e);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshEssentialsData = useCallback(async (tripId: string) => {
    const [pk, tf] = await Promise.all([
      getPackingList(tripId).catch(() => [] as PackingItem[]),
      getTripFiles(tripId).catch(() => [] as TripFile[]),
    ]);
    setPackingItems(pk);
    setFilesData(tf);
  }, []);

  const refreshOverviewData = useCallback(async () => {
    const t = await getActiveTripPromise(true);
    setTrip(t);
    if (!t) {
      setMembersData([]);
      setFlightsData([]);
      return;
    }
    const [ms, fs] = await Promise.all([
      getGroupMembers(t.id).catch(() => [] as GroupMember[]),
      getFlights(t.id).catch(() => [] as Flight[]),
    ]);
    setMembersData(ms);
    setFlightsData(fs);
  }, []);

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
      if (activeTab === 'essentials' && trip?.id) {
        await refreshEssentialsData(trip.id);
      } else if (activeTab === 'summary') {
        await refreshSummaryData();
      } else {
        await refreshOverviewData();
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, refreshEssentialsData, refreshOverviewData, refreshSummaryData, trip?.id]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'essentials' || !trip?.id || testModeRef.current) return;
      refreshEssentialsData(trip.id).catch((e) => {
        if (__DEV__) console.warn('[TripScreen] essentials focus refresh failed:', e);
      });
    }, [activeTab, refreshEssentialsData, trip?.id]),
  );

  useEffect(() => {
    // Cache-first: restore cached data instantly if available
    const cachedTrip = getActiveTripCached();
    const cachedAllTrips = getAllTripsCached(true);
    const cachedQuickTrips = getQuickTripsCached();
    const cachedStats = getLifetimeStatsCached();
    if (cachedTrip !== undefined) {
      setTrip(cachedTrip);
      setLoading(false);
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
    if (cachedTrip !== undefined) {
      load({ silent: true });
    } else {
      load();
    }
  }, [load]);

  // Derived display data
  const flightsDisplay = useMemo(
    () => flightsData.map(mapFlightToDisplay),
    [flightsData],
  );

  const packingState = useMemo(
    () => groupPackingItems(packingItems),
    [packingItems],
  );

  // Compute packing stats
  const packingStats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const items of Object.values(packingState)) {
      for (const item of items) {
        total++;
        if (item.d) done++;
      }
    }
    return { total, done };
  }, [packingState]);

  const togglePackingItem = (itemId: string) => {
    const item = packingItems.find((it) => it.id === itemId);
    if (!item) return;
    setPackingItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, packed: !it.packed } : it,
      ),
    );
    togglePacked(item.id, !item.packed).catch(() => {
      // revert on failure
      setPackingItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, packed: item.packed } : it,
        ),
      );
    });
  };

  const startEditingPackingItem = (itemId: string, itemText: string) => {
    setEditingPackingId(itemId);
    setEditingPackingText(itemText);
  };

  const cancelEditingPackingItem = () => {
    setEditingPackingId(null);
    setEditingPackingText('');
  };

  const saveEditingPackingItem = async () => {
    const itemId = editingPackingId;
    const text = editingPackingText.trim();
    if (!itemId) return;
    const previous = packingItems.find((it) => it.id === itemId);
    if (!previous) {
      cancelEditingPackingItem();
      return;
    }
    if (!text) {
      Alert.alert('Item name required', 'Add a name or delete the item instead.');
      return;
    }
    if (text === previous.item) {
      cancelEditingPackingItem();
      return;
    }

    setPackingItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, item: text } : it)));
    cancelEditingPackingItem();
    try {
      await updatePackingItem(itemId, { item: text });
    } catch {
      setPackingItems((prev) => prev.map((it) => (it.id === itemId ? previous : it)));
      Alert.alert('Update failed', 'Could not update this packing item. Please try again.');
    }
  };

  const deletePackingListItem = (itemId: string, itemText: string) => {
    Alert.alert('Delete packing item?', `"${itemText}" will be removed from this trip.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previous = packingItems;
          setPackingItems((prev) => prev.filter((it) => it.id !== itemId));
          if (editingPackingId === itemId) cancelEditingPackingItem();
          try {
            await deletePackingItem(itemId);
          } catch {
            setPackingItems(previous);
            Alert.alert('Delete failed', 'Could not delete this packing item. Please try again.');
          }
        },
      },
    ]);
  };

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
  const totalSpent = lifetimeStats?.totalSpent ?? (activeTripSpent + pastSpentTotal);
  const totalNights = (lifetimeStats?.totalNights ?? pastTripsDisplay.reduce((s, t) => s + t.nights, 0)) + activeTripNights;
  const totalMiles = lifetimeStats?.totalMiles ?? 0;
  const countriesCount = lifetimeStats?.totalCountries ?? Math.max(1, new Set([...pastTripsDisplay.map((t) => t.flag), activeTripCountry].filter(Boolean)).size);

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

  // Trip destination label
  const destLabel = trip?.destination ?? '';
  const dateRangeLabel = trip
    ? `${formatDatePHT(trip.startDate)}\u2013${formatDatePHT(trip.endDate)}`
    : '';

  // Hotel photos
  const hotelPhotos = useMemo(() => {
    if (!trip?.hotelPhotos) return [];
    try {
      const parsed: unknown = JSON.parse(trip.hotelPhotos);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [trip?.hotelPhotos]);

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
    if (effectiveTab === 'summary') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShareStatsVisible(true);
    } else {
      Share.share({ message: `Check out our trip to ${trip?.destination ?? 'somewhere amazing'}!` });
    }
  };

  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMoreMenu(true);
  };

  const handleEditTrip = () => {
    if (!trip) return;
    setShowMoreMenu(false);
    router.push({ pathname: '/trip-overview', params: { tripId: trip.id } } as never);
  };

  const handleFinishTrip = () => {
    setShowMoreMenu(false);
    Alert.alert(
      'Finish this trip?',
      'Your trip will be marked as completed and you can view your trip summary.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Finish Trip',
          onPress: async () => {
            if (!trip) return;
            try {
              const tripId = trip.id;
              await finishTrip(tripId);
              // Refresh the trip list then navigate to summary
              load({ force: true });
              router.push({ pathname: '/trip-recap', params: { tripId } } as never);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not finish trip');
            }
          },
        },
      ],
    );
  };

  const handleArchiveTrip = () => {
    setShowMoreMenu(false);
    Alert.alert(
      'Archive this trip?',
      'It will move to your past trips without generating a memory. You can still view it later.',
      [
        { text: 'Keep Trip', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (!trip) return;
            try {
              await archiveTrip(trip.id);
              load({ force: true });
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not archive trip');
            }
          },
        },
      ],
    );
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

  const handleDeleteCurrentTrip = () => {
    if (!trip) return;
    const tripId = trip.id;
    setShowMoreMenu(false);
    handleSoftDelete(tripId);
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

  const handleInvite = () => {
    router.push('/invite');
  };

  const handleCalendarInviteAll = () => {
    if (!trip) return;
    const url = buildTripCalendarUrl({
      trip,
      flights: flightsData,
      members: membersData,
    });
    Linking.openURL(url).catch(() => {});
  };

  const handleMemberEdit = (member: GroupMember) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditMember(member);
    setEditField(null);
    setEditValue('');
  };

  const handleMemberAction = async (action: string) => {
    if (!editMember) return;
    const member = editMember;

    if (action === 'calendar') {
      setEditMember(null);
      if (!trip) return;
      const url = buildTripCalendarUrl({
        trip,
        flights: flightsData,
        members: membersData,
        inviteEmail: member.email || undefined,
      });
      Linking.openURL(url).catch(() => {});
    } else if (action === 'message') {
      setEditMember(null);
      if (!trip?.id) return;
      router.push({ pathname: '/group-chat', params: { tripId: trip.id } } as never);
    } else if (action === 'invite') {
      setEditMember(null);
      if (!trip) return;
      try {
        const inviteCode = await getOrCreateInviteCode(trip.id);
        const webLink = `https://afterstay.travel/join/${inviteCode}`;
        const deepLink = `afterstay://join-trip?code=${inviteCode}`;
        const msg =
          `Join our trip to ${trip.destination || trip.name} on AfterStay.\n\n` +
          `Invite code: ${inviteCode}\n\n` +
          `Tap to join: ${webLink}\n\n` +
          `If the app is installed, open: ${deepLink}`;
        const target = member.phone
          ? `sms:${encodeURIComponent(member.phone)}?body=${encodeURIComponent(msg)}`
          : member.email
            ? `mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent('Join our trip on AfterStay')}&body=${encodeURIComponent(msg)}`
            : null;
        if (target) {
          Linking.openURL(target).catch(() => Share.share({ message: msg }).catch(() => router.push('/invite')));
        } else {
          Share.share({ message: msg }).catch(() => router.push('/invite'));
        }
      } catch (e: any) {
        Alert.alert('Could not create invite', e?.message ?? 'Please try again.');
      }
    } else if (action === 'remove') {
      setEditMember(null);
      if (!isPrimary || member.role === 'Primary') return;
      Alert.alert(
        'Remove from trip?',
        `${member.name} will lose access to this trip, shared photos, places, and expenses.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeGroupMember(member.id);
                setMembersData((prev) => prev.filter((m) => m.id !== member.id));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e: any) {
                Alert.alert('Could not remove member', e?.message ?? 'Please try again.');
              }
            },
          },
        ],
      );
    } else if (action === 'photo') {
      setEditMember(null);
      if (Platform.OS === 'ios') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Photo Library Access', 'Please enable photo library access in Settings.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          ]);
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets[0]) {
        await updateMemberPhoto(member.id, result.assets[0].uri).catch(() => {});
        load();
      }
    } else if (action === 'email') {
      setEditField('email');
      setEditValue(member.email ?? '');
    } else if (action === 'phone') {
      setEditField('phone');
      setEditValue(member.phone ?? '');
    } else if (action === 'save') {
      if (editField === 'email' && editValue.trim()) {
        await updateMemberEmail(member.id, editValue.trim()).catch(() => {});
      } else if (editField === 'phone' && editValue.trim()) {
        await updateMemberPhone(member.id, editValue.trim()).catch(() => {});
      }
      setEditMember(null);
      setEditField(null);
      load();
    }
  };

  const handleMemberChat = async (member: GroupMember) => {
    if (member.userId && trip?.id) {
      router.push({ pathname: '/group-chat', params: { tripId: trip.id } } as never);
      return;
    }
    if (member.phone) {
      const url = `sms:${member.phone}`;
      try {
        await Linking.openURL(url);
      } catch {
        if (__DEV__) console.warn('Failed to open URL:', url);
      }
    } else if (member.email) {
      const url = `mailto:${member.email}`;
      try {
        await Linking.openURL(url);
      } catch {
        if (__DEV__) console.warn('Failed to open URL:', url);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSync = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  };

  const handleAddPackingItem = async () => {
    const text = newItemText.trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}`;
    const newItem: PackingItem = {
      id: tempId,
      item: text,
      category: 'Other',
      packed: false,
      owner: '',
    };
    setPackingItems((prev) => [...prev, newItem]);
    setNewItemText('');
    setAddingItem(false);
    try {
      await addPackingItem({ item: text, category: 'Other', tripId: trip?.id });
      // Refresh to get the real ID from the server
      if (trip) {
        const updated = await getPackingList(trip.id).catch(() => [] as PackingItem[]);
        setPackingItems(updated);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      // Revert on failure
      setPackingItems((prev) => prev.filter((it) => it.id !== tempId));
    }
  };

  const handleUpload = () => {
    router.push({ pathname: '/add-file', params: trip?.id ? { tripId: trip.id } : {} } as never);
  };

  const handleDownload = async (fileUrl: string) => {
    try {
      await WebBrowser.openBrowserAsync(fileUrl);
    } catch {
      if (__DEV__) console.warn('Failed to open browser:', fileUrl);
    }
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

  // Always use user's selected tab — empty states handle no-trip cases per tab
  const effectiveTab = activeTab;

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
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Share" onPress={handleShare}>
              <Share2 size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="More" onPress={handleMore}>
              <MoreHorizontal size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trip status pill (overview only) — uses dates, not DB status */}
        {trip && effectiveTab === 'overview' && (() => {
          const now = new Date();
          const start = safeParse(trip.startDate);
          const end = safeParse(trip.endDate);
          const isActive = now >= start && now <= end;
          const isUpcoming = now < start;
          if (isActive) return (
            <View style={styles.pillWrapper}>
              <View style={styles.activePill}>
                <PulsingDot color={colors.accent} />
                <Text style={styles.activePillText}>
                  LIVE · {destLabel.toUpperCase() || 'TRIP'} · {dateRangeLabel.toUpperCase()}
                </Text>
              </View>
            </View>
          );
          if (isUpcoming) return (
            <View style={styles.pillWrapper}>
              <View style={[styles.activePill, { backgroundColor: colors.accentBg }]}>
                <Text style={[styles.activePillText, { color: colors.accent }]}>
                  UPCOMING · {destLabel.toUpperCase() || 'TRIP'} · {dateRangeLabel.toUpperCase()}
                </Text>
              </View>
            </View>
          );
          return null;
        })()}

        {/* Segmented control — always visible */}
          <View style={styles.segWrapper}>
            <View style={styles.segmented}>
              {TAB_KEYS.map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.segBtn,
                    effectiveTab === t && styles.segBtnActive,
                  ]}
                  onPress={() => {
                    if (t === 'guide') {
                      router.push('/(tabs)/guide' as never);
                    } else {
                      setActiveTab(t);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.segText,
                      effectiveTab === t && styles.segTextActive,
                    ]}
                  >
                    {t === 'summary' ? 'My Trips' : t[0].toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

        {/* ===================== OVERVIEW ===================== */}
        {effectiveTab === 'overview' && (trip ? (
          <OverviewTab
            trip={trip}
            members={membersData}
            flights={flightsDisplay}
            hotelPhotos={hotelPhotos}
            colors={colors}
            onMemberEdit={handleMemberEdit}
            onMemberChat={handleMemberChat}
            onMemberProfile={(m) => {
              if (m.userId) router.push({ pathname: '/profile/[userId]', params: { userId: m.userId } } as never);
            }}
            onInvite={handleInvite}
            onAddMember={() => router.push('/add-member')}
            onCalendarInvite={handleCalendarInviteAll}
            isPrimary={isPrimary}
            onLoad={load}
          />
        ) : (
          <EmptyState
            icon={Map}
            title="Plan your first trip"
            subtitle="Your trip overview, group members, flights, and hotel details will appear here."
            actionLabel="Plan a Trip"
            onAction={() => router.push('/onboarding')}
          />
        ))}

        {/* ===================== SUMMARY ===================== */}
        {effectiveTab === 'summary' && (
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
              const pathname = cardStatus === 'past' || cardStatus === 'archived'
                ? '/trip-recap'
                : '/trip-overview';
              router.push({ pathname, params: { tripId } } as never);
            }}
            onQuickTripPress={(id) => router.push({ pathname: '/quick-trip-detail', params: { quickTripId: id } } as never)}
            onAddQuickTrip={() => router.push('/quick-trip-create' as never)}
            onDeleteTrip={handleSoftDelete}
            onDeleteDraft={handleDeleteDraft}
            onArchiveTrip={handleArchiveIncoming}
            onEditTrip={(tripId) => router.push({ pathname: '/trip-overview', params: { tripId } } as never)}
            onRestoreTrip={handleRestore}
          />
        )}

        {/* ===================== MOMENTS ===================== */}

        {/* ===================== ESSENTIALS ===================== */}
        {effectiveTab === 'essentials' && (trip ? (
          <EssentialsTab
            packingState={packingState}
            packingStats={packingStats}
            files={filesData}
            colors={colors}
            addingItem={addingItem}
            newItemText={newItemText}
            editingItemId={editingPackingId}
            editingItemText={editingPackingText}
            onToggleItem={togglePackingItem}
            onStartEditItem={startEditingPackingItem}
            onSetEditingItemText={setEditingPackingText}
            onSaveEditingItem={saveEditingPackingItem}
            onCancelEditingItem={cancelEditingPackingItem}
            onDeleteItem={deletePackingListItem}
            onSetAddingItem={setAddingItem}
            onSetNewItemText={setNewItemText}
            onAddItem={handleAddPackingItem}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onFilePress={setSelectedFile}
          />
        ) : (
          <EmptyState
            icon={Archive}
            title="Packing & files"
            subtitle="Start a trip to manage your packing list, boarding passes, and travel documents."
            actionLabel="Plan a Trip"
            onAction={() => router.push('/onboarding')}
          />
        ))}

        {/* Bottom spacer -- keep outside tabs */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add trip bottom sheet */}
      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <FileViewerSheet
        visible={!!selectedFile}
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />

      {/* Member edit sheet */}
      <Modal
        visible={!!editMember}
        transparent
        animationType="slide"
        onRequestClose={() => setEditMember(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => { setEditMember(null); setEditField(null); }}>
          <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
            {editMember && !editField && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{editMember.name}</Text>
                  <Text style={styles.sheetSub}>
                    {editMember.userId ? 'On the app' : 'Not yet joined — send an invite'}
                  </Text>
                </View>
                <View style={styles.sheetActions}>
                  {editMember.userId && (
                    <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('message')}>
                      <Text style={styles.sheetBtnAccent}>Message in Trip Chat</Text>
                    </Pressable>
                  )}
                  {!editMember.userId && (
                    <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('invite')}>
                      <Text style={styles.sheetBtnAccent}>Send Invite Link</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('calendar')}>
                    <Text style={styles.sheetBtnAccent}>Send Calendar Invite</Text>
                    {editMember.email && <Text style={styles.sheetBtnMeta}>{editMember.email}</Text>}
                  </Pressable>
                  <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('photo')}>
                    <Text style={styles.sheetBtnText}>Change Photo</Text>
                  </Pressable>
                  <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('email')}>
                    <Text style={styles.sheetBtnText}>Edit Email</Text>
                    {editMember.email && <Text style={styles.sheetBtnMeta}>{editMember.email}</Text>}
                  </Pressable>
                  <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('phone')}>
                    <Text style={styles.sheetBtnText}>Edit Phone</Text>
                    {editMember.phone && <Text style={styles.sheetBtnMeta}>{editMember.phone}</Text>}
                  </Pressable>
                  {isPrimary && editMember.role !== 'Primary' && (
                    <Pressable style={styles.sheetBtn} onPress={() => handleMemberAction('remove')}>
                      <Text style={[styles.sheetBtnText, { color: colors.danger }]}>Remove from Trip</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable style={styles.sheetClose} onPress={() => setEditMember(null)}>
                  <Text style={styles.sheetCloseText}>Cancel</Text>
                </Pressable>
              </>
            )}
            {editMember && editField && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{editField === 'email' ? 'Edit Email' : 'Edit Phone'}</Text>
                  <Text style={styles.sheetSub}>{editMember.name}</Text>
                </View>
                <TextInput
                  style={styles.sheetInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder={editField === 'email' ? 'email@example.com' : '+63 912 345 6789'}
                  placeholderTextColor={colors.text3}
                  keyboardType={editField === 'email' ? 'email-address' : 'phone-pad'}
                  autoFocus
                />
                <Pressable
                  style={[styles.sheetSaveBtn, !editValue.trim() && { opacity: 0.4 }]}
                  onPress={() => handleMemberAction('save')}
                  disabled={!editValue.trim()}
                >
                  <Text style={styles.sheetSaveBtnText}>Save</Text>
                </Pressable>
                <Pressable style={styles.sheetClose} onPress={() => setEditField(null)}>
                  <Text style={styles.sheetCloseText}>Back</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Trip options menu sheet */}
      <Modal visible={showMoreMenu} transparent animationType="fade" onRequestClose={() => setShowMoreMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMoreMenu(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuHandle}><View style={styles.menuHandleBar} /></View>
            <View style={styles.menuHeaderRow}>
              <View style={styles.menuHeaderCopy}>
                <Text style={styles.menuTitle} numberOfLines={1}>{trip?.destination ?? 'Trip Options'}</Text>
                {trip?.startDate && (
                  <Text style={styles.menuSubtitle}>
                    {formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.menuCloseIcon}
                onPress={() => setShowMoreMenu(false)}
                activeOpacity={0.7}
                accessibilityLabel="Close trip options"
              >
                <X size={18} color={colors.text2} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuDivider} />

            {isPrimary && (
              <TouchableOpacity style={styles.menuRow} onPress={handleEditTrip} activeOpacity={0.7}>
                <View style={[styles.menuIconWrap, { backgroundColor: colors.accentBg }]}>
                  <Pencil size={18} color={colors.accent} />
                </View>
                <View style={styles.menuRowText}>
                  <Text style={styles.menuRowTitle}>Edit Trip Details</Text>
                  <Text style={styles.menuRowSub}>Update accommodation, dates, and info</Text>
                </View>
              </TouchableOpacity>
            )}

            {isPrimary && (
              <TouchableOpacity style={styles.menuRow} onPress={handleFinishTrip} activeOpacity={0.7}>
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(45,106,46,0.15)' }]}>
                  <CheckCircle size={18} color="#2d6a2e" />
                </View>
                <View style={styles.menuRowText}>
                  <Text style={styles.menuRowTitle}>Finish Trip</Text>
                  <Text style={styles.menuRowSub}>Complete your trip and generate a memory</Text>
                </View>
              </TouchableOpacity>
            )}

            {isPrimary && (
              <TouchableOpacity style={styles.menuRow} onPress={handleArchiveTrip} activeOpacity={0.7}>
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(196,85,74,0.12)' }]}>
                  <Archive size={18} color={colors.danger} />
                </View>
                <View style={styles.menuRowText}>
                  <Text style={[styles.menuRowTitle, { color: colors.danger }]}>Archive Trip</Text>
                  <Text style={styles.menuRowSub}>Move to past trips without a memory</Text>
                </View>
              </TouchableOpacity>
            )}

            {isPrimary && (
              <TouchableOpacity style={styles.menuRow} onPress={handleDeleteCurrentTrip} activeOpacity={0.7}>
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(196,85,74,0.12)' }]}>
                  <Trash2 size={18} color={colors.danger} />
                </View>
                <View style={styles.menuRowText}>
                  <Text style={[styles.menuRowTitle, { color: colors.danger }]}>Delete Trip</Text>
                  <Text style={styles.menuRowSub}>Move to Archived so you can restore it later</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuRow} onPress={() => { setShowMoreMenu(false); router.push('/settings'); }} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: colors.accentBg }]}>
                <Settings size={18} color={colors.accent} />
              </View>
              <View style={styles.menuRowText}>
                <Text style={styles.menuRowTitle}>Settings</Text>
                <Text style={styles.menuRowSub}>Profile, notifications, app updates</Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
            <TouchableOpacity
              style={styles.menuCancelBtn}
              onPress={() => setShowMoreMenu(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuCancelText}>Back</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Share Travel Stats sheet */}
      <ShareTravelStats
        visible={shareStatsVisible}
        data={pastTripsData.length > 0 ? AARON_DATA : PETER_DATA}
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
