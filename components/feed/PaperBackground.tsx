import React from 'react';
import { ImageBackground, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PAPER } from './feedTheme';

const paperTexture = require('@/assets/textures/paper-ivory.png');

interface PaperBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function PaperBackground({ children, style }: PaperBackgroundProps) {
  return (
    <ImageBackground
      source={paperTexture}
      resizeMode="repeat"
      imageStyle={styles.texture}
      style={[styles.container, style]}
    >
      {/* Corner darkening — aged look */}
      <LinearGradient
        colors={[PAPER.cornerDark, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(70,40,10,0.12)']}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Center warm glow */}
      <View style={styles.centerGlow} pointerEvents="none" />

      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER.ivory,
  },
  texture: {
    opacity: 0.85,
  },
  centerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(252,245,225,0.25)',
    borderRadius: 999,
    transform: [{ scaleX: 2 }, { scaleY: 1.5 }],
    opacity: 0.4,
  },
});
