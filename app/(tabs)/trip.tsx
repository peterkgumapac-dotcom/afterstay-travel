import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import Svg, {
  Circle,
  Line as SvgLine,
  Path,
  Polyline,
} from 'react-native-svg';

import AddTripSheet from '@/components/summary/AddTripSheet';
import ConstellationHero from '@/components/summary/ConstellationHero';
import HighlightsStrip from '@/components/summary/HighlightsStrip';
import PastTripRow from '@/components/summary/PastTripRow';
import { useTheme } from '@/constants/ThemeContext';

// ---------- TYPES ----------

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const TAB_KEYS = [
  'overview',
  'summary',
  'moments',
  'flights',
  'packing',
  'files',
] as const;
type TabKey = (typeof TAB_KEYS)[number];

// ---------- STATIC DATA (from prototype) ----------

const MEMBERS = [
  {
    name: 'Peter Karl Gumapoz',
    role: 'Primary' as const,
    init: 'P',
    color: '#a64d1e',
    you: true,
  },
  {
    name: 'Aaron Nicholas Gumapoz',
    role: 'Member' as const,
    init: 'A',
    color: '#b8892b',
    you: false,
  },
  {
    name: 'Jane Ansen Colada',
    role: 'Member' as const,
    init: 'J',
    color: '#c66a36',
    you: false,
  },
];

const FLIGHTS_DATA = [
  {
    dir: 'Outbound',
    airline: 'Cebu Pacific',
    code: '5J',
    num: '911',
    ref: 'VN3HTQ',
    logo: '#b8afa3',
    date: 'Sun, Apr 20',
    dep: '7:30 PM',
    arr: '8:40 PM',
    from: 'MNL',
    fromCity: 'Manila',
    to: 'MPH',
    toCity: 'Caticlan',
    dur: '1h 10m',
    bags: [
      { who: 'Peter', bag: '+20 kg' },
      { who: 'Aaron', bag: 'Pack light' },
      { who: 'Jane', bag: 'Pack light' },
    ],
    status: 'On time',
  },
  {
    dir: 'Return',
    airline: 'Philippines AirAsia',
    code: 'Z2',
    num: '214',
    ref: 'J6FF4V',
    logo: '#e03838',
    date: 'Sun, Apr 27',
    dep: '9:10 AM',
    arr: '10:20 AM',
    from: 'MPH',
    fromCity: 'Caticlan',
    to: 'MNL',
    toCity: 'Manila',
    dur: '1h 10m',
    bags: [
      { who: 'Peter', bag: '+15 kg' },
      { who: 'Aaron', bag: 'Pack light' },
      { who: 'Jane', bag: 'Pack light' },
    ],
    status: 'On time',
  },
];

const PACKING_DATA: Record<
  string,
  { t: string; by: string; d: boolean }[]
> = {
  Essentials: [
    { t: 'Passport + ID', by: 'Peter', d: true },
    { t: 'Phone charger', by: 'Peter', d: true },
    { t: 'Hotel vouchers', by: 'Peter', d: true },
    { t: 'Toiletries kit', by: 'Aaron', d: false },
    { t: 'Prescription meds', by: 'Jane', d: false },
  ],
  Beach: [
    { t: 'Swimsuits \u00D7 3', by: 'Everyone', d: true },
    { t: 'Sunscreen (SPF 50)', by: 'Aaron', d: true },
    { t: 'Beach towels \u00D7 3', by: 'Peter', d: false },
    { t: 'Waterproof pouch', by: 'Jane', d: false },
    { t: 'Reef-safe flip flops', by: 'Peter', d: false },
  ],
  Electronics: [
    { t: 'GoPro + mount', by: 'Peter', d: true },
    { t: 'Power bank', by: 'Aaron', d: false },
    { t: 'Universal adapter', by: 'Peter', d: false },
  ],
};

const FILES_DATA = [
  {
    n: 'Booking_ID_1712826310_ETicket.pdf',
    size: '842 KB',
    t: 'Ticket',
    who: 'Peter',
    icon: '#a64d1e',
  },
  {
    n: 'AGODA_Receipt_Canyon_Hotels.pdf',
    size: '1.2 MB',
    t: 'Receipt',
    who: 'Peter',
    icon: '#c66a36',
  },
  {
    n: 'Z2_214_Boarding_Passes.pdf',
    size: '640 KB',
    t: 'Boarding',
    who: 'Peter',
    icon: '#b8892b',
  },
  {
    n: 'Travel_Insurance_Policy.pdf',
    size: '320 KB',
    t: 'Insurance',
    who: 'Peter',
    icon: '#d9a441',
  },
];

const PAST_TRIPS = [
  {
    flag: '\u{1F1EF}\u{1F1F5}',
    dest: 'Tokyo',
    country: 'Japan',
    dates: 'Nov 2 \u2013 9, 2025',
    nights: 7,
    spent: 68200,
    miles: 1860,
    rating: 5,
  },
  {
    flag: '\u{1F1FB}\u{1F1F3}',
    dest: 'Da Nang',
    country: 'Vietnam',
    dates: 'Jul 14 \u2013 19, 2025',
    nights: 5,
    spent: 32400,
    miles: 1085,
    rating: 4,
  },
  {
    flag: '\u{1F1F5}\u{1F1ED}',
    dest: 'Siargao',
    country: 'Philippines',
    dates: 'Mar 8 \u2013 13, 2025',
    nights: 5,
    spent: 28900,
    miles: 450,
    rating: 5,
  },
  {
    flag: '\u{1F1F9}\u{1F1ED}',
    dest: 'Bangkok',
    country: 'Thailand',
    dates: 'Dec 20 \u2013 27, 2024',
    nights: 7,
    spent: 45600,
    miles: 1370,
    rating: 4,
  },
  {
    flag: '\u{1F1F8}\u{1F1EC}',
    dest: 'Singapore',
    country: 'Singapore',
    dates: 'Aug 3 \u2013 6, 2024',
    nights: 3,
    spent: 39800,
    miles: 1480,
    rating: 5,
  },
];

const HIGHLIGHTS = [
  {
    icon: '\u{1F30F}',
    label: '5 countries',
    sub: 'JP \u00B7 VN \u00B7 TH \u00B7 SG \u00B7 PH',
    tint: '#c66a36',
  },
  {
    icon: '\u2708\uFE0F',
    label: '6,245 miles',
    sub: '25\u00D7 around Boracay',
    tint: '#a64d1e',
  },
  {
    icon: '\u{1F3DD}',
    label: 'Beach streak',
    sub: '4 trips in a row',
    tint: '#b8892b',
  },
  {
    icon: '\u{1F4F8}',
    label: '238 moments',
    sub: 'Across all trips',
    tint: '#d9a441',
  },
  {
    icon: '\u{1F5D3}',
    label: 'Longest trip',
    sub: '7 nights \u00B7 Tokyo',
    tint: '#8a5a2b',
  },
  {
    icon: '\u{1F4B8}',
    label: 'Best value',
    sub: '\u20B15,780/night \u00B7 Siargao',
    tint: '#7e9f5b',
  },
  {
    icon: '\u{1F465}',
    label: 'Trip crew',
    sub: 'Aaron \u00B7 Jane',
    tint: '#c06c4a',
  },
  {
    icon: '\u2B50',
    label: 'Top-rated',
    sub: '3 perfect trips',
    tint: '#e0a23f',
  },
];

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

function MiniFlightCard({
  f,
  colors,
}: {
  f: (typeof FLIGHTS_DATA)[number];
  colors: ThemeColors;
}) {
  const styles = miniFlightStyles(colors);

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
              {f.code} {f.num} {'\u00B7'} {f.date}
            </Text>
          </View>
        </View>
        <Text style={styles.refText}>Ref {f.ref}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View>
          <Text style={styles.iataCode}>{f.from}</Text>
          <Text style={styles.timeText}>{f.dep}</Text>
        </View>
        <Text style={styles.durText}>{f.dur}</Text>
        <View style={styles.routeRight}>
          <Text style={styles.iataCode}>{f.to}</Text>
          <Text style={styles.timeText}>{f.arr}</Text>
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
      color: '#fff',
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
  });

// ---------- FULL FLIGHT CARD ----------

function FullFlightCard({
  f,
  colors,
}: {
  f: (typeof FLIGHTS_DATA)[number];
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
      color: '#fff',
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
  const styles = getStyles(colors);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [addOpen, setAddOpen] = useState(false);
  const [packingState, setPackingState] = useState(PACKING_DATA);

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
    setPackingState((prev) => ({
      ...prev,
      [group]: prev[group].map((it) =>
        it.t === itemText ? { ...it, d: !it.d } : it,
      ),
    }));
  };

  // Summary computed values
  const totalTrips = PAST_TRIPS.length + 1;
  const totalSpent =
    PAST_TRIPS.reduce((s, t) => s + t.spent, 0) + 18400;
  const totalNights =
    PAST_TRIPS.reduce((s, t) => s + t.nights, 0) + 2;
  const totalMiles = PAST_TRIPS.reduce((s, t) => s + t.miles, 0);
  const countriesCount = new Set(PAST_TRIPS.map((t) => t.flag)).size;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Trips</Text>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Share">
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
              >
                <Polyline
                  points="16 6 12 2 8 6"
                  stroke={colors.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <SvgLine
                  x1={12}
                  y1={2}
                  x2={12}
                  y2={15}
                  stroke={colors.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Path
                  d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                  stroke={colors.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="More">
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
              >
                <Circle
                  cx={12}
                  cy={12}
                  r={1.5}
                  fill={colors.text}
                />
                <Circle
                  cx={19}
                  cy={12}
                  r={1.5}
                  fill={colors.text}
                />
                <Circle
                  cx={5}
                  cy={12}
                  r={1.5}
                  fill={colors.text}
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active trip pill (overview only) */}
        {activeTab === 'overview' && (
          <View style={styles.pillWrapper}>
            <View style={styles.activePill}>
              <PulsingDot color={colors.accent} />
              <Text style={styles.activePillText}>
                LIVE {'\u00B7'} BORACAY {'\u00B7'} APR 20{'\u2013'}27
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
          <>
            {/* Group */}
            <GroupHeader
              kicker="Group \u00B7 3 travelers"
              title="Who's going"
              action={
                <TouchableOpacity>
                  <Text style={styles.ghostAction}>Invite +</Text>
                </TouchableOpacity>
              }
              colors={colors}
            />
            <View style={styles.listContainer}>
              {MEMBERS.map((m) => (
                <View key={m.name} style={styles.memberRow}>
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: m.color },
                    ]}
                  >
                    <Text style={styles.memberInit}>{m.init}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {m.name}
                      {m.you && (
                        <Text style={styles.youBadge}> YOU</Text>
                      )}
                    </Text>
                    <Text style={styles.memberRole}>
                      {m.role} {'\u00B7'} Booking linked
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.memberChatBtn}
                    accessibilityLabel={`Message ${m.name}`}
                  >
                    <Svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8z"
                        stroke={colors.text}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Accommodation */}
            <GroupHeader
              kicker="Accommodation"
              title="Canyon Hotels & Resorts"
              action={
                <View style={styles.paidChip}>
                  <Text style={styles.paidChipText}>Paid</Text>
                </View>
              }
              colors={colors}
            />
            <View style={styles.sectionPadding}>
              <View style={styles.accomCard}>
                <View style={styles.accomHeader}>
                  <View style={styles.accomThumb} />
                  <View style={styles.accomHeaderInfo}>
                    <Text style={styles.accomTitle}>
                      Executive Suite {'\u00D7'} 2
                    </Text>
                    <Text style={styles.accomAddr}>
                      Station B, Sitio Sinagpa, Balabag
                    </Text>
                  </View>
                </View>
                <View style={styles.accomGrid}>
                  <View>
                    <Text style={styles.accomGridLabel}>CHECK-IN</Text>
                    <Text style={styles.accomGridValue}>
                      Apr 20 {'\u00B7'} 3:00 PM
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.accomGridLabel}>CHECKOUT</Text>
                    <Text style={styles.accomGridValue}>
                      Apr 27 {'\u00B7'} 12:00 PM
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.accomGridLabel}>TOTAL</Text>
                    <Text style={styles.accomGridValue}>
                      {'\u20B1'}49,491.74
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.accomGridLabel}>
                      SPLIT / PERSON
                    </Text>
                    <Text style={styles.accomGridValue}>
                      {'\u20B1'}16,497.25
                    </Text>
                  </View>
                </View>
                <View style={styles.accomFooter}>
                  <TouchableOpacity style={styles.syncBtn}>
                    <Text style={styles.syncBtnText}>Sync details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Mini flights */}
            <GroupHeader
              kicker="Transit \u00B7 Both ways"
              title="Flights"
              colors={colors}
            />
            <View style={styles.flightsList}>
              {FLIGHTS_DATA.map((f) => (
                <MiniFlightCard key={f.ref} f={f} colors={colors} />
              ))}
            </View>
          </>
        )}

        {/* ===================== SUMMARY ===================== */}
        {activeTab === 'summary' && (
          <>
            <ConstellationHero
              miles={totalMiles}
              trips={totalTrips}
              countries={countriesCount}
              nights={totalNights}
              spent={totalSpent}
            />

            {/* Highlights */}
            <GroupHeader
              kicker="Highlights"
              title="Your travel story"
              colors={colors}
            />
            <HighlightsStrip highlights={HIGHLIGHTS} />

            {/* Past trips */}
            <GroupHeader
              kicker={`Past trips \u00B7 ${PAST_TRIPS.length}`}
              title="Where you've been"
              action={
                <TouchableOpacity>
                  <Text style={styles.ghostAction}>View all</Text>
                </TouchableOpacity>
              }
              colors={colors}
            />
            <View style={styles.listContainer}>
              {PAST_TRIPS.map((t, i) => (
                <PastTripRow key={i} trip={t} />
              ))}

              {/* Add past trip row */}
              <TouchableOpacity
                onPress={() => setAddOpen(true)}
                style={styles.addPastTripRow}
                activeOpacity={0.7}
              >
                <View style={styles.addPastTripIcon}>
                  <Svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <SvgLine
                      x1={12}
                      y1={5}
                      x2={12}
                      y2={19}
                      stroke={colors.accent}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <SvgLine
                      x1={5}
                      y1={12}
                      x2={19}
                      y2={12}
                      stroke={colors.accent}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
                <View style={styles.addPastTripInfo}>
                  <Text style={styles.addPastTripTitle}>
                    Add a past trip
                  </Text>
                  <Text style={styles.addPastTripSub}>
                    Backfill your travel history
                  </Text>
                </View>
                <Svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <Polyline
                    points="9 18 15 12 9 6"
                    stroke={colors.text3}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ===================== MOMENTS ===================== */}
        {activeTab === 'moments' && (
          <View style={styles.momentsPadding}>
            <Text style={styles.placeholderText}>
              Moments tab coming soon
            </Text>
          </View>
        )}

        {/* ===================== FLIGHTS ===================== */}
        {activeTab === 'flights' && (
          <View style={styles.fullFlightsList}>
            {FLIGHTS_DATA.map((f) => (
              <FullFlightCard key={f.ref} f={f} colors={colors} />
            ))}
          </View>
        )}

        {/* ===================== PACKING ===================== */}
        {activeTab === 'packing' && (
          <>
            <View style={styles.packingHeader}>
              <Text style={styles.packingCount}>
                <Text style={styles.packingCountAccent}>
                  {packingStats.done}
                </Text>{' '}
                of {packingStats.total} packed
              </Text>
              <TouchableOpacity style={styles.addItemBtn}>
                <Text style={styles.addItemBtnText}>+ Add item</Text>
              </TouchableOpacity>
            </View>

            {Object.entries(packingState).map(([group, items]) => (
              <View key={group}>
                <GroupHeader
                  kicker={group}
                  title={`${items.filter((i) => i.d).length} / ${items.length} ready`}
                  colors={colors}
                />
                <View style={styles.packingList}>
                  {items.map((it) => (
                    <Pressable
                      key={it.t}
                      onPress={() => togglePackingItem(group, it.t)}
                      style={[
                        styles.packingRow,
                        { opacity: it.d ? 0.7 : 1 },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          it.d && styles.checkboxChecked,
                        ]}
                      >
                        {it.d && (
                          <Svg
                            width={12}
                            height={12}
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <Polyline
                              points="20 6 9 17 4 12"
                              stroke={colors.onBlack}
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.packingItemText,
                          it.d && styles.packingItemDone,
                        ]}
                      >
                        {it.t}
                      </Text>
                      <View style={styles.packingByChip}>
                        <Text style={styles.packingByText}>{it.by}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {/* ===================== FILES ===================== */}
        {activeTab === 'files' && (
          <>
            <View style={styles.filesHeader}>
              <Text style={styles.filesCount}>
                {FILES_DATA.length} files {'\u00B7'} 3.0 MB
              </Text>
              <TouchableOpacity style={styles.uploadBtn}>
                <Text style={styles.uploadBtnText}>+ Upload</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filesList}>
              {FILES_DATA.map((f) => (
                <View key={f.n} style={styles.fileRow}>
                  <View
                    style={[
                      styles.fileIcon,
                      {
                        backgroundColor: f.icon + '20',
                        borderColor: f.icon + '40',
                      },
                    ]}
                  >
                    <Svg
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"
                        stroke={f.icon}
                        strokeWidth={1.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Polyline
                        points="14 3 14 8 19 8"
                        stroke={f.icon}
                        strokeWidth={1.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View style={styles.fileInfo}>
                    <Text
                      style={styles.fileName}
                      numberOfLines={1}
                    >
                      {f.n}
                    </Text>
                    <Text style={styles.fileMeta}>
                      {f.t} {'\u00B7'} {f.size} {'\u00B7'} by {f.who}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    accessibilityLabel={`Download ${f.n}`}
                  >
                    <Svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                        stroke={colors.text}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Polyline
                        points="7 10 12 15 17 10"
                        stroke={colors.text}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <SvgLine
                        x1={12}
                        y1={15}
                        x2={12}
                        y2={3}
                        stroke={colors.text}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setAddOpen(true)}
        accessibilityLabel="Add trip"
        accessibilityRole="button"
        style={styles.fab}
        activeOpacity={0.85}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <SvgLine
            x1={12}
            y1={5}
            x2={12}
            y2={19}
            stroke="#fffaf0"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <SvgLine
            x1={5}
            y1={12}
            x2={19}
            y2={12}
            stroke="#fffaf0"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      </TouchableOpacity>

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
      color: '#0b0f14',
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

    // FAB
    fab: {
      position: 'absolute',
      right: 18,
      bottom: 100,
      width: 52,
      height: 52,
      borderRadius: 99,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
    },

    // Bottom spacer
    bottomSpacer: {
      height: 20,
    },
  });
