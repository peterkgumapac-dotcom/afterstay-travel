import React, { useMemo } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Clock, MapPin, Navigation, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme, type ThemeColors } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { formatDistance } from '@/lib/distance';
import type { ConciergeResultPlace } from '@/lib/types';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80';

interface Props {
  place: ConciergeResultPlace;
  tripId: string | null;
  distanceKm: number;
  travelMode: 'walk' | 'car';
  isSaved: boolean;
  onSave: (name: string) => void;
  onOpenDetail?: (placeId: string | undefined, name: string) => void;
}

export default function ConciergeResultCard({
  place,
  tripId,
  distanceKm,
  travelMode,
  isSaved,
  onSave,
  onOpenDetail,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const handleNavigate = () => {
    if (place.lat == null || place.lng == null) return;
    const url = Platform.select({
      ios: `maps://app?daddr=${place.lat},${place.lng}`,
      android: `google.navigation:q=${place.lat},${place.lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}${place.placeId ? `&destination_place_id=${place.placeId}` : ''}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleAddToTrip = () => {
    onSave(place.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (place.isQuickMoment) {
      Alert.alert(
        'Added!',
        'Want to capture a moment when you get there?',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sure!', onPress: () => {} },
        ],
      );
    }
  };

  const walkMin = distanceKm > 0 ? Math.round(distanceKm / (travelMode === 'car' ? 0.5 : 0.08)) : null;

  return (
    <View style={s.card}>
      {/* Photo + overlay */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpenDetail?.(place.placeId, place.name)}
      >
        <Image
          source={{ uri: place.photoUrl ?? FALLBACK_IMG }}
          style={s.photo}
        />
        {place.openNow != null && (
          <View style={[s.openBadge, { backgroundColor: place.openNow ? '#2d6a4f' : '#6b3030' }]}>
            <Text style={s.openBadgeText}>{place.openNow ? 'Open' : 'Closed'}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Info */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{place.name}</Text>

        <View style={s.metaRow}>
          {place.rating != null && (
            <Text style={s.rating}>{'\u2B50'} {place.rating.toFixed(1)}</Text>
          )}
          {distanceKm > 0 && (
            <Text style={s.meta}>{formatDistance(distanceKm)}</Text>
          )}
          {walkMin != null && walkMin > 0 && (
            <Text style={s.meta}>{walkMin} min {travelMode === 'car' ? 'drive' : 'walk'}</Text>
          )}
          {place.priceRange ? (
            <Text style={s.meta}>{place.priceRange}</Text>
          ) : null}
        </View>

        {/* AI reason */}
        <Text style={s.reason} numberOfLines={2}>{place.reason}</Text>

        {/* Duration badge */}
        <View style={s.badgeRow}>
          <View style={[s.durationBadge, place.isQuickMoment ? s.quickBadge : s.dayBadge]}>
            <Clock size={12} color={place.isQuickMoment ? colors.accent : colors.gold} />
            <Text style={[s.durationText, { color: place.isQuickMoment ? colors.accent : colors.gold }]}>
              {place.isQuickMoment ? 'Quick moment' : 'Day activity'} {'\u00B7'} {place.estimatedDuration}
            </Text>
          </View>
        </View>

        {/* CTAs */}
        <View style={s.ctaRow}>
          {place.lat != null && place.lng != null && (
            <TouchableOpacity style={s.ctaNav} onPress={handleNavigate} activeOpacity={0.7}>
              <Navigation size={14} color={colors.bg} />
              <Text style={s.ctaNavText}>Take me there</Text>
            </TouchableOpacity>
          )}
          {tripId && (
            <TouchableOpacity
              style={[s.ctaAdd, isSaved && s.ctaAddDone]}
              onPress={isSaved ? undefined : handleAddToTrip}
              activeOpacity={isSaved ? 1 : 0.7}
            >
              {isSaved ? (
                <Text style={s.ctaAddDoneText}>{'\u2713'} Added</Text>
              ) : (
                <>
                  <Plus size={14} color={colors.accent} />
                  <Text style={s.ctaAddText}>Add to trip</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    photo: {
      width: '100%',
      height: 160,
      backgroundColor: colors.bg2,
    },
    openBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    openBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },
    info: {
      padding: spacing.lg,
      gap: 8,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
    },
    rating: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    meta: {
      fontSize: 12,
      color: colors.text3,
    },
    reason: {
      fontSize: 13,
      color: colors.text2,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    badgeRow: {
      flexDirection: 'row',
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
    },
    quickBadge: {
      backgroundColor: colors.accentBg,
    },
    dayBadge: {
      backgroundColor: 'rgba(217,164,65,0.10)',
    },
    durationText: {
      fontSize: 11,
      fontWeight: '600',
    },
    ctaRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    ctaNav: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      paddingVertical: 12,
      borderRadius: radius.md,
    },
    ctaNavText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.bg,
    },
    ctaAdd: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      paddingVertical: 12,
      borderRadius: radius.md,
    },
    ctaAddText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    ctaAddDone: {
      backgroundColor: colors.bg2,
      borderColor: colors.border,
    },
    ctaAddDoneText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text3,
    },
  });
