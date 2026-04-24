import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DayRecap } from './generateRecap';

interface PolaroidTemplateProps {
  recap: DayRecap;
  onPhotoPress?: (uri: string) => void;
}

export function PolaroidTemplate({ recap, onPhotoPress }: PolaroidTemplateProps) {
  // Show up to 3 polaroids, slightly rotated
  const rotations = [-3, 2, -1.5];
  const photos = recap.photos.slice(0, 3);

  return (
    <View style={styles.card}>
      {/* Textured background */}
      <View style={styles.bg} />

      {/* Stacked polaroids */}
      <View style={styles.polaroidStack}>
        {photos.map((uri, i) => (
          <View
            key={i}
            style={[
              styles.polaroid,
              {
                transform: [
                  { rotate: `${rotations[i % rotations.length]}deg` },
                  { translateX: (i - 1) * 8 },
                ],
                zIndex: photos.length - i,
              },
            ]}
          >
            <Pressable onPress={() => onPhotoPress?.(uri)}>
              <Image
                source={{ uri, cache: 'force-cache' }}
                style={styles.polaroidImage}
                resizeMode="cover"
              />
            </Pressable>
            <View style={styles.polaroidBottom}>
              {i === 0 && recap.caption ? (
                <Text style={styles.handwriting} numberOfLines={1}>{recap.caption}</Text>
              ) : i === 0 ? (
                <Text style={styles.handwriting}>{recap.places[0] ?? recap.destination}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.dayText}>Day {recap.dayNumber}</Text>
          <Text style={styles.dateText}>{recap.dayOfWeek}, {recap.dayLabel}</Text>
        </View>
        <View style={styles.statsCol}>
          <Text style={styles.statText}>{recap.totalMoments} moments</Text>
          <Text style={styles.statText}>{recap.placeCount} {recap.placeCount === 1 ? 'place' : 'places'}</Text>
        </View>
      </View>

      <Text style={styles.destination}>{recap.destination}</Text>
      <Text style={styles.watermark}>afterstay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5EFE0',
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5EFE0',
  },
  polaroidStack: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
    marginBottom: 16,
  },
  polaroid: {
    position: 'absolute',
    backgroundColor: '#fff',
    padding: 8,
    paddingBottom: 0,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  polaroidImage: {
    width: 200,
    height: 200,
  },
  polaroidBottom: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handwriting: {
    fontSize: 14,
    color: '#3C2814',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  dayText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3C2814',
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    color: '#8B7355',
    marginTop: 2,
  },
  statsCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  statText: {
    fontSize: 12,
    color: '#8B7355',
    fontWeight: '500',
  },
  destination: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B8541A',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  watermark: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C8B89A',
    letterSpacing: 1,
    textAlign: 'right',
    marginTop: 12,
  },
});
