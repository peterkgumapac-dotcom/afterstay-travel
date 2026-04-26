import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CurationProgressProps {
  dayLabel: string;
  photoIndex: number;
  totalPhotos: number;
  favoritesCount: number;
  maxFavorites: number;
}

/**
 * Top bar for curation screen:
 * - Day label (left) + photo counter (right)
 * - Horizontal progress bar
 * - Dots row: one per maxFavorites, filled for each favorite
 */
function CurationProgressInner({
  dayLabel,
  photoIndex,
  totalPhotos,
  favoritesCount,
  maxFavorites,
}: CurationProgressProps) {
  const progress = totalPhotos > 0 ? (photoIndex + 1) / totalPhotos : 0;

  const dots = useMemo(
    () => Array.from({ length: maxFavorites }, (_, i) => i < favoritesCount),
    [maxFavorites, favoritesCount],
  );

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <Text style={styles.counter}>{photoIndex + 1} / {totalPhotos}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Favorites dots */}
      <View style={styles.dotsRow}>
        {dots.map((filled, i) => (
          <View
            key={i}
            style={[styles.dot, filled && styles.dotFilled]}
          />
        ))}
      </View>
    </View>
  );
}

export const CurationProgress = memo(CurationProgressInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  counter: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#C8956C',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dotFilled: {
    backgroundColor: '#C8956C',
    borderColor: '#C8956C',
  },
});
