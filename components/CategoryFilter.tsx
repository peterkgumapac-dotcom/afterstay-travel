import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import type { PlaceCategory } from '@/lib/types';

export type CategoryFilterValue = 'All' | 'Saved' | PlaceCategory;

const CATEGORIES: CategoryFilterValue[] = [
  'All',
  'Saved',
  'Eat',
  'Coffee',
  'Do',
  'Nature',
  'Essentials',
  'Nightlife',
  'Wellness',
  'Culture',
];

interface Props {
  value: CategoryFilterValue;
  onChange: (v: CategoryFilterValue) => void;
  counts?: Record<string, number>;
}

export default function CategoryFilter({ value, onChange, counts }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={staticStyles.row}
    >
      {CATEGORIES.map(c => {
        const active = c === value;
        const count = counts?.[c];
        const label = count != null && count > 0 ? `${c} (${count})` : c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={({ pressed }) => [
              styles.pill,
              active ? styles.pillActive : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillActive: {
    backgroundColor: colors.green + '22',
    borderColor: colors.green,
  },
  label: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  labelActive: { color: colors.green2 },
});

const staticStyles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
