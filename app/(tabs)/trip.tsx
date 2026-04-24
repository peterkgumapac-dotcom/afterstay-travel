import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { ArrowLeft, Map, MoreHorizontal, Share2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

import AddTripSheet from '@/components/summary/AddTripSheet';
import EmptyState from '@/components/shared/EmptyState';
import { TripFloatingActionButton } from '@/components/shared/TripFloatingActionButton';
import ConstellationHero from '@/components/summary/ConstellationHero';
import HighlightsStrip from '@/components/summary/HighlightsStrip';
import { OverviewTab } from '@/components/trip/OverviewTab';
import { SummaryTab } from '@/components/trip/SummaryTab';
import { EssentialsTab } from '@/components/trip/EssentialsTab';
import PastTripRow from '@/components/summary/PastTripRow';
import { useTheme } from '@/constants/ThemeContext';
import { colors as themeColors } from '@/constants/theme';
import {
  addPackingItem,
  getActiveTrip,
  getFlights,
  getGroupMembers,
  getPackingList,
  getTripFiles,
  getLifetimeStats,
  getHighlights,
  getPastTrips,
  togglePacked,
  updateMemberEmail,
  updateMemberPhone,
  updateMemberPhoto,
} from '@/lib/supabase';
import { formatDatePHT, formatTimePHT, formatCurrency } from '@/lib/utils';
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
  flag: string;
  dest: string;
  country: string;
  dates: string;
  nights: number;
  spent: number;
  miles: number;
  rating: number;
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
  return {
    flag: COUNTRY_FLAGS[t.countryCode ?? ''] ?? '\u{1F30D}',
    dest: t.destination ?? t.name,
    country: t.country ?? '',
    dates: `${formatDatePHT(t.startDate)} \u2013 ${formatDatePHT(t.endDate)}`,
    nights: t.totalNights ?? t.nights ?? 0,
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

  // Data from Supabase
  const [trip, setTrip] = useState<Trip | null>(null);
  const [membersData, setMembersData] = useState<GroupMember[]>([]);
  const [flightsData, setFlightsData] = useState<Flight[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [filesData, setFilesData] = useState<TripFile[]>([]);
  const [pastTripsData, setPastTripsData] = useState<Trip[]>([]);
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
      // Load lifetime data (userId not required for now — loads all)
      const [stats, highlights, past] = await Promise.all([
        getLifetimeStats('').catch(() => null),
        getHighlights('').catch(() => [] as Highlight[]),
        getPastTrips('').catch(() => [] as Trip[]),
      ]);
      if (stats) setLifetimeStats(stats);
      setHighlightsData(highlights);
      setPastTripsData(past);
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
    () => pastTripsData.map(mapTripToPastDisplay),
    [pastTripsData],
  );

  // Summary computed values
  const totalTrips = (lifetimeStats?.totalTrips ?? pastTripsDisplay.length) + 1;
  const totalSpent = lifetimeStats?.totalSpent ?? pastTripsDisplay.reduce((s, t) => s + t.spent, 0);
  const totalNights = lifetimeStats?.totalNights ?? pastTripsDisplay.reduce((s, t) => s + t.nights, 0);
  const totalMiles = lifetimeStats?.totalMiles ?? 0;
  const countriesCount = lifetimeStats?.totalCountries ?? new Set(pastTripsDisplay.map((t) => t.flag)).size;

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

  const handleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleInvite = async () => {
    await Clipboard.setStringAsync('https://afterstay.app/invite/boracay-2026');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Invite link copied to clipboard!');
  };

  const handleMemberEdit = (member: GroupMember) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const showEmailPrompt = () => {
      if (Platform.OS === 'ios') {
        Alert.prompt(
          'Edit Email',
          `Current: ${member.email || 'Not set'}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: (value?: string) => {
                if (!value?.trim()) return;
                updateMemberEmail(member.id, value.trim())
                  .then(() => load())
                  .catch(() => {});
              },
            },
          ],
          'plain-text',
          member.email ?? '',
          'email-address',
        );
      } else {
        Alert.alert('Edit Email', 'Use the member settings to update email on Android.');
      }
    };

    const showPhonePrompt = () => {
      if (Platform.OS === 'ios') {
        Alert.prompt(
          'Edit Phone',
          `Current: ${member.phone || 'Not set'}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: (value?: string) => {
                if (!value?.trim()) return;
                updateMemberPhone(member.id, value.trim())
                  .then(() => load())
                  .catch(() => {});
              },
            },
          ],
          'plain-text',
          member.phone ?? '',
          'phone-pad',
        );
      } else {
        Alert.alert('Edit Phone', 'Use the member settings to update phone on Android.');
      }
    };

    const pickMemberPhoto = async () => {
      if (Platform.OS === 'ios') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photo Library Access',
            'Please enable photo library access in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
            ],
          );
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
        try {
          await updateMemberPhoto(member.id, result.assets[0].uri);
          load();
        } catch {
          Alert.alert('Failed to update photo');
        }
      }
    };

    Alert.alert(member.name, 'Edit member details', [
      { text: 'Change Photo', onPress: pickMemberPhoto },
      { text: 'Edit Email', onPress: showEmailPrompt },
      { text: 'Edit Phone', onPress: showPhonePrompt },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  if (!trip && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')} hitSlop={12} accessibilityLabel="Back to Home">
              <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Trips</Text>
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
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')} hitSlop={12} accessibilityLabel="Back to Home">
              <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Trips</Text>
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
        {activeTab === 'overview' && (
          <View style={styles.pillWrapper}>
            <View style={styles.activePill}>
              <PulsingDot color={colors.accent} />
              <Text style={styles.activePillText}>
                LIVE · {destLabel.toUpperCase() || 'TRIP'} · {dateRangeLabel.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Segmented control */}
        <View style={styles.segWrapper}>
          <View style={styles.segmented}>
            {TAB_KEYS.map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.segBtn,
                  activeTab === t && styles.segBtnActive,
                ]}
                onPress={() => setActiveTab(t)}
              >
                <Text
                  style={[
                    styles.segText,
                    activeTab === t && styles.segTextActive,
                  ]}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ===================== OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <OverviewTab
            trip={trip}
            members={membersData}
            flights={flightsDisplay}
            hotelPhotos={hotelPhotos}
            colors={colors}
            onMemberEdit={handleMemberEdit}
            onMemberChat={handleMemberChat}
            onInvite={handleInvite}
            onLoad={load}
          />
        )}

        {/* ===================== SUMMARY ===================== */}
        {activeTab === 'summary' && (
          <SummaryTab
            totalMiles={totalMiles}
            totalTrips={totalTrips}
            countriesCount={countriesCount}
            totalNights={totalNights}
            totalSpent={totalSpent}
            highlights={highlightsForStrip}
            pastTrips={pastTripsDisplay}
            colors={colors}
            onAddTrip={() => setAddOpen(true)}
          />
        )}

        {/* ===================== MOMENTS ===================== */}
        {activeTab === 'guide' && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/guide' as never)}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingVertical: 16,
                paddingHorizontal: 24,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Open Property Guide</Text>
              <Text style={{ fontSize: 12, color: colors.text3 }}>Hotel info, WiFi, house rules, amenities</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== ESSENTIALS ===================== */}
        {activeTab === 'essentials' && (
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

      {/* FAB — action menu */}
      <TripFloatingActionButton
        onAddTrip={() => setAddOpen(true)}
        onAddEssentials={() => { setActiveTab('essentials'); setAddingItem(true); }}
      />

      {/* Add trip bottom sheet */}
      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />
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
  });
