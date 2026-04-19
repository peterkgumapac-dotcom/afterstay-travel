import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { List, Map, Plus, Bookmark, BookmarkCheck, Navigation, Sparkles, Globe2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import AfterStayLoader from '@/components/AfterStayLoader';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { distanceFromHotel, formatDistance, estimateWalkTime } from '@/lib/distance';
import { searchNearby, searchPlace, HOTEL_LAT, HOTEL_LNG, type NearbyPlace } from '@/lib/google-places';
import { PlaceDetailSheet } from '@/components/discover/PlaceDetailSheet';
import { FilterBar } from '@/components/discover/FilterBar';
import { FilterMoreSheet } from '@/components/discover/FilterMoreSheet';
import PlaceCard from '@/components/PlaceCard';
import { addPlace, getSavedPlaces, getActiveTrip, voteOnPlace, savePlace } from '@/lib/supabase';
import { useFilters } from '@/hooks/useFilters';
import { applyFilters } from '@/lib/filters';
import type { Place, PlaceVote } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const DISCOVER_CATEGORIES = [
  { label: 'All', type: '', keyword: 'boracay' },
  { label: 'Restaurants', type: 'restaurant', keyword: 'boracay' },
  { label: 'Coffee', type: 'cafe', keyword: 'coffee boracay' },
  { label: 'Bars', type: 'bar', keyword: 'boracay' },
  { label: 'Beach', type: '', keyword: 'beach boracay' },
  { label: 'Activities', type: 'tourist_attraction', keyword: 'boracay' },
  { label: 'Spa', type: 'spa', keyword: 'boracay' },
  { label: 'Hotels', type: 'lodging', keyword: 'hotel resort boracay' },
  { label: 'Airbnb', type: '', keyword: 'airbnb vacation rental boracay' },
  { label: 'Shopping', type: 'shopping_mall', keyword: 'boracay' },
  { label: 'Essentials', type: '', keyword: 'pharmacy convenience boracay' },
] as const;

// Curated Boracay places — always shown when Google Places API returns nothing
const CURATED_PLACES: NearbyPlace[] = [
  { place_id: 'ChIJf6sRJd3vqTMRQMJSyrfnMEo', name: 'White Beach', rating: 4.7, total_ratings: 12800, address: 'Station 1-3, Boracay', lat: 11.9674, lng: 121.9249, photo_url: null, types: ['natural_feature', 'tourist_attraction'], open_now: undefined, price_level: undefined },
  { place_id: 'ChIJLR5w2N_vqTMR14JMkJHGbhI', name: "Puka Shell Beach", rating: 4.5, total_ratings: 4200, address: 'Yapak, Boracay', lat: 11.9856, lng: 121.9304, photo_url: null, types: ['natural_feature', 'tourist_attraction'], open_now: undefined, price_level: undefined },
  { place_id: 'ChIJm2T3IuDvqTMRMnAhFLDe7Vk', name: "D'Mall Boracay", rating: 4.3, total_ratings: 6500, address: 'Station 2, Boracay', lat: 11.9641, lng: 121.9253, photo_url: null, types: ['shopping_mall', 'store'], open_now: undefined, price_level: 2 },
  { place_id: 'ChIJR0Nh4OPvqTMR-r1kz0c8VQE', name: 'Ariel\u2019s Point', rating: 4.6, total_ratings: 3100, address: 'Buruanga, near Boracay', lat: 11.9200, lng: 121.8850, photo_url: null, types: ['tourist_attraction', 'amusement_park'], open_now: undefined, price_level: 3 },
  { place_id: 'ChIJHV_hKd_vqTMRFKZBptxN2DQ', name: 'The Lemon Cafe', rating: 4.4, total_ratings: 1800, address: 'Station 1, White Beach Path', lat: 11.9710, lng: 121.9230, photo_url: null, types: ['cafe', 'restaurant'], open_now: undefined, price_level: 2 },
  { place_id: 'ChIJDwGJ2eDvqTMRO0GVqAGR_fk', name: 'Epic Boracay', rating: 4.5, total_ratings: 2400, address: 'Station 2, Beachfront', lat: 11.9635, lng: 121.9250, photo_url: null, types: ['bar', 'night_club'], open_now: undefined, price_level: 2 },
  { place_id: 'ChIJ2S05juDvqTMRDDjJEeWlw3o', name: 'Mandala Spa & Resort', rating: 4.7, total_ratings: 980, address: 'Station 3, Boracay', lat: 11.9582, lng: 121.9260, photo_url: null, types: ['spa'], open_now: undefined, price_level: 3 },
  { place_id: 'ChIJsV0pkeDvqTMR0qI6xH9K1rA', name: 'Smoke Restaurant', rating: 4.6, total_ratings: 2100, address: 'Station 1, Boracay', lat: 11.9700, lng: 121.9235, photo_url: null, types: ['restaurant', 'food'], open_now: undefined, price_level: 2 },
  { place_id: 'ChIJK3PYj-DvqTMRBwV7Yyft_q0', name: 'Island Hopping Tour', rating: 4.7, total_ratings: 5300, address: 'Station 1 Boat Terminal', lat: 11.9720, lng: 121.9220, photo_url: null, types: ['tourist_attraction'], open_now: undefined, price_level: 2 },
  { place_id: 'ChIJg9sZhuDvqTMRxJPFHvLx0i4', name: 'Budget Mart Boracay', rating: 4.0, total_ratings: 450, address: 'D\u2019Mall, Station 2', lat: 11.9645, lng: 121.9255, photo_url: null, types: ['convenience_store', 'store'], open_now: undefined, price_level: 1 },
];

const CATEGORY_EMOJI: Record<string, string> = {
  natural_feature: '\u{1F3D6}',
  tourist_attraction: '\u{2B50}',
  restaurant: '\u{1F37D}',
  food: '\u{1F37D}',
  cafe: '\u{2615}',
  bar: '\u{1F378}',
  night_club: '\u{1F378}',
  spa: '\u{1F9D6}',
  shopping_mall: '\u{1F6CD}',
  store: '\u{1F6CD}',
  convenience_store: '\u{1F3EA}',
  pharmacy: '\u{1F48A}',
  lodging: '\u{1F3E8}',
  hotel: '\u{1F3E8}',
};

function getCategoryGradient(colors: ThemeColors): Record<string, string> {
  return {
    natural_feature: colors.blue,
    tourist_attraction: colors.gold,
    restaurant: colors.danger,
    food: colors.danger,
    cafe: colors.accentDk,
    bar: colors.purple,
    night_club: colors.purple,
    spa: colors.accent,
    shopping_mall: colors.pink,
    store: colors.pink,
    convenience_store: colors.info,
    pharmacy: colors.success,
  };
}

function getPlaceEmoji(types: string[]): string {
  for (const t of types) {
    if (CATEGORY_EMOJI[t]) return CATEGORY_EMOJI[t];
  }
  return '\u{1F4CD}';
}

function getPlaceColor(types: string[], colors: ThemeColors): string {
  const gradient = getCategoryGradient(colors);
  for (const t of types) {
    if (gradient[t]) return gradient[t];
  }
  return colors.green;
}

function filterCurated(categoryIndex: number): NearbyPlace[] {
  const cat = DISCOVER_CATEGORIES[categoryIndex];
  if (!cat.type && cat.keyword === 'boracay') return CURATED_PLACES;
  return CURATED_PLACES.filter(p => {
    if (cat.type && p.types.includes(cat.type)) return true;
    if (cat.keyword) {
      const kw = cat.keyword.toLowerCase().replace('boracay', '').trim();
      if (!kw) return !!cat.type && p.types.includes(cat.type);
      return p.types.some(t => kw.includes(t)) || p.name.toLowerCase().includes(kw);
    }
    return false;
  });
}

function priceLevelString(level?: number): string {
  if (level == null) return '';
  return '$'.repeat(level);
}

function mapGoogleTypeToCategory(types: string[]): 'Eat' | 'Do' | 'Nature' | 'Essentials' | 'Nightlife' | 'Wellness' | 'Coffee' | 'Culture' | 'Transport' {
  if (types.includes('restaurant') || types.includes('food')) return 'Eat';
  if (types.includes('cafe')) return 'Coffee';
  if (types.includes('bar') || types.includes('night_club')) return 'Nightlife';
  if (types.includes('spa') || types.includes('beauty_salon')) return 'Wellness';
  if (types.includes('tourist_attraction') || types.includes('amusement_park')) return 'Do';
  if (types.includes('shopping_mall') || types.includes('store')) return 'Essentials';
  if (types.includes('pharmacy') || types.includes('convenience_store')) return 'Essentials';
  if (types.includes('museum') || types.includes('church')) return 'Culture';
  if (types.includes('natural_feature') || types.includes('park')) return 'Nature';
  return 'Do';
}

const TRIP_PLANNER_CHIPS = [
  { emoji: '\uD83C\uDFD6', label: 'Beach day' },
  { emoji: '\uD83C\uDF74', label: 'Food crawl' },
  { emoji: '\uD83E\uDD3F', label: 'Snorkeling' },
  { emoji: '\uD83C\uDF05', label: 'Sunset spot' },
  { emoji: '\uD83D\uDEF6', label: 'Island hop' },
  { emoji: '\uD83C\uDF78', label: 'Nightlife' },
];

const ITINERARY_STYLES = [
  { id: 'relaxed', label: 'Relaxed', desc: 'Chill vibes, no rush' },
  { id: 'adventure', label: 'Adventure', desc: 'Action-packed days' },
  { id: 'foodie', label: 'Foodie', desc: 'Eat your way through' },
  { id: 'family', label: 'Family', desc: 'Kid-friendly activities' },
  { id: 'culture', label: 'Culture', desc: 'History and local life' },
];

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [activeCategory, setActiveCategory] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCurated, setIsCurated] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [discoverView, setDiscoverView] = useState<'explore' | 'saved'>('explore');
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const [voteFilter, setVoteFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [detailPlace, setDetailPlace] = useState<NearbyPlace | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'planner' | 'places'>('places');
  const [selectedStyle, setSelectedStyle] = useState<string>('relaxed');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const { filters, updateFilters, resetFilters } = useFilters();

  const loadSavedPlaces = useCallback(async () => {
    setSavedLoading(true);
    try {
      const trip = await getActiveTrip();
      if (!trip) return;
      const all = await getSavedPlaces(trip.id);
      setSavedPlaces(all.filter(p => p.saved));
    } catch {}
    finally { setSavedLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadSavedPlaces(); }, [loadSavedPlaces]));

  const enrichCurated = useCallback(async (curated: NearbyPlace[]): Promise<NearbyPlace[]> => {
    // Try to get real photos + place_ids from Google Places search
    const results = await Promise.allSettled(
      curated.map(p => searchPlace(p.name, 'Boracay Philippines')),
    );
    return curated.map((p, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        return {
          ...p,
          photo_url: r.value.photo_url ?? p.photo_url,
          place_id: r.value.place_id || p.place_id,
          lat: r.value.lat || p.lat,
          lng: r.value.lng || p.lng,
          rating: r.value.rating || p.rating,
          total_ratings: r.value.total_ratings || p.total_ratings,
        };
      }
      return p;
    });
  }, []);

  const fetchPlaces = useCallback(async (categoryIndex: number) => {
    try {
      const cat = DISCOVER_CATEGORIES[categoryIndex];

      let results: NearbyPlace[];

      if (cat.label === 'All') {
        // Run one search per non-All category, merge + dedupe
        const searches = DISCOVER_CATEGORIES
          .filter(c => c.label !== 'All')
          .map(c => searchNearby(c.type || undefined, c.keyword || undefined).catch(() => [] as NearbyPlace[]));
        const allResults = await Promise.all(searches);
        const seen = new Set<string>();
        const merged: NearbyPlace[] = [];
        for (const batch of allResults) {
          for (const p of batch) {
            if (seen.has(p.place_id)) continue;
            seen.add(p.place_id);
            merged.push(p);
          }
        }
        results = merged;
      } else {
        const type = cat.type || undefined;
        const keyword = cat.keyword || undefined;
        results = await searchNearby(type, keyword);
      }

      if (results.length > 0) {
        const sorted = [...results].sort((a, b) => {
          const dA = a.lat && a.lng ? distanceFromHotel(a.lat, a.lng) : 999;
          const dB = b.lat && b.lng ? distanceFromHotel(b.lat, b.lng) : 999;
          return dA - dB;
        });
        setPlaces(sorted);
        setIsCurated(false);
      } else {
        const curated = filterCurated(categoryIndex);
        setPlaces(curated);
        setIsCurated(true);
        enrichCurated(curated).then(enriched => setPlaces(enriched));
      }
    } catch {
      const curated = filterCurated(categoryIndex);
      setPlaces(curated);
      setIsCurated(true);
      enrichCurated(curated).then(enriched => setPlaces(enriched)).catch(() => {});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enrichCurated]);

  useEffect(() => {
    setLoading(true);
    fetchPlaces(activeCategory);
  }, [activeCategory, fetchPlaces]);

  const onCategoryChange = (index: number) => {
    if (index === activeCategory) return;
    setActiveCategory(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onRecommendToGroup = async (place: NearbyPlace) => {
    if (savingIds.has(place.place_id)) return;
    setSavingIds(prev => new Set([...prev, place.place_id]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const mapsUri = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
      await addPlace({
        name: place.name,
        category: mapGoogleTypeToCategory(place.types),
        rating: place.rating,
        source: 'Suggested',
        vote: 'Pending',
        photoUrl: place.photo_url ?? undefined,
        googlePlaceId: place.place_id,
        googleMapsUri: mapsUri,
        totalRatings: place.total_ratings,
        latitude: place.lat,
        longitude: place.lng,
        saved: true,
        notes: place.address,
        priceEstimate: priceLevelString(place.price_level) || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Recommend failed — user can retry
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(place.place_id);
        return next;
      });
    }
  };

  const onVoteSaved = useCallback(async (placeId: string, vote: PlaceVote) => {
    setVotingIds(prev => new Set([...prev, placeId]));
    const original = savedPlaces.find(p => p.id === placeId)?.vote;
    setSavedPlaces(prev => prev.map(p => p.id === placeId ? { ...p, vote } : p));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await voteOnPlace(placeId, vote);
    } catch {
      setSavedPlaces(prev => prev.map(p => p.id === placeId ? { ...p, vote: original ?? 'Pending' } : p));
    } finally {
      setVotingIds(prev => { const n = new Set(prev); n.delete(placeId); return n; });
    }
  }, [savedPlaces]);

  const onUnsaveSaved = useCallback(async (place: Place) => {
    setSavedPlaces(prev => prev.filter(p => p.id !== place.id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await savePlace(place.id, false);
    } catch {
      setSavedPlaces(prev => [...prev, place]);
    }
  }, []);

  const onDirections = (place: NearbyPlace) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${HOTEL_LAT},${HOTEL_LNG}&destination=${place.lat},${place.lng}&destination_place_id=${place.place_id}`;
    Linking.openURL(url);
  };

  const onCardPress = (place: NearbyPlace) => {
    setDetailPlace(place);
  };

  // Apply filters to explore places
  const enrichedPlaces = places.map(p => ({
    ...p,
    rating: p.rating,
    distanceKm: p.lat && p.lng ? distanceFromHotel(p.lat, p.lng) : undefined,
    isOpenNow: p.open_now,
    priceLevel: p.price_level,
  }));
  const filteredExplore = applyFilters(enrichedPlaces, filters);

  // Apply filters to saved places
  const enrichedSaved = savedPlaces.map(p => ({
    ...p,
    distanceKm: p.latitude && p.longitude ? distanceFromHotel(p.latitude, p.longitude) : undefined,
    isOpenNow: undefined as boolean | undefined,
    priceLevel: undefined as number | undefined,
  }));
  const filteredSaved = applyFilters(enrichedSaved, filters)
    .filter(p => {
      if (voteFilter === 'all') return true;
      if (voteFilter === 'approved') return p.vote === '👍 Yes';
      if (voteFilter === 'pending') return p.vote === 'Pending';
      if (voteFilter === 'rejected') return p.vote === '👎 No';
      return true;
    })
    .sort((a, b) => {
      const aVoted = a.vote !== 'Pending' ? 0 : 1;
      const bVoted = b.vote !== 'Pending' ? 0 : 1;
      if (aVoted !== bVoted) return aVoted - bVoted;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

  const renderCard = ({ item }: { item: NearbyPlace }) => {
    const isSaving = savingIds.has(item.place_id);
    const priceStr = priceLevelString(item.price_level);
    const ratingParts = [`${item.rating.toFixed(1)}`];
    if (item.total_ratings > 0) ratingParts.push(`${item.total_ratings.toLocaleString()} reviews`);
    if (priceStr) ratingParts.push(priceStr);

    const emoji = getPlaceEmoji(item.types);
    const bgColor = getPlaceColor(item.types, colors);

    return (
      <Pressable style={styles.card} onPress={() => onCardPress(item)}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: bgColor + '20' }]}>
            <Text style={styles.placeholderEmoji}>{emoji}</Text>
            <Text style={[styles.placeholderLabel, { color: bgColor }]}>
              {item.types.includes('restaurant') || item.types.includes('food') ? 'Restaurant'
                : item.types.includes('cafe') ? 'Cafe'
                : item.types.includes('bar') || item.types.includes('night_club') ? 'Nightlife'
                : item.types.includes('spa') ? 'Spa & Wellness'
                : item.types.includes('tourist_attraction') ? 'Must Visit'
                : item.types.includes('natural_feature') ? 'Beach & Nature'
                : item.types.includes('shopping_mall') || item.types.includes('store') ? 'Shopping'
                : item.types.includes('convenience_store') || item.types.includes('pharmacy') ? 'Essentials'
                : 'Boracay'}
            </Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardRating}>
            {'★ '}{ratingParts.join(' · ')}
          </Text>
          <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
          {item.lat != null && item.lng != null && (() => {
            const dist = distanceFromHotel(item.lat, item.lng);
            return (
              <View style={styles.distanceRow}>
                <Text style={styles.distanceText}>
                  📍 {formatDistance(dist)} from Canyon
                </Text>
                <Text style={styles.walkTimeText}> · {estimateWalkTime(dist)}</Text>
              </View>
            );
          })()}
          {item.open_now != null && (
            <View style={styles.badgeRow}>
              <View style={[styles.badge, item.open_now ? styles.badgeOpen : styles.badgeClosed]}>
                <Text style={[styles.badgeText, item.open_now ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                  {item.open_now ? 'Open now' : 'Closed'}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.actionBtn, styles.saveBtn]}
              onPress={() => onRecommendToGroup(item)}
              disabled={isSaving}
              accessibilityLabel={isSaving ? 'Recommending...' : 'Recommend to group'}
              accessibilityRole="button"
            >
              <Bookmark size={14} color={colors.white} />
              <Text style={styles.actionBtnText}>{isSaving ? 'Recommending...' : 'Recommend'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.directionsBtn]}
              onPress={() => onDirections(item)}
              accessibilityLabel="Get directions"
              accessibilityRole="button"
            >
              <Navigation size={14} color={colors.accentLt} />
              <Text style={styles.directionsBtnText}>Directions</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.sub}>
            {mainTab === 'planner'
              ? 'Plan your perfect trip'
              : isCurated
                ? 'Curated picks for Boracay'
                : `${(discoverView === 'explore' ? filteredExplore : filteredSaved).length} places`}
          </Text>
        </View>

        {/* Main segmented: Trip Planner | Places */}
        <View style={styles.mainSegmented}>
          <Pressable
            style={[styles.mainSegBtn, mainTab === 'planner' && styles.mainSegBtnActive]}
            onPress={() => setMainTab('planner')}
          >
            <Sparkles size={14} color={mainTab === 'planner' ? colors.accentLt : colors.text3} />
            <Text style={[styles.mainSegText, mainTab === 'planner' && styles.mainSegTextActive]}>Trip Planner</Text>
          </Pressable>
          <Pressable
            style={[styles.mainSegBtn, mainTab === 'places' && styles.mainSegBtnActive]}
            onPress={() => setMainTab('places')}
          >
            <Globe2 size={14} color={mainTab === 'places' ? colors.accentLt : colors.text3} />
            <Text style={[styles.mainSegText, mainTab === 'places' && styles.mainSegTextActive]}>Places</Text>
          </Pressable>
        </View>

        {mainTab === 'places' && (
          <>
            {/* Explore / Saved toggle */}
            <View style={styles.viewToggle}>
              <Pressable
                style={[styles.viewToggleBtn, discoverView === 'explore' && styles.viewToggleBtnActive]}
                onPress={() => setDiscoverView('explore')}
              >
                <Globe2 size={16} color={discoverView === 'explore' ? colors.accentLt : colors.text3} />
                <Text style={[styles.viewToggleText, discoverView === 'explore' && styles.viewToggleTextActive]}>Explore</Text>
              </Pressable>
              <Pressable
                style={[styles.viewToggleBtn, discoverView === 'saved' && styles.viewToggleBtnActive]}
                onPress={() => { setDiscoverView('saved'); loadSavedPlaces(); }}
              >
                <BookmarkCheck size={16} color={discoverView === 'saved' ? colors.accentLt : colors.text3} />
                <Text style={[styles.viewToggleText, discoverView === 'saved' && styles.viewToggleTextActive]}>
                  Saved{savedPlaces.length > 0 ? ` (${savedPlaces.length})` : ''}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {mainTab === 'places' && discoverView === 'explore' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {DISCOVER_CATEGORIES.map((cat, i) => (
                <Pressable
                  key={cat.label}
                  style={[styles.pill, i === activeCategory && styles.pillActive]}
                  onPress={() => onCategoryChange(i)}
                >
                  <Text style={[styles.pillText, i === activeCategory && styles.pillTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <FilterBar
              filters={filters}
              onUpdate={updateFilters}
              onOpenMore={() => setMoreOpen(true)}
              collapsed={filtersCollapsed}
              onToggleCollapse={() => setFiltersCollapsed(c => !c)}
            />
          </>
        )}

        {/* Filter bar for saved view */}
        {mainTab === 'places' && discoverView === 'saved' && (
          <FilterBar
            filters={filters}
            onUpdate={updateFilters}
            onOpenMore={() => setMoreOpen(true)}
            collapsed={filtersCollapsed}
            onToggleCollapse={() => setFiltersCollapsed(c => !c)}
          />
        )}

        {/* List / Map toggle — only in Explore */}
        {mainTab === 'places' && discoverView === 'explore' && (
          <View style={styles.listMapToggle}>
            <Pressable
              style={[styles.listMapBtn, viewMode === 'list' && styles.listMapBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={14} color={viewMode === 'list' ? colors.accentLt : colors.text3} />
              <Text style={[styles.listMapText, viewMode === 'list' && styles.listMapTextActive]}>List</Text>
            </Pressable>
            <Pressable
              style={[styles.listMapBtn, viewMode === 'map' && styles.listMapBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Map size={14} color={viewMode === 'map' ? colors.accentLt : colors.text3} />
              <Text style={[styles.listMapText, viewMode === 'map' && styles.listMapTextActive]}>Map</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      {mainTab === 'planner' ? (
        <ScrollView contentContainerStyle={styles.plannerContent}>
          {/* AI prompt input */}
          <View style={styles.plannerPrompt}>
            <Sparkles size={18} color={colors.accent} />
            <Text style={styles.plannerPromptText}>
              What do you want to do in Boracay?
            </Text>
          </View>

          {/* Popular chips */}
          <Text style={styles.plannerSectionLabel}>Popular first visit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TRIP_PLANNER_CHIPS.map((chip) => (
              <Pressable
                key={chip.label}
                style={styles.chip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/trip-planner' as any);
                }}
              >
                <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Itinerary styles */}
          <Text style={styles.plannerSectionLabel}>Choose your style</Text>
          <View style={styles.styleList}>
            {ITINERARY_STYLES.map((style) => (
              <Pressable
                key={style.id}
                style={[styles.styleCard, selectedStyle === style.id && styles.styleCardActive]}
                onPress={() => setSelectedStyle(style.id)}
              >
                <View style={styles.styleRadio}>
                  {selectedStyle === style.id && <View style={styles.styleRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.styleLabel, selectedStyle === style.id && styles.styleLabelActive]}>
                    {style.label}
                  </Text>
                  <Text style={styles.styleDesc}>{style.desc}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Generate button */}
          <Pressable
            style={styles.generateBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/trip-planner' as any);
            }}
          >
            <Sparkles size={16} color={colors.white} />
            <Text style={styles.generateBtnText}>Generate Itinerary</Text>
          </Pressable>
        </ScrollView>
      ) : discoverView === 'saved' ? (
        savedLoading ? (
          <AfterStayLoader message="Loading saved places..." />
        ) : savedPlaces.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Bookmark color={colors.text3} size={40} />
            <Text style={{ color: colors.text2, marginTop: 12, textAlign: 'center', fontSize: 14 }}>
              No saved places yet.{'\n'}Tap Save to Trip on any place to bookmark it.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Vote filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
              {([
                { key: 'all', label: 'All', color: colors.accent },
                { key: 'approved', label: '👍 Approved', color: colors.green },
                { key: 'pending', label: '⏳ Pending', color: colors.amber },
                { key: 'rejected', label: '👎 Rejected', color: colors.red },
              ] as const).map(chip => (
                <Pressable
                  key={chip.key}
                  onPress={() => { setVoteFilter(chip.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[
                    styles.pill,
                    voteFilter === chip.key && { backgroundColor: chip.color + '22', borderColor: chip.color },
                  ]}
                >
                  <Text style={[
                    styles.pillText,
                    voteFilter === chip.key && { color: chip.color },
                  ]}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <FlatList
              data={filteredSaved}
              keyExtractor={p => p.id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              renderItem={({ item }) => (
                <PlaceCard
                  place={{
                    ...item,
                    distance: item.latitude && item.longitude
                      ? formatDistance(distanceFromHotel(item.latitude, item.longitude))
                      : item.distance,
                  }}
                  onVote={(vote) => onVoteSaved(item.id, vote)}
                  onSave={() => onUnsaveSaved(item)}
                  saved={true}
                  busy={votingIds.has(item.id)}
                  photoUri={item.photoUrl}
                  googleMapsUri={item.googleMapsUri}
                  totalRatings={item.totalRatings}
                />
              )}
              refreshControl={
                <RefreshControl
                  refreshing={savedLoading}
                  onRefresh={loadSavedPlaces}
                  tintColor={colors.accentLt}
                />
              }
            />
          </View>
        )
      ) : loading ? (
        <AfterStayLoader message="Finding places nearby..." />
      ) : viewMode === 'map' ? (
        <MapView
          style={styles.mapView}
          initialRegion={{
            latitude: HOTEL_LAT,
            longitude: HOTEL_LNG,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          {places
            .filter(p => p.lat !== 0 && p.lng !== 0)
            .map(p => (
              <Marker
                key={p.place_id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={p.name}
                description={p.address}
                onCalloutPress={() => onCardPress(p)}
              />
            ))}
        </MapView>
      ) : (
        <FlatList
          data={filteredExplore}
          keyExtractor={p => p.place_id}
          renderItem={renderCard}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPlaces(activeCategory); }}
              tintColor={colors.accentLt}
            />
          }
        />
      )}

      {mainTab === 'places' && discoverView === 'explore' && (
        <Pressable
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({ pathname: '/add-place' as any });
          }}
          accessibilityLabel="Add a place"
          accessibilityRole="button"
        >
          <Plus size={24} color={colors.white} />
        </Pressable>
      )}

      {detailPlace && (
        <PlaceDetailSheet
          visible={!!detailPlace}
          placeId={detailPlace.place_id}
          initialName={detailPlace.name}
          onClose={() => setDetailPlace(null)}
          distanceKm={detailPlace.lat && detailPlace.lng ? distanceFromHotel(detailPlace.lat, detailPlace.lng) : undefined}
        />
      )}

      <FilterMoreSheet
        visible={moreOpen}
        filters={filters}
        onUpdate={updateFilters}
        onReset={resetFilters}
        onClose={() => setMoreOpen(false)}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.text2, fontSize: 13, marginTop: 2, marginBottom: spacing.md },
  mainSegmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: 3,
  },
  mainSegBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  mainSegBtnActive: {
    backgroundColor: colors.card,
  },
  mainSegText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '600',
  },
  mainSegTextActive: {
    color: colors.accentLt,
  },
  pillRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  pillText: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.white,
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: 2,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.card,
  },
  viewToggleText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: colors.accentLt,
  },
  listMapToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg3,
    borderRadius: radius.sm,
    padding: 2,
  },
  listMapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 4,
  },
  listMapBtnActive: { backgroundColor: colors.card },
  listMapText: { color: colors.text3, fontSize: 12, fontWeight: '600' },
  listMapTextActive: { color: colors.accentLt },
  mapView: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 100 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  // Card styles
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: {
    width: '100%',
    height: 180,
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  placeholderLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: spacing.md,
    gap: 4,
  },
  cardName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardRating: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '500',
  },
  cardAddress: {
    color: colors.text2,
    fontSize: 12,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  distanceText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  walkTimeText: { color: colors.text2, fontSize: 11 },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeOpen: {
    backgroundColor: colors.accentDim,
  },
  badgeClosed: {
    backgroundColor: 'rgba(196,85,74,0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextOpen: {
    color: colors.accentLt,
  },
  badgeTextClosed: {
    color: colors.red,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  saveBtn: {
    backgroundColor: colors.green,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  directionsBtn: {
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  directionsBtnText: {
    color: colors.accentLt,
    fontSize: 13,
    fontWeight: '700',
  },
  // Trip Planner styles
  plannerContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  plannerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  plannerPromptText: {
    color: colors.text2,
    fontSize: 14,
    flex: 1,
  },
  plannerSectionLabel: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  styleList: { gap: spacing.sm },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  styleCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  styleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.text3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  styleLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  styleLabelActive: { color: colors.accent },
  styleDesc: { color: colors.text3, fontSize: 12, marginTop: 1 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  generateBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
