import { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Archive, Star, Trash2 } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';

// ---------- TYPES ----------

interface PastTrip {
  flag: string;
  dest: string;
  country: string;
  dates: string;
  nights: number;
  spent: number;
  miles: number;
  rating: number;
  isDraft?: boolean;
}

interface PastTripRowProps {
  trip: PastTrip;
  hasMemory?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ---------- COMPONENT ----------

export default function PastTripRow({ trip, hasMemory, onPress, onDelete, onArchive }: PastTripRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const fullStars = '\u2605'.repeat(trip.rating);
  const emptyStars = '\u2605'.repeat(5 - trip.rating);

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  const isDraftTrip = trip.isDraft;
  const hasActions = onDelete || onArchive;

  const showActionSheet = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (isDraftTrip && onDelete) {
      options.push({ text: 'Delete Draft', style: 'destructive', onPress: onDelete });
    } else if (!isDraftTrip && onArchive) {
      options.push({ text: 'Archive Trip', onPress: onArchive });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Trip Options', undefined, options);
  };

  return (
    <Wrapper style={styles.row} {...wrapperProps as any}>
      <View style={styles.flagContainer}>
        <Text style={styles.flag}>{trip.flag}</Text>
      </View>

      <View style={styles.info}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.dest}>{trip.dest}</Text>
          {hasMemory && <Star size={12} color={colors.accent} fill={colors.accent} />}
        </View>
        <Text style={styles.dates}>
          {trip.dates} {'\u00B7'} {trip.nights} nights
        </Text>
      </View>

      <View style={styles.meta}>
        {trip.spent > 0 && (
          <Text style={styles.spent}>
            {'\u20B1'}{trip.spent.toLocaleString()}
          </Text>
        )}
        {trip.rating > 0 && (
          <Text style={styles.rating}>
            {fullStars}
            <Text style={styles.ratingEmpty}>{emptyStars}</Text>
          </Text>
        )}
        {hasActions && (
          <TouchableOpacity onPress={showActionSheet} style={styles.actionBtn} hitSlop={8}>
            {isDraftTrip ? (
              <Trash2 size={14} color={colors.danger} />
            ) : (
              <Archive size={14} color={colors.text3} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </Wrapper>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    flagContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flag: {
      fontSize: 20,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    dest: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    dates: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    meta: {
      alignItems: 'flex-end',
    },
    actionBtn: {
      padding: 6,
      marginTop: 4,
    },
    spent: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.24,
    },
    rating: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 2,
      letterSpacing: 1,
    },
    ratingEmpty: {
      opacity: 0.25,
    },
  });
