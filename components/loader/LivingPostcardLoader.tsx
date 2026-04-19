import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';

import PlaneScene from './PlaneScene';
import MapScene from './MapScene';
import SunriseScene from './SunriseScene';
import PostcardScene from './PostcardScene';
import CompassScene from './CompassScene';

const TOTAL_SCENES = 5;
const FINAL_DELAY_MS = 650;
const DOT_SIZE = 5;
const DOT_ACTIVE_WIDTH = 16;

interface LivingPostcardLoaderProps {
  readonly onDone?: () => void;
  readonly durationMs?: number;
  readonly destination?: string;
  readonly name?: string;
}

interface SceneConfig {
  readonly k: string;
  readonly line: string;
  readonly sub: string;
}

function buildScenes(name: string, destination: string): readonly SceneConfig[] {
  return [
    { k: 'plane', line: `Packing your passport, ${name}`, sub: 'Pulling bookings from your inbox\u2026' },
    { k: 'map', line: `Dropping pins around ${destination}`, sub: 'Hotels, beaches, that sisig spot.' },
    { k: 'sun', line: 'Reading the skies', sub: 'Sunrise at 5:42, rain at 8pm.' },
    { k: 'postcard', line: 'Stitching your days together', sub: 'Seven perfect ones, coming up.' },
    { k: 'compass', line: `Ready when you are, ${name}`, sub: 'Tap to begin.' },
  ] as const;
}

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  plane: PlaneScene,
  map: MapScene,
  sun: SunriseScene,
  postcard: PostcardScene,
  compass: CompassScene,
};

function ProgressDots({ current, colors }: {
  readonly current: number;
  readonly colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={staticStyles.dotsContainer}>
      {Array.from({ length: TOTAL_SCENES }, (_, i) => (
        <Dot key={i} index={i} current={current} colors={colors} />
      ))}
    </View>
  );
}

function Dot({ index, current, colors }: {
  readonly index: number;
  readonly current: number;
  readonly colors: ReturnType<typeof useTheme>['colors'];
}) {
  const isActive = index === current;
  const isFilled = index <= current;
  const width = useSharedValue(isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE);

  useEffect(() => {
    // transition: all 0.45s cubic-bezier(.4,.1,.2,1)
    width.value = withTiming(isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE, {
      duration: 450,
      easing: Easing.bezier(0.4, 0.1, 0.2, 1),
    });
  }, [isActive, width]);

  const animStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return (
    <Animated.View
      style={[
        {
          height: DOT_SIZE,
          borderRadius: 99,
          backgroundColor: isFilled ? colors.accent : colors.border,
        },
        animStyle,
      ]}
    />
  );
}

function AnimatedEllipsis({ colors }: { readonly colors: ReturnType<typeof useTheme>['colors'] }) {
  // dot keyframe: 0%,20% opacity:0; 50% opacity:1; 100% opacity:0
  // 1.2s infinite, delays 0s, 0.2s, 0.4s
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (sv: typeof d1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            // 0% - 20%: opacity 0 (240ms)
            withTiming(0, { duration: 240 }),
            // 20% - 50%: opacity 0 → 1 (360ms)
            withTiming(1, { duration: 360 }),
            // 50% - 100%: opacity 1 → 0 (600ms)
            withTiming(0, { duration: 600 }),
          ),
          -1,
          false,
        ),
      );
    };
    animateDot(d1, 0);
    animateDot(d2, 200);
    animateDot(d3, 400);
  }, [d1, d2, d3]);

  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

  const dotStyle = { color: colors.text, fontSize: 24, lineHeight: 28, fontWeight: '500' as const, letterSpacing: -0.6 };

  return (
    <View style={staticStyles.ellipsisRow}>
      <Animated.Text style={[dotStyle, s1]}>.</Animated.Text>
      <Animated.Text style={[dotStyle, s2]}>.</Animated.Text>
      <Animated.Text style={[dotStyle, s3]}>.</Animated.Text>
    </View>
  );
}

export default function LivingPostcardLoader({
  onDone,
  durationMs = 6500,
  destination = 'Boracay',
  name = 'Peter',
}: LivingPostcardLoaderProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [idx, setIdx] = useState(0);
  const scenes = useMemo(() => buildScenes(name, destination), [name, destination]);
  const perScene = durationMs / scenes.length;

  const handleDone = useCallback(() => {
    onDone?.();
  }, [onDone]);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= scenes.length - 1) {
          clearInterval(t);
          setTimeout(() => handleDone(), FINAL_DELAY_MS);
          return i;
        }
        return i + 1;
      });
    }, perScene);
    return () => clearInterval(t);
  }, [perScene, handleDone, scenes.length]);

  const scene = scenes[idx];

  // sceneIn: 0.55s cubic-bezier(.2,.8,.2,1)
  // from opacity:0 translateY(12) scale(0.96) → opacity:1 translateY(0) scale(1)
  const sceneOpacity = useSharedValue(0);
  const sceneTY = useSharedValue(12);
  const sceneScale = useSharedValue(0.96);

  useEffect(() => {
    sceneOpacity.value = 0;
    sceneTY.value = 12;
    sceneScale.value = 0.96;
    const easing = Easing.bezier(0.2, 0.8, 0.2, 1);
    sceneOpacity.value = withTiming(1, { duration: 550, easing });
    sceneTY.value = withTiming(0, { duration: 550, easing });
    sceneScale.value = withTiming(1, { duration: 550, easing });
  }, [idx, sceneOpacity, sceneTY, sceneScale]);

  const sceneAnimStyle = useAnimatedStyle(() => ({
    opacity: sceneOpacity.value,
    transform: [
      { translateY: sceneTY.value },
      { scale: sceneScale.value },
    ],
  }));

  // copyIn: 0.5s ease-out
  const copyOpacity = useSharedValue(0);
  const copyTY = useSharedValue(6);

  // sub copyIn: 0.5s ease-out 0.08s delay
  const subOpacity = useSharedValue(0);
  const subTY = useSharedValue(6);

  useEffect(() => {
    copyOpacity.value = 0;
    copyTY.value = 6;
    subOpacity.value = 0;
    subTY.value = 6;
    copyOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
    copyTY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) });
    subOpacity.value = withDelay(80, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
    subTY.value = withDelay(80, withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }));
  }, [idx, copyOpacity, copyTY, subOpacity, subTY]);

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    transform: [{ translateY: copyTY.value }],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: subTY.value }],
  }));

  const SceneComp = SCENE_COMPONENTS[scene.k];

  return (
    <View style={styles.container}>
      {/* Brand bar */}
      <View style={styles.topBar}>
        <Svg width={26} height={26} viewBox="0 0 64 64" fill="none">
          <Circle cx={32} cy={32} r={29} stroke={colors.accent} strokeWidth={2.2} fill="none" opacity={0.95} />
          <Path
            d="M32 12 L52 48 L12 48 Z"
            stroke={colors.accent}
            strokeWidth={2.4}
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <View style={staticStyles.brandTextRow}>
          <Text style={styles.brandAfter}>after</Text>
          <Text style={styles.brandStay}>stay</Text>
        </View>
        {/* Scene dots */}
        <View style={{ marginLeft: 'auto' }}>
          <ProgressDots current={idx} colors={colors} />
        </View>
      </View>

      {/* Stage */}
      <View style={staticStyles.stageOuter}>
        <Animated.View style={[staticStyles.stageInner, sceneAnimStyle]}>
          <SceneComp />
        </Animated.View>
      </View>

      {/* Copy */}
      <View style={staticStyles.copyArea}>
        <Animated.View style={[staticStyles.headingRow, copyStyle]}>
          <Text style={styles.heading}>{scene.line}</Text>
          {idx < scenes.length - 1 && (
            <AnimatedEllipsis colors={colors} />
          )}
        </Animated.View>
        <Animated.View style={subStyle}>
          <Text style={styles.subtext}>{scene.sub}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bg,
      overflow: 'hidden',
      flexDirection: 'column',
    },
    topBar: {
      paddingTop: 28,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandAfter: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.3,
      color: colors.text,
    },
    brandStay: {
      fontSize: 15,
      fontWeight: '500',
      fontStyle: 'italic',
      letterSpacing: -0.3,
      color: colors.accent,
    },
    heading: {
      fontSize: 24,
      fontWeight: '500',
      color: colors.text,
      letterSpacing: -0.6,
      lineHeight: 28,
    },
    subtext: {
      fontSize: 13,
      color: colors.text3,
      marginTop: 8,
    },
  });

const staticStyles = StyleSheet.create({
  brandTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stageOuter: {
    flex: 1,
    position: 'relative',
    marginVertical: 14,
    marginHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageInner: {
    width: '100%',
    maxWidth: 310,
    aspectRatio: 1 / 1.05,
  },
  copyArea: {
    paddingTop: 4,
    paddingHorizontal: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minHeight: 30,
  },
  ellipsisRow: {
    flexDirection: 'row',
    marginLeft: 2,
  },
});
