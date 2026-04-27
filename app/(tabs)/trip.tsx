import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ArrowLeft, Archive, CheckCircle, Map, MoreHorizontal, Pencil, Share2, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

import AddTripSheet from '@/components/summary/AddTripSheet';
import EmptyState from '@/components/shared/EmptyState';
import { OverviewTab } from '@/components/trip/OverviewTab';
import { SummaryTab } from '@/components/trip/SummaryTab';
import { EssentialsTab } from '@/components/trip/EssentialsTab';
import { useTheme } from '@/constants/ThemeContext';
import { colors as themeColors } from '@/constants/theme';
import {
  addPackingItem,
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
  updateMemberEmail,
  updateMemberPhone,
  updateMemberPhoto,
  updateTripProperty,
  finishTrip,
  archiveTrip,
} from '@/lib/supabase';
import { buildTripCalendarUrl } from '@/lib/calendarInvite';
import { getQuickTrips } from '@/lib/quickTrips';
import type { QuickTrip } from '@/lib/quickTripTypes';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';
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

interface FlightDisplayData {
  dir: string;
  airline: string;
  code: string;
  num: string;
  ref: string;
  logo: string;
  date: string;
  dep: string;
  arr: string;
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  dur: string;
  bags: { who: string; bag: string }[];
  status: string;
}

function mapFlightToDisplay(f: Flight): FlightDisplayData {
  const code = f.flightNumber.split(' ')[0] ?? '';
  const num = f.flightNumber.split(' ')[1] ?? f.flightNumber;
  return {
    dir: f.direction,
    airline: f.airline,
    code,
    num,
    ref: f.bookingRef ?? '',
    logo: f.direction === 'Outbound' ? themeColors.text2 : themeColors.danger,
    date: formatDatePHT(f.departTime),
    dep: formatTimePHT(f.departTime),
    arr: formatTimePHT(f.arriveTime),
    from: f.from,
    fromCity: f.from,
    to: f.to,
    toCity: f.to,
    dur: '',
    bags: f.baggage ? [{ who: f.passenger ?? '', bag: f.baggage }] : [],
    status: 'Confirmed',
  };
}

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

export default function TripScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();

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
  const [membersData, setMembersData] = useState<GroupMember[]>([]);
  const [flightsData, setFlightsData] = useState<Flight[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [filesData, setFilesData] = useState<TripFile[]>([]);
  const [activeTripSpent, setActiveTripSpent] = useState(0);
  const [pastTripsData, setPastTripsData] = useState<Trip[]>([]);
  const [quickTripsData, setQuickTripsData] = useState<QuickTrip[]>([]);
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  const [lifetimeStats, setLifetimeStats] = useState<{
    totalTrips: number;
    totalCountries: number;
    totalNights: number;
    totalMiles: number;
    totalSpent: number;
  } | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const t = await getActiveTrip(force);
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
      const [stats, highlights, past, expSummary, qTrips] = await Promise.all([
        getLifetimeStats('').catch(() => null),
        getHighlights('').catch(() => [] as Highlight[]),
        getAllUserTrips('').catch(() => [] as Trip[]),
        getExpenseSummary().catch(() => ({ total: 0, byCategory: {}, count: 0 })),
        getQuickTrips().catch(() => [] as QuickTrip[]),
      ]);
      if (stats) setLifetimeStats(stats);
      setHighlightsData(highlights);
      setActiveTripSpent(expSummary.total);
      setQuickTripsData(qTrips);

      // Backfill spent for trips missing total_spent (legacy data)
      const enriched = await Promise.all(
        past.map(async (t) => {
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
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  useEffect(() => {
    load();
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

  const togglePackingItem = (group: string, itemText: string) => {
    setPackingItems((prev) =>
      prev.map((it) =>
        it.item === itemText ? { ...it, packed: !it.packed } : it,
      ),
    );
    const item = packingItems.find((it) => it.item === itemText);
    if (item) {
      togglePacked(item.id, !item.packed).catch(() => {
        // revert on failure
        setPackingItems((prev) =>
          prev.map((it) =>
            it.item === itemText ? { ...it, packed: !it.packed } : it,
          ),
        );
      });
    }
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

  // Button handlers
  const handleShare = () => {
    Share.share({ message: `Check out our trip to ${trip?.destination ?? 'somewhere amazing'}!` });
  };

  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMoreMenu(true);
  };

  const handleEditTrip = () => {
    setShowMoreMenu(false);
    router.push('/trip-overview');
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
              load(true);
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
              router.replace('/(tabs)/home');
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
    } else if (action === 'invite') {
      setEditMember(null);
      const msg = `Join our trip on AfterStay! Download the app and use your invite code to see all the trip details.`;
      const target = member.phone
        ? `sms:${member.phone}?body=${encodeURIComponent(msg)}`
        : member.email
          ? `mailto:${member.email}?subject=${encodeURIComponent('Join our trip on AfterStay')}&body=${encodeURIComponent(msg)}`
          : null;
      if (target) {
        Linking.openURL(target).catch(() => {});
      } else {
        router.push('/invite');
      }
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
      // Revert on failure
      setPackingItems((prev) => prev.filter((it) => it.id !== tempId));
    }
  };

  const handleUpload = () => {
    router.push('/add-file');
  };

  const handleDownload = async (fileUrl: string) => {
    try {
      await WebBrowser.openBrowserAsync(fileUrl);
    } catch {
      if (__DEV__) console.warn('Failed to open browser:', fileUrl);
    }
  };

  // Show full empty state only when there are truly no trips at all
  const hasAnyTrips = pastTripsData.length > 0 || quickTripsData.length > 0;
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
          title="No active trip"
          subtitle="Create a trip to see your overview, packing list, files, and travel companions."
          actionLabel="Get Started"
          onAction={() => router.push('/onboarding')}
        />
      </SafeAreaView>
    );
  }

  // No active trip but has past/quick trips — force summary tab
  const effectiveTab = (!trip && hasAnyTrips) ? 'summary' : activeTab;

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

        {/* Active trip pill (overview only) */}
        {trip && effectiveTab === 'overview' && (
          <View style={styles.pillWrapper}>
            <View style={styles.activePill}>
              <PulsingDot color={colors.accent} />
              <Text style={styles.activePillText}>
                LIVE · {destLabel.toUpperCase() || 'TRIP'} · {dateRangeLabel.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Segmented control — only show when there's an active trip */}
        {trip && (
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
        )}

        {/* ===================== OVERVIEW ===================== */}
        {trip && effectiveTab === 'overview' && (
          <OverviewTab
            trip={trip}
            members={membersData}
            flights={flightsDisplay}
            hotelPhotos={hotelPhotos}
            colors={colors}
            onMemberEdit={handleMemberEdit}
            onMemberChat={handleMemberChat}
            onInvite={handleInvite}
            onAddMember={() => router.push('/add-member')}
            onLoad={load}
          />
        )}

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
            quickTrips={quickTripsData}
            colors={colors}
            onAddTrip={() => setAddOpen(true)}
            onTripPress={(tripId) => router.push({ pathname: '/trip-recap', params: { tripId } } as never)}
            onQuickTripPress={(id) => router.push({ pathname: '/quick-trip-detail', params: { quickTripId: id } } as never)}
            onAddQuickTrip={() => router.push('/quick-trip-create' as never)}
          />
        )}

        {/* ===================== MOMENTS ===================== */}

        {/* ===================== ESSENTIALS ===================== */}
        {trip && effectiveTab === 'essentials' && (
          <EssentialsTab
            packingState={packingState}
            packingStats={packingStats}
            files={filesData}
            colors={colors}
            addingItem={addingItem}
            newItemText={newItemText}
            onToggleItem={togglePackingItem}
            onSetAddingItem={setAddingItem}
            onSetNewItemText={setNewItemText}
            onAddItem={handleAddPackingItem}
            onUpload={handleUpload}
            onDownload={handleDownload}
          />
        )}

        {/* Bottom spacer -- keep outside tabs */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add trip bottom sheet */}
      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />

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
            <Text style={styles.menuTitle}>{trip?.destination ?? 'Trip Options'}</Text>
            {trip?.startDate && (
              <Text style={styles.menuSubtitle}>{trip.startDate} – {trip.endDate}</Text>
            )}

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuRow} onPress={handleEditTrip} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: colors.accentBg }]}>
                <Pencil size={18} color={colors.accent} />
              </View>
              <View style={styles.menuRowText}>
                <Text style={styles.menuRowTitle}>Edit Trip Details</Text>
                <Text style={styles.menuRowSub}>Update accommodation, dates, and info</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleFinishTrip} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(45,106,46,0.15)' }]}>
                <CheckCircle size={18} color="#2d6a2e" />
              </View>
              <View style={styles.menuRowText}>
                <Text style={styles.menuRowTitle}>Finish Trip</Text>
                <Text style={styles.menuRowSub}>Complete your trip and generate a memory</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleArchiveTrip} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(196,85,74,0.12)' }]}>
                <Archive size={18} color={colors.danger} />
              </View>
              <View style={styles.menuRowText}>
                <Text style={[styles.menuRowTitle, { color: colors.danger }]}>Archive Trip</Text>
                <Text style={styles.menuRowSub}>Move to past trips without a memory</Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
            <TouchableOpacity
              style={styles.menuCancelBtn}
              onPress={() => setShowMoreMenu(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
      paddingHorizontal: 20,
      paddingBottom: 36,
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
