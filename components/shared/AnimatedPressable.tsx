import React, { useCallback } from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { springPresets, scales } from '@/constants/animations';

interface AnimatedPressableProps {
  onPress?: () => void;
  onLongPress?: () => void;
  /** Scale factor on press (default 0.97) */
  scaleDown?: number;
  /** Fire light haptic on press (default true) */
  haptic?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  children: React.ReactNode;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  scaleDown = scales.pressDown,
  haptic = true,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  children,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [disabled, haptic, onPress]);

  const handleLongPress = useCallback(() => {
    if (disabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.();
  }, [disabled, haptic, onLongPress]);

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(scaleDown, springPresets.PRESS);
    })
    .onFinalize(() => {
      'worklet';
      scale.value = withSpring(1, springPresets.PRESS);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(handlePress)();
    });

  const longPress = Gesture.LongPress()
    .enabled(!disabled && !!onLongPress)
    .minDuration(400)
    .onStart(() => {
      'worklet';
      runOnJS(handleLongPress)();
    });

  const gesture = onLongPress
    ? Gesture.Exclusive(longPress, tap)
    : tap;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[style, animatedStyle]}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
