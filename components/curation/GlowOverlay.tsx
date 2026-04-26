import React, { memo } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

interface GlowOverlayProps {
  glowStyle: ViewStyle;
}

/**
 * Warm accent glow that fades in as the user swipes up to favorite.
 * Purely decorative — pointer events disabled.
 */
function GlowOverlayInner({ glowStyle }: GlowOverlayProps) {
  return (
    <Animated.View
      style={[styles.overlay, glowStyle]}
      pointerEvents="none"
    />
  );
}

export const GlowOverlay = memo(GlowOverlayInner);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#C8956C',
    borderRadius: 22,
  },
});
