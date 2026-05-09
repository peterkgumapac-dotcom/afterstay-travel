import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import React, { useMemo, useState } from 'react';
import { LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { FilterRow, SegBtn } from '@/components/discover/DiscoverFilterControls';
import { type FilterState, type TravelMode } from '@/lib/discoverScreenHelpers';
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

type SegmentOption<T extends string | number> = {
  label: string;
  value: T;
};

const PLACE_TYPE_OPTIONS = [
  { label: 'Food', value: 'restaurant' },
  { label: 'Coffee', value: 'cafe' },
  { label: 'Things to do', value: 'tourist_attraction' },
  { label: 'Beach / Nature', value: 'natural_feature' },
  { label: 'Shopping', value: 'store' },
] as const;

const VIBE_OPTIONS = [
  { label: 'Scenic', value: 'scenic' },
  { label: 'Hidden gems', value: 'hidden_gem' },
  { label: 'Budget', value: 'budget' },
  { label: 'Family', value: 'family' },
  { label: 'Date night', value: 'date_night' },
  { label: 'Rainy day', value: 'rainy_day' },
] as const;

function animateSelection() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  Haptics.selectionAsync();
}

function toggleListValue(list: readonly string[] | undefined, value: string): string[] {
  const current = new Set(list ?? []);
  if (current.has(value)) current.delete(value);
  else current.add(value);
  return Array.from(current);
}

function SegmentGroup<T extends string | number>({
  colors,
  options,
  value,
  onChange,
}: {
  colors: ThemeColors;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={{
      width: '100%',
      flexDirection: 'row',
      padding: 3,
      borderRadius: 999,
      backgroundColor: colors.canvas,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 3,
    }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            activeOpacity={0.78}
            onPress={() => {
              animateSelection();
              onChange(option.value);
            }}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.accent : 'transparent',
              paddingHorizontal: 9,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                color: active ? colors.onBlack : colors.text2,
                fontSize: 11.5,
                fontWeight: '800',
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
  const selectedTypes = filters.placeTypes ?? [];
  const selectedVibes = filters.vibes ?? [];
  const hasAdvancedFilters = useMemo(
    () => filters.minRating > 0 ||
      (filters.minReviewCount ?? 0) > 0 ||
      selectedTypes.length > 0 ||
      selectedVibes.length > 0 ||
      Boolean(filters.savedOnly || filters.recommendedOnly || filters.needsVotesOnly),
    [filters.minRating, filters.minReviewCount, filters.savedOnly, filters.recommendedOnly, filters.needsVotesOnly, selectedTypes.length, selectedVibes.length],
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      style={styles.filterPanel}
    >
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
          <SegmentGroup
            colors={colors}
            value={filters.sortMode ?? 'best'}
            onChange={(sortMode) => onFiltersChange((f) => ({ ...f, sortMode }))}
            options={[
              { label: 'Recommended', value: 'best' },
              { label: 'Rating', value: 'rating' },
              { label: 'Nearest', value: 'distance' },
              { label: 'Popular', value: 'popular' },
            ]}
          />
        </FilterRow>

        <FilterRow label="Open now" colors={colors}>
          <SegmentGroup
            colors={colors}
            value={filters.openNow ? 'open' : 'all'}
            onChange={(value) => onFiltersChange((f) => ({ ...f, openNow: value === 'open' }))}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Open now', value: 'open' },
            ]}
          />
        </FilterRow>

        <FilterRow label="Travel mode" colors={colors}>
          <SegmentGroup
            colors={colors}
            value={travelMode}
            onChange={onTravelModeChange}
            options={[
              { label: 'Walk', value: 'walk' },
              { label: 'Drive', value: 'car' },
            ]}
          />
        </FilterRow>

        <TouchableOpacity
          activeOpacity={0.72}
          onPress={() => {
            animateSelection();
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
              {hasAdvancedFilters ? 'Advanced filters are active' : 'Place type, vibe, reviews, group planning'}
            </Text>
          </View>
          {moreOpen
            ? <ChevronUp size={17} color={colors.text2} strokeWidth={2.2} />
            : <ChevronDown size={17} color={colors.text2} strokeWidth={2.2} />}
        </TouchableOpacity>

        {moreOpen ? (
          <View style={{ gap: 14 }}>
            <FilterRow label="Rating" colors={colors}>
              {[0, 4.0, 4.5].map((v) => (
                <SegBtn
                  key={v}
                  active={filters.minRating === v}
                  onPress={() => {
                    animateSelection();
                    onFiltersChange((f) => ({ ...f, minRating: v }));
                  }}
                  colors={colors}
                >
                  {v === 0 ? 'Any' : `★ ${v.toFixed(1)}+`}
                </SegBtn>
              ))}
            </FilterRow>

            <FilterRow label="Review count" colors={colors}>
              {[0, 50, 200, 1000].map((v) => (
                <SegBtn
                  key={v}
                  active={(filters.minReviewCount ?? 0) === v}
                  onPress={() => {
                    animateSelection();
                    onFiltersChange((f) => ({ ...f, minReviewCount: v }));
                  }}
                  colors={colors}
                >
                  {v === 0 ? 'Any' : `${v}+`}
                </SegBtn>
              ))}
            </FilterRow>

            <FilterRow label="Place type" colors={colors}>
              {PLACE_TYPE_OPTIONS.map((option) => (
                <SegBtn
                  key={option.value}
                  active={selectedTypes.includes(option.value)}
                  onPress={() => {
                    animateSelection();
                    onFiltersChange((f) => ({ ...f, placeTypes: toggleListValue(f.placeTypes, option.value) }));
                  }}
                  colors={colors}
                >
                  {option.label}
                </SegBtn>
              ))}
            </FilterRow>

            <FilterRow label="Vibe" colors={colors}>
              {VIBE_OPTIONS.map((option) => (
                <SegBtn
                  key={option.value}
                  active={selectedVibes.includes(option.value)}
                  onPress={() => {
                    animateSelection();
                    onFiltersChange((f) => ({ ...f, vibes: toggleListValue(f.vibes, option.value) }));
                  }}
                  colors={colors}
                >
                  {option.label}
                </SegBtn>
              ))}
            </FilterRow>

            <FilterRow label="Group planning" colors={colors}>
              <SegBtn
                active={Boolean(filters.savedOnly)}
                onPress={() => {
                  animateSelection();
                  onFiltersChange((f) => ({ ...f, savedOnly: !f.savedOnly }));
                }}
                colors={colors}
              >
                Saved
              </SegBtn>
              <SegBtn
                active={Boolean(filters.recommendedOnly)}
                onPress={() => {
                  animateSelection();
                  onFiltersChange((f) => ({ ...f, recommendedOnly: !f.recommendedOnly }));
                }}
                colors={colors}
              >
                Recommended
              </SegBtn>
              {canUseGroupFilters ? (
                <SegBtn
                  active={Boolean(filters.needsVotesOnly)}
                  onPress={() => {
                    animateSelection();
                    onFiltersChange((f) => ({ ...f, needsVotesOnly: !f.needsVotesOnly }));
                  }}
                  colors={colors}
                >
                  Needs votes
                </SegBtn>
              ) : null}
            </FilterRow>
          </View>
        ) : null}
      </View>

      <View style={styles.filterFooter}>
        <TouchableOpacity
          onPress={onClear}
          activeOpacity={0.7}
        >
          <Text style={styles.filterResetText}>Clear filters</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterShowBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.filterShowBtnText}>{showCountLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
