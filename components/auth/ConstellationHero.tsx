import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const HERO_HEIGHT = 300;
const STAR_COUNT = 35;

const CONSTELLATION_VERTICES = [
  [22, 30],
  [54, 18],
  [78, 42],
  [60, 62],
] as const;

const CONSTELLATION_EDGES = [
  [0, 1],
  [1, 2],
  [2, 0],
  [1, 3],
] as const;

function createRng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

interface StarData {
  cx: number;
  cy: number;
  r: number;
  baseOpacity: number;
}

function generateStars(count: number): readonly StarData[] {
  const rng = createRng(7);
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      cx: rng() * 100,
      cy: rng() * 100,
      r: 0.6 + rng() * 1.0,
      baseOpacity: 0.18 + rng() * 0.37,
    });
  }
  return stars;
}

function TwinklingStar({ star, index }: { star: StarData; index: number }) {
  const opacity = useSharedValue(star.baseOpacity);

  useEffect(() => {
    const rng = createRng(index + 42);
    const duration = 1800 + rng() * 2400;
    const lowOpacity = star.baseOpacity * 0.4;
    const highOpacity = Math.min(star.baseOpacity * 1.6, 0.7);

    opacity.value = withDelay(
      index * 80,
      withRepeat(
        withSequence(
          withTiming(highOpacity, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(lowOpacity, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, [index, opacity, star.baseOpacity]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedCircle
      cx={`${star.cx}%`}
      cy={`${star.cy}%`}
      r={star.r}
      fill="#fff"
      animatedProps={animatedProps}
    />
  );
}

function ConstellationLine({ from, to, index }: {
  from: readonly [number, number];
  to: readonly [number, number];
  index: number;
}) {
  const dashOffset = useSharedValue(40);

  useEffect(() => {
    dashOffset.value = withDelay(
      400 + index * 200,
      withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
  }, [dashOffset, index]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <AnimatedLine
      x1={`${from[0]}%`}
      y1={`${from[1]}%`}
      x2={`${to[0]}%`}
      y2={`${to[1]}%`}
      stroke="rgba(255,255,255,0.25)"
      strokeWidth={0.8}
      strokeDasharray="40"
      animatedProps={animatedProps}
    />
  );
}

function ConstellationVertex({ pos, index }: {
  pos: readonly [number, number];
  index: number;
}) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 120,
      withSpring(1, { damping: 12, stiffness: 120 }),
    );
  }, [index, scale]);

  const animatedProps = useAnimatedProps(() => ({
    r: 2.4 * scale.value,
    opacity: scale.value,
  }));

  return (
    <AnimatedCircle
      cx={`${pos[0]}%`}
      cy={`${pos[1]}%`}
      fill="#fff"
      animatedProps={animatedProps}
    />
  );
}

function bezierPoint(t: number) {
  'worklet';
  const p0x = 8;
  const p0y = 88;
  const cpx = 40;
  const cpy = 10;
  const p1x = 92;
  const p1y = 22;

  const x = (1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * cpx + t * t * p1x;
  const y = (1 - t) * (1 - t) * p0y + 2 * (1 - t) * t * cpy + t * t * p1y;
  return { x, y };
}

function Plane() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      600,
      withRepeat(
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [progress]);

  const animatedProps = useAnimatedProps(() => {
    const { x, y } = bezierPoint(progress.value);
    const size = 3;
    const p1 = `${x},${y - size}`;
    const p2 = `${x - size * 0.7},${y + size * 0.6}`;
    const p3 = `${x + size * 0.7},${y + size * 0.6}`;
    return {
      points: `${p1} ${p2} ${p3}`,
      opacity: progress.value < 0.02 || progress.value > 0.95 ? 0 : 0.7,
    };
  });

  return (
    <AnimatedPolygon
      fill="#fff"
      animatedProps={animatedProps}
    />
  );
}

export default function ConstellationHero() {
  const { colors } = useTheme();
  const stars = useMemo(() => generateStars(STAR_COUNT), []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.accent, colors.coral, colors.accentDk]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          {stars.map((star, i) => (
            <TwinklingStar key={i} star={star} index={i} />
          ))}

          {CONSTELLATION_EDGES.map(([a, b], i) => (
            <ConstellationLine
              key={`edge-${i}`}
              from={CONSTELLATION_VERTICES[a]}
              to={CONSTELLATION_VERTICES[b]}
              index={i}
            />
          ))}

          {CONSTELLATION_VERTICES.map((pos, i) => (
            <ConstellationVertex key={`vert-${i}`} pos={pos} index={i} />
          ))}

          <Plane />
        </Svg>

        <View style={styles.brandLockup}>
          <Text style={styles.brandName}>afterstay</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>The trip, after the stay</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HERO_HEIGHT,
    width: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  brandLockup: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    gap: spacing.sm,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.6,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
});
