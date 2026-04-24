import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { elevation } from '@/constants/theme';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

interface TripActiveCardProps {
  trip: Trip;
  dayOfTrip: number;
  totalDays: number;
  daysLeft: number;
  budgetStatus: 'cruising' | 'low' | 'over';
  spent: number;
  budget: number;
  todaySpent?: number;
  todayCount?: number;
}

const GREEN_DOT = '#4fb372';
const GREEN_TEXT = '#2f7a46';

/* ── Daily Spend Bar with pulse animation ── */
function DailySpendBar({
  todaySpent,
  todayCount,
  dailyBudget,
}: {
  todaySpent: number;
  todayCount: number;
  dailyBudget: number;
}) {
  const { colors } = useTheme();
  const pct = dailyBudget > 0 ? Math.min(100, (todaySpent / dailyBudget) * 100) : 0;
  const barColor = pct < 50 ? '#4caf50' : pct < 75 ? '#d9a441' : pct < 100 ? '#e8a860' : '#c4554a';
  const isClose = pct >= 80 && pct < 100;

  // Pulse when close to daily limit
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (isClose) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isClose, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Hours until midnight
  const now = new Date();
  const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
  const hoursLeft = Math.floor(msToMidnight / 3600000);

  return (
    <View style={dailyStyles.container}>
      <View style={dailyStyles.headerRow}>
        <Text style={[dailyStyles.label, { color: colors.text2 }]}>Today</Text>
        <Text style={[dailyStyles.count, { color: colors.text3 }]}>
          {todayCount} expense{todayCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <Animated.View style={[dailyStyles.amountRow, isClose ? pulseStyle : undefined]}>
        <Text style={[dailyStyles.amount, { color: colors.text }]}>
          {formatCurrency(todaySpent, 'PHP')}
        </Text>
        {dailyBudget > 0 && (
          <Text style={[dailyStyles.limit, { color: colors.text3 }]}>
            / {formatCurrency(dailyBudget, 'PHP')} daily
          </Text>
        )}
      </Animated.View>

      {/* Progress bar */}
      {dailyBudget > 0 && (
        <View style={[dailyStyles.barTrack, { backgroundColor: colors.border }]}>
          <View style={[dailyStyles.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: barColor }]} />
        </View>
      )}

      {/* Midnight reset notice */}
      <Text style={[dailyStyles.resetText, { color: colors.text3 }]}>
        Resets at midnight · {hoursLeft}h left
      </Text>
    </View>
  );
}

const dailyStyles = StyleSheet.create({
  container: { marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  count: { fontSize: 11 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
  limit: { fontSize: 11 },
  barTrack: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  resetText: { fontSize: 9.5, marginTop: 4, fontStyle: 'italic' },
});
const GREEN_BG = 'rgba(125, 220, 150, 0.14)';
const GREEN_BORDER = 'rgba(125, 220, 150, 0.35)';
const FILL_DARK = '#3d2416';

const BUDGET_STATUS_CONFIG = {
  cruising: {
    label: 'On pace',
    tone: '#2f7a46',
    bg: 'rgba(125, 220, 150, 0.14)',
    border: 'rgba(125, 220, 150, 0.35)',
  },
  low: {
    label: 'Watch spending',
    tone: '#8b6f2f',
    bg: 'rgba(200, 160, 60, 0.14)',
    border: 'rgba(200, 160, 60, 0.35)',
  },
  over: {
    label: 'Overspending',
    tone: '#b04a2a',
    bg: 'rgba(176, 74, 42, 0.12)',
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
  todaySpent = 0,
  todayCount = 0,
}: TripActiveCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

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

  const spentPct = useMemo(
    () => (budget > 0 ? Math.min(100, (spent / budget) * 100) : 0),
    [spent, budget],
  );

  const expectedPct = useMemo(
    () => (totalDays > 0 ? Math.min(100, (dayOfTrip / totalDays) * 100) : 0),
    [dayOfTrip, totalDays],
  );

  const statusConfig = BUDGET_STATUS_CONFIG[budgetStatus];

  const [budgetOpen, setBudgetOpen] = useState(false);

  const budgetHint = useMemo(() => {
    const remaining = budget - spent;
    if (budgetStatus === 'over') {
      const pastPace = spent - Math.round((budget * expectedPct) / 100);
      return `\u20B1${pastPace.toLocaleString()} past pace`;
    }
    if (budgetStatus === 'low') {
      return `\u20B1${remaining.toLocaleString()} left for ${daysLeft} days \u00B7 above pace`;
    }
    return `\u20B1${remaining.toLocaleString()} left for ${daysLeft} days`;
  }, [budgetStatus, budget, spent, expectedPct, daysLeft]);

  return (
    <View style={styles.card}>
      {/* Top row: Day label + TRIP LIVE pill */}
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

      {/* Days-left status bar */}
      <View>
        <View style={styles.statusBarHeader}>
          <View style={styles.statusBarLeft}>
            <Text style={styles.kicker}>DAYS LEFT</Text>
            <Text style={styles.bigNumber}>{daysLeft}</Text>
            <Text style={styles.unit}>days</Text>
          </View>
          <Text style={styles.hint}>
            {dayOfTrip} spent {'\u00B7'} returning {formatDatePHT(trip.endDate)}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${tripPct}%`, backgroundColor: FILL_DARK }]} />
        </View>
        <View style={styles.pctRow}>
          <Text style={styles.pctLabel}>{Math.round(tripPct)}%</Text>
        </View>
      </View>

      <View style={styles.separator} />

      {/* Budget — collapsed peek; tap to expand */}
      <Pressable
        onPress={() => setBudgetOpen(!budgetOpen)}
        style={styles.budgetHeader}
        accessibilityRole="button"
        accessibilityLabel={`Budget ${statusConfig.label}`}
      >
        <View style={styles.budgetHeaderLeft}>
          <Text style={styles.kicker}>Budget</Text>
          <View style={[styles.statusPill, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
            <Text style={[styles.statusPillText, { color: statusConfig.tone }]}>
              {statusConfig.label.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.peekToggle}>
          <Text style={styles.peekText}>{budgetOpen ? 'Hide' : 'Peek'}</Text>
          <Svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            style={{ transform: [{ rotate: budgetOpen ? '180deg' : '0deg' }] }}
          >
            <Path
              d="M2 3.5L5 6.5L8 3.5"
              stroke={colors.text3}
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      </Pressable>

      {/* Expanded budget detail */}
      {budgetOpen && (
        <View style={styles.budgetExpanded}>
          <View style={styles.budgetAmountRow}>
            <View style={styles.budgetAmountLeft}>
              <Text style={styles.budgetSpent}>
                {'\u20B1'}{spent.toLocaleString()}
              </Text>
              <Text style={styles.budgetTotal}>
                {' '}/ {'\u20B1'}{budget.toLocaleString()}
              </Text>
            </View>
            <Text style={styles.budgetPct}>{Math.round(spentPct)}%</Text>
          </View>
          <View style={styles.budgetTrack}>
            <View
              style={[
                styles.budgetFill,
                {
                  width: `${Math.min(100, spentPct)}%`,
                  backgroundColor: budgetStatus === 'over' ? '#b04a2a'
                    : budgetStatus === 'low' ? '#c8a03c'
                    : FILL_DARK,
                },
              ]}
            />
            <View style={[styles.paceMarker, { left: `${expectedPct}%` }]} />
          </View>
          <Text style={styles.budgetHint}>{budgetHint}</Text>

          {/* Today's spending with daily progress bar */}
          <DailySpendBar
            todaySpent={todaySpent}
            todayCount={todayCount}
            dailyBudget={budget > 0 && totalDays > 0 ? Math.round(budget / totalDays) : 0}
          />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 18,
      marginHorizontal: 16,
      gap: 14,
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
      letterSpacing: 0.16 * 9.5,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: GREEN_BG,
      borderWidth: 1,
      borderColor: GREEN_BORDER,
      borderRadius: 99,
      paddingHorizontal: 8,
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
      letterSpacing: 0.04 * 9.5,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
    statusBarHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    statusBarLeft: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    kicker: {
      color: colors.text3,
      fontSize: 9.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.16 * 9.5,
    },
    bigNumber: {
      fontFamily: 'SpaceMono',
      color: colors.text,
      fontSize: 20,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.02 * 20,
    },
    unit: {
      color: colors.text3,
      fontSize: 11,
    },
    hint: {
      color: colors.text3,
      fontSize: 11,
    },
    progressTrack: {
      height: 8,
      borderRadius: 99,
      backgroundColor: colors.card2,
      overflow: 'hidden',
      position: 'relative',
    },
    progressFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      borderRadius: 99,
    },
    pctRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    pctLabel: {
      fontFamily: 'SpaceMono',
      color: colors.text3,
      fontSize: 10.5,
      fontVariant: ['tabular-nums'],
    },
    budgetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    budgetHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusPill: {
      borderWidth: 1,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusPillText: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.08 * 9.5,
    },
    peekToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    peekText: {
      fontSize: 11,
      color: colors.text3,
    },
    budgetExpanded: {
      marginTop: 12,
    },
    budgetAmountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    budgetAmountLeft: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    budgetSpent: {
      fontFamily: 'SpaceMono',
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    budgetTotal: {
      fontSize: 11,
      color: colors.text3,
    },
    budgetPct: {
      fontFamily: 'SpaceMono',
      fontSize: 11,
      color: colors.text3,
      fontVariant: ['tabular-nums'],
    },
    budgetTrack: {
      height: 8,
      borderRadius: 99,
      backgroundColor: colors.card2,
      overflow: 'visible',
      position: 'relative',
    },
    budgetFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      borderRadius: 99,
    },
    paceMarker: {
      position: 'absolute',
      top: -2,
      width: 2,
      height: 12,
      backgroundColor: colors.text3,
      opacity: 0.5,
      borderRadius: 1,
    },
    budgetHint: {
      marginTop: 6,
      fontSize: 10.5,
      color: colors.text3,
    },
    todayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    todayLeft: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    todayLabel: {
      color: colors.text3,
      fontSize: 9.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.16 * 9.5,
    },
    todayAmount: {
      fontFamily: 'SpaceMono',
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'] as any,
    },
    todayCount: {
      fontSize: 10.5,
      color: colors.text3,
    },
  });
