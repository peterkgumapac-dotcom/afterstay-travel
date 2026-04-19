import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export interface TrendingItem {
  n: string;
  pr: string;
  img: string;
}

interface TrendingCardProps {
  item: TrendingItem;
  onPress?: () => void;
}

export function TrendingCard({ item, onPress }: TrendingCardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.n}, from ${item.pr}`}
    >
      <Image source={{ uri: item.img }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.n}
        </Text>
        <Text style={styles.price}>from {item.pr}</Text>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: 180,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    image: {
      width: 180,
      height: 100,
    },
    body: {
      padding: 12,
    },
    name: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    price: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: '600',
      letterSpacing: 0.22, // 0.02em
    },
  });
