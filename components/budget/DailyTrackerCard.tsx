import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { BarChart3, Camera, Plus } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';
import {
  getDailyTrackerEnabled,
  setDailyTrackerEnabled,
  getDailyExpensePeriodSummary,
} from '@/lib/supabase';
import type { DailyExpenseCategory, DailyExpensePeriodSummary } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type Period = 'daily' | 'weekly' | 'monthly';

const CAT_COLORS: Record<DailyExpenseCategory, string> = {
  Food: '#d8ab7a',
  Transport: '#c49460',
  Bills: '#e2b361',
  Entertainment: '#e38868',
  Groceries: '#8a5a2b',
  Other: '#857d70',
};

interface DailyTrackerCardProps {
  onAddExpense: () => void;
  onScanReceipt: () => void;
}

export function DailyTrackerCard({ onAddExpense, onScanReceipt }: DailyTrackerCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [enabled, setEnabled] = useState(false);
  const [period, setPeriod] = useState<Period>('daily');
  const [summary, setSummary] = useState<DailyExpensePeriodSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDailyTrackerEnabled().then(setEnabled).catch(() => {});
  }, []);

  const loadSummary = useCallback(async (p: Period) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await getDailyExpensePeriodSummary(p);
      setSummary(data);
    } catch { /* silent */ }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (enabled) loadSummary(period);
  }, [enabled, period, loadSummary]);

  const handleToggle = async (on: boolean) => {
    setEnabled(on);
    await setDailyTrackerEnabled(on).catch(() => {});
    if (on) loadSummary(period);
  };

  const maxCatAmount = summary
    ? Math.max(1, ...Object.values(summary.byCategory))
    : 1;

  return (
    <View style={[s.card, enabled && s.cardEnabled]}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <BarChart3 size={18} color={colors.accent} strokeWidth={1.8} />
          <Text style={s.headerTitle}>Daily Tracker</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#fff"
        />
      </View>

      {!enabled && (
        <Text style={s.disabledSub}>Track your everyday spending</Text>
      )}

      {enabled && (
        <>
          {/* Period summary */}
          <Text style={s.totalLabel}>
            {period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month'}
          </Text>
          <Text style={s.totalAmount}>
            {summary ? formatCurrency(summary.total, 'PHP') : loading ? '...' : formatCurrency(0, 'PHP')}
          </Text>
          {summary && period !== 'daily' && summary.average > 0 && (
            <Text style={s.avgLabel}>
              avg {formatCurrency(summary.average, 'PHP')}/day
            </Text>
          )}

          {/* Category bars */}
          {summary && Object.keys(summary.byCategory).length > 0 && (
            <View style={s.catBars}>
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amt]) => (
                  <View key={cat} style={s.catRow}>
                    <Text style={s.catLabel}>{cat}</Text>
                    <View style={s.barBg}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${(amt / maxCatAmount) * 100}%`,
                            backgroundColor: CAT_COLORS[cat as DailyExpenseCategory] ?? colors.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.catAmount}>{formatCurrency(amt, 'PHP')}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Period pills */}
          <View style={s.pillRow}>
            {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.pill, period === p && s.pillActive]}
                onPress={() => setPeriod(p)}
                activeOpacity={0.7}
              >
                <Text style={[s.pillText, period === p && s.pillTextActive]}>
                  {p === 'daily' ? 'Today' : p === 'weekly' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.addBtn} onPress={onAddExpense} activeOpacity={0.7}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Add Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.scanBtn} onPress={onScanReceipt} activeOpacity={0.7}>
              <Camera size={16} color={colors.accent} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 14,
    },
    cardEnabled: { borderColor: c.accentBorder },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    disabledSub: { fontSize: 12, color: c.text3, marginTop: 4 },

    totalLabel: { fontSize: 10, fontWeight: '600', color: c.text3, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
    totalAmount: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.5, marginTop: 2 },
    avgLabel: { fontSize: 11, color: c.text2, marginTop: 2 },

    catBars: { marginTop: 14, gap: 8 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    catLabel: { width: 80, fontSize: 11, fontWeight: '600', color: c.text2 },
    barBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.bg2, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
    catAmount: { width: 65, fontSize: 11, fontWeight: '600', color: c.text, textAlign: 'right' },

    pillRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.card2, borderWidth: 1, borderColor: c.border },
    pillActive: { backgroundColor: c.accent, borderColor: c.accent },
    pillText: { fontSize: 11, fontWeight: '600', color: c.text2 },
    pillTextActive: { color: '#fff' },

    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.accent, paddingVertical: 10, borderRadius: radius.sm },
    addBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    scanBtn: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: c.accentDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.accentBorder },
  });
