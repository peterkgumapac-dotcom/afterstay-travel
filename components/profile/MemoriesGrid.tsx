import React from 'react';
import { StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { useTheme } from '@/constants/ThemeContext';
import type { Moment } from '@/lib/types';

interface MemoriesGridProps {
  moments: Moment[];
  onMomentPress?: (moment: Moment, index: number) => void;
}

export default function MemoriesGrid({ moments, onMomentPress }: MemoriesGridProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = getStyles(colors);
  const gap = 10;
  const cellSize = (width - 32 - gap * 2) / 3;

  return (
    <View style={s.grid}>
      {moments.slice(0, 6).map((moment, index) => (
        <TouchableOpacity
          key={moment.id}
          style={[s.cell, { width: cellSize, height: cellSize }]}
          onPress={() => onMomentPress?.(moment, index)}
          activeOpacity={0.85}
          disabled={!onMomentPress}
        >
          {moment.photo ? (
            <CachedImage remoteUrl={moment.photo} style={s.image} />
          ) : (
            <View style={[s.image, s.fallback]} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  cell: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    backgroundColor: colors.border,
  },
});
