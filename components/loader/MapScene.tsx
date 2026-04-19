import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Circle,
  Path,
  Line,
  Polyline,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface PinPosition {
  readonly x: number;
  readonly y: number;
}

const PINS: readonly PinPosition[] = [
  { x: 90, y: 95 },
  { x: 175, y: 140 },
  { x: 220, y: 90 },
  { x: 130, y: 200 },
  { x: 225, y: 215 },
] as const;

const PATH_LENGTH_ESTIMATE = 600;

const GRID_H_COUNT = 8;
const GRID_V_COUNT = 9;
const GRID_START_X = 20;
const GRID_START_Y = 30;
const GRID_STEP = 30;

function Pin({ pin, index, accentColor }: {
  readonly pin: PinPosition;
  readonly index: number;
  readonly accentColor: string;
}) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 250,
      withSpring(1, { damping: 10, stiffness: 120 }),
    );
  }, [index, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pin.x - 8 },
      { translateY: pin.y - 20 },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', width: 16, height: 22 }, animStyle]}>
      <Svg viewBox="0 0 16 22" width={16} height={22}>
        <Path
          d="M 8 0 C 3.6 0 0 3.6 0 8 C 0 14 8 22 8 22 C 8 22 16 14 16 8 C 16 3.6 12.4 0 8 0 Z"
          fill={accentColor}
        />
        <Circle cx={8} cy={8} r={3} fill="#fff" />
      </Svg>
    </Animated.View>
  );
}

export default function MapScene() {
  const { colors } = useTheme();

  const pathDashOffset = useSharedValue(PATH_LENGTH_ESTIMATE);

  useEffect(() => {
    pathDashOffset.value = withTiming(0, {
      duration: 1600,
      easing: Easing.inOut(Easing.ease),
    });
  }, [pathDashOffset]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathDashOffset.value,
  }));

  const pointsStr = PINS.map((p) => `${p.x},${p.y}`).join(' ');

  const horizontalLines = Array.from({ length: GRID_H_COUNT }, (_, i) => {
    const y = GRID_START_Y + i * GRID_STEP;
    return (
      <Line
        key={`h-${i}`}
        x1={GRID_START_X}
        y1={y}
        x2={GRID_START_X + 260}
        y2={y}
        stroke={colors.border}
        strokeWidth={0.6}
        opacity={0.7}
      />
    );
  });

  const verticalLines = Array.from({ length: GRID_V_COUNT }, (_, i) => {
    const x = GRID_START_X + i * GRID_STEP;
    return (
      <Line
        key={`v-${i}`}
        x1={x}
        y1={GRID_START_Y}
        x2={x}
        y2={GRID_START_Y + 240}
        stroke={colors.border}
        strokeWidth={0.6}
        opacity={0.7}
      />
    );
  });

  return (
    <Animated.View style={{ width: 310, height: 310 }}>
      <Svg viewBox="0 0 300 300" width={310} height={310}>
        <Rect
          x={20}
          y={30}
          width={260}
          height={240}
          rx={16}
          fill={colors.card2}
          stroke={colors.border}
          strokeWidth={1}
        />

        {horizontalLines}
        {verticalLines}

        <Path
          d="M 50 140 Q 80 90 140 110 Q 200 120 240 180 Q 220 240 160 230 Q 90 235 60 200 Z"
          fill={colors.accent}
          opacity={0.14}
          stroke={colors.accent}
          strokeWidth={1}
          strokeDasharray="6 4"
        />

        <AnimatedPolyline
          points={pointsStr}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          strokeDasharray={`${PATH_LENGTH_ESTIMATE}`}
          strokeLinecap="round"
          strokeLinejoin="round"
          animatedProps={pathProps}
        />
      </Svg>

      {PINS.map((pin, i) => (
        <Pin key={`pin-${i}`} pin={pin} index={i} accentColor={colors.accent} />
      ))}
    </Animated.View>
  );
}
