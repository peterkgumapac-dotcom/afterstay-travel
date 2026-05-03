import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const APP_ICON = require('@/assets/icon/afterstay-icon.png');

type AfterStayLoaderProps = {
  message?: string;
  detail?: string;
  progress?: number;
  steps?: string[];
};

export default function AfterStayLoader({ message, detail, progress, steps = [] }: AfterStayLoaderProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);
  const shimmer = useSharedValue(0);
  const [stepIndex, setStepIndex] = useState(0);

  const safeProgress =
    typeof progress === 'number'
      ? Math.max(0.06, Math.min(progress, 1))
      : steps.length > 0
        ? Math.max(0.12, Math.min((stepIndex + 1) / (steps.length + 1), 0.92))
        : undefined;
  const currentDetail = detail ?? steps[stepIndex];
  const progressLabel = useMemo(() => {
    if (typeof safeProgress !== 'number') return null;
    if (typeof progress !== 'number') {
      return steps.length > 0 ? `Step ${Math.min(stepIndex + 1, steps.length)} of ${steps.length}` : 'Working...';
    }
    return `${Math.round(safeProgress * 100)}%`;
  }, [progress, safeProgress, stepIndex, steps.length]);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [opacity, scale, shimmer]);

  useEffect(() => {
    if (steps.length <= 1) return undefined;
    setStepIndex(0);
    const timer = setInterval(() => {
      setStepIndex((idx) => Math.min(idx + 1, steps.length - 1));
    }, 1400);
    return () => clearInterval(timer);
  }, [steps]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + shimmer.value * 0.45,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={animStyle}>
        <Image source={APP_ICON} style={styles.icon} />
      </Animated.View>
      <Text style={styles.message}>{message ?? 'Loading AfterStay...'}</Text>
      {currentDetail ? <Text style={styles.detail}>{currentDetail}</Text> : null}
      {typeof safeProgress === 'number' ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, shimmerStyle, { width: `${Math.round(safeProgress * 100)}%` }]}
            />
          </View>
          {progressLabel ? <Text style={styles.progressLabel}>{progressLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0d0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  message: {
    color: '#f7efe3',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  detail: {
    color: '#9f9386',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 40,
    textAlign: 'center',
  },
  progressWrap: {
    width: '64%',
    maxWidth: 280,
    marginTop: 22,
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(247,239,227,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#dfb174',
  },
  progressLabel: {
    color: '#7f7368',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
