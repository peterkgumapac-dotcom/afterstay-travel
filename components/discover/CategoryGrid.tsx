import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export interface CategoryItem {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

interface CategoryGridProps {
  categories: readonly CategoryItem[];
  onSelect: (id: string) => void;
}

const SCREEN_W = Dimensions.get('window').width;
const CELL_W = (SCREEN_W - 32 - 16) / 3; // 16px padding each side, 8px gap x2

export function CategoryGrid({ categories, onSelect }: CategoryGridProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {categories.map((c, i) => (
        <Animated.View key={c.id} entering={FadeInDown.delay(i * 40).duration(250)}>
          <TouchableOpacity
            style={[styles.cell, { width: CELL_W }]}
            onPress={() => onSelect(c.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={c.label}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: c.color + '22', borderColor: c.color + '55' },
              ]}
            >
              <Text style={styles.emoji}>{c.emoji}</Text>
            </View>
            <Text style={styles.label}>{c.label}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingBottom: 18,
      gap: 8,
    },
    cell: {
      paddingTop: 14,
      paddingHorizontal: 8,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      alignItems: 'center',
      gap: 6,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 22,
    },
    label: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.text,
    },
  });
