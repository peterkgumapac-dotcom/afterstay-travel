import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { FilterRow, SegBtn } from '@/components/discover/DiscoverFilterControls';
import { type FilterState, type TravelMode } from '@/features/discover/lib/screenConfig';
import type { getDiscoverStyles } from '@/components/discover/discoverScreenStyles';
import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;

interface PlaceFilterPanelProps {
  colors: ThemeColors;
  styles: DiscoverStyles;
  filters: FilterState;
  travelMode: TravelMode;
  resultCount?: number;
  canUseGroupFilters?: boolean;
  onFiltersChange: React.Dispatch<React.SetStateAction<FilterState>>;
  onTravelModeChange: (mode: TravelMode) => void;
  onClear: () => void;
  onClose: () => void;
}

const PLACE_TYPES = [
  ['restaurant', 'Food'],
  ['cafe', 'Coffee'],
  ['tourist_attraction', 'Things to do'],
  ['natural_feature', 'Beach / nature'],
] as const;

const VIBES = [
  ['scenic', 'Scenic'],
  ['hidden_gem', 'Hidden gems'],
  ['budget', 'Budget'],
  ['date_night', 'Date night'],
] as const;

function tap() {
  Haptics.selectionAsync();
}

function toggle(list: readonly string[] | undefined, value: string): string[] {
  return list?.includes(value)
    ? list.filter((item) => item !== value)
    : [...(list ?? []), value];
}

function Pill({
  active,
  label,
  colors,
  onPress,
}: {
  active: boolean;
  label: string;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.76}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 11,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.black : colors.border,
        backgroundColor: active ? colors.black : colors.card,
      }}
    >
      <Text style={{
        color: active ? colors.onBlack : colors.text,
        fontSize: 11.5,
        fontWeight: '800',
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default React.memo(function PlaceFilterPanel({
  colors,
  styles,
  filters,
  travelMode,
  resultCount,
  canUseGroupFilters,
  onFiltersChange,
  onTravelModeChange,
  onClear,
  onClose,
}: PlaceFilterPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const showCountLabel = typeof resultCount === 'number' ? `Show ${resultCount} places` : 'Show places';
  const advancedActive =
    filters.minRating > 0 ||
    (filters.minReviewCount ?? 0) > 0 ||
    (filters.placeTypes?.length ?? 0) > 0 ||
    (filters.vibes?.length ?? 0) > 0 ||
    Boolean(filters.savedOnly || filters.recommendedOnly || filters.needsVotesOnly);

  return (
    <Animated.View entering={FadeInDown.duration(160)} style={styles.filterPanel}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Sort & filters</Text>
            <Text style={{ color: colors.text3, fontSize: 11.5, marginTop: 2 }}>
              Curated within 10 km of your selected area.
            </Text>
          </View>
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={styles.filterResetText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <FilterRow label="Sort" colors={colors}>
          {[
            ['best', 'Recommended'],
            ['rating', 'Rating'],
            ['distance', 'Nearest'],
            ['popular', 'Popular'],
          ].map(([value, label]) => (
            <Pill
              key={value}
              colors={colors}
              label={label}
              active={(filters.sortMode ?? 'best') === value}
              onPress={() => onFiltersChange((f) => ({ ...f, sortMode: value as FilterState['sortMode'] }))}
            />
          ))}
        </FilterRow>

        <FilterRow label="Open now" colors={colors}>
          <Pill colors={colors} label="All" active={!filters.openNow} onPress={() => onFiltersChange((f) => ({ ...f, openNow: false }))} />
          <Pill colors={colors} label="Open now" active={filters.openNow} onPress={() => onFiltersChange((f) => ({ ...f, openNow: true }))} />
        </FilterRow>

        <FilterRow label="Travel mode" colors={colors}>
          <Pill colors={colors} label="Walk" active={travelMode === 'walk'} onPress={() => onTravelModeChange('walk')} />
          <Pill colors={colors} label="Drive" active={travelMode === 'car'} onPress={() => onTravelModeChange('car')} />
        </FilterRow>

        <TouchableOpacity
          activeOpacity={0.72}
          onPress={() => {
            tap();
            setMoreOpen((open) => !open);
          }}
          style={{
            minHeight: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 13,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>More filters</Text>
            <Text style={{ color: colors.text3, fontSize: 11, marginTop: 1 }}>
              {advancedActive ? 'Advanced filters active' : 'Place type, vibe, reviews, group planning'}
            </Text>
          </View>
          {moreOpen
            ? <ChevronUp size={17} color={colors.text2} strokeWidth={2.2} />
            : <ChevronDown size={17} color={colors.text2} strokeWidth={2.2} />}
        </TouchableOpacity>

        {moreOpen ? (
          <View style={{ gap: 14 }}>
            <FilterRow label="Rating" colors={colors}>
              {[0, 4, 4.5].map((value) => (
                <Pill
                  key={value}
                  colors={colors}
                  label={value === 0 ? 'Any' : `★ ${value}+`}
                  active={filters.minRating === value}
                  onPress={() => onFiltersChange((f) => ({ ...f, minRating: value }))}
                />
              ))}
            </FilterRow>
            <FilterRow label="Review count" colors={colors}>
              {[0, 50, 200].map((value) => (
                <Pill
                  key={value}
                  colors={colors}
                  label={value === 0 ? 'Any' : `${value}+`}
                  active={(filters.minReviewCount ?? 0) === value}
                  onPress={() => onFiltersChange((f) => ({ ...f, minReviewCount: value }))}
                />
              ))}
            </FilterRow>
            <FilterRow label="Place type" colors={colors}>
              {PLACE_TYPES.map(([value, label]) => (
                <Pill
                  key={value}
                  colors={colors}
                  label={label}
                  active={Boolean(filters.placeTypes?.includes(value))}
                  onPress={() => onFiltersChange((f) => ({ ...f, placeTypes: toggle(f.placeTypes, value) }))}
                />
              ))}
            </FilterRow>
            <FilterRow label="Vibe" colors={colors}>
              {VIBES.map(([value, label]) => (
                <Pill
                  key={value}
                  colors={colors}
                  label={label}
                  active={Boolean(filters.vibes?.includes(value))}
                  onPress={() => onFiltersChange((f) => ({ ...f, vibes: toggle(f.vibes, value) }))}
                />
              ))}
            </FilterRow>
            <FilterRow label="Group planning" colors={colors}>
              <Pill colors={colors} label="Saved" active={Boolean(filters.savedOnly)} onPress={() => onFiltersChange((f) => ({ ...f, savedOnly: !f.savedOnly }))} />
              <Pill colors={colors} label="Recommended" active={Boolean(filters.recommendedOnly)} onPress={() => onFiltersChange((f) => ({ ...f, recommendedOnly: !f.recommendedOnly }))} />
              {canUseGroupFilters ? (
                <Pill colors={colors} label="Needs votes" active={Boolean(filters.needsVotesOnly)} onPress={() => onFiltersChange((f) => ({ ...f, needsVotesOnly: !f.needsVotesOnly }))} />
              ) : null}
            </FilterRow>
          </View>
        ) : null}
      </View>

      <View style={styles.filterFooter}>
        <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
          <Text style={styles.filterResetText}>Clear filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterShowBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.filterShowBtnText}>{showCountLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
