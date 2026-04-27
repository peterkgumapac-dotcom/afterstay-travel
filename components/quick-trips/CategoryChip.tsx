import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QUICK_TRIP_CATEGORIES, type QuickTripCategory } from '@/lib/quickTripTypes';
import type { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface CategoryChipProps {
  selected: QuickTripCategory | null;
  onSelect: (cat: QuickTripCategory) => void;
  colors: ThemeColors;
}

export default function CategoryChipSelector({ selected, onSelect, colors }: CategoryChipProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {QUICK_TRIP_CATEGORIES.map((c) => {
        const active = selected === c.key;
        return (
          <TouchableOpacity
            key={c.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(c.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{c.emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    emoji: {
      fontSize: 14,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text2,
    },
    labelActive: {
      color: colors.accent,
    },
  });
