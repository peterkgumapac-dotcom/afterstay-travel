import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius as themeRadius } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Base shimmer block
// ---------------------------------------------------------------------------

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({ width, height, borderRadius = themeRadius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Preset: Card
// ---------------------------------------------------------------------------

export function CardSkeleton() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.card}>
      <SkeletonLoader width="100%" height={120} borderRadius={themeRadius.md} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset: List item (circle avatar + two text lines)
// ---------------------------------------------------------------------------

export function ListItemSkeleton() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.listItem}>
      <SkeletonLoader width={42} height={42} borderRadius={21} />
      <View style={styles.listItemText}>
        <SkeletonLoader width="70%" height={14} borderRadius={themeRadius.xs} />
        <SkeletonLoader width="45%" height={12} borderRadius={themeRadius.xs} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset: Flight card
// ---------------------------------------------------------------------------

export function FlightCardSkeleton() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.flightCard}>
      {/* Header row: airline chip + status pill */}
      <View style={styles.flightHeader}>
        <View style={styles.flightHeaderLeft}>
          <SkeletonLoader width={36} height={36} borderRadius={themeRadius.xs} />
          <View style={{ gap: 6 }}>
            <SkeletonLoader width={120} height={12} borderRadius={themeRadius.xs} />
            <SkeletonLoader width={80} height={10} borderRadius={themeRadius.xs} />
          </View>
        </View>
        <SkeletonLoader width={72} height={22} borderRadius={themeRadius.pill} />
      </View>

      {/* Route row: dep --- plane --- arr */}
      <View style={styles.flightRoute}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <SkeletonLoader width={40} height={22} borderRadius={themeRadius.xs} />
          <SkeletonLoader width={56} height={10} borderRadius={themeRadius.xs} />
        </View>
        <SkeletonLoader width="40%" height={2} borderRadius={1} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <SkeletonLoader width={40} height={22} borderRadius={themeRadius.xs} />
          <SkeletonLoader width={56} height={10} borderRadius={themeRadius.xs} />
        </View>
      </View>

      {/* Footer row */}
      <View style={styles.flightFooter}>
        <SkeletonLoader width={100} height={10} borderRadius={themeRadius.xs} />
        <SkeletonLoader width={60} height={10} borderRadius={themeRadius.xs} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      borderRadius: themeRadius.md,
      overflow: 'hidden',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    listItemText: {
      flex: 1,
      gap: spacing.sm,
    },
    flightCard: {
      backgroundColor: colors.card,
      borderRadius: themeRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.lg,
    },
    flightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    flightHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    flightRoute: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
    },
    flightFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  });
