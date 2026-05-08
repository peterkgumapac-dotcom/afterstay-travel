import { Image as ExpoImage } from 'expo-image';
import { Map } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { friendlyCategory, type DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';

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
    .filter((p) => p.r >= 4.0 && p.img)
    .map((p) => ({ p, dist: distFn(p.lat, p.lng) }))
    .filter((x) => x.dist > 0 && x.dist < 50)
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.p)
    .filter((p) => {
      if (seen.has(p.n)) return false;
      seen.add(p.n);
      return true;
    })
    .slice(0, 5);
}

function getTopPicksByCategory(places: readonly DiscoverPlace[], distFn: (lat?: number, lng?: number) => number) {
  return TOP_5_CATEGORIES
    .map((cat) => {
      const matches = [...places]
        .filter(cat.match)
        .filter((p) => p.r >= 4.0 && p.img)
        .map((p) => ({ p, dist: distFn(p.lat, p.lng) }))
        .filter((x) => x.dist > 0 && x.dist < 50)
        .sort((a, b) => a.dist - b.dist)
        .map((x) => x.p)
        .slice(0, 5);
      if (matches.length === 0) return null;
      return { ...cat, places: matches };
    })
    .filter(Boolean) as { key: string; label: string; places: DiscoverPlace[] }[];
}

function TopPickCard({
  place,
  onExplore,
}: {
  place: DiscoverPlace;
  onExplore: (placeId: string | undefined, name: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={styles.topPickCard}
      activeOpacity={0.7}
      onPress={() => onExplore(place.placeId, place.n)}
      accessibilityRole="button"
      accessibilityLabel={place.n}
    >
      {place.img ? (
        <ExpoImage source={{ uri: place.img }} style={styles.topPickImage} contentFit="cover" cachePolicy="disk" transition={160} />
      ) : (
        <View style={[styles.topPickImage, { alignItems: 'center', justifyContent: 'center' }]}>
          <Map size={24} color={colors.text3} />
        </View>
      )}
      <Text style={styles.topPickLabel}>{friendlyCategory(place.t).toUpperCase()}</Text>
      <Text style={styles.topPickName} numberOfLines={1}>{place.n}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 10, color: colors.warn }}>{'★'} {place.r}</Text>
      </View>
    </TouchableOpacity>
  );
}

export const TopPicksSection = React.memo(function TopPicksSection({
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
          <TopPickCard key={p.placeId ?? p.n} place={p} onExplore={onExplore} />
        ))}
      </ScrollView>
    </View>
  );
});

export const TopPicksByCategorySection = React.memo(function TopPicksByCategorySection({
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
  const categories = useMemo(() => getTopPicksByCategory(places, distFn), [places, distFn]);
  if (categories.length === 0) return null;

  return (
    <View style={{ gap: 16 }}>
      {categories.map((cat) => (
        <View key={cat.key} style={styles.topPicksSection}>
          <Text style={styles.topPicksTitle}>{cat.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {cat.places.map((p) => (
              <TopPickCard key={p.placeId ?? p.n} place={p} onExplore={onExplore} />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
});

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    topPicksSection: {
      marginBottom: 14,
    },
    topPicksTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
    },
    topPickCard: {
      width: 128,
      borderRadius: 18,
      backgroundColor: colors.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      paddingBottom: 10,
    },
    topPickImage: {
      width: '100%',
      height: 90,
      backgroundColor: colors.card2,
    },
    topPickLabel: {
      marginTop: 8,
      paddingHorizontal: 10,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.text3,
    },
    topPickName: {
      marginTop: 2,
      paddingHorizontal: 10,
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
  });
