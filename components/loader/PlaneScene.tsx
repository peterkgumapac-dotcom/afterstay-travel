import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Circle,
  Path,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const P0 = { x: 30, y: 230 };
const CP = { x: 150, y: 60 };
const P1 = { x: 270, y: 180 };

const ARC_LENGTH = 400;

function quadBezier(t: number, a: number, b: number, c: number): number {
  'worklet';
  const mt = 1 - t;
  return mt * mt * a + 2 * mt * t * b + t * t * c;
}

function quadBezierDerivative(t: number, a: number, b: number, c: number): number {
  'worklet';
  return 2 * (1 - t) * (b - a) + 2 * t * (c - b);
}

export default function PlaneScene() {
  const { colors } = useTheme();

  const dashOffset = useSharedValue(ARC_LENGTH);
  const planeT = useSharedValue(0);

  useEffect(() => {
    dashOffset.value = withTiming(0, {
      duration: 2000,
      easing: Easing.out(Easing.ease),
    });
    planeT.value = withRepeat(
      withTiming(1, { duration: 2200 }),
      -1,
      false,
    );
  }, [dashOffset, planeT]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const planeStyle = useAnimatedStyle(() => {
    const t = planeT.value;
    const cx = quadBezier(t, P0.x, CP.x, P1.x);
    const cy = quadBezier(t, P0.y, CP.y, P1.y);
    const dx = quadBezierDerivative(t, P0.x, CP.x, P1.x);
    const dy = quadBezierDerivative(t, P0.y, CP.y, P1.y);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return {
      position: 'absolute' as const,
      left: cx * (310 / 300) - 16,
      top: cy * (310 / 300) - 8,
      transform: [{ rotate: `${angle}deg` }],
    };
  });

  return (
    <View style={{ width: 310, height: 310 }}>
      <Svg viewBox="0 0 300 300" width={310} height={310}>
        <Defs>
          <LinearGradient id="planeSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#e38868" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#7f3712" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* sky wash */}
        <Rect x={0} y={0} width={300} height={300} fill="url(#planeSky)" />

        {/* distant mountains */}
        <Path
          d="M 0 240 L 60 190 L 110 220 L 170 170 L 230 215 L 300 180 L 300 300 L 0 300 Z"
          fill={colors.accent}
          opacity={0.18}
        />

        {/* dashed arc */}
        <AnimatedPath
          d="M 30 230 Q 150 60 270 180"
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.4}
          strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
          opacity={0.55}
          animatedProps={arcProps}
        />

        {/* sun */}
        <Circle cx={220} cy={90} r={22} fill="#ffd9a8" opacity={0.7} />
        <Circle cx={220} cy={90} r={14} fill="#ffeacc" />
      </Svg>

      {/* plane following arc */}
      <Animated.View style={planeStyle}>
        <Svg viewBox="-15 -8 34 16" width={32} height={16}>
          <G fill={colors.accent} stroke="#fffaf0" strokeWidth={1}>
            <G transform="scale(1.2)">
              <Path d="M-11 0 L11 -3 L15 0 L11 3 Z" />
              <Path d="M0 -5 L4 0 L0 5 Z" />
              <Path d="M-5 -0.5 L-5 0.5 L-11 2.5 L-11 -2.5 Z" />
            </G>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
