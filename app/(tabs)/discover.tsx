import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { List, Map, Plus, Bookmark, Navigation, Sparkles } from 'lucide-react-native';
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
import { colors, radius, spacing } from '@/constants/theme';
import { distanceFromHotel, formatDistance, estimateWalkTime } from '@/lib/distance';
import { searchNearby, searchPlace, HOTEL_LAT, HOTEL_LNG, type NearbyPlace } from '@/lib/google-places';
import { addPlace } from '@/lib/notion';

const DISCOVER_CATEGORIES = [
  { label: 'All', type: '', keyword: 'boracay' },
  { label: 'Restaurants', type: 'restaurant', keyword: 'boracay' },
  { label: 'Coffee', type: 'cafe', keyword: 'coffee boracay' },
  { label: 'Bars', type: 'bar', keyword: 'boracay' },
  { label: 'Beach', type: '', keyword: 'beach boracay' },
  { label: 'Activities', type: 'tourist_attraction', keyword: 'boracay' },
  { label: 'Spa', type: 'spa', keyword: 'boracay' },
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
};

const CATEGORY_GRADIENT: Record<string, string> = {
  natural_feature: '#0ea5e9',
  tourist_attraction: '#f59e0b',
  restaurant: '#ef4444',
  food: '#ef4444',
  cafe: '#92400e',
  bar: '#8b5cf6',
  night_club: '#8b5cf6',
  spa: '#14b8a6',
  shopping_mall: '#ec4899',
  store: '#ec4899',
  convenience_store: '#6366f1',
  pharmacy: '#22c55e',
};

function getPlaceEmoji(types: string[]): string {
  for (const t of types) {
    if (CATEGORY_EMOJI[t]) return CATEGORY_EMOJI[t];
  }
  return '\u{1F4CD}';
}

function getPlaceColor(types: string[]): string {
  for (const t of types) {
    if (CATEGORY_GRADIENT[t]) return CATEGORY_GRADIENT[t];
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

export default function DiscoverScreen() {
  const router = useRouter();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [activeCategory, setActiveCategory] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCurated, setIsCurated] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
      const type = cat.type || undefined;
      const keyword = cat.keyword || undefined;
      const results = await searchNearby(type, keyword);
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
        // Enrich with real photos in background
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

  const onSaveToTrip = async (place: NearbyPlace) => {
    if (savingIds.has(place.place_id)) return;
    setSavingIds(prev => new Set([...prev, place.place_id]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const mapsUri = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
      await addPlace({
        name: place.name,
        category: mapGoogleTypeToCategory(place.types),
        rating: place.rating,
        source: 'Manual',
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
    } catch {
      // Save failed — user can retry
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(place.place_id);
        return next;
      });
    }
  };

  const onDirections = (place: NearbyPlace) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${HOTEL_LAT},${HOTEL_LNG}&destination=${place.lat},${place.lng}&destination_place_id=${place.place_id}`;
    Linking.openURL(url);
  };

  const onCardPress = (place: NearbyPlace) => {
    router.push({ pathname: '/place-details', params: { placeId: place.place_id, placeName: place.name } } as any);
  };

  const renderCard = ({ item }: { item: NearbyPlace }) => {
    const isSaving = savingIds.has(item.place_id);
    const priceStr = priceLevelString(item.price_level);
    const ratingParts = [`${item.rating.toFixed(1)}`];
    if (item.total_ratings > 0) ratingParts.push(`${item.total_ratings.toLocaleString()} reviews`);
    if (priceStr) ratingParts.push(priceStr);

    const emoji = getPlaceEmoji(item.types);
    const bgColor = getPlaceColor(item.types);

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
              onPress={() => onSaveToTrip(item)}
              disabled={isSaving}
              accessibilityLabel={isSaving ? 'Saving place' : 'Save to trip'}
              accessibilityRole="button"
            >
              <Bookmark size={14} color={colors.white} />
              <Text style={styles.actionBtnText}>{isSaving ? 'Saving...' : 'Save to Trip'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.directionsBtn]}
              onPress={() => onDirections(item)}
              accessibilityLabel="Get directions"
              accessibilityRole="button"
            >
              <Navigation size={14} color={colors.green2} />
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
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Discover</Text>
              <Text style={styles.sub}>
                {isCurated
                  ? 'Curated picks for Boracay'
                  : `${places.length} places nearby`}
              </Text>
            </View>
            <Pressable
              style={styles.suggestHeaderBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/trip-planner' as any);
              }}
              accessibilityLabel="Get personalized suggestions"
              accessibilityRole="button"
            >
              <Sparkles size={16} color={colors.white} />
              <Text style={styles.suggestHeaderBtnText}>For You</Text>
            </Pressable>
          </View>
        </View>

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

        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('list')}
            accessibilityLabel="Switch to list view"
            accessibilityRole="button"
          >
            <List size={16} color={viewMode === 'list' ? colors.green2 : colors.text3} />
            <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>List</Text>
          </Pressable>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('map')}
            accessibilityLabel="Switch to map view"
            accessibilityRole="button"
          >
            <Map size={16} color={viewMode === 'map' ? colors.green2 : colors.text3} />
            <Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>Map</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {loading ? (
        <AfterStayLoader message="Finding places nearby..." />
      ) : viewMode === 'map' ? (
        <MapView
          provider="google"
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
          data={places}
          keyExtractor={p => p.place_id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPlaces(activeCategory); }}
              tintColor={colors.green2}
            />
          }
        />
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.text2, fontSize: 13, marginTop: 2, marginBottom: spacing.md },
  suggestHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.purple,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  suggestHeaderBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
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
    color: colors.green2,
  },
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
  distanceText: { color: '#2dd4a0', fontSize: 12, fontWeight: '600' },
  walkTimeText: { color: '#8b95a5', fontSize: 11 },
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
    backgroundColor: 'rgba(29,158,117,0.15)',
  },
  badgeClosed: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextOpen: {
    color: colors.green2,
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
    color: colors.green2,
    fontSize: 13,
    fontWeight: '700',
  },
});
