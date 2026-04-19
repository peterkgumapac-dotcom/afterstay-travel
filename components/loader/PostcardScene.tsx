import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Line,
  Path,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

function PostcardCard({
  rotation,
  delay,
  fill,
  strokeColor,
  children,
}: {
  readonly rotation: number;
  readonly delay: number;
  readonly fill: string;
  readonly strokeColor: string;
  readonly children?: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }),
    );
  }, [delay, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 310,
          height: 310,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animStyle,
      ]}
    >
      <Svg viewBox="0 0 300 300" width={280} height={280}>
        <Rect
          x={30}
          y={60}
          width={240}
          height={160}
          rx={10}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={1.2}
        />
        {children}
      </Svg>
    </Animated.View>
  );
}

export default function PostcardScene() {
  const { colors } = useTheme();

  const stampScale = useSharedValue(0);

  useEffect(() => {
    stampScale.value = withDelay(
      900,
      withSpring(1, { damping: 9, stiffness: 140 }),
    );
  }, [stampScale]);

  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 220 },
      { translateY: 50 },
      { scale: stampScale.value },
    ],
    opacity: stampScale.value,
  }));

  return (
    <Animated.View style={{ width: 310, height: 310, position: 'relative' }}>
      {/* Back card */}
      <PostcardCard
        rotation={4}
        delay={300}
        fill={colors.card}
        strokeColor={colors.border}
      />

      {/* Middle card */}
      <PostcardCard
        rotation={-3}
        delay={150}
        fill={colors.card2}
        strokeColor={colors.border}
      />

      {/* Front card */}
      <PostcardCard
        rotation={0}
        delay={0}
        fill="#fffaf0"
        strokeColor={colors.accent}
      >
        {/* Vertical divider */}
        <Line
          x1={150}
          y1={70}
          x2={150}
          y2={210}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* Left side: mini landscape */}
        <Rect x={42} y={78} width={96} height={64} rx={6} fill={colors.coral} opacity={0.3} />
        <Path
          d="M 42 142 L 60 110 L 78 125 L 100 100 L 138 142 Z"
          fill={colors.accent}
          opacity={0.25}
        />

        {/* Right side: address lines */}
        <Line x1={162} y1={110} x2={254} y2={110} stroke={colors.border2} strokeWidth={1} />
        <Line x1={162} y1={128} x2={254} y2={128} stroke={colors.border2} strokeWidth={1} />
        <Line x1={162} y1={146} x2={254} y2={146} stroke={colors.border2} strokeWidth={1} />
        <Line x1={162} y1={164} x2={230} y2={164} stroke={colors.border2} strokeWidth={1} />
      </PostcardCard>

      {/* Stamp overlay */}
      <Animated.View style={[{ position: 'absolute', width: 32, height: 32 }, stampStyle]}>
        <Svg viewBox="0 0 32 32" width={32} height={32}>
          <Rect x={2} y={2} width={28} height={28} rx={4} fill={colors.accent} />
          <Path
            d="M 10 22 L 16 8 L 22 22 Z"
            fill="#fffaf0"
            opacity={0.8}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
