import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Line,
  Path,
} from 'react-native-svg';
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const HERO_HEIGHT = 300;
const STAR_COUNT = 16;

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
  x: number;
  y: number;
  s: number;
  o: number;
  d: number;
  td: number;
}

function generateStars(count: number): readonly StarData[] {
  const r = createRng(7);
  return Array.from({ length: count }, () => ({
    x: r() * 100,
    y: r() * 100,
    s: 0.6 + r() * 1.6,
    o: 0.18 + r() * 0.55,
    d: r() * 4.5,
    td: 2.2 + r() * 2.8,
  }));
}

function TwinklingStar({ star, index }: { star: StarData; index: number }) {
  const opacity = useSharedValue(star.o);

  useEffect(() => {
    const duration = star.td * 1000;
    const delay = star.d * 1000;

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(star.o, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, [index, opacity, star.o, star.d, star.td]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedCircle
      cx={star.x.toString()}
      cy={star.y.toString()}
      r={(star.s * 0.15).toString()}
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
  const dashOffset = useSharedValue(80);

  useEffect(() => {
    const delay = (0.35 + index * 0.18) * 1000;
    dashOffset.value = withDelay(
      delay,
      withTiming(0, { duration: 1400, easing: Easing.bezier(0.55, 0.1, 0.3, 1) }),
    );
  }, [dashOffset, index]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <AnimatedLine
      x1={from[0].toString()}
      y1={from[1].toString()}
      x2={to[0].toString()}
      y2={to[1].toString()}
      stroke="#fff"
      strokeWidth="0.22"
      opacity="0.42"
      strokeLinecap="round"
      strokeDasharray="80"
      animatedProps={animatedProps}
    />
  );
}

function ConstellationVertex({ pos, index }: {
  pos: readonly [number, number];
  index: number;
}) {
  const scale = useSharedValue(0.2);
  const vertexOpacity = useSharedValue(0);

  useEffect(() => {
    const delay = (0.15 + index * 0.12) * 1000;
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 8, stiffness: 180 }),
    );
    vertexOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );
  }, [index, scale, vertexOpacity]);

  const glowProps = useAnimatedProps(() => ({
    r: (2.8 * scale.value).toString(),
    opacity: 0.16 * vertexOpacity.value,
  }));

  const coreProps = useAnimatedProps(() => ({
    r: (1 * scale.value).toString(),
    opacity: vertexOpacity.value,
  }));

  return (
    <>
      <AnimatedCircle
        cx={pos[0].toString()}
        cy={pos[1].toString()}
        fill="#ffeacc"
        animatedProps={glowProps}
      />
      <AnimatedCircle
        cx={pos[0].toString()}
        cy={pos[1].toString()}
        fill="#ffeacc"
        animatedProps={coreProps}
      />
    </>
  );
}

function PlaneOnArc() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    // Quadratic bezier: P0(-20,240) CP(120,100) P1(260,180)
    // Then smooth to (420,130) via reflected control point
    // Simplified: use a single quadratic for the main arc
    const p0x = -20;
    const p0y = 240;
    const cpx = 120;
    const cpy = 100;
    const p1x = 260;
    const p1y = 180;
    const cp2x = 2 * p1x - cpx; // 400
    const cp2y = 2 * p1y - cpy; // 260
    const p2x = 420;
    const p2y = 130;

    let x: number;
    let y: number;
    let dx: number;
    let dy: number;

    if (t < 0.5) {
      const tt = t * 2;
      x = (1 - tt) * (1 - tt) * p0x + 2 * (1 - tt) * tt * cpx + tt * tt * p1x;
      y = (1 - tt) * (1 - tt) * p0y + 2 * (1 - tt) * tt * cpy + tt * tt * p1y;
      dx = 2 * (1 - tt) * (cpx - p0x) + 2 * tt * (p1x - cpx);
      dy = 2 * (1 - tt) * (cpy - p0y) + 2 * tt * (p1y - cpy);
    } else {
      const tt = (t - 0.5) * 2;
      x = (1 - tt) * (1 - tt) * p1x + 2 * (1 - tt) * tt * cp2x + tt * tt * p2x;
      y = (1 - tt) * (1 - tt) * p1y + 2 * (1 - tt) * tt * cp2y + tt * tt * p2y;
      dx = 2 * (1 - tt) * (cp2x - p1x) + 2 * tt * (p2x - cp2x);
      dy = 2 * (1 - tt) * (cp2y - p1y) + 2 * tt * (p2y - cp2y);
    }

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Map from 390x300 viewBox to percentage
    const xPct = (x / 390) * 100;
    const yPct = (y / 300) * 100;

    return {
      position: 'absolute' as const,
      left: `${xPct}%`,
      top: `${yPct}%`,
      transform: [{ rotate: `${angle}deg` }],
      opacity: 0.95,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Svg width={20} height={10} viewBox="-10 -5 20 10">
        <Path d="M-7 0 L7 -1.6 L10 0 L7 1.6 Z" fill="#ffeacc" />
        <Path d="M0 -3.5 L2.6 0 L0 3.5 Z" fill="#ffeacc" />
      </Svg>
    </Animated.View>
  );
}

function DotPulse() {
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [scale, dotOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#ffd9a8',
    transform: [{ scale: scale.value }],
    opacity: dotOpacity.value,
  }));

  return <Animated.View style={animatedStyle} />;
}

function BrandLockup() {
  const translateY = useSharedValue(14);
  const lockupOpacity = useSharedValue(0);

  useEffect(() => {
    const delay = 200;
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 900, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    );
    lockupOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: 900, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    );
  }, [translateY, lockupOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: lockupOpacity.value,
  }));

  return (
    <Animated.View style={[styles.brandLockup, animatedStyle]}>
      <View style={styles.pill}>
        <DotPulse />
        <Text style={styles.pillText}>THE TRIP, AFTER THE STAY</Text>
      </View>
      <View style={styles.logoRow}>
        <Svg width={40} height={40} viewBox="0 0 64 64" fill="none">
          <Circle cx="32" cy="32" r="29" stroke="#fffaf0" strokeWidth="2.2" fill="none" opacity="0.95" />
          <Path d="M32 12 L52 48 L12 48 Z" stroke="#fffaf0" strokeWidth="2.4" strokeLinejoin="round" fill="none" />
          <Path
            d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
            stroke="#fffaf0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
        </Svg>
        <View style={styles.brandTextRow}>
          <Text style={styles.brandAfter}>after</Text>
          <Text style={styles.brandStay}>stay</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function ConstellationHero() {
  const stars = useMemo(() => generateStars(STAR_COUNT), []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#d58965', '#b9714a', '#955238']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Radial gradient overlays simulated with additional gradient layers */}
      <LinearGradient
        colors={['rgba(230, 135, 80, 0.32)', 'transparent']}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(127, 55, 18, 0.32)', 'transparent']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Starfield SVG */}
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
      </Svg>

      {/* Dashed arc path */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 300"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Path
          d="M-20,240 Q 120,100 260,180 T 420,130"
          stroke="#ffeacc"
          strokeOpacity="0.22"
          strokeWidth="1.2"
          strokeDasharray="3 4"
          fill="none"
        />
      </Svg>

      {/* Animated plane */}
      <PlaneOnArc />

      {/* Film grain overlay — simplified noise via low-opacity pattern */}
      <View style={styles.grainOverlay} />

      {/* Brand lockup */}
      <BrandLockup />
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
    position: 'relative',
  },
  grainOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(180, 150, 100, 0.06)',
  },
  brandLockup: {
    position: 'absolute',
    left: 24,
    bottom: 28,
    right: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 10,
    backgroundColor: 'rgba(255,250,240,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,250,240,0.22)',
    borderRadius: 999,
    marginBottom: 14,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.16 * 10, // 0.16em * fontSize
    textTransform: 'uppercase',
    color: '#fffaf0',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandTextRow: {
    flexDirection: 'row',
  },
  brandAfter: {
    fontSize: 42,
    lineHeight: 42 * 0.95,
    letterSpacing: -0.035 * 42,
    color: '#fffaf0',
    fontWeight: '500',
  },
  brandStay: {
    fontSize: 42,
    lineHeight: 42 * 0.95,
    letterSpacing: -0.035 * 42,
    color: '#ffd9a8',
    fontWeight: '400',
    fontStyle: 'italic',
  },
});
