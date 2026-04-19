import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

interface DayChipsProps {
  active: string;
  onChange: (day: string) => void;
  counts: Record<string, number>;
  total: number;
}

export function DayChips({ active, onChange, counts, total }: DayChipsProps) {
  const { colors } = useTheme();
  const days = Object.keys(counts);

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
        colors={colors}
      />
      {days.map((d) => (
        <Chip
          key={d}
          label={d}
          count={counts[d]}
          isActive={active === d}
          onPress={() => onChange(d)}
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
  colors: ReturnType<typeof useTheme>['colors'];
}

function Chip({ label, count, isActive, onPress, colors }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? colors.accent : colors.card,
          borderColor: isActive ? colors.accent : colors.border,
        },
      ]}
    >
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
}

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
    paddingVertical: 7,
    paddingHorizontal: 12,
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
});
