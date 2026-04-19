import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface SuggestionListProps {
  suggestions: readonly string[];
  emoji: string;
  onSelect: (suggestion: string) => void;
}

export function SuggestionList({ suggestions, emoji, onSelect }: SuggestionListProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      style={styles.container}
    >
      {suggestions.map((s, i) => (
        <TouchableOpacity
          key={s}
          style={styles.row}
          onPress={() => onSelect(s)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={s}
        >
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {s}
          </Text>
          <Svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.text3}
            strokeWidth={2}
          >
            <Path d="M9 6l6 6-6 6" />
          </Svg>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingBottom: 18,
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    emoji: {
      fontSize: 16,
    },
    label: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
    },
  });
