import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/constants/theme';

const BRAND_COLOR = colors.green;
const PULSE_COLOR = colors.green2;
const LOGO_BG = colors.bg2;

const LOADING_MESSAGES = [
  'Finding the best spots for you...',
  'Checking what locals love...',
  'Building your Boracay guide...',
  'Picking hidden gems nearby...',
  'Almost there...',
] as const;

const ORBIT_EMOJIS = ['✈️', '🏖', '🍽', '🗺', '☕'] as const;

const LOGO_SIZE = 72;
const ORBIT_RADIUS = 100;
const RING_COUNT = 3;
const MESSAGE_INTERVAL_MS = 2500;

interface AfterStayLoaderProps {
  readonly message?: string;
}

function PulseRing({ index }: { readonly index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 800,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 2.6]);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0.5, 0.3, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        animatedStyle,
      ]}
    />
  );
}

function OrbitingEmoji({
  emoji,
  index,
  total,
  rotation,
}: {
  readonly emoji: string;
  readonly index: number;
  readonly total: number;
  readonly rotation: SharedValue<number>;
}) {
  const baseAngle = (index / total) * 2 * Math.PI;

  const animatedStyle = useAnimatedStyle(() => {
    const angle = baseAngle + rotation.value;
    const x = Math.cos(angle) * ORBIT_RADIUS;
    const y = Math.sin(angle) * ORBIT_RADIUS;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
      ],
    };
  });

  return (
    <Animated.View style={[styles.emojiContainer, animatedStyle]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

function AnimatedDots() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = (sv: SharedValue<number>, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-6, { duration: 350, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    };
    bounce(dot1, 0);
    bounce(dot2, 200);
    bounce(dot3, 400);
  }, [dot1, dot2, dot3]);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));
  const style2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));
  const style3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, style1]} />
      <Animated.View style={[styles.dot, style2]} />
      <Animated.View style={[styles.dot, style3]} />
    </View>
  );
}

export default function AfterStayLoader({ message }: AfterStayLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  const logoScale = useSharedValue(1);
  const orbitRotation = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    orbitRotation.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [logoScale, orbitRotation]);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [message]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const displayMessage = message ?? LOADING_MESSAGES[messageIndex];

  return (
    <View style={styles.container}>
      <View style={styles.orbitArea}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <PulseRing key={`ring-${i}`} index={i} />
        ))}

        {ORBIT_EMOJIS.map((emoji, i) => (
          <OrbitingEmoji
            key={`orbit-${i}`}
            emoji={emoji}
            index={i}
            total={ORBIT_EMOJIS.length}
            rotation={orbitRotation}
          />
        ))}

        <Animated.View style={[styles.logoCircle, logoAnimatedStyle]}>
          <Text style={styles.logoLetter}>A</Text>
        </Animated.View>
      </View>

      <Text style={styles.message}>{displayMessage}</Text>
      <AnimatedDots />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitArea: {
    width: ORBIT_RADIUS * 2 + 60,
    height: ORBIT_RADIUS * 2 + 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  pulseRing: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 2,
    borderColor: PULSE_COLOR,
  },
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: LOGO_BG,
    borderWidth: 2.5,
    borderColor: BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
    marginTop: -2,
  },
  emojiContainer: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  message: {
    fontSize: 15,
    color: colors.text2,
    textAlign: 'center',
    paddingHorizontal: 32,
    minHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLOR,
  },
});
