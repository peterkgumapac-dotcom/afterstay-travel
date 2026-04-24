import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';

const AnimatedSvgGroup = Animated.createAnimatedComponent(View);

interface AfterStayLoaderProps {
  readonly message?: string;
}

export default function AfterStayLoader({ message }: AfterStayLoaderProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const markScale = useSharedValue(0.85);
  const markOpacity = useSharedValue(0);

  useEffect(() => {
    // Spinning ring
    rotation.value = withRepeat(
      withTiming(360, { duration: 1600, easing: Easing.bezier(0.5, 0.1, 0.5, 0.9) }),
      -1,
      false,
    );
    // Mark entrance — scale in like prototype
    markScale.value = withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.9, 0.2, 1) });
    markOpacity.value = withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.9, 0.2, 1) });
  }, [rotation, markScale, markOpacity]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const markEntrance = useAnimatedStyle(() => ({
    transform: [{ scale: markScale.value }],
    opacity: markOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Radial gradient glow behind mark */}
      <View style={styles.glowOuter}>
        <View style={[styles.glow, { backgroundColor: colors.accent }]} />
      </View>

      {/* Mark with entrance animation */}
      <Animated.View style={[styles.markWrapper, markEntrance]}>
        {/* Static ring + triangle + zigzag */}
        <Svg width={72} height={72} viewBox="0 0 64 64" fill="none" style={StyleSheet.absoluteFill}>
          <Circle cx={32} cy={32} r={29} stroke={colors.accent} strokeWidth={2.2} fill="none" opacity={0.18} />
          <Path
            d="M32 12 L52 48 L12 48 Z"
            stroke={colors.accent}
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        {/* Spinning ring */}
        <AnimatedSvgGroup style={[StyleSheet.absoluteFill, spinStyle]}>
          <Svg width={72} height={72} viewBox="0 0 64 64" fill="none">
            <Circle
              cx={32} cy={32} r={29}
              stroke={colors.accent}
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="45 200"
            />
          </Svg>
        </AnimatedSvgGroup>
      </Animated.View>

      {message ? (
        <Text style={[styles.message, { color: colors.text2 }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  glowOuter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 280,
    height: 200,
    borderRadius: 140,
    opacity: 0.18,
  },
  markWrapper: {
    width: 72,
    height: 72,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
