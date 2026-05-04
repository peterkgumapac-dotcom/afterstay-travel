/**
 * StaysTab — Accommodation discovery for the Discover screen.
 * Lets users browse hotels, resorts, hostels, villas, and boutique stays
 * near their trip destination or any destination they search for.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Bed, MapPin } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { distanceFromPoint } from '@/lib/distance';
import { searchNearby } from '@/lib/google-places';
import type { GroupMember, Place } from '@/lib/types';
import { DiscoverPlaceCard, type DiscoverPlace } from './DiscoverPlaceCard';
import { mapNearbyToDiscoverPlace } from './shared';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ── Category chip configuration ──────────────────────────────────────

type StayChip = 'All' | 'Hotels' | 'Resorts' | 'Hostels' | 'Villas' | 'Boutique';

const STAY_CHIPS: readonly StayChip[] = ['All', 'Hotels', 'Resorts', 'Hostels', 'Villas', 'Boutique'];

const STAY_SEARCH: Record<StayChip, { type: string; keyword: string }> = {
  All:      { type: 'lodging', keyword: '' },
  Hotels:   { type: 'lodging', keyword: 'hotel' },
  Resorts:  { type: 'lodging', keyword: 'resort' },
  Hostels:  { type: 'lodging', keyword: 'hostel backpacker' },
  Villas:   { type: 'lodging', keyword: 'villa private rental' },
  Boutique: { type: 'lodging', keyword: 'boutique hotel' },
};

// ── Props ────────────────────────────────────────────────────────────

interface StaysTabProps {
  tripCoords: { lat: number; lng: number } | null;
  originCoords?: { lat: number; lng: number } | null;
  originLabel?: string;
  originKind?: 'trip' | 'selected_place' | 'searched_destination' | 'current_location' | 'none';
  tripId: string | null;
  tripDest: string;
  travelMode: 'walk' | 'car';
  tripMembers: GroupMember[];
  memberNames: Record<string, string>;
  savedPlaces: Place[];
  savedNames?: Set<string>;
  onSavePlace: (place: DiscoverPlace) => void;
  onExplore: (placeId: string | undefined, name: string) => void;
}

// ── Component ────────────────────────────────────────────────────────

export default function StaysTab({
  tripCoords,
  originCoords,
  originLabel,
  tripId,
  tripDest,
  travelMode,
  tripMembers,
  memberNames,
  savedPlaces,
  savedNames,
  onSavePlace,
  onExplore,
}: StaysTabProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  // Search state
  const [chip, setChip] = useState<StayChip>('All');
  const [stays, setStays] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, DiscoverPlace[]>>(new Map());

  // Filter state
  const [minRating, setMinRating] = useState(0);

  const effectiveCoords = tripCoords ?? originCoords ?? null;
  const effectiveLabel = tripDest || originLabel || 'selected location';
  const savedSet = useMemo(
    () => savedNames ?? new Set(savedPlaces.map((p) => p.name)),
    [savedNames, savedPlaces],
  );

  // ── Search function ──────────────────────────────────────────────

  const searchStays = useCallback(async (c: StayChip, coords: { lat: number; lng: number } | null) => {
    if (!coords) {
      setStays([]);
      return;
    }
    const { type, keyword } = STAY_SEARCH[c];
    const cacheKey = `${c}_${coords.lat}_${coords.lng}`;

    if (cache.current.has(cacheKey)) {
      setStays(cache.current.get(cacheKey)!);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { places: results } = await searchNearby(type, keyword, coords, 5000);
      if (results.length > 0) {
        const mapped = results.map((p) => mapNearbyToDiscoverPlace(p, coords));
        if (cache.current.size >= 20) {
          const first = cache.current.keys().next().value;
          if (first) cache.current.delete(first);
        }
        cache.current.set(cacheKey, mapped);
        setStays(mapped);
      } else {
        setStays([]);
        setError('No accommodations found nearby. Try a different destination or category.');
      }
    } catch {
      setStays([]);
      setError('Could not load accommodations.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search on chip change or coords change
  useEffect(() => {
    searchStays(chip, effectiveCoords);
  }, [chip, effectiveCoords, searchStays]);

  // ── Filtered results ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (minRating === 0) return stays;
    return stays.filter((s) => s.r >= minRating);
  }, [stays, minRating]);

  // ── Distance helper ──────────────────────────────────────────────

  // Pre-compute distances so we don't run haversine on every render
  const distMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!effectiveCoords) return map;
    for (const stay of filtered) {
      if (stay.lat != null && stay.lng != null) {
        map[stay.placeId ?? stay.n] = distanceFromPoint(
          effectiveCoords.lat,
          effectiveCoords.lng,
          stay.lat,
          stay.lng,
        );
      }
    }
    return map;
  }, [filtered, effectiveCoords]);

  // ── Render ───────────────────────────────────────────────────────

  const renderStayItem = useCallback(({ item }: { item: DiscoverPlace }) => (
    <View style={s.cardWrap}>
      <DiscoverPlaceCard
        place={item}
        distanceKm={distMap[item.placeId ?? item.n] ?? 0}
        travelMode={travelMode}
        isSaved={savedSet.has(item.n)}
        isRecommended={false}
        onSave={() => onSavePlace(item)}
        onRecommend={() => {}}
        saveActionLabel={tripId ? 'Save to trip' : 'Save for later'}
        savedActionLabel={tripId ? 'Saved to trip' : 'Saved for later'}
        onExplore={onExplore}
        showRecommend={tripMembers.length >= 2}
        voteByMember={{}}
        memberNames={memberNames}
      />
    </View>
  ), [distMap, travelMode, savedSet, onSavePlace, onExplore, tripMembers.length, memberNames, s.cardWrap, tripId]);

  const ListHeader = useMemo(() => (
    <>
      <View style={s.originSummary}>
        <MapPin size={15} color={colors.accent} strokeWidth={2} />
        <Text style={s.originSummaryText} numberOfLines={1}>
          Accommodations near {effectiveLabel}
        </Text>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
        style={s.chipScroll}
      >
        {STAY_CHIPS.map((c) => {
          const active = chip === c;
          return (
            <Pressable
              key={c}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setChip(c)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Rating filter */}
      <View style={s.filterRow}>
        <Text style={s.filterLabel}>Min rating</Text>
        {[0, 4.0, 4.5].map((r) => (
          <Pressable
            key={r}
            style={[s.filterPill, minRating === r && s.filterPillActive]}
            onPress={() => setMinRating(r)}
          >
            <Text style={[s.filterPillText, minRating === r && s.filterPillTextActive]}>
              {r === 0 ? 'Any' : `${r}+`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Results count */}
      {!loading && effectiveCoords && (
        <Text style={s.resultCount}>
          {filtered.length} {filtered.length === 1 ? 'stay' : 'stays'}
        </Text>
      )}

      {!loading && error ? (
        <Text style={s.errorText}>{error}</Text>
      ) : null}

      {/* Loading */}
      {loading && (
        <View style={s.centered}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={s.loadingText}>Searching accommodations...</Text>
        </View>
      )}
    </>
  ), [s, colors.accent, effectiveLabel, chip, minRating, loading, effectiveCoords, filtered.length, error]);

  const ListEmpty = useMemo(() => {
    if (loading || effectiveCoords) return null;
    return (
      <View style={s.emptyState}>
        <Bed size={40} color={colors.text3} strokeWidth={1.2} />
        <Text style={s.emptyTitle}>Set a search origin first</Text>
        <Text style={s.emptySub}>
          Use current location or a precise place in Discover to find accommodations nearby.
        </Text>
      </View>
    );
  }, [loading, effectiveCoords, s, colors.text3]);

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.placeId ?? item.n}
      renderItem={renderStayItem}
      removeClippedSubviews={true}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={5}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={<View style={{ height: 100 }} />}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    />
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 16 },

    originSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 10,
    },
    originSummaryText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.text2 },

    // Chips
    chipScroll: { marginBottom: 10 },
    chipRow: { gap: 8, paddingVertical: 4 },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
    chipTextActive: { color: '#fff' },

    // Filter
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    filterLabel: { fontSize: 12, fontWeight: '600', color: colors.text3, marginRight: 4 },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accent,
    },
    filterPillText: { fontSize: 12, fontWeight: '600', color: colors.text3 },
    filterPillTextActive: { color: colors.accent },

    // Results
    resultCount: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      marginBottom: 10,
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    cardWrap: { marginBottom: 10 },

    // States
    centered: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 10,
    },
    loadingText: { fontSize: 13, color: colors.text3 },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 10,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySub: { fontSize: 13, color: colors.text3, textAlign: 'center', paddingHorizontal: 20 },
  });
