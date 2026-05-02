import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { AnimatedPressable } from '@/components/shared/AnimatedPressable';
import { TiltCard } from '@/components/shared/TiltCard';
import { safeParse, MS_PER_DAY, MS_PER_HOUR } from '@/lib/utils';

interface Props {
  tripStartISO: string;
  status: 'upcoming' | 'active' | 'completed';
  dayNumber?: number;
  totalDays: number;
  dateLabel?: string;
  onBoard?: () => void;
}

export function CountdownCard({
  tripStartISO,
  status,
  dayNumber,
  totalDays,
  dateLabel,
  onBoard,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== 'upcoming') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status === 'completed') return null;

  const tripStartDate = safeParse(tripStartISO);
  const hasValidStart = Number.isFinite(tripStartDate.getTime());

  if (status === 'active') {
    return (
      <View style={styles.card}>
        <Text style={styles.activeLabel}>
          Day {dayNumber} of {totalDays}
        </Text>
      </View>
    );
  }

  if (!hasValidStart) {
    return (
      <TiltCard style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>Trip timing</Text>
            <Text style={styles.dateLabel}>{dateLabel || 'Add your departure date'}</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>Needs details</Text>
          </View>
        </View>
        <Text style={styles.fallbackText}>
          Add or rescan your booking details to unlock the countdown.
        </Text>
      </TiltCard>
    );
  }

  const tripStart = tripStartDate.getTime();
  const diff = Math.max(0, tripStart - now);
  const days = Math.floor(diff / MS_PER_DAY);
  const hours = Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((diff % MS_PER_HOUR) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const label = tripStartDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const units = [
    { v: days, l: 'DAYS' },
    { v: hours, l: 'HRS' },
    { v: minutes, l: 'MIN' },
    { v: seconds, l: 'SEC' },
  ];

  return (
    <TiltCard style={styles.card}>
      {/* Top row: label + stamp */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>Arriving in</Text>
          <Text style={styles.dateLabel}>{label}</Text>
        </View>
        <View style={styles.stamp}>
          <Text style={styles.stampText}>{'\u2708'} Departing</Text>
        </View>
      </View>

      {/* Countdown grid */}
      <View style={styles.digitsGrid}>
        {units.map((u) => (
          <View key={u.l} style={styles.digitCell}>
            <Text style={styles.digitValue}>
              {String(u.v).padStart(2, '0')}
            </Text>
            <Text style={styles.digitLabel}>{u.l}</Text>
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Manual boarding CTA */}
      {onBoard && (
        <AnimatedPressable
          style={styles.boardButton}
          onPress={onBoard}
          accessibilityRole="button"
          accessibilityLabel="I'm boarding now"
        >
          <View style={styles.boardRow}>
            <View style={styles.boardIconCircle}>
              <Svg width={12} height={12} viewBox="0 0 24 24">
                <Path d="M2 16l20-6L2 4l2 6-2 6z" fill="#fffaf0" />
              </Svg>
            </View>
            <View>
              <Text style={styles.boardEyebrow}>At the gate?</Text>
              <Text style={styles.boardLabel}>I'm boarding now</Text>
            </View>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12h14M13 5l7 7-7 7"
              stroke="#fffaf0"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </AnimatedPressable>
      )}
    </TiltCard>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: 20,
      marginHorizontal: 16,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.16 * 10,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    dateLabel: {
      fontSize: 11,
      color: colors.text3,
      fontWeight: '500',
      marginTop: 4,
    },
    stamp: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    stampText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text3,
    },
    digitsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    digitCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      backgroundColor: colors.card2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    digitValue: {
      fontFamily: 'SpaceMono',
      fontSize: 30,
      fontWeight: '600',
      lineHeight: 30,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    digitLabel: {
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 0.14 * 9,
      color: colors.text3,
      marginTop: 8,
    },
    divider: {
      height: 1,
      marginTop: 16,
      marginBottom: 14,
    },
    boardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#2a1810',
      backgroundColor: '#3d2416',
      shadowColor: 'rgba(61, 36, 22, 1)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
      elevation: 6,
    },
    boardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    boardIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 99,
      backgroundColor: 'rgba(255,250,240,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,250,240,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    boardEyebrow: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.16 * 9.5,
      textTransform: 'uppercase',
      color: '#fffaf0',
      opacity: 0.85,
    },
    boardLabel: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.01 * 14,
      color: '#fffaf0',
      marginTop: 1,
    },
    activeLabel: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    fallbackText: {
      color: colors.text3,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
  });
