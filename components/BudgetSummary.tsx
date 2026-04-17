import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';

interface Props {
  total: number;
  currency?: string;
  byCategory: Record<string, number>;
  travelers?: number;
  memberNames?: string[];
  budgetMode?: 'Limited' | 'Unlimited';
  budgetLimit?: number;
  daysLeft?: number;
  daysElapsed?: number;
  totalDays?: number;
  currentDay?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: colors.amber,
  Transport: colors.blue,
  Activity: colors.green2,
  Accommodation: colors.purple,
  Shopping: colors.pink,
  Other: colors.text2,
};

function getProgressColor(pct: number): string {
  if (pct >= 0.8) return colors.red;
  if (pct >= 0.6) return colors.amber;
  return colors.green2;
}

function computeTodaySpend(
  total: number,
  daysElapsed: number,
  dailyAverage: number,
): number {
  // Approximate: today's spend = total - (dailyAverage * (daysElapsed - 1))
  // This is a rough estimate; the parent component can pass exact today's spend
  const previousDaysSpend = dailyAverage * Math.max(0, daysElapsed - 1);
  return Math.max(0, total - previousDaysSpend);
}

export default function BudgetSummary({
  total,
  currency = 'PHP',
  byCategory,
  travelers = 3,
  memberNames,
  budgetMode = 'Unlimited',
  budgetLimit,
  daysLeft = 0,
  daysElapsed = 1,
  totalDays = 1,
  currentDay = 1,
}: Props) {
  const max = Math.max(1, ...Object.values(byCategory));
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const travelerCount = memberNames?.length ?? travelers;
  const perPersonAmount = total / Math.max(1, travelerCount);
  const names = memberNames ?? [];

  const isLimited = budgetMode === 'Limited' && budgetLimit != null && budgetLimit > 0;
  const remaining = isLimited ? Math.max(0, budgetLimit - total) : 0;
  const spentPct = isLimited ? Math.min(1, total / budgetLimit) : 0;
  const dailyBudgetRemaining = isLimited && daysLeft > 0 ? remaining / daysLeft : 0;
  const dailyAverageSpend = daysElapsed > 0 ? total / daysElapsed : 0;
  const lowBudget = isLimited && spentPct >= 0.8;

  const dailyAllowance = isLimited ? budgetLimit / Math.max(1, totalDays) : 0;
  const showPasalubong = isLimited && daysLeft <= 2 && daysLeft > 0;
  const suggestedSouvenirBudget = isLimited
    ? Math.min(remaining, Math.round(remaining * 0.2 / 100) * 100 || 5000)
    : 0;

  return (
    <View style={styles.card}>
      {/* --- Limited Mode Header --- */}
      {isLimited ? (
        <>
          <Text style={styles.label}>TOTAL BUDGET</Text>
          <Text style={styles.total}>{formatCurrency(budgetLimit, currency)}</Text>

          <View style={styles.statRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Spent</Text>
              <Text style={styles.statValue}>{formatCurrency(total, currency)}</Text>
              <Text style={styles.excludeNote}>excl. accommodation</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Remaining</Text>
              <Text style={[styles.statValue, lowBudget && styles.statWarning]}>
                {formatCurrency(remaining, currency)}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${spentPct * 100}%`,
                  backgroundColor: getProgressColor(spentPct),
                },
              ]}
            />
          </View>
          <Text style={styles.pctText}>{Math.round(spentPct * 100)}% used</Text>

          {/* Daily allowance */}
          <View style={styles.dailyBudgetRow}>
            <Text style={styles.dailyLabel}>Daily allowance</Text>
            <Text style={styles.dailyValue}>
              {formatCurrency(dailyAllowance, currency)}/day
            </Text>
          </View>

          {daysLeft > 0 && (
            <View style={styles.dailyBudgetRow}>
              <Text style={styles.dailyLabel}>Daily budget remaining</Text>
              <Text style={styles.dailyValue}>
                {formatCurrency(dailyBudgetRemaining, currency)}/day
              </Text>
            </View>
          )}

          {lowBudget && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Less than 20% of your budget remaining
              </Text>
            </View>
          )}

          {/* Pasalubong reminder */}
          {showPasalubong && (
            <View style={styles.pasalubongCard}>
              <Text style={styles.pasalubongTitle}>
                {'\u{1F381}'} Set aside budget for pasalubong!
              </Text>
              <Text style={styles.pasalubongLine}>
                Remaining trip budget: {formatCurrency(remaining, currency)}
              </Text>
              <Text style={styles.pasalubongLine}>
                Suggested souvenir budget: {formatCurrency(suggestedSouvenirBudget, currency)}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* --- Unlimited Mode Header --- */}
          <Text style={styles.label}>TOTAL SPENT</Text>
          <Text style={styles.total}>{formatCurrency(total, currency)}</Text>
          <Text style={styles.perPerson}>
            {formatCurrency(perPersonAmount, currency)} per person {'\u00B7'} split {travelerCount} ways
          </Text>

          {daysElapsed > 0 && (
            <View style={styles.dailyBudgetRow}>
              <Text style={styles.dailyLabel}>Daily average spend</Text>
              <Text style={styles.dailyValue}>
                {formatCurrency(dailyAverageSpend, currency)}/day
              </Text>
            </View>
          )}
        </>
      )}

      {/* Category breakdown */}
      <View style={styles.bars}>
        {categories.length === 0 ? (
          <Text style={styles.empty}>No expenses yet.</Text>
        ) : (
          categories.map(([cat, amt]) => {
            const pct = amt / max;
            const color = CATEGORY_COLORS[cat] ?? colors.text2;
            return (
              <View key={cat} style={styles.barRow}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.catLabel}>{cat}</Text>
                  <Text style={styles.catAmount}>{formatCurrency(amt, currency)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Per-person running total */}
      {names.length > 0 ? (
        <View style={styles.perPersonSection}>
          <Text style={styles.sectionTitle}>PER PERSON</Text>
          {names.map(name => (
            <View key={name} style={styles.personRow}>
              <Text style={styles.personName}>{name}</Text>
              <Text style={styles.personAmount}>
                {formatCurrency(perPersonAmount, currency)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.perPersonSection}>
          <Text style={styles.sectionTitle}>PER PERSON</Text>
          <View style={styles.personRow}>
            <Text style={styles.personName}>{travelerCount} travelers</Text>
            <Text style={styles.personAmount}>
              {formatCurrency(perPersonAmount, currency)} each
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  total: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  perPerson: { color: colors.text2, fontSize: 12, marginTop: 4 },
  statRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  statCol: { flex: 1 },
  statLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  statWarning: {
    color: colors.red,
  },
  excludeNote: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg3,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  pctText: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  dailyBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dailyLabel: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '500',
  },
  dailyValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  warningBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.red + '1A',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red + '40',
    padding: spacing.md,
  },
  warningText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  pasalubongCard: {
    marginTop: spacing.md,
    backgroundColor: colors.amber + '1A',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber + '40',
    padding: spacing.md,
    gap: 4,
  },
  pasalubongTitle: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '700',
  },
  pasalubongLine: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '500',
  },
  bars: { marginTop: spacing.lg, gap: spacing.sm },
  empty: { color: colors.text3, fontSize: 13 },
  barRow: { gap: 6 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel: { color: colors.text2, fontSize: 12, fontWeight: '600' },
  catAmount: { color: colors.text, fontSize: 12, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bg3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  perPersonSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personName: { color: colors.text2, fontSize: 13, fontWeight: '500' },
  personAmount: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
