import React from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { FilterState, TravelMode } from '@/features/discover/lib/screenConfig';

import type { getDiscoverStyles } from './discoverScreenStyles';
import PlaceFilterPanel from './PlaceFilterPanel';

type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;
type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface Props {
  canUseGroupFilters: boolean;
  colors: ThemeColors;
  filters: FilterState;
  resultCount: number;
  styles: DiscoverStyles;
  travelMode: TravelMode;
  visible: boolean;
  onClear: () => void;
  onClose: () => void;
  onFiltersChange: React.Dispatch<React.SetStateAction<FilterState>>;
  onTravelModeChange: (mode: TravelMode) => void;
}

export default function DiscoverFilterSheet({
  canUseGroupFilters,
  colors,
  filters,
  resultCount,
  styles,
  travelMode,
  visible,
  onClear,
  onClose,
  onFiltersChange,
  onTravelModeChange,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.filterModalOverlay}>
        <TouchableOpacity
          style={styles.filterModalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.filterSheetWrap}>
          <View style={styles.filterSheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <PlaceFilterPanel
              colors={colors}
              styles={styles}
              filters={filters}
              travelMode={travelMode}
              resultCount={resultCount}
              canUseGroupFilters={canUseGroupFilters}
              onFiltersChange={onFiltersChange}
              onTravelModeChange={onTravelModeChange}
              onClear={onClear}
              onClose={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
