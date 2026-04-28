import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Gesture,
  GestureType,
  PanGesture,
  TapGesture,
  LongPressGesture,
  PinchGesture,
} from 'react-native-gesture-handler';
import {
  runOnJS,
  SharedValue,
  useSharedValue,
  withSpring,
  withDecay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { springPresets, thresholds } from '@/constants/animations';

export type PhotoGestureCallbacks = {
  onTap?: () => void;
  onDoubleTap?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onPinchStart?: () => void;
  onPinchEnd?: (scale: number) => void;
  onDismissProgress?: (progress: number) => void;
  onDismissComplete?: () => void;
  onActionSheetProgress?: (progress: number) => void;
  onActionSheetOpen?: () => void;
};

interface UsePhotoGesturesOptions {
  enabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  rotateY: SharedValue<number>;
  callbacks: PhotoGestureCallbacks;
}

export function usePhotoGestures(options: UsePhotoGesturesOptions) {
  const {
    enabled = true,
    isFirst = false,
    isLast = false,
    translateX,
    translateY,
    scale,
    opacity,
    rotateY,
    callbacks,
  } = options;

  const dismissProgress = useSharedValue(0);
  const sheetProgress = useSharedValue(0);

  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  }, []);

  const triggerNotification = useCallback((style: Haptics.NotificationFeedbackType) => {
    Haptics.notificationAsync(style);
  }, []);

  // Horizontal pan for carousel navigation
  const horizontalPan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      'worklet';
      const velocity = event.velocityX;
      const translation = event.translationX;

      // Edge resistance
      if ((isFirst && translation > 0) || (isLast && translation < 0)) {
        translateX.value = translation * thresholds.edgeResistance;
      } else {
        translateX.value = translation;
      }

      // Parallax effects
      const progress = Math.abs(translation) / 300;
      scale.value = 1 - progress * (1 - 0.85);
      opacity.value = 1 - progress * (1 - 0.5);
      rotateY.value = (translation / 300) * 15;
    })
    .onEnd((event) => {
      'worklet';
      const velocity = event.velocityX;
      const translation = event.translationX;
      const shouldAdvance = Math.abs(translation) > 100 || Math.abs(velocity) > thresholds.flickVelocity;
      const direction = translation < 0 ? 'left' : 'right';

      if (shouldAdvance && !((isFirst && direction === 'right') || (isLast && direction === 'left'))) {
        // Complete swipe
        const targetX = direction === 'left' ? -500 : 500;
        translateX.value = withSpring(targetX, springPresets.CAROUSEL_SNAP);
        scale.value = withTiming(0.85, { duration: 200 });
        opacity.value = withTiming(0.5, { duration: 200 });
        rotateY.value = withTiming(direction === 'left' ? -15 : 15, { duration: 200 });

        if (direction === 'left' && callbacks.onSwipeLeft) {
          runOnJS(callbacks.onSwipeLeft)();
        } else if (direction === 'right' && callbacks.onSwipeRight) {
          runOnJS(callbacks.onSwipeRight)();
        }
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Snap back
        translateX.value = withSpring(0, springPresets.CAROUSEL_SNAP);
        scale.value = withSpring(1, springPresets.CAROUSEL_SNAP);
        opacity.value = withSpring(1, springPresets.CAROUSEL_SNAP);
        rotateY.value = withSpring(0, springPresets.CAROUSEL_SNAP);
      }
    });

  // Vertical pan for dismiss + action sheet
  const verticalPan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetY([-20, 20])
    .failOffsetX([-10, 10])
    .onUpdate((event) => {
      'worklet';
      const translation = event.translationY;

      if (translation > 0) {
        // Dismiss gesture (swipe down)
        dismissProgress.value = Math.min(translation / thresholds.dismissSwipe, 1);
        translateY.value = translation * 0.6;
        scale.value = 1 - dismissProgress.value * 0.2;
        if (callbacks.onDismissProgress) {
          runOnJS(callbacks.onDismissProgress)(dismissProgress.value);
        }
      } else {
        // Action sheet gesture (swipe up)
        sheetProgress.value = Math.min(Math.abs(translation) / thresholds.actionSheetSwipe, 1);
        if (callbacks.onActionSheetProgress) {
          runOnJS(callbacks.onActionSheetProgress)(sheetProgress.value);
        }
      }
    })
    .onEnd((event) => {
      'worklet';
      const translation = event.translationY;
      const velocity = event.velocityY;

      if (translation > 0) {
        // Dismiss
        if (translation > thresholds.dismissSwipe || velocity > 300) {
          translateY.value = withSpring(800, springPresets.DISMISS);
          scale.value = withTiming(0.8, { duration: 250 });
          opacity.value = withTiming(0, { duration: 250 });
          if (callbacks.onDismissComplete) {
            runOnJS(callbacks.onDismissComplete)();
          }
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          // Spring back with wobble
          translateY.value = withSpring(0, springPresets.BOUNCY);
          scale.value = withSpring(1, springPresets.BOUNCY);
        }
      } else {
        // Action sheet
        if (Math.abs(translation) > thresholds.actionSheetSwipe || velocity < -300) {
          if (callbacks.onActionSheetOpen) {
            runOnJS(callbacks.onActionSheetOpen)();
          }
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        }
        sheetProgress.value = withSpring(0, springPresets.GENTLE);
      }
    });

  // Double tap for favorite
  const doubleTap = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      if (callbacks.onDoubleTap) {
        runOnJS(callbacks.onDoubleTap)();
      }
      runOnJS(triggerNotification)(Haptics.NotificationFeedbackType.Success);
    });

  // Single tap
  const singleTap = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      if (callbacks.onTap) {
        runOnJS(callbacks.onTap)();
      }
    });

  // Long press for selection mode
  const longPress = Gesture.LongPress()
    .enabled(enabled)
    .minDuration(thresholds.longPress)
    .onStart(() => {
      'worklet';
      if (callbacks.onLongPress) {
        runOnJS(callbacks.onLongPress)();
      }
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
    });

  // Pinch for zoom
  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onStart(() => {
      'worklet';
      if (callbacks.onPinchStart) {
        runOnJS(callbacks.onPinchStart)();
      }
    })
    .onUpdate((event) => {
      'worklet';
      scale.value = Math.max(1, Math.min(event.scale, 3));
    })
    .onEnd((event) => {
      'worklet';
      const finalScale = Math.max(1, Math.min(event.scale, 3));
      scale.value = withSpring(finalScale > 1.1 ? finalScale : 1, springPresets.BOUNCY);
      if (callbacks.onPinchEnd) {
        runOnJS(callbacks.onPinchEnd)(finalScale);
      }
    });

  // Compose gestures
  const tapGestures = Gesture.Exclusive(doubleTap, singleTap);
  const composed = Gesture.Simultaneous(
    Gesture.Race(horizontalPan, verticalPan),
    tapGestures,
    longPress,
    pinch
  );

  return {
    gesture: composed,
    dismissProgress,
    sheetProgress,
  };
}
