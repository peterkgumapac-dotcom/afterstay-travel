import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { elevation, radius, spacing } from '@/constants/theme';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

interface TripActiveCardProps {
  trip: Trip;
  dayOfTrip: number;
  totalDays: number;
  daysLeft: number;
  budgetStatus: 'cruising' | 'low' | 'over';
  spent: number;
  budget: number;
}

const GREEN_DOT = '#4fb372';
const GREEN_TEXT = '#2f7a46';
const GREEN_BG = 'rgba(125, 220, 150, 0.14)';
const GREEN_BORDER = 'rgba(125, 220, 150, 0.35)';
const FILL_DARK = '#3d2416';

const BUDGET_STATUS_CONFIG = {
  cruising: {
    label: 'On pace',
    textColor: GREEN_TEXT,
    bg: 'rgba(125, 220, 150, 0.14)',
    border: 'rgba(125, 220, 150, 0.35)',
  },
  low: {
    label: 'Watch spending',
    textColor: '#8b6f2f',
    bg: 'rgba(200, 154, 60, 0.14)',
    border: 'rgba(200, 154, 60, 0.35)',
  },
  over: {
    label: 'Overspending',
    textColor: '#b04a2a',
    bg: 'rgba(176, 74, 42, 0.14)',
    border: 'rgba(176, 74, 42, 0.35)',
  },
} as const;

export function TripActiveCard({
  trip,
  dayOfTrip,
  totalDays,
  daysLeft,
  budgetStatus,
  spent,
  budget,
}: TripActiveCardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const dotScale = useSharedValue(1);
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [dotScale, dotOpacity]);

  const dotAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotOpacity.value,
  }));

  const tripPct = useMemo(
    () => Math.min(100, (dayOfTrip / totalDays) * 100),
    [dayOfTrip, totalDays],
  );

  const budgetPct = useMemo(
    () => (budget > 0 ? Math.min(100, (spent / budget) * 100) : 0),
    [spent, budget],
  );

  const expectedPct = useMemo(
    () => (totalDays > 0 ? Math.min(100, (dayOfTrip / totalDays) * 100) : 0),
    [dayOfTrip, totalDays],
  );

  const budgetFillColor = useMemo(() => {
    if (budgetStatus === 'low') return '#c89a3c';
    if (budgetStatus === 'over') return colors.danger;
    return colors.accent;
  }, [budgetStatus, colors]);

  const statusConfig = BUDGET_STATUS_CONFIG[budgetStatus];

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.topRow}>
        <Text style={styles.topLabel}>
          {trip.destination ?? 'Trip'} {'\u00B7'} Day {dayOfTrip} of {totalDays}
        </Text>
        <View style={styles.livePill}>
          <Animated.View style={[styles.liveDot, dotAnimStyle]} />
          <Text style={styles.liveText}>TRIP LIVE</Text>
        </View>
      </View>

      <View style={styles.separator} />

      {/* Days-left status */}
      <View style={styles.section}>
        <Text style={styles.kicker}>DAYS LEFT</Text>
        <View style={styles.bigNumberRow}>
          <Text style={styles.bigNumber}>{daysLeft}</Text>
          <Text style={styles.unit}>days</Text>
        </View>
        <Text style={styles.hint}>
          {dayOfTrip} spent {'\u00B7'} returning {formatDatePHT(trip.endDate)}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${tripPct}%` }]} />
        </View>
      </View>

      <View style={styles.separator} />

      {/* Budget peek */}
      <View style={styles.section}>
        <Text style={styles.kicker}>BUDGET</Text>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetAmount}>
            {'\u20B1'}{spent.toLocaleString()}
          </Text>
          <Text style={styles.budgetOf}>
            {' '}of {'\u20B1'}{budget.toLocaleString()}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFillBudget,
              { width: `${budgetPct}%`, backgroundColor: budgetFillColor },
            ]}
          />
          {/* Expected pace marker */}
          <View
            style={[
              styles.paceMarker,
              { left: `${expectedPct}%` },
            ]}
          />
        </View>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
          ]}
        >
          <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: 18,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      ...elevation.sm,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topLabel: {
      color: colors.text3,
      fontSize: 9.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.6,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: GREEN_BG,
      borderWidth: 1,
      borderColor: GREEN_BORDER,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: GREEN_DOT,
    },
    liveText: {
      color: GREEN_TEXT,
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    section: {
      gap: 4,
    },
    kicker: {
      color: colors.text3,
      fontSize: 8.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.4,
    },
    bigNumberRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    bigNumber: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    unit: {
      color: colors.text3,
      fontSize: 12,
    },
    hint: {
      color: colors.text3,
      fontSize: 11,
      marginBottom: 6,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.card2,
      overflow: 'visible',
      position: 'relative',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: FILL_DARK,
    },
    progressFillBudget: {
      height: 4,
      borderRadius: 2,
    },
    paceMarker: {
      position: 'absolute',
      top: -3,
      width: 2,
      height: 10,
      backgroundColor: colors.text3,
      borderRadius: 1,
      borderStyle: 'dashed',
    },
    budgetRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    budgetAmount: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    budgetOf: {
      color: colors.text3,
      fontSize: 12,
    },
    statusPill: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      marginTop: spacing.sm,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
  });
