import { StyleSheet, Text, View } from 'react-native';

import {
  DiscoverPlaceCard,
  type DiscoverPlace,
} from '@/components/discover/DiscoverPlaceCard';
import MiniLoader from '@/components/loader/MiniLoader';
import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface PlacesGridProps {
  places: DiscoverPlace[];
  savedIds: Set<string>;
  recommendedIds: Set<string>;
  onSave: (place: DiscoverPlace) => void;
  onRecommend: (place: DiscoverPlace) => void;
  onPress: (place: DiscoverPlace) => void;
  colors: ThemeColors;
  loading?: boolean;
  error?: string | null;
}

export function PlacesGrid({
  places,
  savedIds,
  recommendedIds,
  onSave,
  onRecommend,
  onPress,
  colors,
  loading = false,
  error = null,
}: PlacesGridProps) {
  const styles = getStyles(colors);

  return (
    <View style={styles.placeList}>
      {error && (
        <View style={styles.emptyPlaces}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {loading ? (
        <View style={styles.emptyPlaces}>
          <MiniLoader message="Finding places..." />
        </View>
      ) : places.length === 0 ? (
        <View style={styles.emptyPlaces}>
          <Text style={styles.emptyText}>
            No places match these filters.
          </Text>
        </View>
      ) : (
        places.map((p) => (
          <DiscoverPlaceCard
            key={p.n}
            place={p}
            isSaved={savedIds.has(p.n)}
            isRecommended={recommendedIds.has(p.n)}
            onSave={() => onSave(p)}
            onRecommend={() => onRecommend(p)}
            onExplore={() => onPress(p)}
          />
        ))
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    placeList: {
      paddingHorizontal: 16,
      gap: 12,
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
    errorText: {
      fontSize: 12,
      color: colors.danger,
      textAlign: 'center',
      paddingVertical: 4,
    },
  });
