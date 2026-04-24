import React, { useMemo } from 'react';
import { Image, ImageStyle, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Footprints, Car, Plus } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { fmtKm, travelTime as calcTravelTime } from '@/lib/utils';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const CATEGORY_LABELS: Record<string, string> = {
  tourist_attraction: 'Attraction',
  natural_feature: 'Nature',
  point_of_interest: 'Spot',
  establishment: 'Place',
  park: 'Park',
  lodging: 'Hotel',
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  store: 'Shopping',
  shopping_mall: 'Shopping',
};

export function friendlyCategory(t: string): string {
  return CATEGORY_LABELS[t.toLowerCase()] ?? t;
}

export interface DiscoverPlace {
  n: string;
  t: string;
  r: number;
  rv: string;
  d: string;
  dn: number;
  price: number;
  openNow: boolean;
  img: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  totalRatings?: number;
  types?: string[];
}

interface DiscoverPlaceCardProps {
  place: DiscoverPlace;
  distanceKm?: number;
  travelMode?: 'walk' | 'car';
  isSaved: boolean;
  isRecommended: boolean;
  onSave: (name: string) => void;
  onRecommend: (name: string) => void;
  onExplore?: (placeId: string | undefined, name: string) => void;
  onAddToPlanner?: (place: DiscoverPlace) => void;
}

export const DiscoverPlaceCard = React.memo(function DiscoverPlaceCard({
  place,
  distanceKm = 0,
  travelMode = 'walk',
  isSaved,
  onSave,
  onExplore,
  onAddToPlanner,
}: DiscoverPlaceCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Cap absurd distances (emulator GPS in wrong location)
  const validDistance = distanceKm > 0 && distanceKm < 50;
  const travelTimeLabel = useMemo(
    () => validDistance ? calcTravelTime(distanceKm, travelMode) : null,
    [validDistance, distanceKm, travelMode],
  );
  const distanceLabel = useMemo(
    () => validDistance ? fmtKm(distanceKm) : null,
    [validDistance, distanceKm],
  );

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onExplore?.(place.placeId, place.n)}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${place.n}`}
    >
      {/* Thumbnail */}
      <Image
        source={{ uri: place.img }}
        style={styles.thumb}
        resizeMode="cover"
      />

      {/* Info */}
      <View style={styles.info}>
        {/* Category + open/closed */}
        <View style={styles.tagRow}>
          <Text style={styles.category}>{friendlyCategory(place.t).toUpperCase()}</Text>
          {place.openNow ? (
            <View style={styles.openBadge}>
              <Text style={styles.openText}>OPEN</Text>
            </View>
          ) : (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>CLOSED</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>{place.n}</Text>

        {/* Rating · travel time · distance */}
        <View style={styles.metaRow}>
          <Svg width={10} height={10} viewBox="0 0 24 24" fill={colors.warn}>
            <Path d="M12 2l2.9 6.7L22 9.3l-5 4.9 1.2 7.1L12 18l-6.2 3.3L7 14.2 2 9.3l7.1-.6z" />
          </Svg>
          <Text style={styles.rating}>{place.r}</Text>
          {place.rv ? <Text style={styles.meta}>({place.rv})</Text> : null}
          <Text style={styles.dot}>·</Text>
          {travelMode === 'walk'
            ? <Footprints size={10} color={colors.text2} strokeWidth={1.8} />
            : <Car size={10} color={colors.text2} strokeWidth={1.8} />
          }
          <Text style={styles.meta}>{travelTimeLabel || place.d}</Text>
          {distanceLabel && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{distanceLabel}</Text>
            </>
          )}
        </View>
      </View>

      {/* Add to planner */}
      {onAddToPlanner && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onAddToPlanner(place); }}
          style={styles.addBtn}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Add to planner"
          hitSlop={8}
        >
          <Plus size={16} color={colors.text3} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {/* Bookmark */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation?.(); onSave(place.n); }}
        style={styles.bookmarkBtn}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={isSaved ? 'Unsave' : 'Save'}
        hitSlop={8}
      >
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill={isSaved ? colors.accent : 'none'}
          stroke={isSaved ? colors.accent : colors.text3}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </Svg>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const getStyles = (colors: ThemeColors): {
  row: ViewStyle; thumb: ImageStyle; info: ViewStyle; tagRow: ViewStyle;
  category: TextStyle; openBadge: ViewStyle; openText: TextStyle;
  closedBadge: ViewStyle; closedText: TextStyle; name: TextStyle;
  metaRow: ViewStyle; rating: TextStyle; dot: TextStyle; meta: TextStyle;
  addBtn: ViewStyle; bookmarkBtn: ViewStyle;
} =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    thumb: {
      width: 120,
      height: 120,
      borderRadius: radius.md,
      backgroundColor: colors.card2,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    category: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      color: colors.accent,
    },
    openBadge: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(125,220,150,0.14)',
    },
    openText: {
      fontSize: 9,
      fontWeight: '600',
      color: '#2f7a46',
    },
    closedBadge: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.card2,
    },
    closedText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.text3,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    rating: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warn,
    },
    dot: {
      fontSize: 11,
      color: colors.text3,
    },
    meta: {
      fontSize: 11,
      color: colors.text3,
    },
    addBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    bookmarkBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
  });
