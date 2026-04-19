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
  ClipPath,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);

const SUN_CX = 150;
const SUN_CY = 200;
const RAY_COUNT = 12;

export default function SunriseScene() {
  const { colors } = useTheme();

  const sunTY = useSharedValue(50);
  const sunOpacity = useSharedValue(0);
  const rayRotation = useSharedValue(0);
  const cloudDriftX = useSharedValue(-20);

  useEffect(() => {
    // sunRise: from translateY(50px) opacity 0 → translateY(0) opacity 1
    // 1.8s cubic-bezier(.2,.7,.2,1)
    sunTY.value = withTiming(0, {
      duration: 1800,
      easing: Easing.bezier(0.2, 0.7, 0.2, 1),
    });
    sunOpacity.value = withTiming(1, {
      duration: 1800,
      easing: Easing.bezier(0.2, 0.7, 0.2, 1),
    });

    // spinSlow: 30s linear infinite
    rayRotation.value = withRepeat(
      withTiming(360, { duration: 30000, easing: Easing.linear }),
      -1,
      false,
    );

    // cloudDrift: 8s ease-in-out infinite alternate, from -20 to 20
    cloudDriftX.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-20, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [sunTY, sunOpacity, rayRotation, cloudDriftX]);

  const sunGroupProps = useAnimatedProps(() => ({
    translateY: sunTY.value,
    opacity: sunOpacity.value,
  }));

  const rayGroupProps = useAnimatedProps(() => ({
    rotation: rayRotation.value,
  }));

  const cloud1Props = useAnimatedProps(() => ({
    cx: 70 + cloudDriftX.value,
  }));

  const cloud2Props = useAnimatedProps(() => ({
    cx: 210 + cloudDriftX.value,
  }));

  const rays = Array.from({ length: RAY_COUNT }, (_, i) => (
    <Line
      key={`ray-${i}`}
      x1={SUN_CX}
      y1={SUN_CY}
      x2={SUN_CX}
      y2={-60}
      stroke="#fffaf0"
      strokeWidth={1.5}
      opacity={0.18}
      transform={`rotate(${i * 30} ${SUN_CX} ${SUN_CY})`}
    />
  ));

  return (
    <Svg viewBox="0 0 300 300" width={310} height={310}>
      <Defs>
        <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#c66a36" />
          <Stop offset="60%" stopColor="#e38868" />
          <Stop offset="100%" stopColor="#ffd9a8" />
        </LinearGradient>
        <ClipPath id="horizonClip">
          <Rect x={0} y={0} width={300} height={200} />
        </ClipPath>
      </Defs>

      {/* sky */}
      <Rect x={0} y={0} width={300} height={200} fill="url(#skyGrad)" opacity={0.85} />

      {/* rays clipped to horizon */}
      <AnimatedG
        animatedProps={rayGroupProps}
        origin={`${SUN_CX}, ${SUN_CY}`}
        clipPath="url(#horizonClip)"
      >
        {rays}
      </AnimatedG>

      {/* sun rising */}
      <AnimatedG animatedProps={sunGroupProps}>
        <Circle cx={SUN_CX} cy={SUN_CY} r={60} fill="#fffaf0" opacity={0.35} />
        <Circle cx={SUN_CX} cy={SUN_CY} r={44} fill="#ffeacc" />
      </AnimatedG>

      {/* drifting clouds */}
      <G>
        <AnimatedEllipse
          cy={85}
          rx={28}
          ry={7}
          fill="#fffaf0"
          opacity={0.5}
          animatedProps={cloud1Props}
        />
        <AnimatedEllipse
          cy={65}
          rx={34}
          ry={8}
          fill="#fffaf0"
          opacity={0.4}
          animatedProps={cloud2Props}
        />
      </G>

      {/* water */}
      <Rect x={0} y={200} width={300} height={100} fill="#7f3712" opacity={0.5} />

      {/* water reflection lines */}
      <G stroke="#ffeacc" strokeWidth={1.5} strokeLinecap="round" opacity={0.45}>
        <Line x1={120} y1={220} x2={180} y2={220} />
        <Line x1={100} y1={240} x2={200} y2={240} />
        <Line x1={80} y1={258} x2={220} y2={258} />
        <Line x1={60} y1={276} x2={240} y2={276} />
      </G>
    </Svg>
  );
}
