import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { springPresets } from '@/constants/animations';

interface SelectionOverlayProps {
  selected: boolean;
  selectionMode: boolean;
}

export function SelectionOverlay({ selected, selectionMode }: SelectionOverlayProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const borderOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (selectionMode) {
      opacity.value = withTiming(selected ? 1 : 0.6, { duration: 200 });
      borderOpacity.value = withTiming(selected ? 1 : 0, { duration: 200 });
      scale.value = withSpring(selected ? 1 : 0, springPresets.CHECK_POP);
    } else {
      opacity.value = withTiming(1, { duration: 200 });
      borderOpacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 150 });
    }
  }, [selected, selectionMode]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  if (!selectionMode) {
    return (
      <Animated.View
        style={[StyleSheet.absoluteFillObject, dimStyle]}
        pointerEvents="none"
      />
    );
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, dimStyle]}
      pointerEvents="none"
    >
      {/* Golden border for selected */}
      <Animated.View
        style={[
          styles.goldenBorder,
          { opacity: selected ? 1 : 0 },
          borderStyle,
        ]}
      />

      {/* Checkmark */}
      <View style={styles.checkContainer}>
        <Animated.View style={[styles.checkBadge, checkStyle]}>
          <Check size={14} color="#000" strokeWidth={3} />
        </Animated.View>
      </View>

      {/* Dim overlay for unselected */}
      {!selected && <View style={styles.dimOverlay} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  goldenBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#d8ab7a',
    borderRadius: 8,
    zIndex: 2,
  },
  checkContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d8ab7a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
  },
});
