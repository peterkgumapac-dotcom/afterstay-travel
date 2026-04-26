import React, { memo } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

interface PhotoItem {
  id: string;
  uri: string;
}

interface PhotoLayerProps {
  photos: PhotoItem[];
  currentIndex: SharedValue<number>;
  animatedStyle: ViewStyle;
}

/**
 * Worklet-driven photo layer. The visible photo is selected via
 * SharedValue index — no React re-renders when swiping.
 *
 * Renders a stack of Animated.Image elements with only the active
 * one visible (opacity 1), driven entirely on the UI thread.
 */
function PhotoLayerInner({ photos, currentIndex, animatedStyle }: PhotoLayerProps) {
  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {photos.map((photo, i) => (
        <PhotoSlot key={photo.id} uri={photo.uri} index={i} currentIndex={currentIndex} />
      ))}
    </Animated.View>
  );
}

interface PhotoSlotProps {
  uri: string;
  index: number;
  currentIndex: SharedValue<number>;
}

const PhotoSlot = memo(function PhotoSlot({ uri, index, currentIndex }: PhotoSlotProps) {
  const slotStyle = useAnimatedStyle(() => ({
    opacity: Math.round(currentIndex.value) === index ? 1 : 0,
    zIndex: Math.round(currentIndex.value) === index ? 1 : 0,
  }));

  return (
    <Animated.Image
      source={{ uri }}
      style={[styles.image, slotStyle]}
      resizeMode="cover"
    />
  );
});

export const PhotoLayer = memo(PhotoLayerInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
