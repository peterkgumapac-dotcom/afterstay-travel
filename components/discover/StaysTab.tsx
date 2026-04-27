/**
 * StaysTab — Accommodation discovery for the Discover screen.
 * Lets users browse hotels, resorts, hostels, villas, and boutique stays
 * near their trip destination or any destination they search for.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bed, MapPin, Search, X } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { distanceFromPoint } from '@/lib/distance';
import { searchNearby, placeAutocomplete, getPlaceLocation } from '@/lib/google-places';
import type { GroupMember, Place, PlaceVote } from '@/lib/types';
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
  tripId: string | null;
  tripDest: string;
  travelMode: 'walk' | 'car';
  tripMembers: GroupMember[];
  memberNames: Record<string, string>;
  savedPlaces: Place[];
  onSave: (name: string) => void;
  onExplore: (placeId: string | undefined, name: string) => void;
}

// ── Component ────────────────────────────────────────────────────────

export default function StaysTab({
  tripCoords,
  tripId,
  tripDest,
  travelMode,
  tripMembers,
  memberNames,
  savedPlaces,
  onSave,
  onExplore,
}: StaysTabProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  // Search state
  const [chip, setChip] = useState<StayChip>('All');
  const [stays, setStays] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Record<string, DiscoverPlace[]>>({});

  // Destination search (when no trip coords)
  const [destQuery, setDestQuery] = useState('');
  const [destSuggestions, setDestSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchLabel, setSearchLabel] = useState('');
  const destTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter state
  const [minRating, setMinRating] = useState(0);

  const effectiveCoords = tripCoords ?? searchCoords;
  const savedSet = useMemo(
    () => new Set(savedPlaces.map((p) => p.name.toLowerCase())),
    [savedPlaces],
  );

  // ── Search function ──────────────────────────────────────────────

  const searchStays = useCallback(async (c: StayChip, coords: { lat: number; lng: number } | null) => {
    if (!coords) {
      setStays([]);
      return;
    }
    const { type, keyword } = STAY_SEARCH[c];
    const cacheKey = `${c}_${coords.lat}_${coords.lng}`;

    if (cache.current[cacheKey]) {
      setStays(cache.current[cacheKey]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await searchNearby(type, keyword, coords, 5000);
      if (results.length > 0) {
        const mapped = results.map((p) => mapNearbyToDiscoverPlace(p, coords));
        cache.current[cacheKey] = mapped;
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

  // ── Destination autocomplete ─────────────────────────────────────

  const handleDestInput = useCallback((text: string) => {
    setDestQuery(text);
    if (destTimer.current) clearTimeout(destTimer.current);
    if (!text.trim()) {
      setDestSuggestions([]);
      return;
    }
    destTimer.current = setTimeout(async () => {
      try {
        const results = await placeAutocomplete(text);
        setDestSuggestions(results.slice(0, 5));
      } catch {
        setDestSuggestions([]);
      }
    }, 400);
  }, []);

  const selectDestination = useCallback(async (placeId: string, label: string) => {
    setDestSuggestions([]);
    setDestQuery(label.split(',')[0]);
    setSearchLabel(label.split(',')[0]);
    try {
      const loc = await getPlaceLocation(placeId);
      if (loc) {
        setSearchCoords({ lat: loc.lat, lng: loc.lng });
      }
    } catch {
      setError('Could not find that destination. Try another search.');
    }
  }, []);

  const clearDestination = useCallback(() => {
    setDestQuery('');
    setSearchCoords(null);
    setSearchLabel('');
    setStays([]);
    cache.current = {};
  }, []);

  // ── Filtered results ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (minRating === 0) return stays;
    return stays.filter((s) => s.r >= minRating);
  }, [stays, minRating]);

  // ── Distance helper ──────────────────────────────────────────────

  const getDistKm = useCallback((lat?: number, lng?: number) => {
    if (lat == null || lng == null || !effectiveCoords) return 0;
    return distanceFromPoint(effectiveCoords.lat, effectiveCoords.lng, lat, lng);
  }, [effectiveCoords]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Destination search — only when no trip coords */}
      {!tripCoords && (
        <View style={s.destSection}>
          <View style={s.destInputRow}>
            <Search size={16} color={colors.text3} />
            <TextInput
              style={s.destInput}
              value={destQuery}
              onChangeText={handleDestInput}
              placeholder="Where do you want to stay?"
              placeholderTextColor={colors.text3}
            />
            {destQuery.length > 0 && (
              <Pressable onPress={clearDestination} hitSlop={8}>
                <X size={16} color={colors.text3} />
              </Pressable>
            )}
          </View>
          {destSuggestions.length > 0 && (
            <View style={s.suggestions}>
              {destSuggestions.map((sg) => (
                <Pressable
                  key={sg.placeId}
                  style={s.suggestionItem}
                  onPress={() => selectDestination(sg.placeId, sg.description)}
                >
                  <MapPin size={14} color={colors.accent} />
                  <Text style={s.suggestionText} numberOfLines={1}>{sg.description}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {searchLabel ? (
            <Text style={s.searchingLabel}>Showing stays near {searchLabel}</Text>
          ) : null}
        </View>
      )}

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

      {/* Loading */}
      {loading && (
        <View style={s.centered}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={s.loadingText}>Searching accommodations...</Text>
        </View>
      )}

      {/* Empty: no coords */}
      {!effectiveCoords && !loading && (
        <View style={s.emptyState}>
          <Bed size={40} color={colors.text3} strokeWidth={1.2} />
          <Text style={s.emptyTitle}>Where do you want to stay?</Text>
          <Text style={s.emptySub}>
            {tripCoords
              ? 'Search for accommodations near your trip.'
              : 'Search a destination above to discover hotels, resorts, and more.'}
          </Text>
        </View>
      )}

      {/* Empty: no results */}
      {effectiveCoords && !loading && filtered.length === 0 && (
        <View style={s.emptyState}>
          <Bed size={36} color={colors.text3} strokeWidth={1.2} />
          <Text style={s.emptyTitle}>No stays found</Text>
          <Text style={s.emptySub}>
            {error || 'Try a different category or lower the rating filter.'}
          </Text>
        </View>
      )}

      {/* Results */}
      {filtered.map((stay) => (
        <View key={stay.placeId ?? stay.n} style={s.cardWrap}>
          <DiscoverPlaceCard
            place={stay}
            distanceKm={getDistKm(stay.lat, stay.lng)}
            travelMode={travelMode}
            isSaved={savedSet.has(stay.n.toLowerCase())}
            isRecommended={false}
            onSave={onSave}
            onRecommend={() => {}}
            onExplore={onExplore}
            showRecommend={tripMembers.length >= 2}
            voteByMember={{}}
            memberNames={memberNames}
          />
        </View>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 16 },

    // Destination search
    destSection: { marginBottom: 12 },
    destInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    destInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
    },
    suggestions: {
      marginTop: 4,
      backgroundColor: colors.card,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestionText: { flex: 1, fontSize: 13, color: colors.text },
    searchingLabel: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: '600',
      marginTop: 8,
      letterSpacing: 0.3,
    },

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
