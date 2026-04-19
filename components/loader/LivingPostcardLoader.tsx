import React, { useEffect, useState, useCallback } from 'react';
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
import { spacing } from '@/constants/theme';

import PlaneScene from './PlaneScene';
import MapScene from './MapScene';
import SunriseScene from './SunriseScene';
import PostcardScene from './PostcardScene';
import CompassScene from './CompassScene';

const SCENE_DURATION_MS = 1300;
const FINAL_DELAY_MS = 650;
const TOTAL_SCENES = 5;
const DOT_SIZE = 5;
const DOT_ACTIVE_WIDTH = 16;

interface LivingPostcardLoaderProps {
  readonly destination?: string;
  readonly userName?: string;
  readonly message?: string;
  readonly onDone?: () => void;
}

interface SceneConfig {
  readonly key: string;
  readonly line: string;
  readonly sub: string;
}

function buildScenes(userName: string, destination: string): readonly SceneConfig[] {
  return [
    { key: 'plane', line: `Packing your passport, ${userName}`, sub: 'Pulling bookings from your inbox\u2026' },
    { key: 'map', line: `Dropping pins around ${destination}`, sub: 'Hotels, beaches, that sisig spot.' },
    { key: 'sun', line: 'Reading the skies', sub: 'Sunrise at 5:42, rain at 8pm.' },
    { key: 'postcard', line: 'Stitching your days together', sub: 'Seven perfect ones, coming up.' },
    { key: 'compass', line: `Ready when you are, ${userName}`, sub: 'Tap to begin.' },
  ] as const;
}

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  plane: PlaneScene,
  map: MapScene,
  sun: SunriseScene,
  postcard: PostcardScene,
  compass: CompassScene,
};

function ProgressDots({ current, colors }: { readonly current: number; readonly colors: ReturnType<typeof useTheme>['colors'] }) {
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
  const width = useSharedValue(DOT_SIZE);

  useEffect(() => {
    width.value = withTiming(isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE, { duration: 260 });
  }, [isActive, width]);

  const animStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return (
    <Animated.View
      style={[
        staticStyles.dot,
        {
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: isFilled ? colors.accent : 'transparent',
          borderWidth: isFilled ? 0 : 1,
          borderColor: colors.border2,
        },
        animStyle,
      ]}
    />
  );
}

function AnimatedEllipsis({ colors }: { readonly colors: ReturnType<typeof useTheme>['colors'] }) {
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);

  useEffect(() => {
    const pulse = (sv: typeof d1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    };
    pulse(d1, 0);
    pulse(d2, 180);
    pulse(d3, 360);
  }, [d1, d2, d3]);

  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

  const dotStyle = { color: colors.text2, fontSize: 24, fontWeight: '600' as const };

  return (
    <View style={staticStyles.ellipsisRow}>
      <Animated.Text style={[dotStyle, s1]}>.</Animated.Text>
      <Animated.Text style={[dotStyle, s2]}>.</Animated.Text>
      <Animated.Text style={[dotStyle, s3]}>.</Animated.Text>
    </View>
  );
}

export default function LivingPostcardLoader({
  destination = 'Boracay',
  userName = 'traveler',
  onDone,
}: LivingPostcardLoaderProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [currentScene, setCurrentScene] = useState(0);
  const scenes = buildScenes(userName, destination);

  const handleDone = useCallback(() => {
    onDone?.();
  }, [onDone]);

  useEffect(() => {
    if (currentScene < TOTAL_SCENES - 1) {
      const timer = setTimeout(() => {
        setCurrentScene((prev) => prev + 1);
      }, SCENE_DURATION_MS);
      return () => clearTimeout(timer);
    }

    const doneTimer = setTimeout(handleDone, FINAL_DELAY_MS);
    return () => clearTimeout(doneTimer);
  }, [currentScene, handleDone]);

  const copyOpacity = useSharedValue(0);
  const copyTY = useSharedValue(6);

  useEffect(() => {
    copyOpacity.value = 0;
    copyTY.value = 6;
    copyOpacity.value = withTiming(1, { duration: 350 });
    copyTY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.ease) });
  }, [currentScene, copyOpacity, copyTY]);

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    transform: [{ translateY: copyTY.value }],
  }));

  const SceneComp = SCENE_COMPONENTS[scenes[currentScene].key];

  const sceneOpacity = useSharedValue(0);
  const sceneTY = useSharedValue(12);

  useEffect(() => {
    sceneOpacity.value = 0;
    sceneTY.value = 12;
    sceneOpacity.value = withTiming(1, { duration: 400 });
    sceneTY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
  }, [currentScene, sceneOpacity, sceneTY]);

  const sceneAnimStyle = useAnimatedStyle(() => ({
    opacity: sceneOpacity.value,
    transform: [{ translateY: sceneTY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={staticStyles.brandRow}>
          <Svg viewBox="0 0 26 26" width={26} height={26}>
            <Circle cx={13} cy={13} r={11} fill="none" stroke={colors.accent} strokeWidth={1.8} />
            <Path d="M 8 18 L 13 6 L 18 18" fill="none" stroke={colors.accent} strokeWidth={1.6} strokeLinecap="round" />
            <Path d="M 6 22 L 10 20 L 14 22 L 18 20 L 22 22" fill="none" stroke={colors.accent} strokeWidth={1.2} opacity={0.5} />
          </Svg>
          <Text style={styles.brandText}>afterstay</Text>
        </View>
        <ProgressDots current={currentScene} colors={colors} />
      </View>

      {/* Scene area */}
      <Animated.View style={[staticStyles.sceneCenter, sceneAnimStyle]}>
        <SceneComp />
      </Animated.View>

      {/* Bottom copy */}
      <Animated.View style={[staticStyles.copyArea, copyStyle]}>
        <View style={staticStyles.headingRow}>
          <Text style={styles.heading}>{scenes[currentScene].line}</Text>
          {currentScene < TOTAL_SCENES - 1 && (
            <AnimatedEllipsis colors={colors} />
          )}
        </View>
        <Text style={styles.subtext}>{scenes[currentScene].sub}</Text>
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: 60,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    brandText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.6,
      marginLeft: spacing.sm,
    },
    heading: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtext: {
      fontSize: 13,
      color: colors.text3,
      marginTop: 6,
    },
  });

const staticStyles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    // height, borderRadius, etc. applied inline
  },
  sceneCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 310,
    alignSelf: 'center',
  },
  copyArea: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ellipsisRow: {
    flexDirection: 'row',
    marginLeft: 2,
    gap: 1,
  },
});
