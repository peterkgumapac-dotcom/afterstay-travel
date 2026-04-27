import { useEffect } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(
  require('react-native').TextInput,
);

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle;
  decimals?: number;
  /** Delay before animation starts (ms) */
  delay?: number;
}

export default function AnimatedCounter({
  value,
  duration = 1200,
  prefix = '',
  suffix = '',
  style,
  decimals = 0,
  delay = 0,
}: AnimatedCounterProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(value, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [value, duration, delay]);

  const animatedProps = useAnimatedProps(() => {
    const current = progress.value;
    const formatted = decimals > 0
      ? current.toFixed(decimals)
      : Math.round(current).toLocaleString();
    return {
      text: `${prefix}${formatted}${suffix}`,
      defaultValue: `${prefix}0${suffix}`,
    };
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      style={[styles.counter, style]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  counter: {
    padding: 0,
    margin: 0,
  },
});
