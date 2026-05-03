import { Camera, Moon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { useTheme } from '@/constants/ThemeContext';
import { formatProfileCurrency } from '@/lib/profileStats';
import type { Trip } from '@/lib/types';
import { formatDatePHT } from '@/lib/utils';

interface TopTripCardProps {
  trip: Trip;
  photoCount: number;
  photoUrls?: string[];
  onPress: () => void;
}

export default function TopTripCard({ trip, photoCount, photoUrls = [], onPress }: TopTripCardProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = getStyles(colors);
  const cardWidth = Math.max(0, width - 32);
  const photos = photoUrls.filter(Boolean).slice(0, 3);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.82}>
      {photos.length > 0 ? (
        <View style={[s.mosaic, { width: cardWidth }]}>
          <CachedImage remoteUrl={photos[0]} style={s.heroImage} />
          <View style={s.sideRail}>
            <CachedImage remoteUrl={photos[1] ?? photos[0]} style={s.sideImage} />
            <CachedImage remoteUrl={photos[2] ?? photos[0]} style={s.sideImage} />
          </View>
        </View>
      ) : (
        <View style={s.fallback} />
      )}
      <View style={s.overlay} />
      <View style={s.content}>
        <Text style={s.destination} numberOfLines={1}>{trip.destination || trip.name}</Text>
        <Text style={s.dates}>{formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}</Text>
        <View style={s.metaRow}>
          <Moon size={13} color="#fff" />
          <Text style={s.meta}>{trip.nights} nights</Text>
          <Camera size={13} color="#fff" />
          <Text style={s.meta}>{photoCount} photos</Text>
          {trip.totalSpent ? <Text style={s.meta}>{formatProfileCurrency(trip.totalSpent)} spent</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (_colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    height: 236,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#241b12',
  },
  mosaic: {
    height: 236,
    flexDirection: 'row',
    gap: 3,
  },
  heroImage: {
    flex: 1,
    height: '100%',
  },
  sideRail: {
    width: 104,
    gap: 3,
  },
  sideImage: {
    flex: 1,
    width: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#241b12',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  content: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  destination: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dates: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  meta: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
