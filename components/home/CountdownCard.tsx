import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';

interface Props {
  tripStartISO: string;
  status: 'upcoming' | 'active' | 'completed';
  dayNumber?: number;
  totalDays: number;
  dateLabel?: string;
}

export const CountdownCard: React.FC<Props> = ({
  tripStartISO,
  status,
  dayNumber,
  totalDays,
  dateLabel,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [now, setNow] = useState(Date.now());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'upcoming') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'upcoming') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  if (status === 'completed') return null;

  if (status === 'active') {
    return (
      <View style={styles.card}>
        <Text style={styles.activeLabel}>
          Day {dayNumber} of {totalDays}
        </Text>
      </View>
    );
  }

  const tripStart = new Date(tripStartISO).getTime();
  const diff = Math.max(0, tripStart - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>ARRIVING IN</Text>
        {dateLabel ? <Text style={styles.dateLabel}>{dateLabel}</Text> : null}
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Departing</Text>
      </View>
      <View style={styles.digitsRow}>
        <Animated.View style={[styles.digitCell, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.digitLarge}>{days}</Text>
          <Text style={styles.digitLabel}>DAYS</Text>
        </Animated.View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.digitCell}>
          <Text style={styles.digit}>{String(hours).padStart(2, '0')}</Text>
          <Text style={styles.digitLabel}>HRS</Text>
        </View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.digitCell}>
          <Text style={styles.digit}>{String(minutes).padStart(2, '0')}</Text>
          <Text style={styles.digitLabel}>MIN</Text>
        </View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.digitCell}>
          <Text style={styles.digitMuted}>{String(seconds).padStart(2, '0')}</Text>
          <Text style={styles.digitLabel}>SEC</Text>
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eyebrow: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dateLabel: {
    color: colors.text2,
    fontSize: 11,
  },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: colors.accentDim,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  digitCell: {
    alignItems: 'center',
    minWidth: 52,
  },
  digitLarge: {
    color: colors.accent,
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 40,
  },
  digit: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  digitMuted: {
    color: colors.text3,
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  digitLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  separator: {
    color: colors.text3,
    fontSize: 24,
    fontWeight: '200',
    marginTop: -14,
  },
  activeLabel: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
