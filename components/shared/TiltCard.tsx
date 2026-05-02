import React, { useCallback } from 'react';
import { type ViewStyle, type StyleProp, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { springPresets, scales } from '@/constants/animations';

interface TiltCardProps {
  onPress?: () => void;
  /** Max rotation in degrees (default ±3) */
  maxTilt?: number;
  /** Fire light haptic on press (default false) */
  haptic?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Card wrapper with iOS-native parallax tilt on touch.
 * Tracks finger position relative to card center and maps to
 * subtle rotateX/rotateY transforms with perspective depth.
 */
export function TiltCard({
  onPress,
  maxTilt = scales.tiltMaxDeg,
  haptic = false,
  disabled = false,
  style,
  children,
}: TiltCardProps) {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const cardWidth = useSharedValue(200);
  const cardHeight = useSharedValue(100);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [disabled, haptic, onPress]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    cardWidth.value = e.nativeEvent.layout.width;
    cardHeight.value = e.nativeEvent.layout.height;
  }, []);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      pressScale.value = withSpring(scales.pressDown, springPresets.PRESS);
      // Map touch position to tilt: center = 0, edges = ±maxTilt
      const normalX = (e.x / cardWidth.value - 0.5) * 2; // -1 to 1
      const normalY = (e.y / cardHeight.value - 0.5) * 2;
      rotateY.value = withSpring(normalX * maxTilt, springPresets.PRESS);
      rotateX.value = withSpring(-normalY * maxTilt, springPresets.PRESS);
    })
    .onUpdate((e) => {
      'worklet';
      const normalX = (e.x / cardWidth.value - 0.5) * 2;
      const normalY = (e.y / cardHeight.value - 0.5) * 2;
      // Clamp to bounds
      const clampedX = Math.max(-1, Math.min(1, normalX));
      const clampedY = Math.max(-1, Math.min(1, normalY));
      rotateY.value = clampedX * maxTilt;
      rotateX.value = -clampedY * maxTilt;
    })
    .onFinalize(() => {
      'worklet';
      rotateX.value = withSpring(0, springPresets.TILT_RELEASE);
      rotateY.value = withSpring(0, springPresets.TILT_RELEASE);
      pressScale.value = withSpring(1, springPresets.PRESS);
    });

  const tap = Gesture.Tap()
    .enabled(!disabled && !!onPress)
    .onEnd(() => {
      'worklet';
      if (onPress) runOnJS(handlePress)();
    });

  const gesture = Gesture.Simultaneous(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: scales.tiltPerspective },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: pressScale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animatedStyle]} onLayout={onLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
