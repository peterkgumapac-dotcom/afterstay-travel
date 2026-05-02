import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';

interface SepiaPhotoProps {
  uri: string;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}

/** Photo with warm sepia overlay to simulate printed-on-paper look */
export function SepiaPhoto({ uri, style, imageStyle }: SepiaPhotoProps) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri }}
        style={[styles.image, imageStyle]}
        resizeMode="cover"
      />
      {/* Sepia warmth overlay */}
      <View style={styles.sepiaOverlay} pointerEvents="none" />
      {/* Slight desaturation via reducing contrast */}
      <View style={styles.desatOverlay} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#e8e4db',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  sepiaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(112, 66, 20, 0.10)',
  },
  desatOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 230, 207, 0.06)',
  },
});
