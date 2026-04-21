import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Info, Navigation, Search, X } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
import { spacing, radius } from '@/constants/theme';
import { CONFIG } from '@/lib/config';
import { placeAutocomplete, searchPlace } from '@/lib/google-places';
import { fmtKm, travelTime } from '@/lib/utils';
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
  const { setVisible: setTabBarVisible } = useTabBarVisibility();

  // Hide tab bar when map opens, restore on close
  useEffect(() => {
    if (visible) setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [visible, setTabBarVisible]);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ placeId: string; description: string }[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<{ placeId: string; name: string; distanceKm: number } | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<{ placeId: string; name: string; lat: number; lng: number; distanceKm: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!visible || !MapView) return null;

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
    const name = result.description.split(',')[0];
    setSearchQuery(name);
    setSearchResults([]);
    const details = await searchPlace(result.description);
    if (details && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: details.lat,
        longitude: details.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
      const km = getDistanceKm(details.lat, details.lng);
      setSearchedPlace({ placeId: result.placeId, name, lat: details.lat, lng: details.lng, distanceKm: km });
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
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        onMapReady={() => {
          mapRef.current?.animateToRegion({
            latitude: userLocation?.lat ?? CONFIG.HOTEL_COORDS.lat,
            longitude: userLocation?.lng ?? CONFIG.HOTEL_COORDS.lng,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }, 300);
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
      >
        {/* Hotel pin only */}
        <Marker
          coordinate={{ latitude: CONFIG.HOTEL_COORDS.lat, longitude: CONFIG.HOTEL_COORDS.lng }}
          title="Your Hotel"
          pinColor={colors.accent}
        />
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

      {/* ── Action card (Navigate vs Details) ── */}
      {searchedPlace && !selectedPlace && (
        <View style={styles.actionCard}>
          <View style={styles.actionCardHeader}>
            <Text style={styles.actionCardName} numberOfLines={1}>{searchedPlace.name}</Text>
            <TouchableOpacity onPress={() => setSearchedPlace(null)} hitSlop={8}>
              <X size={18} color={colors.text3} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.actionCardDist}>
            {travelTime(searchedPlace.distanceKm, travelMode)} · {fmtKm(searchedPlace.distanceKm)}
          </Text>
          <View style={styles.actionCardBtns}>
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => {
                const mode = travelMode === 'walk' ? 'walking' : 'driving';
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${searchedPlace.lat},${searchedPlace.lng}&travelmode=${mode}`
                );
              }}
              activeOpacity={0.7}
            >
              <Navigation size={16} color={colors.ink} strokeWidth={2} />
              <Text style={styles.navigateBtnText}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => {
                setSelectedPlace({ placeId: searchedPlace.placeId, name: searchedPlace.name, distanceKm: searchedPlace.distanceKm });
                setSearchedPlace(null);
              }}
              activeOpacity={0.7}
            >
              <Info size={16} color={colors.accent} strokeWidth={2} />
              <Text style={styles.detailsBtnText}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
    // Action card
    actionCard: {
      position: 'absolute',
      bottom: 32,
      left: 16,
      right: 16,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      zIndex: 101,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    actionCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionCardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    actionCardDist: {
      fontSize: 13,
      color: colors.text2,
      marginTop: 4,
      marginBottom: spacing.md,
    },
    actionCardBtns: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    navigateBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 12,
    },
    navigateBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
    },
    detailsBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.bg3,
      borderRadius: radius.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailsBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
  });
