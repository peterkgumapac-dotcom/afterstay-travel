import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import type { Expense } from '@/lib/types';

interface Props {
  expenses: Expense[];
  currency?: string;
  tripDays?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#e8a860',
  Transport: '#5a8fb5',
  Activity: '#7ac4d6',
  Accommodation: '#8b6f5a',
  Shopping: '#b66a8a',
  Other: '#857d70',
};

export function InsightCards({ expenses, currency = 'PHP', tripDays = 1 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (expenses.length === 0) return null;

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const biggest = expenses.reduce((a, b) => (a.amount > b.amount ? a : b));
  const dailyAvg = tripDays > 0 ? Math.round(total / tripDays) : total;

  // Top categories
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Spending by day
  const byDay: Record<string, number> = {};
  for (const e of expenses) {
    byDay[e.date] = (byDay[e.date] ?? 0) + e.amount;
  }
  const dayEntries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDaySpend = Math.max(...dayEntries.map(d => d[1]), 1);

  // Most visited place
  const byPlace: Record<string, number> = {};
  for (const e of expenses) {
    const place = e.placeName || e.description.split(' ').slice(0, 3).join(' ');
    byPlace[place] = (byPlace[place] ?? 0) + 1;
  }
  const topSpot = Object.entries(byPlace).sort((a, b) => b[1] - a[1])[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spending Insights</Text>

      {/* Stat cards row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Biggest expense</Text>
          <Text style={styles.statValue}>{formatCurrency(biggest.amount, currency)}</Text>
          <Text style={styles.statSub} numberOfLines={1}>{biggest.description.slice(0, 20)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Top spot</Text>
          <Text style={styles.statValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{topSpot?.[0] ?? '—'}</Text>
          <Text style={styles.statSub}>{topSpot?.[1] ?? 0} visits</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Daily avg</Text>
          <Text style={styles.statValue}>{formatCurrency(dailyAvg, currency)}</Text>
          <Text style={styles.statSub}>per day</Text>
        </View>
      </ScrollView>

      {/* Spending by day */}
      {dayEntries.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by day</Text>
          {dayEntries.slice(-7).map(([date, amt]) => {
            const pct = (amt / maxDaySpend) * 100;
            const barColor = pct > 80 ? '#c4554a' : pct > 60 ? '#e8a860' : pct > 40 ? '#d9a441' : '#4caf50';
            return (
              <View key={date} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{formatDatePHT(date)}</Text>
                <View style={styles.dayBarTrack}>
                  <View style={[styles.dayBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={styles.dayAmount}>{formatCurrency(amt, currency)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Top categories */}
      {sortedCats.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top categories</Text>
          {sortedCats.map(([cat, amt]) => {
            const pct = Math.round((amt / total) * 100);
            const color = CATEGORY_COLORS[cat] ?? colors.text3;
            return (
              <View key={cat} style={styles.catRow}>
                <Text style={[styles.catLabel, { color }]}>{cat}</Text>
                <View style={styles.catBarTrack}>
                  <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.catPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing.lg,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    statRow: {
      gap: spacing.sm + 2,
    },
    statCard: {
      width: 150,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 4,
      letterSpacing: -0.3,
    },
    statSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text2,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dayLabel: {
      fontSize: 11,
      color: colors.text3,
      width: 50,
    },
    dayBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    dayBarFill: {
      height: 6,
      borderRadius: 3,
    },
    dayAmount: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      width: 65,
      textAlign: 'right',
    },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    catLabel: {
      fontSize: 12,
      fontWeight: '600',
      width: 90,
    },
    catBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    catBarFill: {
      height: 6,
      borderRadius: 3,
    },
    catPct: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text3,
      width: 30,
      textAlign: 'right',
    },
  });
