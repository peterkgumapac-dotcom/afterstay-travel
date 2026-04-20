import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Building2, MapPin, Footprints, Car } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';

interface DistanceToggleProps {
  anchor: 'hotel' | 'me';
  travelMode: 'walk' | 'car';
  onAnchorChange: (a: 'hotel' | 'me') => void;
  onTravelModeChange: (m: 'walk' | 'car') => void;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function DistanceToggle({
  anchor,
  travelMode,
  onAnchorChange,
  onTravelModeChange,
}: DistanceToggleProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const tapAnchor = useCallback((v: 'hotel' | 'me') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAnchorChange(v);
  }, [onAnchorChange]);

  const tapMode = useCallback((v: 'walk' | 'car') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTravelModeChange(v);
  }, [onTravelModeChange]);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>FROM</Text>

      <View style={styles.togglesRow}>
        {/* Anchor: Hotel / Me */}
        <View style={styles.track}>
          <TouchableOpacity
            onPress={() => tapAnchor('hotel')}
            style={[styles.seg, anchor === 'hotel' && styles.segActive]}
            activeOpacity={0.7}
          >
            <Building2 size={13} strokeWidth={1.8} color={anchor === 'hotel' ? colors.ink : colors.text2} />
            <Text style={[styles.segLabel, anchor === 'hotel' && styles.segLabelActive]}>Hotel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => tapAnchor('me')}
            style={[styles.seg, anchor === 'me' && styles.segActive]}
            activeOpacity={0.7}
          >
            <MapPin size={13} strokeWidth={1.8} color={anchor === 'me' ? colors.ink : colors.text2} />
            <Text style={[styles.segLabel, anchor === 'me' && styles.segLabelActive]}>Me</Text>
          </TouchableOpacity>
        </View>

        {/* Mode: Walk / Car */}
        <View style={styles.track}>
          <TouchableOpacity
            onPress={() => tapMode('walk')}
            style={[styles.seg, travelMode === 'walk' && styles.segActive]}
            activeOpacity={0.7}
          >
            <Footprints size={13} strokeWidth={1.8} color={travelMode === 'walk' ? colors.ink : colors.text2} />
            <Text style={[styles.segLabel, travelMode === 'walk' && styles.segLabelActive]}>Walk</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => tapMode('car')}
            style={[styles.seg, travelMode === 'car' && styles.segActive]}
            activeOpacity={0.7}
          >
            <Car size={13} strokeWidth={1.8} color={travelMode === 'car' ? colors.ink : colors.text2} />
            <Text style={[styles.segLabel, travelMode === 'car' && styles.segLabelActive]}>Drive</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default React.memo(DistanceToggle);

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
      marginRight: spacing.sm,
    },
    togglesRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    track: {
      flexDirection: 'row',
      backgroundColor: colors.canvas,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    seg: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      minHeight: 34,
    },
    segActive: {
      backgroundColor: colors.accent,
    },
    segLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text2,
    },
    segLabelActive: {
      color: colors.ink,
    },
  });
