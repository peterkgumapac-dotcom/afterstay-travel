import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Path,
  Pattern,
  Polyline,
  Rect,
  Line,
} from 'react-native-svg';

import { Hotel, MapPin, StickyNote } from 'lucide-react-native';

import { useRouter } from 'expo-router';

import { useTheme } from '@/constants/ThemeContext';
import EmptyState from '@/components/shared/EmptyState';
import { getActiveTrip } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type TabId = 'property' | 'nearby' | 'notes';

// ── Data ────────────────────────────────────────────────────────────────

const PROPERTY = {
  name: 'Canyon Hotels & Resorts Boracay',
  desc: 'Station B, Sitio Sinagpa, Balabag, Malay, Aklan 5608',
  checkIn: '3:00 PM',
  checkOut: '12:00 PM',
  phone: '+63 36 288 5888',
  email: 'reservations@canyonhotels.ph',
} as const;

const AMENITIES = [
  { n: 'Infinity pool', iconId: 'pool' },
  { n: 'Free WiFi', iconId: 'wifi' },
  { n: 'Breakfast', iconId: 'breakfast' },
  { n: 'Gym', iconId: 'gym' },
  { n: 'Shuttle', iconId: 'shuttle' },
  { n: 'Spa', iconId: 'spa' },
] as const;

const NEARBY = [
  { n: 'CityMall Boracay', d: '470 m', t: 'Shopping mall', w: '6 min walk', pin: 'M' },
  { n: "D'Mall", d: '1.6 km', t: 'Shopping street', w: '20 min walk', pin: 'D' },
  { n: 'Island Clinic', d: '830 m', t: 'Medical', w: '10 min walk', pin: '+' },
  { n: 'White Beach Path 2', d: '1.1 km', t: 'Beach access', w: '14 min walk', pin: '~' },
  { n: 'Puka Beach', d: '4.2 km', t: 'Beach', w: '15 min ride', pin: '~' },
] as const;

const NOTES = [
  {
    title: 'Check-in tip',
    body: 'Agoda vouchers required at the front desk \u2014 already saved to Files.',
    time: '2h ago',
    by: 'Peter',
  },
  {
    title: 'Tricycle fare',
    body: "Fixed rate \u20B13\u20135/person short hops. Don't pay more than \u20B1150 flag-down from Caticlan.",
    time: 'Yesterday',
    by: 'Aaron',
  },
  {
    title: 'Sunset plan',
    body: 'Try Station 2 first night \u2014 golden hour 5:40 PM. Bring the GoPro.',
    time: '2 days ago',
    by: 'Jane',
  },
] as const;

const HOTEL_PHOTO =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80';

const MAP_PINS = [
  { x: '20%', y: '30%' },
  { x: '75%', y: '25%' },
  { x: '30%', y: '75%' },
  { x: '80%', y: '70%' },
] as const;

// ── Amenity icon renderer ───────────────────────────────────────────────

function AmenityIcon({ id, color }: { id: string; color: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (id) {
    case 'pool':
      return (
        <Svg {...props}>
          <Path d="M2 20c2 0 2-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2" />
          <Path d="M2 15c2 0 2-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2" />
          <Path d="M8 11V4a2 2 0 012-2h2a2 2 0 012 2v7" />
        </Svg>
      );
    case 'wifi':
      return (
        <Svg {...props}>
          <Path d="M5 12.5a10 10 0 0114 0" />
          <Path d="M8.5 15.5a5 5 0 017 0" />
          <Circle cx={12} cy={19} r={1} fill={color} />
        </Svg>
      );
    case 'breakfast':
      return (
        <Svg {...props}>
          <Path d="M3 12h14a4 4 0 010 8H5a2 2 0 01-2-2z" />
          <Path d="M8 7a2 2 0 014 0 2 2 0 004 0M17 12v-2a3 3 0 016 0v2" />
        </Svg>
      );
    case 'gym':
      return (
        <Svg {...props} strokeLinejoin={undefined}>
          <Path d="M6 8v8M18 8v8M2 12h4M18 12h4M9 10v4M15 10v4" />
        </Svg>
      );
    case 'shuttle':
      return (
        <Svg {...props}>
          <Rect x={3} y={6} width={18} height={12} rx={2} />
          <Path d="M3 12h18M7 18v2M17 18v2" />
          <Circle cx={7} cy={14} r={1} fill={color} />
          <Circle cx={17} cy={14} r={1} fill={color} />
        </Svg>
      );
    case 'spa':
      return (
        <Svg {...props}>
          <Path d="M12 22c-6 0-10-4-10-10 0-3 2-6 4-6s4 2 4 4M12 22c6 0 10-4 10-10 0-3-2-6-4-6s-4 2-4 4" />
        </Svg>
      );
    default:
      return null;
  }
}

// ── Pulsing dot for map pin ─────────────────────────────────────────────

function PulsingMapPin({ colors, label }: { colors: ThemeColors; label: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles_static.pinContainer, animStyle]}>
      <View
        style={[
          styles_static.pinOuter,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
          },
        ]}
      >
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.onBlack}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z" />
          <Circle cx={12} cy={9} r={2.5} />
        </Svg>
      </View>
      <Text style={[styles_static.pinLabel, { color: colors.text }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

// Some styles that don't depend on theme
const styles_static = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
  },
  pinOuter: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
});

// ── Main screen ─────────────────────────────────────────────────────────

export default function GuideScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tab, setTab] = useState<TabId>('property');
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    getActiveTrip().then((t) => { if (t) setTrip(t); }).catch((e) => { if (__DEV__) console.warn('[GuideScreen] load active trip failed:', e); });
  }, []);

  // Canyon Hotels backward compat — show hardcoded data only for Canyon trips
  const isCanyon = trip?.accommodation?.toLowerCase().includes('canyon') ?? false;
  const hasAccommodation = !!(trip?.accommodation);

  const hotelName = hasAccommodation ? trip!.accommodation : (isCanyon ? PROPERTY.name : '');
  const hotelAddr = trip?.address ?? (isCanyon ? PROPERTY.desc : '');
  const checkInTime = trip?.checkIn ?? (isCanyon ? PROPERTY.checkIn : '');
  const checkOutTime = trip?.checkOut ?? (isCanyon ? PROPERTY.checkOut : '');
  const destLabel = trip?.destination ?? '';
  const checkInDate = trip ? formatDatePHT(trip.startDate) : '';
  const checkOutDate = trip ? formatDatePHT(trip.endDate) : '';

  const hotelPhotoUrl = (() => {
    if (!trip?.hotelPhotos) return HOTEL_PHOTO;
    try {
      const parsed = JSON.parse(trip.hotelPhotos);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : HOTEL_PHOTO;
    } catch {
      return HOTEL_PHOTO;
    }
  })();

  // No trip at all — show empty state
  if (!trip) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>Guide</Text>
          </View>
        </View>
        <EmptyState
          icon={Hotel}
          title="No trip yet"
          subtitle="Create a trip to see your property guide, nearby essentials, and group notes."
          actionLabel="Get Started"
          onAction={() => router.push('/onboarding')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Guide</Text>
          <Text style={styles.subtitle}>{hotelName || destLabel} {hotelName && destLabel ? `\u00B7 ${destLabel}` : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel="Search"
          accessibilityRole="button"
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.7}
        >
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.text}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Circle cx={11} cy={11} r={8} />
            <Line x1={21} y1={21} x2={16.6} y2={16.6} />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={styles.segWrapper}>
        <View style={styles.seg}>
          {(['property', 'nearby', 'notes'] as const).map((id) => {
            const label =
              id === 'property'
                ? 'Property'
                : id === 'nearby'
                  ? 'Nearby'
                  : 'Notes';
            return (
              <TouchableOpacity
                key={id}
                style={[styles.segBtn, tab === id && styles.segBtnActive]}
                onPress={() => {
                  setTab(id);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.segText, tab === id && styles.segTextActive]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══════ PROPERTY TAB ═══════ */}
        {tab === 'property' && !hasAccommodation && !isCanyon && (
          <EmptyState
            icon={Hotel}
            title="No accommodation added"
            subtitle="Add your hotel or stay details to see check-in times, amenities, and contact info."
            actionLabel="Add Hotel Details"
            onAction={() => router.push('/(tabs)/trip')}
          />
        )}
        {tab === 'property' && (hasAccommodation || isCanyon) && (
          <>
            {/* Hero image */}
            <View style={styles.heroWrapper}>
              <View style={styles.heroCard}>
                <View style={styles.heroImageBg}>
                  <Image
                    source={{ uri: hotelPhotoUrl }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                  <View style={styles.heroGradient} />
                  <View style={styles.heroTextBlock}>
                    <Text style={styles.heroName}>{hotelName}</Text>
                    <Text style={styles.heroDesc}>{hotelAddr}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Check-in / Check-out times */}
            <View style={styles.timesWrapper}>
              <View style={styles.timesGrid}>
                <View style={styles.timeCard}>
                  <Text style={styles.timeEyebrow}>Check-in</Text>
                  <Text style={styles.timeValue}>{checkInTime}</Text>
                  <Text style={styles.timeDate}>{checkInDate}</Text>
                </View>
                <View style={styles.timeCard}>
                  <Text style={styles.timeEyebrow}>Check-out</Text>
                  <Text style={styles.timeValue}>{checkOutTime}</Text>
                  <Text style={styles.timeDate}>{checkOutDate}</Text>
                </View>
              </View>
            </View>

            {/* Amenities */}
            <View style={styles.groupHeader}>
              <Text style={styles.eyebrow}>Amenities</Text>
              <Text style={styles.groupTitle}>What{'\u2019'}s included</Text>
            </View>
            <View style={styles.amenityGridWrapper}>
              <View style={styles.amenityGrid}>
                {AMENITIES.map((a) => (
                  <View key={a.n} style={styles.amenityCell}>
                    <View style={{ marginBottom: 8 }}>
                      <AmenityIcon id={a.iconId} color={colors.accent} />
                    </View>
                    <Text style={styles.amenityLabel}>{a.n}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Contact */}
            <View style={styles.groupHeader}>
              <Text style={styles.eyebrow}>Contact</Text>
              <Text style={styles.groupTitle}>Reach the property</Text>
            </View>
            <View style={styles.contactList}>
              {/* Phone */}
              <TouchableOpacity
                style={styles.contactRow}
                onPress={async () => {
                  const phone = trip?.hotelPhone ?? PROPERTY.phone;
                  const url = `tel:${phone.replace(/[^+\d]/g, '')}`;
                  try {
                    await Linking.openURL(url);
                  } catch {
                    if (__DEV__) console.warn('Failed to open URL:', url);
                  }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Call ${trip?.hotelPhone ?? PROPERTY.phone}`}
              >
                <View style={styles.contactIcon}>
                  <Svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M22 16.9v3a2 2 0 01-2.2 2 20 20 0 01-8.6-3.1 19.5 19.5 0 01-6-6A20 20 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.8.6a2 2 0 011.7 2z" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>{trip?.hotelPhone ?? PROPERTY.phone}</Text>
                  <Text style={styles.contactMeta}>
                    Reception {'\u00B7'} 24 hours
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Email */}
              <TouchableOpacity
                style={styles.contactRow}
                onPress={async () => {
                  const url = `mailto:${PROPERTY.email}`;
                  try {
                    await Linking.openURL(url);
                  } catch {
                    if (__DEV__) console.warn('Failed to open URL:', url);
                  }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Email ${PROPERTY.email}`}
              >
                <View style={styles.contactIcon}>
                  <Svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Rect x={3} y={5} width={18} height={14} rx={2} />
                    <Polyline points="3 7 12 13 21 7" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>{PROPERTY.email}</Text>
                  <Text style={styles.contactMeta}>Reservations</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ═══════ NEARBY TAB ═══════ */}
        {tab === 'nearby' && !isCanyon && (
          <EmptyState
            icon={MapPin}
            title="Nearby places"
            subtitle="Nearby essentials will appear here once your accommodation is set up."
          />
        )}
        {tab === 'nearby' && isCanyon && (
          <>
            {/* Mini map card */}
            <View style={styles.mapCardWrapper}>
              <View style={styles.mapCard}>
                {/* Grid pattern background */}
                <Svg
                  width="100%"
                  height="100%"
                  style={StyleSheet.absoluteFill}
                >
                  <Defs>
                    <Pattern
                      id="grid"
                      width={24}
                      height={24}
                      patternUnits="userSpaceOnUse"
                    >
                      <Path
                        d="M 24 0 L 0 0 0 24"
                        fill="none"
                        stroke={colors.border}
                        strokeWidth={0.5}
                      />
                    </Pattern>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#grid)" opacity={0.25} />
                </Svg>

                {/* Hotel pin (centered) */}
                <View style={styles.mapPinCenter}>
                  <PulsingMapPin colors={colors} label={hotelName} />
                </View>

                {/* Scattered secondary pins */}
                {MAP_PINS.map((p, i) => (
                  <View
                    key={i}
                    style={[
                      styles.mapDot,
                      { left: p.x as unknown as number, top: p.y as unknown as number },
                    ]}
                  >
                    <View
                      style={[
                        styles.mapDotInner,
                        { backgroundColor: colors.text3 },
                      ]}
                    />
                  </View>
                ))}

                {/* Open map button */}
                <TouchableOpacity
                  style={styles.openMapBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open map"
                  onPress={async () => {
                    const lat = 11.9710;
                    const lng = 121.9215;
                    const url = `https://maps.google.com/?q=${lat},${lng}`;
                    try {
                      await Linking.openURL(url);
                    } catch {
                      if (__DEV__) console.warn('Failed to open URL:', url);
                    }
                  }}
                >
                  <Text style={styles.openMapBtnText}>Open map {'\u2192'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Essentials header */}
            <View style={styles.groupHeader}>
              <Text style={styles.eyebrow}>Essentials</Text>
              <Text style={styles.groupTitle}>Around the hotel</Text>
            </View>

            {/* Nearby list */}
            <View style={styles.nearbyList}>
              {NEARBY.map((n) => (
                <View key={n.n} style={styles.nearbyRow}>
                  <View style={styles.nearbyPin}>
                    <Text style={styles.nearbyPinText}>{n.pin}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nearbyName}>{n.n}</Text>
                    <Text style={styles.nearbyMeta}>
                      {n.t} {'\u00B7'} {n.w}
                    </Text>
                  </View>
                  <Text style={styles.nearbyDist}>{n.d}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ═══════ NOTES TAB ═══════ */}
        {tab === 'notes' && !isCanyon && (
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            subtitle="Add tips and reminders for your travel group — check-in tricks, local fares, sunset spots."
          />
        )}
        {tab === 'notes' && isCanyon && (
          <>
            {/* Notes header */}
            <View style={styles.notesHeader}>
              <Text style={styles.notesCount}>
                {NOTES.length} notes {'\u00B7'} shared with group
              </Text>
              <TouchableOpacity
                style={styles.newNoteBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="New note"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.prompt(
                    'New note',
                    'Add a quick note for the group',
                    (_text) => {
                      // Note creation will be wired to Supabase
                    },
                    'plain-text',
                  );
                }}
              >
                <Text style={styles.newNoteBtnText}>+ New note</Text>
              </TouchableOpacity>
            </View>

            {/* Notes list */}
            <View style={styles.notesList}>
              {NOTES.map((n, i) => (
                <View key={i} style={styles.noteCard}>
                  <View style={styles.noteTopRow}>
                    <Text style={styles.noteTitle}>{n.title}</Text>
                    <Text style={styles.noteTime}>{n.time}</Text>
                  </View>
                  <Text style={styles.noteBody}>{n.body}</Text>
                  <View style={styles.noteFooter}>
                    <Text style={styles.noteByLabel}>
                      by{' '}
                      <Text style={styles.noteByName}>{n.by}</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },

    // Top bar
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.66,
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.text3,
      letterSpacing: 1.76,
      textTransform: 'uppercase',
      fontWeight: '600',
      marginTop: 2,
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

    // Segmented control
    segWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    seg: {
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

    // Hero
    heroWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    heroCard: {
      height: 200,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    heroImageBg: {
      flex: 1,
      backgroundColor: colors.card2,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    heroTextBlock: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 14,
    },
    heroName: {
      fontSize: 20,
      fontWeight: '500',
      letterSpacing: -0.6,
      color: '#fff',
      lineHeight: 22,
      marginBottom: 3,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    heroDesc: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.8)',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },

    // Times
    timesWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    timesGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    timeCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 14,
    },
    timeEyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    timeValue: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginTop: 6,
      letterSpacing: 0.4,
    },
    timeDate: {
      fontSize: 10.5,
      color: colors.text3,
      marginTop: 2,
    },

    // Group headers
    groupHeader: {
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    groupTitle: {
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: -0.48,
      color: colors.text,
      marginTop: 2,
    },

    // Amenities
    amenityGridWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    amenityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    amenityCell: {
      width: '31%',
      paddingVertical: 14,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      alignItems: 'center',
    },
    amenityLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 13.2,
      textAlign: 'center',
    },

    // Contact
    contactList: {
      paddingHorizontal: 16,
      gap: 8,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    contactIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    contactMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },

    // Map card
    mapCardWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    mapCard: {
      height: 150,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    mapPinCenter: {
      position: 'absolute',
      top: '45%',
      left: '50%',
      transform: [{ translateX: -19 }, { translateY: -19 }],
    },
    mapDot: {
      position: 'absolute',
    },
    mapDotInner: {
      width: 8,
      height: 8,
      borderRadius: 999,
      opacity: 0.6,
    },
    openMapBtn: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    openMapBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },

    // Nearby list
    nearbyList: {
      paddingHorizontal: 16,
      gap: 8,
    },
    nearbyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    nearbyPin: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nearbyPinText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    nearbyName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    nearbyMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    nearbyDist: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.26,
    },

    // Notes
    notesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    notesCount: {
      fontSize: 12,
      color: colors.text3,
    },
    newNoteBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    newNoteBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    notesList: {
      paddingHorizontal: 16,
      gap: 10,
    },
    noteCard: {
      padding: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    noteTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    noteTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    noteTime: {
      fontSize: 10,
      color: colors.text3,
    },
    noteBody: {
      fontSize: 12.5,
      color: colors.text2,
      lineHeight: 18.125, // 12.5 * 1.45
    },
    noteFooter: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    noteByLabel: {
      fontSize: 10.5,
      color: colors.text3,
    },
    noteByName: {
      color: colors.accent,
      fontWeight: '600',
    },
  });
