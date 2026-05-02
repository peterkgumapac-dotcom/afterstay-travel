import { Camera, Moon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { formatProfileCurrency } from '@/lib/profileStats';
import type { Trip } from '@/lib/types';
import { formatDatePHT } from '@/lib/utils';
import { TripCollage } from '@/components/trip/TripCollage';

interface TopTripCardProps {
  trip: Trip;
  photoCount: number;
  onPress: () => void;
}

export default function TopTripCard({ trip, photoCount, onPress }: TopTripCardProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.82}>
      <TripCollage tripId={trip.id} width={320} height={190} />
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
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
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
