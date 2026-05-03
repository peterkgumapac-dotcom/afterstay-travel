import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Crown, Heart, MessageCircle, Moon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { lightColors, useTheme } from '@/constants/ThemeContext';
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
  const colors = lightColors;
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
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.48)']} style={s.imageShade} />
      <View style={s.badge}>
        <Crown size={12} color="#fff" />
        <Text style={s.badgeText}>Top trip</Text>
      </View>
      <View style={s.content}>
        <Text style={s.destination} numberOfLines={1}>{trip.destination || trip.name}</Text>
        <Text style={s.dates}>{formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}</Text>
        <View style={s.metaRow}>
          <Moon size={13} color={colors.accent} />
          <Text style={s.meta}>{trip.nights} nights</Text>
          <Camera size={13} color={colors.accent} />
          <Text style={s.meta}>{photoCount} photos</Text>
          {trip.totalSpent ? <Text style={s.meta}>{formatProfileCurrency(trip.totalSpent)} spent</Text> : null}
        </View>
        <View style={s.actionRow}>
          <View style={s.actionItem}>
            <Heart size={15} color={colors.text3} strokeWidth={1.8} />
            <Text style={s.actionText}>Trip</Text>
          </View>
          <View style={s.actionItem}>
            <MessageCircle size={15} color={colors.text3} strokeWidth={1.8} />
            <Text style={s.actionText}>Memory</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (_colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    minHeight: 302,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: _colors.card,
    borderWidth: 1,
    borderColor: _colors.border,
  },
  mosaic: {
    height: 178,
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
    height: 178,
    backgroundColor: _colors.accentBg,
  },
  imageShade: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    height: 98,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  badge: {
    position: 'absolute',
    left: 12,
    top: 12,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(42,29,13,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  destination: {
    color: _colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  dates: {
    color: _colors.text2,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  meta: {
    color: _colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 14,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: _colors.text3,
    fontSize: 12,
    fontWeight: '700',
  },
});
