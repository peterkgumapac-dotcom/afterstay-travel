import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, MapPin, Users, Wallet } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import { CATEGORY_EMOJI, type QuickTrip } from '@/lib/quickTripTypes';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface QuickTripRowProps {
  trip: QuickTrip;
  onPress?: () => void;
}

export default function QuickTripRow({ trip, onPress }: QuickTripRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const emoji = CATEGORY_EMOJI[trip.category] ?? '\u2728';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Cover or emoji */}
      {trip.coverPhotoUrl ? (
        <Image source={{ uri: trip.coverPhotoUrl }} style={styles.cover} />
      ) : (
        <View style={styles.emojiWrap}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{trip.title}</Text>
        <View style={styles.metaRow}>
          <MapPin size={11} color={colors.text3} />
          <Text style={styles.meta} numberOfLines={1}>{trip.placeName}</Text>
          <Text style={styles.metaDot}>{'\u00B7'}</Text>
          <Text style={styles.meta}>{formatDatePHT(trip.occurredAt)}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsCol}>
        {trip.totalSpendAmount > 0 && (
          <View style={styles.statRow}>
            <Wallet size={11} color={colors.text3} />
            <Text style={styles.statText}>{formatCurrency(trip.totalSpendAmount, trip.totalSpendCurrency)}</Text>
          </View>
        )}
        {trip.photoCount > 0 && (
          <View style={styles.statRow}>
            <Camera size={11} color={colors.text3} />
            <Text style={styles.statText}>{trip.photoCount}</Text>
          </View>
        )}
        {trip.companionCount > 0 && (
          <View style={styles.statRow}>
            <Users size={11} color={colors.text3} />
            <Text style={styles.statText}>{trip.companionCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cover: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.card2,
    },
    emojiWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 20,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    meta: {
      fontSize: 11,
      color: colors.text3,
    },
    metaDot: {
      fontSize: 11,
      color: colors.text3,
    },
    statsCol: {
      alignItems: 'flex-end',
      gap: 3,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text2,
    },
  });
