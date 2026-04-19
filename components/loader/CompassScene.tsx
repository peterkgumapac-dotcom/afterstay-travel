import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CX = 150;
const CY = 150;
const OUTER_R = 110;
const TICK_COUNT = 32;
const TICK_OUTER = OUTER_R - 6;
const TICK_SHORT = 8;
const TICK_LONG = 14;

interface SparklePosition {
  readonly x: number;
  readonly y: number;
  readonly delay: number;
}

const SPARKLES: readonly SparklePosition[] = [
  { x: 50, y: 50, delay: 0 },
  { x: 260, y: 60, delay: 200 },
  { x: 40, y: 250, delay: 400 },
  { x: 265, y: 245, delay: 600 },
] as const;

function Sparkle({ x, y, delay, color }: SparklePosition & { readonly color: string }) {
  const ty = useSharedValue(0);

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(4, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, [delay, ty]);

  const props = useAnimatedProps(() => ({
    cy: y + ty.value,
  }));

  return (
    <AnimatedCircle
      cx={x}
      r={2.5}
      fill={color}
      opacity={0.4}
      animatedProps={props}
    />
  );
}

export default function CompassScene() {
  const { colors } = useTheme();

  const needleRotation = useSharedValue(0);

  useEffect(() => {
    needleRotation.value = withSequence(
      withTiming(-40, { duration: 400, easing: Easing.out(Easing.ease) }),
      withTiming(65, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      withTiming(30, { duration: 350, easing: Easing.inOut(Easing.ease) }),
      withTiming(45, { duration: 350, easing: Easing.out(Easing.ease) }),
    );
  }, [needleRotation]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -155 },
      { translateY: -155 },
      { rotate: `${needleRotation.value}deg` },
      { translateX: 155 },
      { translateY: 155 },
    ],
  }));

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i * 360) / TICK_COUNT;
    const rad = (angle * Math.PI) / 180;
    const isCardinal = i % 8 === 0;
    const len = isCardinal ? TICK_LONG : TICK_SHORT;
    const r1 = TICK_OUTER;
    const r2 = TICK_OUTER - len;
    return (
      <Line
        key={`tick-${i}`}
        x1={CX + Math.cos(rad) * r1}
        y1={CY + Math.sin(rad) * r1}
        x2={CX + Math.cos(rad) * r2}
        y2={CY + Math.sin(rad) * r2}
        stroke={colors.text3}
        strokeWidth={isCardinal ? 2 : 1}
        opacity={isCardinal ? 0.6 : 0.3}
      />
    );
  });

  return (
    <Animated.View style={{ width: 310, height: 310, position: 'relative' }}>
      <Svg viewBox="0 0 300 300" width={310} height={310}>
        {/* Outer ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill={colors.card}
          stroke={colors.accent}
          strokeWidth={2}
        />

        {/* Inner dashed ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={96}
          fill="none"
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Tick marks */}
        {ticks}

        {/* Cardinal letters */}
        <SvgText
          x={150}
          y={68}
          textAnchor="middle"
          fontSize={14}
          fontWeight="700"
          fill={colors.accent}
        >
          N
        </SvgText>
        <SvgText
          x={232}
          y={155}
          textAnchor="middle"
          fontSize={12}
          fontWeight="600"
          fill={colors.text3}
        >
          E
        </SvgText>
        <SvgText
          x={150}
          y={242}
          textAnchor="middle"
          fontSize={12}
          fontWeight="600"
          fill={colors.text3}
        >
          S
        </SvgText>
        <SvgText
          x={68}
          y={155}
          textAnchor="middle"
          fontSize={12}
          fontWeight="600"
          fill={colors.text3}
        >
          W
        </SvgText>

        {/* Sparkles */}
        {SPARKLES.map((s, i) => (
          <Sparkle key={`sparkle-${i}`} {...s} color={colors.accent} />
        ))}

        {/* Center hub */}
        <Circle cx={CX} cy={CY} r={7} fill="#fffaf0" stroke={colors.accent} strokeWidth={1.5} />
        <Circle cx={CX} cy={CY} r={2.5} fill={colors.accent} />
      </Svg>

      {/* Needle overlay (animated rotation) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 310,
            height: 310,
          },
          needleStyle,
        ]}
      >
        <Svg viewBox="0 0 300 300" width={310} height={310}>
          {/* Top half (north) — accent */}
          <Path
            d="M 150 82 L 158 150 L 142 150 Z"
            fill={colors.accent}
          />
          {/* Bottom half (south) — dim */}
          <Path
            d="M 150 218 L 158 150 L 142 150 Z"
            fill={colors.text3}
            opacity={0.4}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
