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

interface SparkleConfig {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly duration: number;
  readonly delay: number;
}

const SPARKLES: readonly SparkleConfig[] = [
  { cx: 70, cy: 70, r: 2, duration: 2400, delay: 0 },
  { cx: 240, cy: 90, r: 1.6, duration: 2800, delay: 300 },
  { cx: 230, cy: 240, r: 2, duration: 2200, delay: 600 },
  { cx: 60, cy: 230, r: 1.6, duration: 2600, delay: 900 },
] as const;

function Sparkle({ cx, cy, r, duration, delay, color }: SparkleConfig & { readonly color: string }) {
  const floatY = useSharedValue(0);

  useEffect(() => {
    // float: 0%,100% translateY(0); 50% translateY(-6px)
    floatY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, duration, floatY]);

  const props = useAnimatedProps(() => ({
    cy: cy + floatY.value,
  }));

  return (
    <AnimatedCircle
      cx={cx}
      r={r}
      fill={color}
      opacity={0.8}
      animatedProps={props}
    />
  );
}

export default function CompassScene() {
  const { colors } = useTheme();

  // needlePoint: 1.6s cubic-bezier(.3,.6,.3,1)
  // 0% rotate(-40deg), 40% rotate(65deg), 70% rotate(30deg), 100% rotate(45deg)
  const needleRotation = useSharedValue(-40);

  useEffect(() => {
    needleRotation.value = withSequence(
      withTiming(65, { duration: 640, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
      withTiming(30, { duration: 480, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
      withTiming(45, { duration: 480, easing: Easing.bezier(0.3, 0.6, 0.3, 1) }),
    );
  }, [needleRotation]);

  const needleStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: 310,
    height: 310,
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
    const isMajor = i % 4 === 0;
    const r1 = isMajor ? 82 : 90;
    const r2 = 100;
    return (
      <Line
        key={`tick-${i}`}
        x1={CX + Math.cos(rad) * r1}
        y1={CY + Math.sin(rad) * r1}
        x2={CX + Math.cos(rad) * r2}
        y2={CY + Math.sin(rad) * r2}
        stroke={colors.text2}
        strokeWidth={1.2}
        opacity={isMajor ? 1 : 0.4}
      />
    );
  });

  const cardinals: readonly [string, number, number][] = [
    ['N', 150, 68],
    ['E', 232, 155],
    ['S', 150, 242],
    ['W', 68, 155],
  ];

  return (
    <Animated.View style={{ width: 310, height: 310, position: 'relative' }}>
      <Svg viewBox="0 0 300 300" width={310} height={310}>
        {/* outer ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill={colors.card}
          stroke={colors.accent}
          strokeWidth={2}
        />

        {/* inner dashed ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={96}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.35}
          strokeDasharray="2 4"
        />

        {/* tick marks */}
        {ticks}

        {/* cardinal letters */}
        {cardinals.map(([letter, x, y]) => (
          <SvgText
            key={letter}
            x={x}
            y={y}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={13}
            fontWeight="700"
            fill={letter === 'N' ? colors.accent : colors.text2}
          >
            {letter}
          </SvgText>
        ))}

        {/* floating sparkles */}
        {SPARKLES.map((s, i) => (
          <Sparkle key={`sparkle-${i}`} {...s} color={colors.accent} />
        ))}

        {/* center hub */}
        <Circle cx={CX} cy={CY} r={7} fill="#fffaf0" stroke={colors.accent} strokeWidth={2} />
        <Circle cx={CX} cy={CY} r={2.5} fill={colors.accent} />
      </Svg>

      {/* needle overlay (animated rotation) */}
      <Animated.View style={needleStyle}>
        <Svg viewBox="0 0 300 300" width={310} height={310}>
          {/* full diamond outline */}
          <Path
            d="M 150 82 L 158 150 L 150 218 L 142 150 Z"
            fill={colors.accent}
            opacity={0.95}
          />
          {/* north half — solid accent */}
          <Path
            d="M 150 82 L 158 150 L 142 150 Z"
            fill={colors.accent}
          />
          {/* south half — dim */}
          <Path
            d="M 150 218 L 158 150 L 142 150 Z"
            fill={colors.textDim}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
