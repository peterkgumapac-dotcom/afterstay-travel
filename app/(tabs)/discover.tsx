import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, CalendarDays, ChevronDown, ChevronRight, Filter, Map, Search, SlidersHorizontal, Sparkles, ThumbsUp, Users, Vote } from 'lucide-react-native';

import EmptyState from '@/components/shared/EmptyState';
import { SwipeToDelete } from '@/components/shared/SwipeToDelete';

import { type CategoryItem } from '@/components/discover/CategoryGrid';
import {
  DiscoverPlaceCard,
  friendlyCategory,
  type DiscoverPlace,
} from '@/components/discover/DiscoverPlaceCard';
import { type TrendingItem } from '@/components/discover/TrendingCard';
import MiniLoader from '@/components/loader/MiniLoader';
import PlaceDetailSheet from '@/components/discover/PlaceDetailSheet';
import StaysTab from '@/components/discover/StaysTab';
import { useTheme } from '@/constants/ThemeContext';
import { generateItinerary, type ItineraryDay, type PlannerScope, type PlannerPace } from '@/lib/anthropic';
import { distanceFromPoint, formatDistance } from '@/lib/distance';
import { mapNearbyToDiscoverPlace, mapSavedToDiscoverPlace } from '@/components/discover/shared';
import { MS_PER_DAY } from '@/lib/utils';
import DistanceToggle from '@/components/discover/DistanceToggle';
import ExploreMap from '@/components/discover/ExploreMap';
import { cacheGet, cacheSet } from '@/lib/cache';
import { searchNearby, type NearbyPlace } from '@/lib/google-places';
import {
  addPlace,
  getActiveTrip,
  getGroupMembers,
  getSavedPlaces,
  savePlace,
  voteOnPlace,
  voteAsMember,
  notifyGroupOfRecommendation,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import GroupVotingSheet from '@/components/discover/GroupVotingSheet';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useVoteSubscription } from '@/hooks/useVoteSubscription';
import type { GroupMember, Place, PlaceCategory, PlaceVote } from '@/lib/types';


type ThemeColors = ReturnType<typeof useTheme>['colors'];
type TabId = 'places' | 'stays' | 'planner' | 'saved';
type TravelMode = 'walk' | 'car';
type DistanceOrigin = 'hotel' | 'me';
type FilterState = {
  minRating: number;
  openNow: boolean;
  nearby: boolean;
  maxPrice: number;
};

// Map UI category IDs to Google Places API types/keywords
const CATEGORY_SEARCH_MAP: Record<string, { type?: string; keyword?: string }> = {
  beach: { keyword: 'beach' },
  food: { type: 'restaurant', keyword: 'food' },
  activity: { keyword: 'water sports activities tours' },
  nightlife: { type: 'bar', keyword: 'nightlife bar club' },
  photo: { keyword: 'viewpoint scenic photo spot' },
  wellness: { type: 'spa', keyword: 'spa wellness massage yoga' },
  coffee: { type: 'cafe', keyword: 'coffee cafe espresso' },
  atm: { type: 'atm', keyword: 'atm cash withdraw money changer' },
  shopping: { type: 'store', keyword: 'shopping mall market souvenir' },
  landmark: { type: 'tourist_attraction', keyword: 'landmark monument attraction viewpoint' },
};

// Map Google Places types to display labels
function resolveTypeLabel(types: string[]): string {
  const typeMap: Record<string, string> = {
    restaurant: 'Restaurant',
    bar: 'Bar',
    cafe: 'Cafe',
    spa: 'Spa',
    beach: 'Beach',
    park: 'Park',
    shopping_mall: 'Shopping',
    store: 'Shopping',
    tourist_attraction: 'Attraction',
    point_of_interest: 'Landmark',
    natural_feature: 'Nature',
    gym: 'Wellness',
    lodging: 'Hotel',
    church: 'Culture',
  };
  for (const t of types) {
    if (typeMap[t]) return typeMap[t];
  }
  return 'Place';
}

// Map Google Places type to PlaceCategory for Supabase storage
function resolveCategory(types: string[]): PlaceCategory {
  const mapping: Record<string, PlaceCategory> = {
    restaurant: 'Eat',
    bar: 'Nightlife',
    cafe: 'Coffee',
    spa: 'Wellness',
    gym: 'Wellness',
    tourist_attraction: 'Do',
    natural_feature: 'Nature',
    park: 'Nature',
    shopping_mall: 'Essentials',
    store: 'Essentials',
    church: 'Culture',
    lodging: 'Stay',
  };
  for (const t of types) {
    if (mapping[t]) return mapping[t];
  }
  return 'Do';
}

function formatReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k reviews`;
  if (count === 0) return 'No reviews';
  return `${count} reviews`;
}

// Itinerary style ID → interests for the Anthropic API
const STYLE_TO_INTERESTS: Record<string, string[]> = {
  relaxed: ['spa', 'beach', 'sunset viewing', 'cafes'],
  adventure: ['water sports', 'island hopping', 'snorkeling', 'hiking'],
  foodie: ['local restaurants', 'street food', 'seafood', 'markets'],
  family: ['kid-friendly beaches', 'easy activities', 'family dining'],
  culture: ['history', 'local markets', 'cultural sites', 'community'],
};

// ── Data ────────────────────────────────────────────────────────────────

const CATEGORIES: readonly CategoryItem[] = [
  { id: 'beach', label: 'Beaches', emoji: '\uD83C\uDFDD\uFE0F', color: '#7ac4d6' },
  { id: 'food', label: 'Food', emoji: '\uD83C\uDF5C', color: '#e8a860' },
  { id: 'activity', label: 'Activities', emoji: '\uD83C\uDF0A', color: '#5a8fb5' },
  { id: 'nightlife', label: 'Nightlife', emoji: '\uD83C\uDF79', color: '#b66a8a' },
  { id: 'photo', label: 'Photo spots', emoji: '\uD83D\uDCF8', color: '#8b6f5a' },
  { id: 'wellness', label: 'Wellness', emoji: '\uD83E\uDDD8', color: '#7ba88a' },
  { id: 'coffee', label: 'Coffee', emoji: '\u2615', color: '#a0845c' },
] as const;

// Category suggestion labels — generic, works for any destination
const CATEGORY_SUGGESTIONS: Record<string, readonly string[]> = {
  beach: ['Top beaches', 'Hidden coves', 'Snorkeling spots', 'Sunset views', 'Tidal pools'],
  food: ['Best local eats', 'Seafood restaurants', 'Street food', 'Coffee & brunch', 'Fine dining'],
  activity: ['Water sports', 'Hiking trails', 'Tours', 'Day trips', 'Cultural experiences'],
  nightlife: ['Rooftop bars', 'Live music', 'Cocktail lounges', 'Night markets', 'Late-night spots'],
  photo: ['Scenic viewpoints', 'Golden hour spots', 'Iconic landmarks', 'Hidden gems', 'Architecture'],
  wellness: ['Spa & massage', 'Yoga studios', 'Wellness retreats', 'Hot springs', 'Juice bars'],
  coffee: ['Best espresso', 'Specialty coffee', 'Cafés with views', 'Pour-over spots', 'Brunch & coffee'],
};

const ITINERARY_STYLES = [
  { id: 'relaxed', label: 'Relaxed', sub: 'Slow mornings, spa, sunsets' },
  { id: 'adventure', label: 'Adventure', sub: 'Water sports, trails, reefs' },
  { id: 'foodie', label: 'Foodie', sub: 'Local eats, markets, bars' },
  { id: 'family', label: 'Family', sub: 'Kid-safe, easy access' },
  { id: 'culture', label: 'Culture', sub: 'History, markets, locals' },
] as const;

const PACE_OPTIONS: { id: PlannerPace; label: string; desc: string }[] = [
  { id: 'relaxed', label: 'Relaxed', desc: '2-3 activities/day' },
  { id: 'moderate', label: 'Moderate', desc: '3-4 activities/day' },
  { id: 'packed', label: 'Packed', desc: '5-6 activities/day' },
];

const ACTIVITY_CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍽', Beach: '🏖', Activity: '🌊', Culture: '🏛',
  Nightlife: '🌙', Wellness: '🧘', Shopping: '🛍', Transport: '🚗',
};


const PLACE_CATEGORY_CHIPS = [
  'All',
  'Beach',
  'Food',
  'Coffee',
  'Activity',
  'Shopping',
  'ATM',
  'Landmark',
] as const;

const DEFAULT_FILTERS: FilterState = {
  minRating: 0,
  openNow: false,
  nearby: false,
  maxPrice: 3,
};

// ── Helpers ─────────────────────────────────────────────────────────────

function countActiveFilters(f: FilterState): number {
  return (
    (f.minRating > 0 ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.nearby ? 1 : 0) +
    (f.maxPrice < 3 ? 1 : 0)
  );
}

function applyPlaceFilters(
  list: readonly DiscoverPlace[],
  f: FilterState,
): DiscoverPlace[] {
  return list.filter((p) => {
    // Hide hotels/lodging — user already has accommodation
    const t = (p.t ?? '').toLowerCase();
    const types = (p.types ?? []).map(s => s.toLowerCase());
    if (t === 'hotel' || t === 'lodging' || types.includes('lodging') || types.includes('hotel')) return false;
    if (f.minRating && p.r < f.minRating) return false;
    if (f.openNow && !p.openNow) return false;
    // "nearby" filter is applied AFTER distance computation in placesWithDistance
    if (f.maxPrice < 3 && p.price > f.maxPrice) return false;
    return true;
  });
}

// ── Sub-components ──────────────────────────────────────────────────────

const chipStyles = (colors: ThemeColors) => StyleSheet.create({
  chip: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  chipText: { fontSize: 11.5, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.accent },
});

const FilterChip = React.memo(function FilterChip({
  active,
  onPress,
  children,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  const s = chipStyles(colors);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
});

const FilterRow = React.memo(function FilterRow({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
});

const segStyles = (colors: ThemeColors) => StyleSheet.create({
  seg: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  segActive: { borderColor: colors.black, backgroundColor: colors.black },
  segText: { fontSize: 11.5, fontWeight: '600', color: colors.text },
  segTextActive: { color: colors.onBlack },
});

const SegBtn = React.memo(function SegBtn({
  active,
  onPress,
  children,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  const s = segStyles(colors);
  return (
    <TouchableOpacity onPress={onPress} style={[s.seg, active && s.segActive]} activeOpacity={0.7}>
      <Text style={[s.segText, active && s.segTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
});

// ── Top Picks ───────────────────────────────────────────────────────────

const TOP_5_CATEGORIES = [
  { key: 'food', label: 'Top 5 Food', match: (p: DiscoverPlace) => p.t === 'Restaurant' || p.types?.includes('restaurant') || p.types?.includes('food') },
  { key: 'beach', label: 'Top 5 Beaches', match: (p: DiscoverPlace) => p.t === 'Beach' || p.types?.includes('beach') || p.types?.includes('natural_feature') },
  { key: 'activity', label: 'Top 5 Activities', match: (p: DiscoverPlace) => p.t === 'Attraction' || p.t === 'Landmark' || p.types?.includes('tourist_attraction') || p.types?.includes('park') },
  { key: 'coffee', label: 'Top 5 Coffee', match: (p: DiscoverPlace) => p.t === 'Cafe' || p.types?.includes('cafe') },
  { key: 'nightlife', label: 'Top 5 Nightlife', match: (p: DiscoverPlace) => p.t === 'Bar' || p.t === 'Nightlife' || p.types?.includes('bar') || p.types?.includes('night_club') },
];

function getTopPicks(places: readonly DiscoverPlace[], distFn: (lat?: number, lng?: number) => number): DiscoverPlace[] {
  const seen = new Set<string>();
  return [...places]
    .filter(p => p.r >= 4.0 && p.img)
    .map(p => ({ p, dist: distFn(p.lat, p.lng) }))
    .filter(x => x.dist > 0 && x.dist < 50)
    .sort((a, b) => a.dist - b.dist)
    .map(x => x.p)
    .filter(p => {
      if (seen.has(p.n)) return false;
      seen.add(p.n);
      return true;
    })
    .slice(0, 5);
}

function getTopPicksByCategory(places: readonly DiscoverPlace[], distFn: (lat?: number, lng?: number) => number) {
  return TOP_5_CATEGORIES
    .map(cat => {
      const matches = [...places]
        .filter(cat.match)
        .filter(p => p.r >= 3.5 && p.img)
        .map(p => ({ p, dist: distFn(p.lat, p.lng) }))
        .filter(x => x.dist > 0 && x.dist < 50)
        .sort((a, b) => a.dist - b.dist)
        .map(x => x.p)
        .slice(0, 5);
      if (matches.length === 0) return null;
      return { ...cat, places: matches };
    })
    .filter(Boolean) as { key: string; label: string; places: DiscoverPlace[] }[];
}

const TopPicksSection = React.memo(function TopPicksSection({
  places,
  onExplore,
  distFn,
}: {
  places: readonly DiscoverPlace[];
  onExplore: (placeId: string | undefined, name: string) => void;
  distFn: (lat?: number, lng?: number) => number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const picks = useMemo(() => getTopPicks(places, distFn), [places, distFn]);
  if (picks.length === 0) return null;

  return (
    <View style={styles.topPicksSection}>
      <Text style={styles.topPicksTitle}>Top 5 Picks for You</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {picks.map((p) => (
          <TouchableOpacity
            key={p.placeId ?? p.n}
            style={styles.topPickCard}
            activeOpacity={0.7}
            onPress={() => onExplore(p.placeId, p.n)}
            accessibilityRole="button"
            accessibilityLabel={p.n}
          >
            {p.img ? (
              <Image source={{ uri: p.img }} style={styles.topPickImage} />
            ) : (
              <View style={[styles.topPickImage, { alignItems: 'center', justifyContent: 'center' }]}>
                <Map size={24} color={colors.text3} />
              </View>
            )}
            <Text style={styles.topPickLabel}>{friendlyCategory(p.t).toUpperCase()}</Text>
            <Text style={styles.topPickName} numberOfLines={1}>{p.n}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 10, color: colors.warn }}>{'★'} {p.r}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

// ── Error boundary for Discover ────────────────────────────────────────

class DiscoverErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: string }
> {
  state = { hasError: false, error: undefined as string | undefined };
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, error: e.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Discover crashed</Text>
          <Text style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── Main screen ─────────────────────────────────────────────────────────

export default function DiscoverScreenWrapper() {
  return (
    <DiscoverErrorBoundary>
      <DiscoverScreenInner />
    </DiscoverErrorBoundary>
  );
}

function DiscoverScreenInner() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { segment } = useUserSegment();

  const [tab, setTab] = useState<TabId>(segment === 'returning' || segment === 'new' ? 'stays' : 'places');
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [distanceOrigin, setDistanceOrigin] = useState<DistanceOrigin>('hotel');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('relaxed');
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [recommended, setRecommended] = useState<Set<string>>(() => new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);

  // API-wired state
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripCoords, setTripCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<readonly DiscoverPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [itineraryScope, setItineraryScope] = useState<PlannerScope>('today');
  const [pace, setPace] = useState<PlannerPace>('relaxed');
  const [placeCategoryChip, setPlaceCategoryChip] = useState('All');
  const [visibleCount, setVisibleCount] = useState(20);
  const [showMapModal, setShowMapModal] = useState(false);

  // PlaceDetailSheet state
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);
  const [detailPlaceName, setDetailPlaceName] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const placesCache = useRef<Record<string, readonly DiscoverPlace[]>>({});

  const [tripDest, setTripDest] = useState('');
  const [tripStartDate, setTripStartDate] = useState<string | undefined>();
  const [tripEndDate, setTripEndDate] = useState<string | undefined>();
  const [tripDays, setTripDays] = useState<number | undefined>();
  const [tripHotel, setTripHotel] = useState('');
  const [tripGroupSize, setTripGroupSize] = useState(0);
  const [tripMembers, setTripMembers] = useState<GroupMember[]>([]);
  const [showVotingSheet, setShowVotingSheet] = useState(false);
  const [votingPlace, setVotingPlace] = useState<Place | null>(null);
  const { user } = useAuth();
  const currentMemberId = useMemo(
    () => tripMembers.find((m) => m.userId === user?.id)?.id ?? '',
    [tripMembers, user?.id],
  );
  const memberNames = useMemo(
    () => Object.fromEntries(tripMembers.map((m) => [m.id, m.name])),
    [tripMembers],
  );

  // Places awaiting group votes
  const pendingVotePlaces = useMemo(
    () => savedPlaces.filter((p) => {
      if (p.vote !== 'Pending') return false;
      const votes = p.voteByMember ?? {};
      return Object.keys(votes).length < tripMembers.length;
    }),
    [savedPlaces, tripMembers],
  );
  const votedPlaces = useMemo(
    () => savedPlaces.filter((p) => p.voteByMember && Object.keys(p.voteByMember).length > 0 && p.vote !== 'Pending'),
    [savedPlaces],
  );

  // Realtime vote updates from other members
  useVoteSubscription(tripId, useCallback(
    (placeId: string, voteByMember: Record<string, any>, vote: any) => {
      setSavedPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, voteByMember, vote } : p)),
      );
    },
    [],
  ));
  const [tripBudget, setTripBudget] = useState(0);
  const [tripBudgetCurrency, setTripBudgetCurrency] = useState('PHP');

  // Manual day planner state
  const [plannerActiveDay, setPlannerActiveDay] = useState(1);
  const [plannerItems, setPlannerItems] = useState<Record<number, { id: string; time: string; title: string; note: string | null }[]>>({});

  // Auto-detect current day of trip
  const todayDayNumber = useMemo(() => {
    if (!tripStartDate) return 1;
    const startMs = new Date(tripStartDate + 'T00:00:00+08:00').getTime();
    const nowMs = Date.now();
    if (nowMs < startMs) return 1; // pre-trip
    return Math.floor((nowMs - startMs) / MS_PER_DAY) + 1;
  }, [tripStartDate]);

  const todayLabel = useMemo(() => {
    if (!tripStartDate) return 'Today';
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(tripStartDate + 'T00:00:00+08:00');
    d.setDate(d.getDate() + todayDayNumber - 1);
    return `${DAY_NAMES[d.getDay()]} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, [tripStartDate, todayDayNumber]);

  const hasTripDates = !!(tripStartDate && tripEndDate);

  const plannerDayItems = useMemo(() =>
    (plannerItems[todayDayNumber] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)),
    [plannerItems, todayDayNumber],
  );

  const plannerTotalCount = useMemo(() =>
    Object.values(plannerItems).reduce((n, arr) => n + arr.length, 0),
    [plannerItems],
  );

  const removePlannerItem = useCallback((id: string) => {
    setPlannerItems((prev) => ({
      ...prev,
      [todayDayNumber]: (prev[todayDayNumber] ?? []).filter(x => x.id !== id),
    }));
  }, [todayDayNumber]);

  // Compute distance from the selected origin (hotel or current location)
  const getDistanceKm = useCallback((placeLat?: number, placeLng?: number): number => {
    if (placeLat == null || placeLng == null) return 0;
    if (distanceOrigin === 'me' && userLocation) {
      return distanceFromPoint(userLocation.lat, userLocation.lng, placeLat, placeLng);
    }
    if (tripCoords) {
      return distanceFromPoint(tripCoords.lat, tripCoords.lng, placeLat, placeLng);
    }
    return 0;
  }, [distanceOrigin, userLocation, tripCoords]);

  // Fetch GPS when user switches to "me"
  const switchToMyLocation = useCallback(async () => {
    // Always re-fetch GPS so distances stay fresh as user moves
    try {
      const Location = require('expo-location') as typeof import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location denied', 'Enable location permissions in Settings to use "From Me".');
        setDistanceOrigin('hotel');
        return;
      }
      // Use High accuracy for better distance comparison vs hotel
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      setDistanceOrigin('me');
    } catch {
      Alert.alert('Location unavailable', 'Could not get your location. Using hotel distance.');
      setDistanceOrigin('hotel');
    }
  }, []);

  const handleAnchorChange = useCallback((a: 'hotel' | 'me') => {
    if (a === 'me') {
      switchToMyLocation();
    } else {
      setDistanceOrigin('hotel');
    }
    cacheSet('discover:anchor', a);
  }, [switchToMyLocation]);

  const handleTravelModeChange = useCallback((m: 'walk' | 'car') => {
    setTravelMode(m);
    cacheSet('discover:travelMode', m);
  }, []);

  // Restore cached anchor/travel mode (after switchToMyLocation is defined)
  useEffect(() => {
    cacheGet<'hotel' | 'me'>('discover:anchor').then((v) => {
      if (v === 'me') {
        switchToMyLocation();
      } else if (v) {
        setDistanceOrigin(v);
      }
    });
    cacheGet<'walk' | 'car'>('discover:travelMode').then((v) => { if (v) setTravelMode(v); });
  }, [switchToMyLocation]);

  // Load trip ID on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const trip = await getActiveTrip();
        if (!cancelled && trip) {
          setTripId(trip.id);
          setTripDest(trip.destination ?? '');
          setTripStartDate(trip.startDate);
          setTripEndDate(trip.endDate);
          setTripHotel(trip.accommodation ?? '');
          // Prefer hotel coords (active trip), fall back to general lat/lng (past trip)
          const lat = trip.hotelLat ?? trip.latitude;
          const lng = trip.hotelLng ?? trip.longitude;
          if (lat != null && lng != null) {
            setTripCoords({ lat, lng });
          }
          setTripBudget(trip.budgetLimit ?? 0);
          setTripBudgetCurrency(trip.costCurrency ?? 'PHP');
          const members = await getGroupMembers(trip.id).catch(() => []);
          setTripGroupSize(Math.max(1, members.length));
          setTripMembers(members);
          // Default travel mode based on transport (car/bus → car, else walk)
          if (trip.transport === 'car' || trip.transport === 'bus') {
            const cached = await cacheGet<'walk' | 'car'>('discover:travelMode');
            if (!cached) setTravelMode('car');
          }
          if (trip.startDate && trip.endDate) {
            const ms = new Date(trip.endDate + 'T00:00:00+08:00').getTime() - new Date(trip.startDate + 'T00:00:00+08:00').getTime();
            setTripDays(Math.max(1, Math.ceil(ms / MS_PER_DAY) + 1));
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[DiscoverScreen] load trip context failed:', e);
      }
    };
    placesCache.current = {};
    load();
    return () => { cancelled = true; };
  }, []);

  // Load saved places when Saved tab is selected or tripId changes
  const loadSavedPlaces = useCallback(async () => {
    if (!tripId) return;
    setSavedLoading(true);
    try {
      const result = await getSavedPlaces(tripId);
      setSavedPlaces(result);
      setSaved(new Set(result.filter((p) => p.saved !== false).map((p) => p.name)));
    } catch (e) {
      if (__DEV__) console.warn('[DiscoverScreen] load saved places failed:', e);
    } finally {
      setSavedLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (tripId) loadSavedPlaces();
  }, [tripId, loadSavedPlaces]);

  useEffect(() => {
    if (tab === 'saved' && tripId) {
      loadSavedPlaces();
    }
  }, [tab, tripId, loadSavedPlaces]);

  // Search places via Google Places API
  const searchPlaces = useCallback(async (keyword?: string, type?: string, skipCache = false) => {
    // Don't search if no destination is set
    if (!tripCoords) {
      setPlaces([]);
      setPlacesLoading(false);
      return;
    }

    const cacheKey = `${type ?? ''}_${keyword ?? ''}_${tripCoords.lat}_${tripCoords.lng}`;

    // Use cache if available and not forced refresh
    if (!skipCache && placesCache.current[cacheKey]) {
      setPlaces(placesCache.current[cacheKey]);
      return;
    }

    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const results = await searchNearby(type, keyword, tripCoords) ?? [];
      if (results.length > 0) {
        const mapped = results.map((p) => mapNearbyToDiscoverPlace(p, tripCoords ?? undefined));
        placesCache.current[cacheKey] = mapped;
        setPlaces(mapped);
      } else {
        setPlaces([]);
        setPlacesError('No results found nearby.');
      }
    } catch {
      setPlaces([]);
      setPlacesError('Could not load places.');
    } finally {
      setPlacesLoading(false);
      setRefreshing(false);
    }
  }, [tripCoords]);

  // Load places when category chip changes
  useEffect(() => {
    if (tab !== 'places') return;
    if (placeCategoryChip === 'All') {
      searchPlaces();
    } else {
      const chipKey = placeCategoryChip.toLowerCase();
      const searchConfig = CATEGORY_SEARCH_MAP[chipKey];
      searchPlaces(searchConfig?.keyword ?? chipKey, searchConfig?.type);
    }
  }, [placeCategoryChip, tab, searchPlaces]);

  // Debounced search input
  useEffect(() => {
    if (tab !== 'places') return;
    if (!q.trim()) {
      // Reset to category-based search when query is cleared
      if (placeCategoryChip === 'All') {
        searchPlaces();
      }
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchPlaces(q.trim());
    }, 500);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [q, tab, placeCategoryChip, searchPlaces]);

  const toggleSave = useCallback(async (name: string) => {
    // Optimistic local update
    setSaved((s) => {
      const next = new Set(s);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Persist to Supabase
    if (!tripId) return;
    const existingPlace = savedPlaces.find((p) => p.name === name);
    if (existingPlace) {
      try {
        await savePlace(existingPlace.id, !existingPlace.saved);
      } catch {
        // Revert on failure
        setSaved((s) => {
          const next = new Set(s);
          if (existingPlace.saved) next.add(name);
          else next.delete(name);
          return next;
        });
      }
    } else {
      // Find the place data in current places list to save it
      const placeData = places.find((p) => p.n === name);
      if (placeData) {
        try {
          await addPlace({
            tripId,
            name: placeData.n,
            category: (placeData.types ? resolveCategory(placeData.types) : 'Do') as PlaceCategory,
            distance: placeData.d,
            rating: placeData.r,
            source: 'Manual',
            vote: 'Pending' as PlaceVote,
            photoUrl: placeData.img,
            googlePlaceId: placeData.placeId,
            latitude: placeData.lat,
            longitude: placeData.lng,
            totalRatings: placeData.totalRatings,
            saved: true,
          });
        } catch {
          setSaved((s) => {
            const next = new Set(s);
            next.delete(name);
            return next;
          });
        }
      }
    }
  }, [tripId, savedPlaces, places]);

  const toggleRecommend = useCallback(async (name: string) => {
    // Optimistic local update
    setRecommended((s) => {
      const next = new Set(s);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Persist to Supabase as a suggested place
    if (!tripId) return;
    const existingPlace = savedPlaces.find((p) => p.name === name);
    if (existingPlace) {
      try {
        await voteOnPlace(existingPlace.id, '\uD83D\uDC4D Yes' as PlaceVote);
        // Record member vote and notify group
        if (currentMemberId && tripMembers.length >= 2) {
          const updated = await voteAsMember(existingPlace.id, currentMemberId, '👍 Yes' as PlaceVote, tripMembers.length);
          setSavedPlaces((prev) => prev.map((p) => (p.id === existingPlace.id ? { ...p, voteByMember: updated } : p)));
          if (tripId && user) {
            notifyGroupOfRecommendation(tripId, name, existingPlace.id, user.user_metadata?.name ?? 'Someone', user.id).catch(() => {});
          }
          setVotingPlace({ ...existingPlace, voteByMember: updated });
          setShowVotingSheet(true);
        }
      } catch {
        setRecommended((s) => {
          const next = new Set(s);
          next.delete(name);
          return next;
        });
      }
    } else {
      const placeData = places.find((p) => p.n === name);
      if (placeData) {
        try {
          await addPlace({
            tripId,
            name: placeData.n,
            category: (placeData.types ? resolveCategory(placeData.types) : 'Do') as PlaceCategory,
            distance: placeData.d,
            rating: placeData.r,
            source: 'Suggested',
            vote: '\uD83D\uDC4D Yes' as PlaceVote,
            photoUrl: placeData.img,
            googlePlaceId: placeData.placeId,
            latitude: placeData.lat,
            longitude: placeData.lng,
            totalRatings: placeData.totalRatings,
            saved: true,
          });
        } catch {
          setRecommended((s) => {
            const next = new Set(s);
            next.delete(name);
            return next;
          });
        }
      }
    }
  }, [tripId, savedPlaces, places]);

  // Generate itinerary via Anthropic
  const handleGenerateItinerary = useCallback(async () => {
    setItineraryLoading(true);
    setItineraryError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const chosenStyle = style;
      const interests = STYLE_TO_INTERESTS[chosenStyle] ?? ['beach', 'food', 'activities'];
      const promptInterests = prompt.trim()
        ? [...interests, prompt.trim()]
        : interests;
      const result = await generateItinerary({
        scope: itineraryScope,
        pace,
        interests: promptInterests,
        tripDays,
        startDate: tripStartDate,
        destination: tripDest || undefined,
        hotelName: tripHotel || undefined,
        groupSize: tripGroupSize || undefined,
        budget: tripBudget || undefined,
        budgetCurrency: tripBudgetCurrency,
      });
      setItinerary(result);
      // Populate planner items — map AI days to actual trip days
      const newItems: Record<number, { id: string; time: string; title: string; note: string | null }[]> = {};
      for (const day of result) {
        // For "today" scope, day 1 maps to todayDayNumber
        // For "whole" scope, day N maps directly
        const dayKey = itineraryScope === 'today' ? todayDayNumber : day.day;
        newItems[dayKey] = (day.activities ?? []).map((act, i) => ({
          id: `ai-${dayKey}-${i}`,
          time: act.timeSlot?.replace(/[^\d:]/g, '').slice(0, 5) || `${9 + i}:00`,
          title: act.name,
          note: act.duration ? `${act.duration}${act.cost ? ` · ${act.cost}` : ''}` : null,
        }));
      }
      setPlannerItems((prev) => ({ ...prev, ...newItems }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate itinerary';
      setItineraryError(message);
    } finally {
      setItineraryLoading(false);
    }
  }, [style, prompt, itineraryScope, pace, tripDays, tripStartDate, todayDayNumber]);

  const handleAddToPlanner = useCallback((place: DiscoverPlace) => {
    if (!hasTripDates) {
      Alert.alert('No Trip', 'No trip dates set. Create a trip first.');
      return;
    }
    // Add directly to today's plan
    const now = new Date();
    const nextHour = `${String(Math.min(now.getHours() + 1, 23)).padStart(2, '0')}:00`;
    setPlannerItems((prev) => {
      const existing = prev[todayDayNumber] ?? [];
      const newItem = {
        id: `${place.placeId ?? place.n}-${Date.now()}`,
        time: nextHour,
        title: place.n,
        note: `${friendlyCategory(place.t)} · ${place.d}`,
      };
      return {
        ...prev,
        [todayDayNumber]: [...existing, newItem].sort((a, b) => a.time.localeCompare(b.time)),
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Added', `${place.n} added to today's plan`);
  }, [hasTripDates, todayDayNumber]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const filteredPlaces = useMemo(() => applyPlaceFilters(places, filters), [places, filters]);


  // Pre-compute distances, filter nearby, sort by nearest first.
  const placesWithDistance = useMemo(() => {
    const withDist = filteredPlaces.map((p) => ({
      place: p,
      distanceKm: getDistanceKm(p.lat, p.lng),
    }));
    const nearbyRadius = travelMode === 'car' ? 10 : 2;
    const filtered = filters.nearby
      ? withDist.filter((p) => p.distanceKm > 0 && p.distanceKm <= nearbyRadius)
      : withDist;
    return filtered.sort((a, b) => {
      // Open places first, then by distance
      const openA = a.place.openNow ? 0 : 1;
      const openB = b.place.openNow ? 0 : 1;
      if (openA !== openB) return openA - openB;
      return a.distanceKm - b.distanceKm;
    });
  }, [filteredPlaces, getDistanceKm, filters.nearby]);

  // Stable filter callbacks — prevent FilterChip re-renders
  const toggleOpenNow = useCallback(() => setFilters((f) => ({ ...f, openNow: !f.openNow })), []);
  const toggleNearby = useCallback(() => setFilters((f) => ({ ...f, nearby: !f.nearby })), []);
  const toggleRating = useCallback(() => setFilters((f) => ({ ...f, minRating: f.minRating >= 4.5 ? 0 : 4.5 })), []);
  const toggleShowFilters = useCallback(() => setShowFilters((s) => !s), []);

  const handleExplore = useCallback((placeId: string | undefined, name: string) => {
    setDetailPlaceId(placeId ?? null);
    setDetailPlaceName(name);
    setShowDetail(true);
  }, []);

  const selectedCategory = cat
    ? CATEGORIES.find((c) => c.id === cat)
    : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Discover</Text>
          {tripDest ? <Text style={styles.subtitle}>{tripDest}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel="Filters"
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => {
            setTab('places');
            setShowFilters((s) => !s);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <SlidersHorizontal size={16} color={colors.text} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={styles.segWrapper}>
        <View style={styles.seg}>
          {(['places', 'stays', 'planner', 'saved'] as const).map((id) => {
            const label =
              id === 'places' ? 'Places'
              : id === 'stays' ? 'Stays'
              : id === 'planner' ? 'Planner'
              : `Saved${saved.size ? ` \u00B7 ${saved.size}` : ''}`;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.segBtn, tab === id && styles.segBtnActive]}
                onPress={() => setTab(id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segText, tab === id && styles.segTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {tab !== 'stays' && (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              placesCache.current = {};
              const chipKey = placeCategoryChip.toLowerCase();
              const search = CATEGORY_SEARCH_MAP[chipKey];
              searchPlaces(search?.keyword, search?.type, true);
            }}
            tintColor={colors.accent}
          />
        }
      >
        {/* ═══════ PLANNER TAB — manual day-by-day timeline ═══════ */}
        {tab === 'planner' && !hasTripDates && (
          <EmptyState
            icon={CalendarDays}
            title={tripId ? 'No trip dates set' : 'No trip yet'}
            subtitle={tripId
              ? 'Set your trip dates to start planning.'
              : 'Create a trip to start planning your days.'}
            actionLabel={tripId ? undefined : 'Get Started'}
            onAction={tripId ? undefined : () => router.push('/onboarding')}
          />
        )}
        {tab === 'planner' && hasTripDates && (
          <>
            {/* Scope toggle: Today vs Whole Trip — matches Budget segmented control */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['today', 'whole'] as const).map((scope) => {
                const active = itineraryScope === scope;
                return (
                  <TouchableOpacity
                    key={scope}
                    onPress={() => setItineraryScope(scope)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center',
                      backgroundColor: active ? colors.accentBg : colors.card,
                      borderWidth: 1, borderColor: active ? colors.accentBorder : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: active ? colors.accent : colors.text }}>
                      {scope === 'today' ? 'Plan Today' : 'Whole Trip'}
                    </Text>
                    <Text style={{ fontSize: 11, color: active ? colors.accent : colors.text3, marginTop: 2 }}>
                      {scope === 'today' ? `Day ${todayDayNumber} · ${todayLabel}` : `${tripDays} days`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Questions: style + pace + interests */}
            {!itineraryLoading && (
              <View style={{ gap: 16 }}>
                {/* Q1: What's your vibe? — eyebrow matches Home/Budget section labels */}
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text3, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>What's your vibe?</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ITINERARY_STYLES.map((s) => {
                      const active = style === s.id;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => setStyle(s.id)}
                          activeOpacity={0.7}
                          style={{
                            paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                            backgroundColor: active ? colors.accent : colors.card,
                            borderWidth: active ? 0 : 1, borderColor: colors.border,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '500', color: active ? colors.bg : colors.text2 }}>{s.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Q2: How packed? */}
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text3, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>How packed?</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {PACE_OPTIONS.map((p) => {
                      const active = pace === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setPace(p.id)}
                          activeOpacity={0.7}
                          style={{
                            flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14,
                            backgroundColor: active ? colors.accent : colors.card,
                            borderWidth: active ? 0 : 1, borderColor: colors.border,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: active ? colors.bg : colors.text }}>{p.label}</Text>
                          <Text style={{ fontSize: 10, color: active ? `${colors.bg}B3` : colors.text3, marginTop: 2 }}>{p.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Q3: Anything specific? */}
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text3, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>Anything specific?</Text>
                  <TextInput
                    value={prompt}
                    onChangeText={setPrompt}
                    placeholder="e.g. snorkeling, sunset dinner, local food..."
                    placeholderTextColor={colors.text3}
                    style={{
                      fontSize: 14, color: colors.text, backgroundColor: colors.bg2,
                      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                      paddingHorizontal: 16, paddingVertical: 12,
                    }}
                  />
                </View>

                {/* Generate button — matches Budget CTA / PlaceDetail save button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                    shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
                  }}
                  activeOpacity={0.7}
                  onPress={handleGenerateItinerary}
                >
                  <Sparkles size={16} color={colors.bg} strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.bg }}>
                    {itineraryScope === 'today' ? 'Generate today\'s plan' : 'Generate full trip plan'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {itineraryLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <MiniLoader message={itineraryScope === 'today' ? 'Planning your day...' : 'Planning your trip...'} />
              </View>
            )}
            {itineraryError && (
              <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{itineraryError}</Text>
            )}

            {/* Results timeline */}
            {plannerDayItems.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
                  {itineraryScope === 'today' ? `Day ${todayDayNumber} · ${todayLabel}` : 'Your Plan'}
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
                  {plannerDayItems.map((item) => (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, width: 46, marginTop: 2 }}>{item.time}</Text>
                      <View style={{ width: 2, backgroundColor: colors.accentBorder, alignSelf: 'stretch', borderRadius: 1 }} />
                      <View style={{ flex: 1, backgroundColor: colors.bg2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 }}>{item.title}</Text>
                          <TouchableOpacity onPress={() => removePlannerItem(item.id)} activeOpacity={0.6} hitSlop={8}>
                            <Text style={{ color: colors.text3, fontSize: 16 }}>{'\u00D7'}</Text>
                          </TouchableOpacity>
                        </View>
                        {item.note && (
                          <Text style={{ fontSize: 12, color: colors.text3, marginTop: 4 }}>{item.note}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {plannerDayItems.length === 0 && !itineraryLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ fontSize: 13, color: colors.text3 }}>Choose your vibe and tap generate</Text>
              </View>
            )}
          </>
        )}

        {/* ═══════ PLACES TAB ═══════ */}
        {tab === 'places' && (
          <>
            {/* Search */}
            <View style={styles.searchBox}>
              <Search size={16} color={colors.text3} strokeWidth={1.8} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search restaurants, beaches, activities..."
                placeholderTextColor={colors.text3}
                style={styles.searchInput}
              />
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {PLACE_CATEGORY_CHIPS.map((c) => {
                const isActive = placeCategoryChip === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, isActive && styles.chipActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setPlaceCategoryChip(c);
                      setQ('');
                      setVisibleCount(20);
                    }}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Filter toggle */}
            <TouchableOpacity
              onPress={toggleShowFilters}
              style={[
                styles.filterBarInline,
                activeFilterCount > 0 && { borderColor: colors.accent },
              ]}
              activeOpacity={0.7}
            >
              <Filter size={14} color={activeFilterCount > 0 ? colors.accent : colors.text3} strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '500', color: activeFilterCount > 0 ? colors.accent : colors.text2 }}>
                Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
              </Text>
              <ChevronDown size={14} color={colors.text3} strokeWidth={2} style={{ transform: [{ rotate: showFilters ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {/* Expanded filters panel */}
            {showFilters && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={styles.filterPanel}
              >
                <FilterRow label="Minimum rating" colors={colors}>
                  {[0, 4.0, 4.5].map((v) => (
                    <SegBtn
                      key={v}
                      active={filters.minRating === v}
                      onPress={() =>
                        setFilters((f) => ({ ...f, minRating: v }))
                      }
                      colors={colors}
                    >
                      {v === 0 ? 'Any' : `\u2605 ${v.toFixed(1)}+`}
                    </SegBtn>
                  ))}
                </FilterRow>
                <FilterRow label="Price" colors={colors}>
                  {['Free', '$', '$$', '$$$'].map((lbl, i) => (
                    <SegBtn
                      key={lbl}
                      active={filters.maxPrice === i}
                      onPress={() =>
                        setFilters((f) => ({ ...f, maxPrice: i }))
                      }
                      colors={colors}
                    >
                      {lbl}
                      {i < 3 ? ' or less' : ''}
                    </SegBtn>
                  ))}
                </FilterRow>
                <FilterRow label="Distance" colors={colors}>
                  <SegBtn
                    active={!filters.nearby}
                    onPress={() =>
                      setFilters((f) => ({ ...f, nearby: false }))
                    }
                    colors={colors}
                  >
                    Any
                  </SegBtn>
                  <SegBtn
                    active={filters.nearby}
                    onPress={() =>
                      setFilters((f) => ({ ...f, nearby: true }))
                    }
                    colors={colors}
                  >
                    {'\u2264'} 2 km
                  </SegBtn>
                </FilterRow>
                <FilterRow label="Availability" colors={colors}>
                  <SegBtn
                    active={!filters.openNow}
                    onPress={() =>
                      setFilters((f) => ({ ...f, openNow: false }))
                    }
                    colors={colors}
                  >
                    All
                  </SegBtn>
                  <SegBtn
                    active={filters.openNow}
                    onPress={() =>
                      setFilters((f) => ({ ...f, openNow: true }))
                    }
                    colors={colors}
                  >
                    Open now
                  </SegBtn>
                </FilterRow>

                {/* Distance origin + travel mode (moved inside filter panel) */}
                <View style={{ marginTop: 8 }}>
                  <DistanceToggle
                    anchor={distanceOrigin === 'me' ? 'me' : 'hotel'}
                    travelMode={travelMode}
                    onAnchorChange={handleAnchorChange}
                    onTravelModeChange={handleTravelModeChange}
                  />
                </View>

                {/* Footer */}
                <View style={styles.filterFooter}>
                  <TouchableOpacity
                    onPress={() => setFilters({ ...DEFAULT_FILTERS })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.filterShowBtn}
                    onPress={() => setShowFilters(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterShowBtnText}>Show results</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Top Picks */}
            {placeCategoryChip === 'All' && !q && (
              <TopPicksSection places={places} onExplore={handleExplore} distFn={getDistanceKm} />
            )}

            {/* Results count */}
            <Text style={styles.resultsCount}>
              {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
            </Text>

            {/* Place cards */}
            <View style={styles.placeList}>
              {placesError && (
                <View style={styles.emptyPlaces}>
                  <Text style={styles.errorText}>{placesError}</Text>
                </View>
              )}
              {placesLoading ? (
                <View style={styles.emptyPlaces}>
                  <MiniLoader message="Finding places..." />
                </View>
              ) : filteredPlaces.length === 0 ? (
                <View style={styles.emptyPlaces}>
                  <Text style={styles.emptyText}>
                    No places match these filters.
                  </Text>
                </View>
              ) : (
                <>
                  {placesWithDistance.slice(0, visibleCount).map(({ place: p, distanceKm }, idx) => (
                    <DiscoverPlaceCard
                      key={p.placeId ?? `${p.n}-${idx}`}
                      place={p}
                      distanceKm={distanceKm}
                      travelMode={travelMode}
                      isSaved={saved.has(p.n)}
                      isRecommended={recommended.has(p.n)}
                      onSave={toggleSave}
                      onRecommend={toggleRecommend}
                      onExplore={handleExplore}
                      onAddToPlanner={handleAddToPlanner}
                      showRecommend={tripMembers.length >= 2}
                      voteByMember={savedPlaces.find((sp) => sp.name === p.n)?.voteByMember}
                      memberNames={memberNames}
                      totalMembers={tripMembers.length}
                      onVoteTap={() => {
                        const sp = savedPlaces.find((s) => s.name === p.n);
                        if (sp) { setVotingPlace(sp); setShowVotingSheet(true); }
                      }}
                    />
                  ))}
                  {placesWithDistance.length > visibleCount && (
                    <TouchableOpacity
                      style={styles.showMoreBtn}
                      onPress={() => setVisibleCount((c) => c + 20)}
                      activeOpacity={0.7}
                    >
                      <ChevronDown size={16} color={colors.accent} strokeWidth={2} />
                      <Text style={styles.showMoreText}>
                        Show more ({placesWithDistance.length - visibleCount} remaining)
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

          </>
        )}

        {/* ═══════ SAVED TAB ═══════ */}
        {tab === 'saved' && (
          <View style={styles.placeList}>
            {savedLoading ? (
              <View style={styles.emptyPlaces}>
                <MiniLoader message="Loading saved places..." />
              </View>
            ) : savedPlaces.length === 0 && saved.size === 0 ? (
              <View style={styles.emptyCard}>
                <Bookmark size={28} color={colors.text3} strokeWidth={1.6} opacity={0.6} />
                <Text style={styles.emptyCardTitle}>No saved places yet</Text>
                <Text style={styles.emptyCardBody}>
                  Tap the bookmark on a place to save it here.
                </Text>
              </View>
            ) : (
              <>
                {/* ── Group Voting Section ── */}
                {tripMembers.length >= 2 && (
                  <View style={styles.votingSection}>
                    <View style={styles.votingSectionHeader}>
                      <Users size={16} color={colors.accent} strokeWidth={2} />
                      <Text style={styles.votingSectionTitle}>Group Voting</Text>
                      {pendingVotePlaces.length > 0 && (
                        <View style={styles.votingBadge}>
                          <Text style={styles.votingBadgeText}>{pendingVotePlaces.length} pending</Text>
                        </View>
                      )}
                    </View>

                    {/* Empty state for groups with no votes yet */}
                    {pendingVotePlaces.length === 0 && votedPlaces.length === 0 && (
                      <View style={styles.votingEmpty}>
                        <ThumbsUp size={20} color={colors.text3} strokeWidth={1.6} />
                        <Text style={styles.votingEmptyTitle}>No places to vote on yet</Text>
                        <Text style={styles.votingEmptyBody}>
                          Tap the {'\u{1F465}'} icon on any place in the Places tab to recommend it to your group.
                        </Text>
                      </View>
                    )}

                    {pendingVotePlaces.length > 0 && (
                      <>
                        <Text style={styles.votingSubhead}>Needs your vote</Text>
                        {pendingVotePlaces.map((p) => {
                          const votes = p.voteByMember ?? {};
                          const yes = Object.values(votes).filter((v) => v === '👍 Yes').length;
                          const voted = Object.keys(votes).length;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={styles.votingRow}
                              activeOpacity={0.7}
                              onPress={() => { setVotingPlace(p); setShowVotingSheet(true); }}
                            >
                              {p.photoUrl ? (
                                <Image source={{ uri: p.photoUrl }} style={styles.votingThumb} />
                              ) : (
                                <View style={[styles.votingThumb, { backgroundColor: colors.bg3, justifyContent: 'center', alignItems: 'center' }]}>
                                  <ThumbsUp size={14} color={colors.text3} />
                                </View>
                              )}
                              <View style={styles.votingInfo}>
                                <Text style={styles.votingName} numberOfLines={1}>{p.name}</Text>
                                <Text style={styles.votingMeta}>
                                  {voted}/{tripMembers.length} voted{yes > 0 ? ` · ${yes} yes` : ''}
                                </Text>
                              </View>
                              <ChevronRight size={16} color={colors.text3} />
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}

                    {votedPlaces.length > 0 && (
                      <>
                        <Text style={styles.votingSubhead}>Decided</Text>
                        {votedPlaces.map((p) => {
                          const isYes = p.vote === '👍 Yes';
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={styles.votingRow}
                              activeOpacity={0.7}
                              onPress={() => { setVotingPlace(p); setShowVotingSheet(true); }}
                            >
                              {p.photoUrl ? (
                                <Image source={{ uri: p.photoUrl }} style={styles.votingThumb} />
                              ) : (
                                <View style={[styles.votingThumb, { backgroundColor: colors.bg3, justifyContent: 'center', alignItems: 'center' }]}>
                                  <ThumbsUp size={14} color={colors.text3} />
                                </View>
                              )}
                              <View style={styles.votingInfo}>
                                <Text style={styles.votingName} numberOfLines={1}>{p.name}</Text>
                                <View style={[styles.votingDecision, { backgroundColor: isYes ? 'rgba(45,106,46,0.15)' : 'rgba(158,58,52,0.15)' }]}>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: isYes ? '#2d6a2e' : '#9e3a34' }}>
                                    {isYes ? 'Going' : 'Skipped'}
                                  </Text>
                                </View>
                              </View>
                              <ChevronRight size={16} color={colors.text3} />
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}

                <View style={styles.savedHeaderRow}>
                  <Text style={styles.savedCount}>
                    {savedPlaces.length} saved {'\u00B7'} {recommended.size} recommended
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Clear All', 'Remove all saved places?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: () => {
                            setSaved(new Set());
                            setRecommended(new Set());
                            setSavedPlaces([]);
                          },
                        },
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                {savedPlaces.map((p) => {
                  const dp = mapSavedToDiscoverPlace(p, tripCoords ?? undefined);
                  return (
                    <SwipeToDelete
                      key={p.id}
                      onDelete={() => toggleSave(p.name)}
                    >
                      <DiscoverPlaceCard
                        place={dp}
                        distanceKm={getDistanceKm(dp.lat, dp.lng)}
                        travelMode={travelMode}
                        isSaved={true}
                        isRecommended={recommended.has(p.name)}
                        onSave={toggleSave}
                        onRecommend={toggleRecommend}
                        onAddToPlanner={handleAddToPlanner}
                        showRecommend={tripMembers.length >= 2}
                        voteByMember={p.voteByMember}
                        memberNames={memberNames}
                        totalMembers={tripMembers.length}
                        onVoteTap={() => {
                          setVotingPlace(p);
                          setShowVotingSheet(true);
                        }}
                      />
                    </SwipeToDelete>
                  );
                })}
              </>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
      )}

      {/* ═══════ STAYS TAB (own ScrollView — outside parent) ═══════ */}
      {tab === 'stays' && (
        <StaysTab
          tripCoords={tripCoords}
          tripId={tripId}
          tripDest={tripDest}
          travelMode={travelMode}
          tripMembers={tripMembers}
          memberNames={memberNames}
          savedPlaces={savedPlaces}
          onSave={toggleSave}
          onExplore={handleExplore}
        />
      )}

      {/* Full-screen map */}
      <ExploreMap
        visible={showMapModal}
        places={filteredPlaces}
        savedNames={saved}
        recommendedNames={recommended}
        travelMode={travelMode}
        distanceOrigin={distanceOrigin === 'me' ? 'me' : 'hotel'}
        userLocation={userLocation}
        onClose={() => setShowMapModal(false)}
        onTravelModeChange={handleTravelModeChange}
        onAnchorChange={handleAnchorChange}
        onSaveToggle={toggleSave}
        getDistanceKm={getDistanceKm}
      />

      <PlaceDetailSheet
        visible={showDetail}
        placeId={detailPlaceId}
        initialName={detailPlaceName}
        saved={saved.has(detailPlaceName)}
        onClose={() => setShowDetail(false)}
        onRecommend={() => {
          setShowDetail(false);
          if (detailPlaceName) toggleRecommend(detailPlaceName);
        }}
        isRecommended={recommended.has(detailPlaceName)}
      />
      <GroupVotingSheet
        visible={showVotingSheet}
        onClose={() => setShowVotingSheet(false)}
        place={votingPlace}
        members={tripMembers}
        currentMemberId={currentMemberId}
        onVoteUpdated={(placeId, votes) => {
          setSavedPlaces((prev) =>
            prev.map((p) => (p.id === placeId ? { ...p, voteByMember: votes } : p)),
          );
        }}
      />
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
      letterSpacing: -0.66, // -0.03em
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.text3,
      letterSpacing: 1.76, // 0.16em
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
      letterSpacing: -0.12, // -0.01em
    },
    segTextActive: {
      color: colors.text,
    },

    // Prompt card
    promptCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    promptGlow: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 140,
      height: 140,
      borderRadius: 999,
      backgroundColor: 'rgba(217, 164, 65, 0.28)',
    },
    promptInner: {
      position: 'relative',
    },
    promptHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    promptIconBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promptTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    promptSub: {
      fontSize: 10.5,
      color: colors.text3,
    },
    promptInputBox: {
      backgroundColor: colors.canvas,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    promptInput: {
      minHeight: 56,
      color: colors.text,
      fontSize: 13,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    generateBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onBlack,
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6, // 0.16em
      textTransform: 'uppercase',
      color: colors.text3,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: -0.48, // -0.03em
      color: colors.text,
      marginTop: 2,
    },
    backLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      padding: 4,
    },

    // Style cards
    scopeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    scopePill: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scopePillActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    scopePillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
    },
    scopePillTextActive: {
      color: colors.accent,
    },
    styleList: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    styleCard: {
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
    styleCardActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    styleRadio: {
      width: 20,
      height: 20,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: colors.border2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    styleRadioActive: {
      borderColor: colors.accent,
    },
    styleRadioDot: {
      width: 9,
      height: 9,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    styleLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    styleSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },

    // Trending
    trendingRow: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 10,
    },

    // Search
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 14,
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
    },

    // Chips
    chipRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 6,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text2,
    },
    chipTextActive: {
      color: colors.ink,
    },

    // Filter toggle
    filterBarInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.card,
    },

    // Results count
    resultsCount: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text3,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },


    // Filter panel
    filterPanel: {
      marginHorizontal: 16,
      marginBottom: 14,
      padding: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      gap: 14,
    },
    filterFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    filterResetText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
      padding: 4,
    },
    filterShowBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.black,
    },
    filterShowBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },

    // Place list
    placeList: {
      paddingHorizontal: 16,
      gap: 12,
    },
    viewMapBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginHorizontal: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
    },
    viewMapText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    emptyPlaces: {
      paddingVertical: 28,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: colors.text3,
    },
    showMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    showMoreText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },

    // Saved empty state
    emptyCard: {
      paddingVertical: 36,
      paddingHorizontal: 20,
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 16,
    },
    emptyCardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    emptyCardBody: {
      fontSize: 12,
      color: colors.text3,
    },

    // Saved header
    // Group voting section
    votingSection: {
      marginBottom: 16,
      padding: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    votingSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    votingSectionTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    votingBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
    },
    votingBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.accent,
    },
    votingSubhead: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 6,
      marginBottom: 6,
    },
    votingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    votingThumb: {
      width: 40,
      height: 40,
      borderRadius: 8,
    },
    votingInfo: {
      flex: 1,
    },
    votingName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    votingMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 1,
    },
    votingDecision: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 2,
    },
    votingEmpty: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 6,
    },
    votingEmptyTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },
    votingEmptyBody: {
      fontSize: 12,
      color: colors.text3,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: 8,
    },

    savedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    savedCount: {
      fontSize: 12,
      color: colors.text3,
      flex: 1,
      marginRight: 8,
    },
    clearAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
    },

    // Error text
    errorText: {
      fontSize: 12,
      color: colors.danger,
      textAlign: 'center',
      paddingVertical: 4,
    },

    // Itinerary cards
    itineraryCard: {
      padding: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      gap: 8,
    },
    itineraryDayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itineraryDayLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.accent,
    },
    itineraryDate: {
      fontSize: 11,
      color: colors.text3,
      fontWeight: '600',
    },
    itineraryTheme: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    itinerarySlot: {
      gap: 2,
    },
    itinerarySlotLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    itinerarySlotText: {
      fontSize: 12,
      color: colors.text2,
      lineHeight: 17,
    },
    itineraryTipBox: {
      marginTop: 4,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.accentBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    itineraryTipText: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: '500',
    },

    // Activity cards
    activityCard: {
      padding: 12,
      backgroundColor: colors.bg2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    activityEmoji: {
      fontSize: 20,
      marginTop: 2,
    },
    activityName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    activityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    activitySlot: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    activityDot: {
      fontSize: 10,
      color: colors.text3,
    },
    activityDetail: {
      fontSize: 10,
      color: colors.text3,
    },
    activityDesc: {
      fontSize: 12,
      color: colors.text2,
      lineHeight: 17,
      paddingLeft: 30,
    },
    activityNavBtn: {
      alignSelf: 'flex-start',
      marginLeft: 30,
      marginTop: 2,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activityNavText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },

    // ── Manual Planner ──
    plannerSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginBottom: 12,
    },
    plannerCount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    browsePlacesBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    browsePlacesBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    plannerDayRow: {
      paddingBottom: 14,
      gap: 8,
    },
    plannerDayChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      minWidth: 64,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
    },
    plannerDayLabel: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    plannerDayNum: {
      fontSize: 15,
      fontWeight: '600',
      marginTop: 2,
    },
    plannerDayCount: {
      fontSize: 10,
      marginTop: 2,
    },
    plannerTimeline: {
      paddingTop: 4,
      paddingBottom: 18,
    },
    plannerDayEyebrow: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.text3,
      marginBottom: 10,
    },
    plannerEmptyCard: {
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border2,
      borderRadius: 16,
    },
    plannerEmptyTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    plannerEmptyBody: {
      fontSize: 12,
      color: colors.text3,
      marginBottom: 14,
      textAlign: 'center',
    },
    plannerEmptyBtn: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: colors.black,
    },
    plannerEmptyBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    plannerLine: {
      position: 'absolute',
      left: 36,
      top: 8,
      bottom: 8,
      width: 1,
    },
    plannerItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 10,
    },
    plannerItemTime: {
      width: 44,
      fontSize: 11,
      fontWeight: '600',
      color: colors.text2,
      paddingTop: 14,
      textAlign: 'right',
      fontFamily: 'SpaceMono',
    },
    plannerDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      borderWidth: 2,
      marginTop: 16,
    },
    plannerItemCard: {
      flex: 1,
      padding: 12,
      borderWidth: 1,
      borderRadius: 12,
    },
    plannerItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    plannerItemTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    plannerItemNote: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 4,
    },

    // ── Top Picks ──
    topPicksSection: {
      marginBottom: 16,
    },
    topPicksTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    topPickCard: {
      width: 140,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      overflow: 'hidden',
      paddingBottom: 10,
    },
    topPickImage: {
      width: 140,
      height: 90,
      backgroundColor: colors.card2,
    },
    topPickLabel: {
      fontSize: 9.5,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.accent,
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    topPickName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: 10,
      marginTop: 2,
    },
  });
