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
import * as WebBrowser from 'expo-web-browser';
import { Bookmark, ChevronDown, Filter, Map, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react-native';

import { CategoryGrid, type CategoryItem } from '@/components/discover/CategoryGrid';
import {
  DiscoverPlaceCard,
  type DiscoverPlace,
} from '@/components/discover/DiscoverPlaceCard';
import { SuggestionList } from '@/components/discover/SuggestionList';
import { TrendingCard, type TrendingItem } from '@/components/discover/TrendingCard';
import MiniLoader from '@/components/loader/MiniLoader';
import LivingPostcardLoader from '@/components/loader/LivingPostcardLoader';
import PlaceDetailSheet from '@/components/discover/PlaceDetailSheet';
import { useTheme } from '@/constants/ThemeContext';
import { generateItinerary, type ItineraryDay } from '@/lib/anthropic';
import { distanceFromHotel, distanceFromPoint, formatDistance } from '@/lib/distance';
import DistanceToggle from '@/components/discover/DistanceToggle';
import { cacheGet, cacheSet } from '@/lib/cache';
import { searchNearby, type NearbyPlace } from '@/lib/google-places';
import {
  addPlace,
  getActiveTrip,
  getSavedPlaces,
  savePlace,
  voteOnPlace,
} from '@/lib/supabase';

// Dynamic require AFTER all imports — avoids Hermes strict mode crash
let MapView: any = null;
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  // Maps not available (web or missing native module)
}
import type { Place, PlaceCategory, PlaceVote } from '@/lib/types';
import { CONFIG } from '@/lib/config';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type TabId = 'places' | 'planner' | 'saved';
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

function mapNearbyToDiscoverPlace(place: NearbyPlace): DiscoverPlace {
  const km = distanceFromHotel(place.lat, place.lng);
  return {
    n: place.name,
    t: resolveTypeLabel(place.types),
    r: place.rating,
    rv: formatReviewCount(place.total_ratings),
    d: formatDistance(km),
    dn: km,
    price: place.price_level ?? 0,
    openNow: place.open_now ?? false,
    img: place.photo_url ?? 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80',
    placeId: place.place_id,
    lat: place.lat,
    lng: place.lng,
    totalRatings: place.total_ratings,
    types: place.types,
  };
}

function mapSavedPlaceToDiscoverPlace(place: Place): DiscoverPlace {
  const km = place.latitude && place.longitude
    ? distanceFromHotel(place.latitude, place.longitude)
    : 0;
  return {
    n: place.name,
    t: place.category,
    r: place.rating ?? 0,
    rv: formatReviewCount(place.totalRatings ?? 0),
    d: place.distance ?? formatDistance(km),
    dn: km,
    price: 0,
    openNow: true,
    img: place.photoUrl ?? 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80',
  };
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

const CATEGORY_SUGGESTIONS: Record<string, readonly string[]> = {
  beach: [
    'Puka Shell Beach',
    'White Beach Station 1',
    'Diniwid cove',
    'Ilig-Iligan',
    'Bulabog wind beach',
  ],
  food: [
    'Best local eats',
    'Fresh seafood grills',
    'Late-night ihaw-ihaw',
    'Coffee & brunch',
    'Must-try halo-halo',
  ],
  activity: [
    'Island hopping',
    'Parasailing',
    'Snorkeling reefs',
    'Helmet diving',
    'Kite-surfing Bulabog',
  ],
  nightlife: [
    'Beachfront sundowners',
    'Live music bars',
    'Fire dancers',
    'Sky bar rooftop',
    'Late-night clubs',
  ],
  photo: [
    "Willy's Rock at sunset",
    'Drone-friendly viewpoints',
    'Puka sunset',
    'Mt Luho overlook',
    'Pastel caf\u00E9s',
  ],
  wellness: [
    'Beachside massage',
    'Yoga at sunrise',
    'Spa day',
    'Wellness retreats',
    'Juice & smoothie bars',
  ],
  coffee: [
    'Best espresso spots',
    'Beachfront cafes',
    'Pour-over & specialty',
    'Iced coffee stops',
    'Brunch & coffee',
  ],
};

const ITINERARY_STYLES = [
  { id: 'relaxed', label: 'Relaxed', sub: 'Slow mornings, spa, sunsets' },
  { id: 'adventure', label: 'Adventure', sub: 'Water sports, trails, reefs' },
  { id: 'foodie', label: 'Foodie', sub: 'Local eats, markets, bars' },
  { id: 'family', label: 'Family', sub: 'Kid-safe, easy access' },
  { id: 'culture', label: 'Culture', sub: 'History, markets, locals' },
] as const;

const PLACES: readonly DiscoverPlace[] = [
  {
    n: 'Puka Shell Beach',
    t: 'Beach',
    r: 4.7,
    rv: '3.2k reviews',
    d: '4.2 km',
    dn: 4.2,
    price: 0,
    openNow: true,
    img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80',
  },
  {
    n: "D'Mall",
    t: 'Shopping',
    r: 4.3,
    rv: '1.8k reviews',
    d: '1.6 km',
    dn: 1.6,
    price: 2,
    openNow: true,
    img: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&q=80',
  },
  {
    n: "Willy's Rock",
    t: 'Landmark',
    r: 4.5,
    rv: '2.1k reviews',
    d: '900 m',
    dn: 0.9,
    price: 0,
    openNow: true,
    img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
  },
  {
    n: "Jonah's Fruit Shake",
    t: 'Restaurant',
    r: 4.6,
    rv: '890 reviews',
    d: '1.2 km',
    dn: 1.2,
    price: 1,
    openNow: false,
    img: 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?w=800&q=80',
  },
];

const TRENDING: readonly TrendingItem[] = [
  {
    n: 'Island hopping tour',
    pr: '\u20B11,800',
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  },
  {
    n: 'Parasailing',
    pr: '\u20B11,200',
    img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80',
  },
  {
    n: 'Sunset sail',
    pr: '\u20B11,500',
    img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80',
  },
];

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
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [tab, setTab] = useState<TabId>('places');
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
  const [places, setPlaces] = useState<readonly DiscoverPlace[]>(PLACES);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [itineraryScope, setItineraryScope] = useState<'whole' | 'day' | 'surprise'>('whole');
  const [placeCategoryChip, setPlaceCategoryChip] = useState('All');
  const [visibleCount, setVisibleCount] = useState(20);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapFilter, setMapFilter] = useState<string | null>(null);

  // PlaceDetailSheet state
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);
  const [detailPlaceName, setDetailPlaceName] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const placesCache = useRef<Record<string, readonly DiscoverPlace[]>>({});

  const [tripDest, setTripDest] = useState('');

  // Restore cached anchor/travel mode
  useEffect(() => {
    cacheGet<'hotel' | 'me'>('discover:anchor').then((v) => {
      if (v === 'me') {
        // Need to fetch GPS before setting origin to 'me'
        switchToMyLocation();
      } else if (v) {
        setDistanceOrigin(v);
      }
    });
    cacheGet<'walk' | 'car'>('discover:travelMode').then((v) => { if (v) setTravelMode(v); });
  }, []);

  // Compute distance from the selected origin (hotel or current location)
  const getDistanceKm = useCallback((placeLat?: number, placeLng?: number): number => {
    if (!placeLat || !placeLng) return 0;
    if (distanceOrigin === 'me' && userLocation) {
      return distanceFromPoint(userLocation.lat, userLocation.lng, placeLat, placeLng);
    }
    return distanceFromHotel(placeLat, placeLng);
  }, [distanceOrigin, userLocation]);

  // Fetch GPS when user switches to "me"
  const switchToMyLocation = useCallback(async () => {
    if (userLocation) {
      setDistanceOrigin('me');
      return;
    }
    try {
      const Location = require('expo-location') as typeof import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location denied', 'Enable location permissions in Settings to use "From Me".');
        setDistanceOrigin('hotel');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setDistanceOrigin('me');
    } catch {
      Alert.alert('Location unavailable', 'Could not get your location. Using hotel distance.');
      setDistanceOrigin('hotel');
    }
  }, [userLocation]);

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

  // Load trip ID on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const trip = await getActiveTrip();
        if (!cancelled && trip) {
          setTripId(trip.id);
          setTripDest(trip.destination ?? '');
        }
      } catch {
        // Trip load failure is non-fatal; features degrade gracefully
      }
    };
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
    } catch {
      // Saved places load failure is non-fatal
    } finally {
      setSavedLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (tab === 'saved' && tripId) {
      loadSavedPlaces();
    }
  }, [tab, tripId, loadSavedPlaces]);

  // Search places via Google Places API
  const searchPlaces = useCallback(async (keyword?: string, type?: string, skipCache = false) => {
    const cacheKey = `${type ?? ''}_${keyword ?? ''}`;

    // Use cache if available and not forced refresh
    if (!skipCache && placesCache.current[cacheKey]) {
      setPlaces(placesCache.current[cacheKey]);
      return;
    }

    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const results = await searchNearby(type, keyword);
      if (results.length > 0) {
        const mapped = results.map(mapNearbyToDiscoverPlace);
        placesCache.current[cacheKey] = mapped;
        setPlaces(mapped);
      } else {
        setPlaces(PLACES);
        setPlacesError('No results found. Showing curated places.');
      }
    } catch {
      setPlaces(PLACES);
      setPlacesError('Could not load places. Showing curated places.');
    } finally {
      setPlacesLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      const chosenStyle = itineraryScope === 'surprise'
        ? ITINERARY_STYLES[Math.floor(Math.random() * ITINERARY_STYLES.length)].id
        : style;
      const interests = STYLE_TO_INTERESTS[chosenStyle] ?? ['beach', 'food', 'activities'];
      const promptInterests = prompt.trim()
        ? [...interests, prompt.trim()]
        : interests;
      const mode = itineraryScope === 'day' ? 'Lite in 7 Days' : 'Surprise Me';
      const result = await generateItinerary({
        mode,
        interests: promptInterests,
      });
      setItinerary(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate itinerary';
      setItineraryError(message);
    } finally {
      setItineraryLoading(false);
    }
  }, [style, prompt, itineraryScope]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const filteredPlaces = useMemo(() => applyPlaceFilters(places, filters), [places, filters]);


  // Pre-compute distances, filter nearby, sort by nearest first.
  const placesWithDistance = useMemo(() => {
    const withDist = filteredPlaces.map((p) => ({
      place: p,
      distanceKm: getDistanceKm(p.lat, p.lng),
    }));
    const filtered = filters.nearby
      ? withDist.filter((p) => p.distanceKm > 0 && p.distanceKm <= 2)
      : withDist;
    return filtered.sort((a, b) => a.distanceKm - b.distanceKm);
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
          <Text style={styles.subtitle}>{tripDest || 'Discover'}</Text>
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
          {(['places', 'planner', 'saved'] as const).map((id) => (
            <TouchableOpacity
              key={id}
              style={[styles.segBtn, tab === id && styles.segBtnActive]}
              onPress={() => setTab(id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segText, tab === id && styles.segTextActive]}>
                {id === 'planner'
                  ? 'Planner'
                  : id === 'places'
                    ? 'Places'
                    : `Saved${saved.size ? ` \u00B7 ${saved.size}` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
        {/* ═══════ PLANNER TAB ═══════ */}
        {tab === 'planner' && (
          <>
            {/* AI loading — full animated loader */}
            {itineraryLoading ? (
              <View style={{ height: 400, marginHorizontal: -16 }}>
                <LivingPostcardLoader
                  destination={tripDest || 'your trip'}
                  name="traveler"
                  onDone={() => {}}
                  durationMs={30000}
                />
              </View>
            ) : (
              <>
                {/* AI prompt card */}
                <View style={styles.promptCard}>
                  {/* Glow */}
                  <View style={styles.promptGlow} />
                  <View style={styles.promptInner}>
                    {/* Header row */}
                    <View style={styles.promptHeaderRow}>
                      <View style={styles.promptIconBox}>
                        <Sparkles size={15} color="#fff" strokeWidth={2} />
                      </View>
                      <View>
                        <Text style={styles.promptTitle}>Trip Planner</Text>
                        <Text style={styles.promptSub}>
                          AI-generated day-by-day for {tripDest || 'your trip'}
                        </Text>
                      </View>
                    </View>

                    {/* Scope selector */}
                    <View style={styles.scopeRow}>
                      {([
                        { id: 'whole', label: 'Whole trip' },
                        { id: 'day', label: 'Just today' },
                        { id: 'surprise', label: 'Surprise me' },
                      ] as const).map((s) => {
                        const active = itineraryScope === s.id;
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.scopePill, active && styles.scopePillActive]}
                            onPress={() => setItineraryScope(s.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.scopePillText, active && styles.scopePillTextActive]}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Style selector — hidden for "surprise me" */}
                    {itineraryScope !== 'surprise' && (
                      <View style={styles.styleList}>
                        {ITINERARY_STYLES.map((s) => {
                          const active = style === s.id;
                          return (
                            <TouchableOpacity
                              key={s.id}
                              style={[styles.styleCard, active && styles.styleCardActive]}
                              onPress={() => setStyle(s.id)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.styleRadio,
                                  active && styles.styleRadioActive,
                                ]}
                              >
                                {active && <View style={styles.styleRadioDot} />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.styleLabel}>{s.label}</Text>
                                <Text style={styles.styleSub}>{s.sub}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Text input */}
                    <View style={styles.promptInputBox}>
                      <TextInput
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder="What do you want to do on this trip?"
                        placeholderTextColor={colors.text3}
                        style={styles.promptInput}
                        multiline
                      />
                    </View>

                    {/* Generate button */}
                    <TouchableOpacity
                      style={styles.generateBtn}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Generate Itinerary"
                      onPress={handleGenerateItinerary}
                    >
                      <Sparkles size={16} color={colors.onBlack} strokeWidth={2} />
                      <Text style={styles.generateBtnText}>Generate Itinerary</Text>
                    </TouchableOpacity>

                    {/* Itinerary error */}
                    {itineraryError && (
                      <Text style={styles.errorText}>{itineraryError}</Text>
                    )}
                  </View>
                </View>

                {/* Generated itinerary results */}
                {itinerary.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.eyebrow}>Your itinerary</Text>
                        <Text style={styles.sectionTitle}>Day-by-day plan</Text>
                      </View>
                    </View>
                    <View style={styles.styleList}>
                      {itinerary.map((day) => (
                        <View key={day.day} style={styles.itineraryCard}>
                          <View style={styles.itineraryDayHeader}>
                            <Text style={styles.itineraryDayLabel}>Day {day.day}</Text>
                            <Text style={styles.itineraryDate}>{day.date}</Text>
                          </View>
                          <Text style={styles.itineraryTheme}>{day.theme}</Text>
                          <View style={styles.itinerarySlot}>
                            <Text style={styles.itinerarySlotLabel}>Morning</Text>
                            <Text style={styles.itinerarySlotText}>{day.morning}</Text>
                          </View>
                          <View style={styles.itinerarySlot}>
                            <Text style={styles.itinerarySlotLabel}>Afternoon</Text>
                            <Text style={styles.itinerarySlotText}>{day.afternoon}</Text>
                          </View>
                          <View style={styles.itinerarySlot}>
                            <Text style={styles.itinerarySlotLabel}>Evening</Text>
                            <Text style={styles.itinerarySlotText}>{day.evening}</Text>
                          </View>
                          <View style={styles.itinerarySlot}>
                            <Text style={styles.itinerarySlotLabel}>Dining</Text>
                            <Text style={styles.itinerarySlotText}>{day.dining}</Text>
                          </View>
                          {day.tips ? (
                            <View style={styles.itineraryTipBox}>
                              <Text style={styles.itineraryTipText}>{day.tips}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* Trending */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.eyebrow}>Trending in {tripDest || 'your area'}</Text>
                <Text style={styles.sectionTitle}>
                  What everyone{'\u2019'}s doing
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setTab('places');
                  setPlaceCategoryChip('Activity');
                }}
              >
                <Text style={styles.backLink}>All {'\u2192'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingRow}
            >
              {TRENDING.map((t) => (
                <TrendingCard key={t.n} item={t} />
              ))}
            </ScrollView>
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

            {/* Distance anchor + travel mode */}
            <DistanceToggle
              anchor={distanceOrigin === 'me' ? 'me' : 'hotel'}
              travelMode={travelMode}
              onAnchorChange={handleAnchorChange}
              onTravelModeChange={handleTravelModeChange}
            />

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

            {/* Filter bar */}
            <View style={styles.filterBar}>
              <TouchableOpacity
                onPress={toggleShowFilters}
                style={[
                  styles.filterBtn,
                  activeFilterCount > 0 && styles.filterBtnActive,
                ]}
                activeOpacity={0.7}
              >
                <Filter size={12} color={activeFilterCount > 0 ? colors.accent : colors.text} strokeWidth={2} />
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '600',
                    color: activeFilterCount > 0 ? colors.accent : colors.text,
                  }}
                >
                  Filters{activeFilterCount > 0 ? ` \u00B7 ${activeFilterCount}` : ''}
                </Text>
              </TouchableOpacity>
              <FilterChip
                active={filters.openNow}
                onPress={toggleOpenNow}
                colors={colors}
              >
                Open now
              </FilterChip>
              <FilterChip
                active={filters.nearby}
                onPress={toggleNearby}
                colors={colors}
              >
                Nearby
              </FilterChip>
              <FilterChip
                active={filters.minRating >= 4.5}
                onPress={toggleRating}
                colors={colors}
              >
                {'\u2605'} 4.5+
              </FilterChip>
            </View>

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

            {/* Explore on Map button — top */}
            {!placesLoading && filteredPlaces.length > 0 && MapView && (
              <TouchableOpacity
                style={styles.viewMapBtn}
                onPress={() => setShowMapModal(true)}
                activeOpacity={0.7}
              >
                <Map size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.viewMapText}>Explore on Map</Text>
              </TouchableOpacity>
            )}

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
                <View style={styles.savedHeaderRow}>
                  <Text style={styles.savedCount}>
                    {savedPlaces.length} saved {'\u00B7'} {recommended.size} recommended
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSaved(new Set());
                      setRecommended(new Set());
                      setSavedPlaces([]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                {savedPlaces.map((p) => {
                  const dp = mapSavedPlaceToDiscoverPlace(p);
                  return (
                    <DiscoverPlaceCard
                      key={p.id}
                      place={dp}
                      distanceKm={getDistanceKm(dp.lat, dp.lng)}
                      travelMode={travelMode}
                      isSaved={true}
                      isRecommended={recommended.has(p.name)}
                      onSave={toggleSave}
                      onRecommend={toggleRecommend}
                    />
                  );
                })}
              </>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Full-screen map modal */}
      {showMapModal && MapView && (() => {
        const CATEGORY_COLOR: Record<string, string> = {
          Restaurant: '#c66a36', Cafe: '#8a5a2b', Bar: '#b66a8a',
          Beach: '#5a8fb5', Spa: '#7ba88a', Shopping: '#a64d1e',
          Attraction: '#d9a441', Landmark: '#857d70', Nature: '#7e9f5b',
          Wellness: '#7ba88a', Hotel: '#c49460', Culture: '#8b6f5a',
          Park: '#7e9f5b', Place: '#857d70',
        };
        const MAP_CHIPS = ['All', 'Coffee', 'Food', 'Beach', 'Bar', 'Shopping', 'Spa', 'Activity'];
        const mapPlaces = filteredPlaces.filter((p) => {
          if (!p.lat || !p.lng) return false;
          if (!mapFilter || mapFilter === 'All') return true;
          return p.t.toLowerCase().includes(mapFilter.toLowerCase());
        });
        return (
          <View style={styles.mapModal}>
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: userLocation?.lat ?? CONFIG.HOTEL_COORDS.lat,
                longitude: userLocation?.lng ?? CONFIG.HOTEL_COORDS.lng,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
            >
              {/* Hotel pin */}
              <Marker
                coordinate={{ latitude: CONFIG.HOTEL_COORDS.lat, longitude: CONFIG.HOTEL_COORDS.lng }}
                title="Your Hotel"
                pinColor={colors.accent}
              />
              {/* Place pins — simple pinColor, no custom views */}
              {mapPlaces.map((p, idx) => (
                <Marker
                  key={p.placeId ?? `${p.n}-${idx}`}
                  coordinate={{ latitude: p.lat!, longitude: p.lng! }}
                  title={p.n}
                  description={`${p.t} \u00B7 Tap for directions`}
                  pinColor={CATEGORY_COLOR[p.t] ?? colors.text3}
                  onCalloutPress={() => {
                    const mode = travelMode === 'walk' ? 'walking' : 'driving';
                    WebBrowser.openBrowserAsync(
                      `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&destination_place_id=${p.placeId ?? ''}&travelmode=${mode}`
                    );
                  }}
                />
              ))}
            </MapView>
            {/* Close button */}
            <TouchableOpacity
              style={styles.mapCloseBtn}
              onPress={() => { setShowMapModal(false); setMapFilter(null); }}
              activeOpacity={0.7}
            >
              <X size={22} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            {/* Place count badge */}
            <View style={styles.mapBadge}>
              <Text style={styles.mapBadgeText}>{mapPlaces.length} places</Text>
            </View>
            {/* Category filter chips */}
            <View style={styles.mapChipsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
                {MAP_CHIPS.map((c) => {
                  const active = (mapFilter ?? 'All') === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setMapFilter(c === 'All' ? null : c)}
                      style={[styles.mapChip, active && styles.mapChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.mapChipText, active && styles.mapChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        );
      })()}

      <PlaceDetailSheet
        visible={showDetail}
        placeId={detailPlaceId}
        initialName={detailPlaceName}
        saved={saved.has(detailPlaceName)}
        onClose={() => setShowDetail(false)}
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

    // Filter bar
    filterBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
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
    mapModal: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      backgroundColor: colors.bg,
    },
    mapCloseBtn: {
      position: 'absolute',
      top: 52,
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 101,
    },
    mapBadge: {
      position: 'absolute',
      top: 52,
      left: 16,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 101,
    },
    mapBadgeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    mapChipsRow: {
      position: 'absolute',
      bottom: 32,
      left: 0,
      right: 0,
      zIndex: 101,
    },
    mapChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    mapChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text2,
    },
    mapChipTextActive: {
      color: colors.ink,
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
    savedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    savedCount: {
      fontSize: 12,
      color: colors.text3,
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
  });
