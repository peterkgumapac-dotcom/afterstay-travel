import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Circle,
  Path,
  Line,
  Polyline,
  G,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface PinConfig {
  readonly x: number;
  readonly y: number;
  readonly d: number;
}

const PINS: readonly PinConfig[] = [
  { x: 90, y: 95, d: 0.1 },
  { x: 175, y: 140, d: 0.35 },
  { x: 220, y: 90, d: 0.6 },
  { x: 130, y: 200, d: 0.85 },
  { x: 225, y: 215, d: 1.1 },
] as const;

const PATH_LENGTH = 300;

const GRID_H_COUNT = 8;
const GRID_V_COUNT = 9;
const GRID_X = 20;
const GRID_Y = 30;
const GRID_STEP = 30;

function Pin({ pin, accentColor }: {
  readonly pin: PinConfig;
  readonly accentColor: string;
}) {
  const scale = useSharedValue(0);
  const bobY = useSharedValue(0);

  useEffect(() => {
    // popIn: 0.5s cubic-bezier(.2,1.4,.3,1) with delay
    scale.value = withDelay(
      pin.d * 1000,
      withSequence(
        withTiming(1.15, { duration: 350, easing: Easing.bezier(0.2, 1.4, 0.3, 1) }),
        withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) }),
      ),
    );

    // bobPin: 2.4s ease-in-out infinite, starts after popIn + 0.7s
    bobY.value = withDelay(
      (pin.d + 0.7) * 1000,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [pin.d, scale, bobY]);

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: pin.x * (310 / 300) - 8,
    top: pin.y * (310 / 300) - 22,
    width: 16,
    height: 22,
    opacity: scale.value > 0 ? 1 : 0,
    transform: [
      { scale: scale.value },
      { translateY: bobY.value },
    ],
  }));

  return (
    <Animated.View style={animStyle}>
      <Svg viewBox={`0 0 16 22`} width={16} height={22}>
        <Path
          d={`M 8 0 C 0 0 0 6 8 18 C 16 6 16 0 8 0 Z`}
          fill={accentColor}
        />
        <Circle cx={8} cy={6} r={3} fill="#fffaf0" />
      </Svg>
    </Animated.View>
  );
}

export default function MapScene() {
  const { colors } = useTheme();

  const pathDashOffset = useSharedValue(PATH_LENGTH);

  useEffect(() => {
    // drawPath 1.6s ease-out 0.2s forwards
    pathDashOffset.value = withDelay(
      200,
      withTiming(0, {
        duration: 1600,
        easing: Easing.out(Easing.ease),
      }),
    );
  }, [pathDashOffset]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathDashOffset.value,
  }));

  const pointsStr = PINS.map((p) => `${p.x},${p.y}`).join(' ');

  const horizontalLines = Array.from({ length: GRID_H_COUNT }, (_, i) => {
    const y = GRID_Y + i * GRID_STEP;
    return (
      <Line
        key={`h-${i}`}
        x1={GRID_X}
        y1={y}
        x2={GRID_X + 260}
        y2={y}
        stroke={colors.border}
        strokeWidth={0.6}
        opacity={0.7}
      />
    );
  });

  const verticalLines = Array.from({ length: GRID_V_COUNT }, (_, i) => {
    const x = GRID_X + i * GRID_STEP;
    return (
      <Line
        key={`v-${i}`}
        x1={x}
        y1={GRID_Y}
        x2={x}
        y2={GRID_Y + 240}
        stroke={colors.border}
        strokeWidth={0.6}
        opacity={0.7}
      />
    );
  });

  return (
    <View style={{ width: 310, height: 310 }}>
      <Svg viewBox="0 0 300 300" width={310} height={310}>
        {/* paper card */}
        <Rect
          x={20}
          y={30}
          width={260}
          height={240}
          rx={16}
          fill={colors.card2}
          stroke={colors.border}
        />

        {/* grid */}
        <G opacity={0.7}>
          {horizontalLines}
          {verticalLines}
        </G>

        {/* coastline blob */}
        <Path
          d="M 50 140 Q 80 90 140 110 Q 200 120 240 180 Q 220 240 160 230 Q 90 235 60 200 Z"
          fill={colors.accent}
          opacity={0.14}
          stroke={colors.accent}
          strokeWidth={1}
          strokeOpacity={0.4}
          strokeDasharray="3 3"
        />

        {/* path connecting pins */}
        <AnimatedPolyline
          points={pointsStr}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`${PATH_LENGTH} ${PATH_LENGTH}`}
          animatedProps={pathProps}
        />
      </Svg>

      {/* pins overlay */}
      {PINS.map((pin, i) => (
        <Pin key={`pin-${i}`} pin={pin} accentColor={colors.accent} />
      ))}
    </View>
  );
}
