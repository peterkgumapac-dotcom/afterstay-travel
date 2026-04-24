import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { DayRecap } from './generateRecap';

interface MinimalTemplateProps {
  recap: DayRecap;
}

export function MinimalTemplate({ recap }: MinimalTemplateProps) {
  return (
    <View style={styles.card}>
      {/* Hero photo */}
      <View style={styles.heroContainer}>
        <Image
          source={{ uri: recap.heroPhoto, cache: 'force-cache' }}
          style={styles.hero}
          resizeMode="cover"
        />
        {/* Day badge */}
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>DAY {recap.dayNumber}</Text>
        </View>
      </View>

      {/* Info section */}
      <View style={styles.info}>
        <Text style={styles.destination}>{recap.destination}</Text>
        <Text style={styles.dateRow}>
          {recap.dayOfWeek} · {recap.dayLabel}
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{recap.totalMoments}</Text>
            <Text style={styles.statLabel}>moments</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{recap.placeCount}</Text>
            <Text style={styles.statLabel}>{recap.placeCount === 1 ? 'place' : 'places'}</Text>
          </View>
        </View>

        {/* Places list */}
        {recap.places.length > 0 && (
          <Text style={styles.places} numberOfLines={2}>
            {recap.places.join(' · ')}
          </Text>
        )}

        {/* Photo strip */}
        {recap.photos.length > 1 && (
          <View style={styles.strip}>
            {recap.photos.slice(1, 5).map((uri, i) => (
              <Image
                key={i}
                source={{ uri, cache: 'force-cache' }}
                style={styles.stripPhoto}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        {/* Watermark */}
        <Text style={styles.watermark}>afterstay</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAFAF7',
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroContainer: {
    position: 'relative',
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  dayBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dayBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  info: {
    padding: 20,
    gap: 8,
  },
  destination: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1612',
    letterSpacing: -0.5,
  },
  dateRow: {
    fontSize: 13,
    color: '#8a7e72',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1612',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8a7e72',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#e0d8cc',
  },
  places: {
    fontSize: 12,
    color: '#8a7e72',
    fontStyle: 'italic',
    marginTop: 4,
  },
  strip: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  stripPhoto: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
  },
  watermark: {
    fontSize: 10,
    fontWeight: '600',
    color: '#c8bfb0',
    letterSpacing: 1,
    textAlign: 'right',
    marginTop: 8,
  },
});
