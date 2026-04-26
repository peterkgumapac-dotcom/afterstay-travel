import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';

interface DayChipsProps {
  active: string;
  onChange: (day: string) => void;
  onLongPress?: (day: string) => void;
  counts: Record<string, number>;
  total: number;
  /** Set of days that have been curated (shows dot indicator). */
  curatedDays?: Set<string>;
}

export function DayChips({ active, onChange, onLongPress, counts, total, curatedDays }: DayChipsProps) {
  const { colors } = useTheme();
  const days = useMemo(() => Object.keys(counts).sort((a, b) => b.localeCompare(a)), [counts]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      <Chip
        label="All"
        count={total}
        isActive={active === 'all'}
        onPress={() => onChange('all')}
        onLongPress={onLongPress ? () => onLongPress('all') : undefined}
        showDot={curatedDays ? !curatedDays.has('all') : false}
        colors={colors}
      />
      {days.map((d) => (
        <Chip
          key={d}
          label={formatDatePHT(d)}
          count={counts[d]}
          isActive={active === d}
          onPress={() => onChange(d)}
          onLongPress={onLongPress ? () => onLongPress(d) : undefined}
          showDot={curatedDays ? !curatedDays.has(d) : false}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

interface ChipProps {
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  showDot?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

const Chip = React.memo(function Chip({ label, count, isActive, onPress, onLongPress, showDot, colors }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? colors.accent : colors.card,
          borderColor: isActive ? colors.accent : colors.border,
        },
      ]}
    >
      {showDot && (
        <View style={[styles.uncuratedDot, { backgroundColor: colors.accent }]} />
      )}
      <Text
        style={[
          styles.chipLabel,
          { color: isActive ? colors.onBlack : colors.text2 },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.chipCount,
          {
            backgroundColor: isActive
              ? 'rgba(0,0,0,0.16)'
              : colors.card2,
          },
        ]}
      >
        <Text
          style={[
            styles.chipCountText,
            { color: isActive ? colors.onBlack : colors.text3 },
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 6,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipCount: {
    minWidth: 18,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  uncuratedDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
