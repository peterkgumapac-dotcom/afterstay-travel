/**
 * Skeleton — Animated shimmer placeholder for loading states.
 * Uses react-native-reanimated for a smooth pulse animation.
 */

import { useEffect, useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.card2 },
        animStyle,
        style,
      ]}
    />
  );
}

/** Row of skeleton elements with consistent spacing */
export function SkeletonRow({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

/** A skeleton card with padding and border matching the app's card style */
export function SkeletonCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  const s = useMemo(() => ({
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  }), [colors]);

  return <View style={[s, style]}>{children}</View>;
}
