import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const P0 = { x: 30, y: 230 };
const CP = { x: 150, y: 60 };
const P1 = { x: 270, y: 180 };

const ARC_LENGTH_ESTIMATE = 400;

function quadBezier(t: number, a: number, b: number, c: number): number {
  'worklet';
  const mt = 1 - t;
  return mt * mt * a + 2 * mt * t * b + t * t * c;
}

export default function PlaneScene() {
  const { colors } = useTheme();

  const dashOffset = useSharedValue(ARC_LENGTH_ESTIMATE);
  const planeT = useSharedValue(0);

  useEffect(() => {
    dashOffset.value = withTiming(0, {
      duration: 2200,
      easing: Easing.inOut(Easing.ease),
    });
    planeT.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [dashOffset, planeT]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const planeProps = useAnimatedProps(() => {
    const t = planeT.value;
    const cx = quadBezier(t, P0.x, CP.x, P1.x);
    const cy = quadBezier(t, P0.y, CP.y, P1.y);
    return { cx, cy };
  });

  return (
    <Svg viewBox="0 0 300 300" width={310} height={310}>
      <Defs>
        <LinearGradient id="skyWash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.coral} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.bg2} stopOpacity="0.9" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={300} height={300} rx={18} fill="url(#skyWash)" />

      <Path
        d="M 0 240 L 60 190 L 110 220 L 170 170 L 230 215 L 300 180 L 300 300 L 0 300 Z"
        fill={colors.accent}
        opacity={0.18}
      />

      <AnimatedPath
        d="M 30 230 Q 150 60 270 180"
        fill="none"
        stroke={colors.accent}
        strokeWidth={1.8}
        strokeDasharray={`${ARC_LENGTH_ESTIMATE}`}
        strokeLinecap="round"
        animatedProps={arcProps}
      />

      <Circle cx={220} cy={90} r={22} fill="#ffd9a8" opacity={0.7} />
      <Circle cx={220} cy={90} r={14} fill="#ffeacc" />

      <AnimatedCircle
        r={6}
        fill={colors.accent}
        animatedProps={planeProps}
      />
    </Svg>
  );
}
