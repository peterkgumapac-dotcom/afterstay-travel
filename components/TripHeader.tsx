import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing, typography } from '@/constants/theme';
import type { Trip } from '@/lib/types';
import { formatDateRange, tripStatusLabel } from '@/lib/utils';
import Pill from './Pill';

interface Props {
  trip: Trip;
}

function parseHotelPhotos(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function TripHeader({ trip }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const status = tripStatusLabel(trip.startDate, trip.endDate, trip.nights);
  const tone = status === 'Completed' ? 'default' : 'green';
  const photos = parseHotelPhotos(trip.hotelPhotos);
  const heroPhoto = photos.length > 0 ? photos[0] : null;
  const hasHeroUrl = !!trip.heroImageUrl;
  const useImage = heroPhoto || hasHeroUrl;
  const imageSource = heroPhoto
    ? { uri: heroPhoto }
    : hasHeroUrl
      ? { uri: trip.heroImageUrl }
      : undefined;

  return (
    <View style={styles.wrap}>
      {useImage && imageSource ? (
        <ImageBackground
          source={imageSource}
          style={styles.hero}
          imageStyle={styles.heroImg}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['transparent', 'rgba(8,11,18,0.6)', 'rgba(8,11,18,0.95)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroContent}>
            <Pill label={status} tone={tone as any} />
            <Text style={styles.name} numberOfLines={2}>{trip.name}</Text>
            <Text style={styles.sub} numberOfLines={2}>{trip.destination}</Text>
            <Text style={styles.dateRange}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.gradientFallback}>
          <View style={styles.heroContent}>
            <Pill label={status} tone={tone as any} />
            <Text style={styles.name} numberOfLines={2}>{trip.name}</Text>
            <Text style={styles.sub} numberOfLines={2}>{trip.destination}</Text>
            <Text style={styles.dateRange}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
          </View>
        </View>
      )}
      <View style={styles.meta}>
        {trip.accommodation ? (
          <>
            <Text style={styles.metaLabel}>ACCOMMODATION</Text>
            <Text style={styles.metaValue} numberOfLines={2}>{trip.accommodation}</Text>
          </>
        ) : null}
        <Text style={[styles.metaLabel, trip.accommodation ? { marginTop: spacing.sm } : undefined]}>ADDRESS</Text>
        <Text style={styles.metaValue} numberOfLines={2}>{trip.address}</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hero: {
    height: 280,
    justifyContent: 'flex-end',
  },
  heroImg: {
    opacity: 0.85,
  },
  gradientFallback: {
    height: 280,
    justifyContent: 'flex-end',
    backgroundColor: colors.bg3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroContent: {
    padding: spacing.lg,
    gap: 6,
  },
  name: {
    ...typography.h1,
    color: colors.white,
    marginTop: spacing.xs,
  },
  sub: {
    color: colors.text,
    opacity: 0.85,
    fontSize: 13,
  },
  dateRange: {
    color: colors.text2,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  meta: {
    padding: spacing.lg,
    gap: 2,
  },
  metaLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
