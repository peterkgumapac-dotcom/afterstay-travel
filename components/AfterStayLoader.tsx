import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
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

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1600, easing: Easing.bezier(0.5, 0.1, 0.5, 0.9) }),
      -1,
      false,
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.markWrapper}>
        {/* Static ring + mark */}
        <Svg width={56} height={56} viewBox="0 0 64 64" fill="none" style={StyleSheet.absoluteFill}>
          <Circle cx={32} cy={32} r={29} stroke={colors.accent} strokeWidth={2.2} fill="none" opacity={0.18} />
          <Path
            d="M32 12 L52 48 L12 48 Z"
            stroke={colors.accent}
            strokeWidth={2.4}
            strokeLinejoin="round"
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
          <Svg width={56} height={56} viewBox="0 0 64 64" fill="none">
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
      </View>
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
  markWrapper: {
    width: 56,
    height: 56,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
