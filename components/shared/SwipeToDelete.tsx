import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';

const DELETE_THRESHOLD = -100;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteColor?: string;
  deleteLabel?: string;
}

export function SwipeToDelete({
  children,
  onDelete,
  deleteColor = '#c4554a',
  deleteLabel = 'Remove',
}: SwipeToDeleteProps) {
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue<number | null>(null);
  const isDeleting = useSharedValue(false);

  const handleDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      // Only allow swiping left
      if (e.translationX < 0) {
        translateX.value = e.translationX;
      } else {
        translateX.value = 0;
      }
    })
    .onEnd((e) => {
      if (e.translationX < DELETE_THRESHOLD) {
        // Swipe past threshold — animate out and delete
        isDeleting.value = true;
        translateX.value = withTiming(-400, { duration: 250 }, () => {
          if (rowHeight.value !== null) {
            rowHeight.value = withTiming(0, { duration: 200 }, () => {
              runOnJS(handleDelete)();
            });
          } else {
            runOnJS(handleDelete)();
          }
        });
      } else {
        // Snap back
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, DELETE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const iconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [0, DELETE_THRESHOLD],
      [0.5, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale }],
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    if (rowHeight.value !== null && isDeleting.value) {
      return { height: rowHeight.value, overflow: 'hidden' as const };
    }
    return {};
  });

  return (
    <Animated.View
      style={containerStyle}
      onLayout={(e) => {
        if (rowHeight.value === null) {
          rowHeight.value = e.nativeEvent.layout.height;
        }
      }}
    >
      <View style={styles.container}>
        {/* Delete backdrop */}
        <Animated.View style={[styles.backdrop, { backgroundColor: deleteColor }, backdropStyle]}>
          <Animated.View style={[styles.deleteContent, iconStyle]}>
            <Trash2 size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.deleteText}>{deleteLabel}</Text>
          </Animated.View>
        </Animated.View>

        {/* Swipeable content */}
        <GestureDetector gesture={pan}>
          <Animated.View style={contentStyle}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
    borderRadius: 8,
  },
  deleteContent: {
    alignItems: 'center',
    gap: 4,
  },
  deleteText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
