import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';

import DistanceToggle from '@/components/discover/DistanceToggle';
import { FilterRow, SegBtn } from '@/components/discover/DiscoverFilterControls';
import { DEFAULT_FILTERS, type DistanceOrigin, type FilterState, type TravelMode } from '@/lib/discoverScreenHelpers';
import type { getDiscoverStyles } from '@/components/discover/discoverScreenStyles';
import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;

interface PlaceFilterPanelProps {
  colors: ThemeColors;
  styles: DiscoverStyles;
  filters: FilterState;
  distanceOrigin: DistanceOrigin;
  travelMode: TravelMode;
  onFiltersChange: React.Dispatch<React.SetStateAction<FilterState>>;
  onAnchorChange: (anchor: DistanceOrigin) => void;
  onTravelModeChange: (mode: TravelMode) => void;
  onClose: () => void;
}

export default React.memo(function PlaceFilterPanel({
  colors,
  styles,
  filters,
  distanceOrigin,
  travelMode,
  onFiltersChange,
  onAnchorChange,
  onTravelModeChange,
  onClose,
}: PlaceFilterPanelProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      style={styles.filterPanel}
    >
      <FilterRow label="Rating" colors={colors}>
        {[0, 4.0, 4.5].map((v) => (
          <SegBtn
            key={v}
            active={filters.minRating === v}
            onPress={() => onFiltersChange((f) => ({ ...f, minRating: v }))}
            colors={colors}
          >
            {v === 0 ? 'Any' : `★ ${v.toFixed(1)}+`}
          </SegBtn>
        ))}
      </FilterRow>
      <FilterRow label="Price" colors={colors}>
        {['Any', 'Free', '$', '$$', '$$$', '$$$$'].map((lbl, i) => {
          const value = i === 0 ? DEFAULT_FILTERS.maxPrice : i - 1;
          return (
            <SegBtn
              key={lbl}
              active={filters.maxPrice === value}
              onPress={() => onFiltersChange((f) => ({ ...f, maxPrice: value }))}
              colors={colors}
            >
              {lbl}
              {i > 1 && i < 5 ? ' or less' : ''}
            </SegBtn>
          );
        })}
      </FilterRow>
      <FilterRow label="Distance" colors={colors}>
        <SegBtn
          active={!filters.nearby}
          onPress={() => onFiltersChange((f) => ({ ...f, nearby: false, sortMode: f.sortMode === 'distance' ? 'best' : f.sortMode }))}
          colors={colors}
        >
          Any
        </SegBtn>
        <SegBtn
          active={filters.nearby}
          onPress={() => onFiltersChange((f) => ({ ...f, nearby: true, sortMode: 'distance' }))}
          colors={colors}
        >
          ≤ 2 km
        </SegBtn>
      </FilterRow>
      <FilterRow label="Open now" colors={colors}>
        <SegBtn
          active={!filters.openNow}
          onPress={() => onFiltersChange((f) => ({ ...f, openNow: false }))}
          colors={colors}
        >
          All
        </SegBtn>
        <SegBtn
          active={filters.openNow}
          onPress={() => onFiltersChange((f) => ({ ...f, openNow: true }))}
          colors={colors}
        >
          Open now
        </SegBtn>
      </FilterRow>
      <FilterRow label="Sort" colors={colors}>
        {[
          ['best', 'Best'],
          ['distance', 'Nearest'],
          ['rating', 'Rating'],
          ['popular', 'Popular'],
        ].map(([value, label]) => (
          <SegBtn
            key={value}
            active={filters.sortMode === value}
            onPress={() => onFiltersChange((f) => ({ ...f, sortMode: value as FilterState['sortMode'] }))}
            colors={colors}
          >
            {label}
          </SegBtn>
        ))}
      </FilterRow>
      <View style={{ marginTop: 2 }}>
        <DistanceToggle
          anchor={distanceOrigin === 'me' ? 'me' : 'hotel'}
          travelMode={travelMode}
          onAnchorChange={(anchor) => {
            Haptics.selectionAsync();
            onAnchorChange(anchor);
          }}
          onTravelModeChange={(mode) => {
            Haptics.selectionAsync();
            onTravelModeChange(mode);
          }}
        />
      </View>
      <View style={styles.filterFooter}>
        <TouchableOpacity
          onPress={() => onFiltersChange({ ...DEFAULT_FILTERS })}
          activeOpacity={0.7}
        >
          <Text style={styles.filterResetText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterShowBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.filterShowBtnText}>Show results</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
