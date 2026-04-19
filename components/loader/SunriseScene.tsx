import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Circle,
  Line,
  Ellipse,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);

const SUN_CX = 150;
const RAY_COUNT = 12;
const RAY_INNER = 34;
const RAY_OUTER = 70;

export default function SunriseScene() {
  const { colors } = useTheme();

  const sunCy = useSharedValue(250);
  const rayRotation = useSharedValue(0);
  const cloud1Cx = useSharedValue(80);
  const cloud2Cx = useSharedValue(230);

  useEffect(() => {
    sunCy.value = withTiming(200, {
      duration: 1800,
      easing: Easing.out(Easing.ease),
    });

    rayRotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false,
    );

    cloud1Cx.value = withRepeat(
      withSequence(
        withTiming(100, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(80, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    cloud2Cx.value = withRepeat(
      withSequence(
        withTiming(210, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(230, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [sunCy, rayRotation, cloud1Cx, cloud2Cx]);

  const sunProps = useAnimatedProps(() => ({
    cy: sunCy.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    cy: sunCy.value,
  }));

  const rayGroupProps = useAnimatedProps(() => ({
    rotation: rayRotation.value,
  }));

  const cloud1Props = useAnimatedProps(() => ({
    cx: cloud1Cx.value,
  }));

  const cloud2Props = useAnimatedProps(() => ({
    cx: cloud2Cx.value,
  }));

  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    const angle = (i * 360) / RAY_COUNT;
    const rad = (angle * Math.PI) / 180;
    const x1 = SUN_CX + Math.cos(rad) * RAY_INNER;
    const y1Inner = Math.sin(rad) * RAY_INNER;
    const x2 = SUN_CX + Math.cos(rad) * RAY_OUTER;
    const y2Outer = Math.sin(rad) * RAY_OUTER;
    return (
      <Line
        key={`ray-${i}`}
        x1={x1}
        y1={y1Inner}
        x2={x2}
        y2={y2Outer}
        stroke={colors.gold}
        strokeWidth={1.5}
        opacity={0.18}
        strokeLinecap="round"
      />
    );
  });

  const waterLines = [210, 230, 250, 270].map((y, i) => (
    <Line
      key={`wl-${i}`}
      x1={30 + i * 20}
      y1={y}
      x2={270 - i * 20}
      y2={y}
      stroke={colors.accent}
      strokeWidth={0.8}
      opacity={0.15}
    />
  ));

  return (
    <Svg viewBox="0 0 300 300" width={310} height={310}>
      <Defs>
        <LinearGradient id="sunrise-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.coral} stopOpacity="0.4" />
          <Stop offset="1" stopColor={colors.gold} stopOpacity="0.15" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={300} height={300} rx={18} fill="url(#sunrise-sky)" />

      <AnimatedG animatedProps={rayGroupProps} origin={`${SUN_CX}, 0`}>
        {rays}
      </AnimatedG>

      <AnimatedCircle
        cx={SUN_CX}
        r={28}
        fill={colors.gold}
        opacity={0.2}
        animatedProps={glowProps}
      />
      <AnimatedCircle
        cx={SUN_CX}
        r={18}
        fill="#ffeacc"
        animatedProps={sunProps}
      />

      <AnimatedEllipse
        cy={130}
        rx={32}
        ry={10}
        fill={colors.text}
        opacity={0.08}
        animatedProps={cloud1Props}
      />
      <AnimatedEllipse
        cy={110}
        rx={26}
        ry={8}
        fill={colors.text}
        opacity={0.06}
        animatedProps={cloud2Props}
      />

      <Rect x={0} y={200} width={300} height={100} fill={colors.bg} opacity={0.5} />
      {waterLines}
    </Svg>
  );
}
