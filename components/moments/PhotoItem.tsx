import React, { memo, useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CachedImage } from '@/components/CachedImage';
import { useTheme } from '@/constants/ThemeContext';
import { springPresets, durations, thresholds } from '@/constants/animations';
import type { MomentDisplay } from './types';
import { SelectionOverlay } from './SelectionOverlay';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLS = 3;
export const THUMB_SIZE = (SCREEN_W - 32 - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;

interface PhotoItemProps {
  moment: MomentDisplay;
  index: number;
  selectionMode: boolean;
  selected: boolean;
  onPress: (moment: MomentDisplay) => void;
  onLongPress: (moment: MomentDisplay) => void;
  onToggleSelect: (id: string) => void;
  onDoubleTap?: (moment: MomentDisplay) => void;
  isFavoritedDuringView?: boolean;
}

function PhotoItemComponent({
  moment,
  index,
  selectionMode,
  selected,
  onPress,
  onLongPress,
  onToggleSelect,
  onDoubleTap,
  isFavoritedDuringView,
}: PhotoItemProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const entryY = useSharedValue(20);
  const entryOpacity = useSharedValue(0);
  const favGlowOpacity = useSharedValue(0);

  // Staggered entry animation
  useEffect(() => {
    const delay = index * 50;
    entryY.value = withDelay(
      delay,
      withSpring(0, springPresets.GRID_ENTER)
    );
    entryOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: 300 })
    );
  }, [index]);

  // Golden border glow when favorited during viewing
  useEffect(() => {
    if (isFavoritedDuringView) {
      favGlowOpacity.value = withTiming(1, { duration: 300 });
      const timer = setTimeout(() => {
        favGlowOpacity.value = withTiming(0, { duration: 500 });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFavoritedDuringView]);

  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: entryY.value }, { scale: scale.value }],
    opacity: entryOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: favGlowOpacity.value,
  }));

  const handlePress = useCallback(() => {
    if (selectionMode) {
      Haptics.selectionAsync();
      onToggleSelect(moment.id);
    } else {
      scale.value = withSequence(
        withTiming(0.95, { duration: 80 }),
        withSpring(1, springPresets.SNAPPY)
      );
      onPress(moment);
    }
  }, [selectionMode, moment, onPress, onToggleSelect]);

  const handleLongPress = useCallback(() => {
    if (!selectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSpring(0.95, springPresets.SNAPPY);
      onLongPress(moment);
    }
  }, [selectionMode, moment, onLongPress]);

  // Double tap gesture
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      if (onDoubleTap && !selectionMode) {
        runOnJS(onDoubleTap)(moment);
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      runOnJS(handlePress)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(thresholds.longPress)
    .onStart(() => {
      'worklet';
      runOnJS(handleLongPress)();
    });

  const composed = Gesture.Exclusive(doubleTap, singleTap, longPressGesture);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, entryStyle]}>
        <Pressable
          style={[
            styles.thumb,
            selectionMode && selected && styles.thumbSelected,
          ]}
          accessibilityLabel={`${moment.caption || 'Photo'}${selected ? ', selected' : ''}`}
        >
          {moment.photo ? (
            <CachedImage
              remoteUrl={moment.photo}
              style={StyleSheet.absoluteFillObject}
              blurhash={moment.blurhash}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a1a' }]} />
          )}

          {/* Favorited glow overlay */}
          <Animated.View
            style={[
              styles.favGlow,
              glowStyle,
              { borderColor: colors.accent },
            ]}
          />

          {/* Selection overlay */}
          <SelectionOverlay
            selected={selected}
            selectionMode={selectionMode}
          />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export const PhotoItem = memo(PhotoItemComponent);

const styles = StyleSheet.create({
  container: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbSelected: {
    transform: [{ scale: 0.95 }],
  },
  favGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 8,
    zIndex: 1,
  },
});
