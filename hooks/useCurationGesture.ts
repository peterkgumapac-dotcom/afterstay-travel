/**
 * useCurationGesture — Reanimated v3 pan gesture for swipe-to-curate cards.
 *
 * Swipe up: favorite (tilt + glow + scale)
 * Swipe down: skip (shrink + fade)
 * 12% screen height threshold to commit
 * Spring snap back on cancel
 * Auto-advance after commit
 * Max favorites gate with error haptic
 */

import { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SCREEN_H = Dimensions.get('window').height;
const COMMIT_THRESHOLD = SCREEN_H * 0.12;

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };
const EXIT_DURATION = 250;

export type CurationAction = 'favorite' | 'skip';

interface UseCurationGestureOptions {
  /** Called when user commits a swipe. */
  onCommit: (action: CurationAction) => void;
  /** Current number of favorites. */
  favoriteCount: number;
  /** Maximum allowed favorites. Swipe-up blocked beyond this. */
  maxFavorites: number;
  /** Whether gestures are enabled. */
  enabled?: boolean;
}

export function useCurationGesture({
  onCommit,
  favoriteCount,
  maxFavorites,
  enabled = true,
}: UseCurationGestureOptions) {
  const translateY = useSharedValue(0);
  const isCommitting = useSharedValue(false);

  const triggerErrorHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const commitFavorite = useCallback(() => {
    triggerSuccessHaptic();
    onCommit('favorite');
  }, [onCommit, triggerSuccessHaptic]);

  const commitSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCommit('skip');
  }, [onCommit]);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetY([-10, 10])
    .failOffsetX([-30, 30])
    .onBegin(() => {
      'worklet';
      // Gesture recognized — finger down
    })
    .onUpdate((e) => {
      'worklet';
      if (isCommitting.value) return;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (isCommitting.value) return;

      const swipeUp = e.translationY < -COMMIT_THRESHOLD;
      const swipeDown = e.translationY > COMMIT_THRESHOLD;

      if (swipeUp) {
        // Gate: max favorites reached
        if (favoriteCount >= maxFavorites) {
          runOnJS(triggerErrorHaptic)();
          translateY.value = withSpring(0, SPRING_CONFIG);
          return;
        }

        isCommitting.value = true;
        // Animate out upward
        translateY.value = withTiming(-SCREEN_H * 0.5, { duration: EXIT_DURATION }, () => {
          runOnJS(commitFavorite)();
          // Reset for next card
          translateY.value = 0;
          isCommitting.value = false;
        });
      } else if (swipeDown) {
        isCommitting.value = true;
        // Animate out downward
        translateY.value = withTiming(SCREEN_H * 0.5, { duration: EXIT_DURATION }, () => {
          runOnJS(commitSkip)();
          // Reset for next card
          translateY.value = 0;
          isCommitting.value = false;
        });
      } else {
        // Cancel — snap back
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Card style: tilt + glow + scale on up, shrink + fade on down
  const cardStyle = useAnimatedStyle(() => {
    const y = translateY.value;

    // Swipe up (negative y): tilt, scale up, glow
    const rotateZ = interpolate(
      y,
      [-COMMIT_THRESHOLD, 0, COMMIT_THRESHOLD],
      [-3, 0, 0],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(
      y,
      [-COMMIT_THRESHOLD * 2, -COMMIT_THRESHOLD, 0, COMMIT_THRESHOLD, COMMIT_THRESHOLD * 2],
      [1.08, 1.05, 1, 0.92, 0.85],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      y,
      [0, COMMIT_THRESHOLD, COMMIT_THRESHOLD * 2],
      [1, 0.7, 0.3],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateY: y },
        { scale },
        { rotateZ: `${rotateZ}deg` },
      ],
      opacity,
    };
  });

  // Glow overlay opacity (visible only on swipe up)
  const glowStyle = useAnimatedStyle(() => {
    const glowOpacity = interpolate(
      translateY.value,
      [-COMMIT_THRESHOLD, -COMMIT_THRESHOLD * 0.3, 0],
      [0.6, 0, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: glowOpacity };
  });

  // Intent indicator: 1 = favorite, -1 = skip, 0 = neutral
  const intentStyle = useAnimatedStyle(() => {
    const intent = interpolate(
      translateY.value,
      [-COMMIT_THRESHOLD, -COMMIT_THRESHOLD * 0.4, 0, COMMIT_THRESHOLD * 0.4, COMMIT_THRESHOLD],
      [1, 0, 0, 0, -1],
      Extrapolation.CLAMP,
    );
    return { opacity: Math.abs(intent) };
  });

  const reset = useCallback(() => {
    translateY.value = withSpring(0, SPRING_CONFIG);
    isCommitting.value = false;
  }, [translateY, isCommitting]);

  return {
    gesture,
    cardStyle,
    glowStyle,
    intentStyle,
    translateY,
    reset,
  };
}
