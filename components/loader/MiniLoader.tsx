import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MiniLoaderProps {
  readonly message?: string;
  readonly size?: number;
}

/**
 * Compact animated compass loader for inline/card loading states.
 * Replaces plain ActivityIndicator with a themed compass needle animation.
 */
export default function MiniLoader({ message, size = 48 }: MiniLoaderProps) {
  const { colors } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const tickR = size * 0.36;

  // Compass needle swings and settles: -30° → 50° → 20° → 35° → repeat
  const needleRotation = useSharedValue(-30);
  useEffect(() => {
    needleRotation.value = withRepeat(
      withSequence(
        withTiming(50, { duration: 500, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
        withTiming(20, { duration: 400, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
        withTiming(35, { duration: 350, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
        withTiming(-30, { duration: 350, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
      ),
      -1,
      false,
    );
  }, [needleRotation]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${needleRotation.value}deg` }],
  }));

  // Pulsing north dot
  const pulseR = useSharedValue(size * 0.04);
  useEffect(() => {
    pulseR.value = withRepeat(
      withSequence(
        withTiming(size * 0.06, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(size * 0.04, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [pulseR, size]);

  const dotProps = useAnimatedProps(() => ({
    r: pulseR.value,
  }));

  // 4 cardinal ticks
  const ticks = [0, 90, 180, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const innerR = tickR - size * 0.04;
    return {
      x1: cx + Math.cos(rad) * innerR,
      y1: cy - Math.sin(rad) * innerR,
      x2: cx + Math.cos(rad) * tickR,
      y2: cy - Math.sin(rad) * tickR,
    };
  });

  const needleLen = size * 0.28;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={outerR}
          stroke={colors.border}
          strokeWidth={1}
          fill="none"
        />

        {/* Cardinal ticks */}
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={colors.text3}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        ))}

        {/* North pulse dot */}
        <AnimatedCircle
          cx={cx}
          cy={cy - tickR + size * 0.01}
          fill={colors.accent}
          opacity={0.7}
          animatedProps={dotProps}
        />
      </Svg>

      {/* Animated needle overlay */}
      <Animated.View style={[styles.needleOverlay, { width: size, height: size }, needleStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* North half (accent) */}
          <Path
            d={`M${cx} ${cy} L${cx - size * 0.04} ${cy} L${cx} ${cy - needleLen} Z`}
            fill={colors.accent}
          />
          <Path
            d={`M${cx} ${cy} L${cx + size * 0.04} ${cy} L${cx} ${cy - needleLen} Z`}
            fill={colors.accentDk}
          />
          {/* South half (muted) */}
          <Path
            d={`M${cx} ${cy} L${cx - size * 0.03} ${cy} L${cx} ${cy + needleLen * 0.5} Z`}
            fill={colors.text3}
            opacity={0.4}
          />
          <Path
            d={`M${cx} ${cy} L${cx + size * 0.03} ${cy} L${cx} ${cy + needleLen * 0.5} Z`}
            fill={colors.text3}
            opacity={0.3}
          />
          {/* Center pivot */}
          <Circle cx={cx} cy={cy} r={size * 0.04} fill={colors.accent} />
        </Svg>
      </Animated.View>

      {message && (
        <Text style={[styles.message, { color: colors.text3 }]}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  needleOverlay: {
    position: 'absolute',
  },
  message: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginTop: 6,
  },
});
