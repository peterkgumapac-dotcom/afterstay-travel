import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import {
  Bookmark,
  BookmarkCheck,
  Filter,
  Search,
  X,
} from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { CONFIG } from '@/lib/config';
import { placeAutocomplete, searchPlace } from '@/lib/google-places';
import { fmtKm, travelTime } from '@/lib/utils';
import DistanceToggle from './DistanceToggle';
import PlaceDetailSheet from './PlaceDetailSheet';
import type { DiscoverPlace } from './DiscoverPlaceCard';

// Dynamic require — must be AFTER all imports
let MapView: any = null;
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  // Not available (Expo Go / web)
}

export const MAP_AVAILABLE = MapView !== null;

// ── Constants ────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Restaurant: '#c66a36', Cafe: '#8a5a2b', Bar: '#b66a8a',
  Beach: '#5a8fb5', Spa: '#7ba88a', Shopping: '#a64d1e',
  Attraction: '#d9a441', Landmark: '#857d70', Nature: '#7e9f5b',
  Wellness: '#7ba88a', Hotel: '#c49460', Culture: '#8b6f5a',
  Park: '#7e9f5b', Place: '#857d70',
};

const MAP_CATEGORIES = ['All', 'Coffee', 'Food', 'Beach', 'Bar', 'Shopping', 'Spa', 'Activity'];

// ── Props ────────────────────────────────────────────────────────────────

interface ExploreMapProps {
  visible: boolean;
  places: readonly DiscoverPlace[];
  savedNames: Set<string>;
  recommendedNames: Set<string>;
  travelMode: 'walk' | 'car';
  distanceOrigin: 'hotel' | 'me';
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onTravelModeChange: (m: 'walk' | 'car') => void;
  onAnchorChange: (a: 'hotel' | 'me') => void;
  onSaveToggle: (name: string) => void;
  getDistanceKm: (lat?: number, lng?: number) => number;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ── Component ────────────────────────────────────────────────────────────

function ExploreMap({
  visible,
  places,
  savedNames,
  recommendedNames,
  travelMode,
  distanceOrigin,
  userLocation,
  onClose,
  onTravelModeChange,
  onAnchorChange,
  onSaveToggle,
  getDistanceKm,
}: ExploreMapProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const mapRef = useRef<any>(null);

  // Local state
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ placeId: string; description: string }[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<{ placeId: string; name: string; distanceKm: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!visible || !MapView) return null;

  // Filter places
  const isFiltered = categoryFilter && categoryFilter !== 'All';
  const visiblePlaces = places.filter((p) => {
    if (!p.lat || !p.lng) return false;
    if (showSavedOnly && !savedNames.has(p.n)) return false;
    if (isFiltered && !p.t.toLowerCase().includes(categoryFilter!.toLowerCase())) return false;
    return true;
  });

  // Handlers
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await placeAutocomplete(text);
      setSearchResults(results.slice(0, 5));
    }, 300);
  };

  const handleSearchResultTap = async (result: { placeId: string; description: string }) => {
    setSearchQuery(result.description.split(',')[0]);
    setSearchResults([]);
    const details = await searchPlace(result.description);
    if (details && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: details.lat,
        longitude: details.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 500);
    }
  };

  const handlePinPress = (p: DiscoverPlace) => {
    const km = getDistanceKm(p.lat, p.lng);
    setSelectedPlace({
      placeId: p.placeId ?? '',
      name: p.n,
      distanceKm: km,
    });
  };

  const handleClose = () => {
    setCategoryFilter(null);
    setShowDropdown(false);
    setShowSavedOnly(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPlace(null);
    onClose();
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
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
        {/* Place pins */}
        {visiblePlaces.map((p, idx) => {
          const km = getDistanceKm(p.lat, p.lng);
          const timeStr = km > 0 ? travelTime(km, travelMode) : '';
          const distStr = km > 0 ? fmtKm(km) : '';
          const isRecommended = recommendedNames.has(p.n);
          return (
            <Marker
              key={p.placeId ?? `${p.n}-${idx}`}
              coordinate={{ latitude: p.lat!, longitude: p.lng! }}
              title={p.n}
              description={`${p.t} · ${timeStr} · ${distStr}`}
              pinColor={isRecommended ? '#d9a441' : (CATEGORY_COLOR[p.t] ?? colors.text3)}
              onPress={() => handlePinPress(p)}
            />
          );
        })}
      </MapView>

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Search size={16} color={colors.text3} strokeWidth={1.8} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search places..."
          placeholderTextColor={colors.text3}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <X size={16} color={colors.text3} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <View style={styles.searchDropdown}>
          {searchResults.map((r) => (
            <TouchableOpacity
              key={r.placeId}
              style={styles.searchItem}
              onPress={() => handleSearchResultTap(r)}
            >
              <Text style={styles.searchItemText} numberOfLines={1}>{r.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Close button ── */}
      <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
        <X size={22} color={colors.text} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Top row: badge + filter + saved ── */}
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{visiblePlaces.length} places</Text>
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowDropdown((s) => !s)}
          activeOpacity={0.7}
        >
          <Filter size={14} color={categoryFilter ? colors.accent : colors.text} strokeWidth={2} />
          <Text style={[styles.filterBtnText, categoryFilter && { color: colors.accent }]}>
            {categoryFilter ?? 'Filter'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.savedBtn, showSavedOnly && styles.savedBtnActive]}
          onPress={() => {
            setShowSavedOnly((s) => !s);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}
        >
          {showSavedOnly
            ? <BookmarkCheck size={16} color={colors.accent} strokeWidth={2} />
            : <Bookmark size={16} color={colors.text2} strokeWidth={2} />
          }
        </TouchableOpacity>
      </View>

      {/* ── Category dropdown ── */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {MAP_CATEGORIES.map((c) => {
            const active = (categoryFilter ?? 'All') === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  setCategoryFilter(c === 'All' ? null : c);
                  setShowDropdown(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>{c}</Text>
                {active && <View style={styles.dropdownDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Distance toggle (bottom) ── */}
      <View style={styles.bottomToggle}>
        <DistanceToggle
          anchor={distanceOrigin === 'me' ? 'me' : 'hotel'}
          travelMode={travelMode}
          onAnchorChange={onAnchorChange}
          onTravelModeChange={onTravelModeChange}
        />
      </View>

      {/* ── Place detail sheet ── */}
      <PlaceDetailSheet
        visible={selectedPlace !== null}
        placeId={selectedPlace?.placeId ?? null}
        initialName={selectedPlace?.name}
        saved={selectedPlace ? savedNames.has(selectedPlace.name) : false}
        distanceKm={selectedPlace?.distanceKm}
        travelMode={travelMode}
        onClose={() => setSelectedPlace(null)}
        onSaveToggle={selectedPlace ? () => onSaveToggle(selectedPlace.name) : undefined}
      />
    </View>
  );
}

export default React.memo(ExploreMap);

// ── Styles ───────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      backgroundColor: colors.bg,
    },
    // Search
    searchBar: {
      position: 'absolute',
      top: 52,
      left: 16,
      right: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      zIndex: 102,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
    },
    searchDropdown: {
      position: 'absolute',
      top: 98,
      left: 16,
      right: 56,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 103,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    searchItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchItemText: {
      fontSize: 13,
      color: colors.text,
    },
    // Close
    closeBtn: {
      position: 'absolute',
      top: 52,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 102,
    },
    // Top row
    topRow: {
      position: 'absolute',
      top: 100,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      zIndex: 101,
    },
    badge: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    savedBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },
    // Dropdown
    dropdown: {
      position: 'absolute',
      top: 144,
      left: 16,
      width: 180,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
      zIndex: 102,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      paddingHorizontal: 16,
    },
    dropdownItemActive: {
      backgroundColor: colors.accentBg,
    },
    dropdownText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    dropdownTextActive: {
      fontWeight: '700',
      color: colors.accent,
    },
    dropdownDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    // Bottom toggle
    bottomToggle: {
      position: 'absolute',
      bottom: 32,
      left: 16,
      right: 16,
      zIndex: 101,
    },
  });
