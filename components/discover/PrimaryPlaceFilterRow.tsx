import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Filter } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import {
  getPrimaryPlaceCategoryLabel,
  PLACE_CATEGORY_CHIPS,
  PRIMARY_PLACE_CATEGORY_CHIPS,
} from '@/features/discover/lib/screenConfig';

import type { getDiscoverStyles } from './discoverScreenStyles';

type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;
type PlaceCategoryChip = typeof PLACE_CATEGORY_CHIPS[number];
type PrimaryPlaceCategoryChip = typeof PRIMARY_PLACE_CATEGORY_CHIPS[number];
type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface Props {
  activeCategory: PlaceCategoryChip;
  activeFilterCount: number;
  colors: ThemeColors;
  styles: DiscoverStyles;
  onCategoryChange: (category: PrimaryPlaceCategoryChip) => void;
  onShowFilters: () => void;
}

export default function PrimaryPlaceFilterRow({
  activeCategory,
  activeFilterCount,
  colors,
  styles,
  onCategoryChange,
  onShowFilters,
}: Props) {
  return (
    <View style={styles.primaryFilterRow}>
      {PRIMARY_PLACE_CATEGORY_CHIPS.map((chip) => {
        const active = activeCategory === chip;
        const label = getPrimaryPlaceCategoryLabel(chip);
        return (
          <TouchableOpacity
            key={chip}
            style={[styles.primaryFilterChip, active && styles.primaryFilterChipActive]}
            activeOpacity={0.72}
            onPress={() => onCategoryChange(chip)}
          >
            <Text style={[styles.primaryFilterText, active && styles.primaryFilterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onShowFilters}
        style={[
          styles.moreFiltersBtn,
          activeFilterCount > 0 && { borderColor: colors.accent, backgroundColor: colors.accentBg },
        ]}
        activeOpacity={0.72}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount > 0 ? `More filters, ${activeFilterCount} active` : 'More filters'}
      >
        <Filter size={17} color={activeFilterCount > 0 ? colors.accent : colors.text2} strokeWidth={2.2} />
        {activeFilterCount > 0 ? (
          <View style={styles.filterCountBadge}>
            <Text style={styles.filterCountText}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}
