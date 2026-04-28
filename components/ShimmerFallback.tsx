import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface ShimmerFallbackProps {
  rows?: number;
  rowHeight?: number;
  gap?: number;
}

export function ShimmerFallback({
  rows = 3,
  rowHeight = 80,
  gap = 12,
}: ShimmerFallbackProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const opacity = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withTiming(0.3, { duration: 800 }),
      -1,
      true
    ),
  }));

  const shimmerColor = isDark ? '#1a1a1a' : '#e0e0e0';

  return (
    <View style={[styles.container, { gap }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.shimmer,
            { height: rowHeight, backgroundColor: shimmerColor },
            opacity,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  shimmer: {
    borderRadius: 12,
  },
});
