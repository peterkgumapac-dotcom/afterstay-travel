import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect,
  Circle,
  Line,
  Path,
  G,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

interface CardProps {
  readonly delay: number;
  readonly children?: React.ReactNode;
}

function CardFlip({ delay, children }: CardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);

  useEffect(() => {
    // cardFlip: from rotateY(-12deg) translateY(6px) opacity 0
    // 0.7s ease-out with delay
    opacity.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 700, easing: Easing.out(Easing.ease) }));
  }, [delay, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: 310, height: 310, alignItems: 'center', justifyContent: 'center' },
        animStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function PostcardScene() {
  const { colors } = useTheme();

  // stampIn: 0.5s cubic-bezier(.2,1.4,.3,1) 0.9s
  // from rotate(-20deg) scale(0.4) opacity 0
  // 60%: rotate(-12deg) scale(1.1) opacity 1
  // 100%: rotate(-8deg) scale(1) opacity 0.95
  const stampScale = useSharedValue(0.4);
  const stampOpacity = useSharedValue(0);
  const stampRotation = useSharedValue(-20);

  useEffect(() => {
    stampScale.value = withDelay(
      900,
      withSequence(
        withTiming(1.1, { duration: 300, easing: Easing.bezier(0.2, 1.4, 0.3, 1) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
      ),
    );
    stampOpacity.value = withDelay(
      900,
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.bezier(0.2, 1.4, 0.3, 1) }),
        withTiming(0.95, { duration: 200 }),
      ),
    );
    stampRotation.value = withDelay(
      900,
      withSequence(
        withTiming(-12, { duration: 300, easing: Easing.bezier(0.2, 1.4, 0.3, 1) }),
        withTiming(-8, { duration: 200, easing: Easing.out(Easing.ease) }),
      ),
    );
  }, [stampScale, stampOpacity, stampRotation]);

  const stampStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    // stamp is at translate(238, 98) in prototype viewBox coords, scaled to 310/300
    left: 238 * (310 / 300) - 18,
    top: 98 * (310 / 300) - 14,
    width: 36,
    height: 28,
    opacity: stampOpacity.value,
    transform: [
      { rotate: `${stampRotation.value}deg` },
      { scale: stampScale.value },
    ],
  }));

  return (
    <View style={{ width: 310, height: 310, position: 'relative' }}>
      {/* back card — rotate(4) */}
      <CardFlip delay={300}>
        <Svg viewBox="0 0 300 300" width={310} height={310}>
          <G transform="rotate(4 160 150)">
            <Rect
              x={50}
              y={70}
              width={220}
              height={160}
              rx={6}
              fill={colors.card}
              stroke={colors.border}
            />
          </G>
        </Svg>
      </CardFlip>

      {/* middle card — rotate(-3) */}
      <CardFlip delay={150}>
        <Svg viewBox="0 0 300 300" width={310} height={310}>
          <G transform="rotate(-3 160 150)">
            <Rect
              x={50}
              y={70}
              width={220}
              height={160}
              rx={6}
              fill={colors.card}
              stroke={colors.border}
            />
          </G>
        </Svg>
      </CardFlip>

      {/* top card */}
      <CardFlip delay={0}>
        <Svg viewBox="0 0 300 300" width={310} height={310}>
          <Rect
            x={50}
            y={70}
            width={220}
            height={160}
            rx={6}
            fill="#fffaf0"
            stroke={colors.accent}
            strokeOpacity={0.3}
          />
          {/* divider */}
          <Line
            x1={160}
            y1={82}
            x2={160}
            y2={218}
            stroke={colors.accent}
            strokeOpacity={0.3}
            strokeDasharray="2 3"
          />
          {/* left: tiny scene */}
          <Rect x={62} y={82} width={86} height={80} fill="#e38868" opacity={0.4} />
          <Circle cx={132} cy={108} r={12} fill="#ffeacc" />
          <Path
            d="M 62 142 Q 90 125 120 135 Q 145 145 148 150 L 148 162 L 62 162 Z"
            fill="#7f3712"
            opacity={0.55}
          />
          {/* handwritten lines */}
          <G stroke={colors.text3} strokeWidth={1.2} strokeLinecap="round" opacity={0.7}>
            <Line x1={62} y1={180} x2={140} y2={180} />
            <Line x1={62} y1={192} x2={130} y2={192} />
            <Line x1={62} y1={204} x2={146} y2={204} />
          </G>
          {/* right: address lines */}
          <G stroke={colors.text3} strokeWidth={1.2} strokeLinecap="round" opacity={0.6}>
            <Line x1={172} y1={130} x2={250} y2={130} />
            <Line x1={172} y1={144} x2={240} y2={144} />
            <Line x1={172} y1={158} x2={250} y2={158} />
            <Line x1={172} y1={172} x2={220} y2={172} />
          </G>
        </Svg>
      </CardFlip>

      {/* stamp */}
      <Animated.View style={stampStyle}>
        <Svg viewBox="-18 -14 36 28" width={36} height={28}>
          <Rect
            x={-18}
            y={-14}
            width={36}
            height={28}
            fill={colors.accent}
            stroke="#fffaf0"
            strokeWidth={2}
            strokeDasharray="3 2"
          />
          <Path d="M -8 -4 L 8 -4 L 0 6 Z" fill="#fffaf0" />
        </Svg>
      </Animated.View>
    </View>
  );
}
