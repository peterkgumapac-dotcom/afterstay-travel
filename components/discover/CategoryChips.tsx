import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface CategoryChipsProps {
  categories: readonly { id: string; label: string; emoji: string; color: string }[];
  selected: string;
  onSelect: (id: string) => void;
  colors: ThemeColors;
}

export function CategoryChips({
  categories,
  selected,
  onSelect,
  colors,
}: CategoryChipsProps) {
  const styles = getStyles(colors);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {categories.map((c) => {
        const isActive = selected === c.id;
        return (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, isActive && styles.chipActive]}
            activeOpacity={0.7}
            onPress={() => onSelect(c.id)}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={styles.chipEmoji}>{c.emoji}</Text>
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chipRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.black,
      borderColor: colors.black,
    },
    chipEmoji: {
      fontSize: 13,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text2,
    },
    chipTextActive: {
      color: colors.onBlack,
    },
  });
