import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Plus, Settings2, Trash2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import {
  deleteDailyExpense,
  getDailyTrackerEnabled,
  getDailyTrackerSettings,
  setDailyTrackerEnabled,
  setDailyTrackerSettings,
  getDailyExpenses,
  getDailyExpensePeriodSummary,
} from '@/lib/supabase';
import type { DailyExpense, DailyExpenseCategory, DailyExpensePeriodSummary, DailyTrackerSettings } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type Period = 'daily' | 'weekly' | 'monthly';

const CAT_COLORS: Record<DailyExpenseCategory, string> = {
  Food: '#d8ab7a', Transport: '#c49460', Bills: '#e2b361',
  Entertainment: '#e38868', Groceries: '#8a5a2b', Other: '#857d70',
};

const ALL_CATS: DailyExpenseCategory[] = ['Food', 'Transport', 'Bills', 'Entertainment', 'Groceries', 'Other'];
const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'GBP', 'SGD', 'THB', 'KRW', 'VND'] as const;

interface DailyTrackerCardProps {
  onAddExpense: () => void;
  onScanReceipt: () => void;
}

export function DailyTrackerCard({ onAddExpense, onScanReceipt }: DailyTrackerCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [enabled, setEnabled] = useState(false);
  const [period, setPeriod] = useState<Period>('weekly');
  const [summary, setSummary] = useState<DailyExpensePeriodSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [settings, setSettings] = useState<DailyTrackerSettings>({});
  const [showSettings, setShowSettings] = useState(false);
  const [weeklyInput, setWeeklyInput] = useState('');
  const [monthlyInput, setMonthlyInput] = useState('');
  const [incomeInput, setIncomeInput] = useState('');
  const [currencyPick, setCurrencyPick] = useState('PHP');
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [trackedCats, setTrackedCats] = useState<DailyExpenseCategory[]>(ALL_CATS);

  useEffect(() => {
    getDailyTrackerEnabled().then(setEnabled).catch(() => {});
    getDailyTrackerSettings().then((st) => {
      setSettings(st);
      setWeeklyInput(st.weeklyBudget ? String(st.weeklyBudget) : '');
      setMonthlyInput(st.monthlyBudget ? String(st.monthlyBudget) : '');
      setIncomeInput(st.income ? String(st.income) : '');
      setCurrencyPick(st.currency ?? 'PHP');
      setWeeklyReport(st.weeklyReport ?? false);
      setTrackedCats(st.trackedCategories ?? ALL_CATS);
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async (p: Period) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await getDailyExpensePeriodSummary(p);
      setSummary(data);
      const exps = await getDailyExpenses(data.startDate, data.endDate);
      setExpenses(exps);
    } catch { /* silent */ }
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) loadData(period); }, [enabled, period, loadData]);

  const handleToggle = async (on: boolean) => {
    setEnabled(on);
    await setDailyTrackerEnabled(on).catch(() => {});
    if (on) loadData(period);
  };

  const handleSaveSettings = async () => {
    const next: DailyTrackerSettings = {
      weeklyBudget: Number(weeklyInput) || undefined,
      monthlyBudget: Number(monthlyInput) || undefined,
      income: Number(incomeInput) || undefined,
      currency: currencyPick,
      weeklyReport,
      trackedCategories: trackedCats.length === ALL_CATS.length ? undefined : trackedCats,
    };
    setSettings(next);
    await setDailyTrackerSettings(next).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSettings(false);
  };

  const handleDelete = (id: string, desc: string) => {
    Alert.alert('Delete?', desc, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteDailyExpense(id).catch(() => {});
        setExpenses(prev => prev.filter(e => e.id !== id));
        loadData(period);
      }},
    ]);
  };

  const cur = settings.currency ?? 'PHP';
  const budget = period === 'weekly' ? settings.weeklyBudget : period === 'monthly' ? settings.monthlyBudget : undefined;
  const spent = summary?.total ?? 0;
  const pct = budget && budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const paceColor = pct > 90 ? '#c4554a' : pct > 70 ? '#e2b361' : '#4ade80';
  const maxCat = summary ? Math.max(1, ...Object.values(summary.byCategory)) : 1;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayLabel = (d: string) => d === today ? 'Today' : d === yesterday ? 'Yesterday' : formatDatePHT(d);

  const byDate = useMemo(() => {
    const map = new Map<string, { items: DailyExpense[]; total: number }>();
    for (const e of expenses) {
      const entry = map.get(e.date) ?? { items: [], total: 0 };
      entry.items.push(e);
      entry.total += e.amount;
      map.set(e.date, entry);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  return (
    <View style={[s.card, enabled && s.cardOn]}>
      {/* Header */}
      <View style={s.row}>
        <Text style={s.title}>EVERYDAY SPENDING</Text>
        <View style={s.headerRight}>
          {enabled && (
            <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={s.gearBtn} activeOpacity={0.7}>
              <Settings2 size={18} color={showSettings ? colors.accent : colors.text3} strokeWidth={1.8} />
            </TouchableOpacity>
          )}
          <Switch value={enabled} onValueChange={handleToggle} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" />
        </View>
      </View>

      {!enabled && <Text style={s.offText}>Track everyday spending between trips</Text>}

      {enabled && (
        <>
          {/* Settings panel */}
          {showSettings && (
            <View style={s.settingsPanel}>
              <View style={s.row}>
                <Text style={s.settingsHead}>Settings</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={8}>
                  <X size={16} color={colors.text3} />
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity key={c} style={[s.chip, currencyPick === c && s.chipOn]} onPress={() => setCurrencyPick(c)}>
                      <Text style={[s.chipText, currencyPick === c && s.chipTextOn]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={s.inputRow}>
                <Text style={s.fieldLabel}>Weekly budget</Text>
                <TextInput style={s.numInput} value={weeklyInput} onChangeText={setWeeklyInput} placeholder="0" placeholderTextColor={colors.text3} keyboardType="decimal-pad" />
              </View>
              <View style={s.inputRow}>
                <Text style={s.fieldLabel}>Monthly budget</Text>
                <TextInput style={s.numInput} value={monthlyInput} onChangeText={setMonthlyInput} placeholder="0" placeholderTextColor={colors.text3} keyboardType="decimal-pad" />
              </View>
              <View style={s.inputRow}>
                <Text style={s.fieldLabel}>Monthly income</Text>
                <TextInput style={s.numInput} value={incomeInput} onChangeText={setIncomeInput} placeholder="optional" placeholderTextColor={colors.text3} keyboardType="decimal-pad" />
              </View>

              <Text style={[s.fieldLabel, { marginTop: 8 }]}>Track categories</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {ALL_CATS.map(cat => {
                  const on = trackedCats.includes(cat);
                  return (
                    <TouchableOpacity key={cat} style={[s.chip, on && s.chipOn]} onPress={() => setTrackedCats(prev => on ? prev.filter(c => c !== cat) : [...prev, cat])}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[s.inputRow, { marginTop: 8 }]}>
                <Text style={s.fieldLabel}>Weekly report</Text>
                <Switch value={weeklyReport} onValueChange={setWeeklyReport} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" />
              </View>

              <TouchableOpacity style={s.saveBtn} onPress={handleSaveSettings} activeOpacity={0.7}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Budget nudge */}
          {!showSettings && !settings.weeklyBudget && !settings.monthlyBudget && (
            <TouchableOpacity style={s.nudge} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
              <Text style={s.nudgeText}>Set your spending budget</Text>
              <ChevronRight size={14} color={colors.accent} />
            </TouchableOpacity>
          )}

          {/* Period pills */}
          <View style={s.pillRow}>
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <TouchableOpacity key={p} style={[s.pill, period === p && s.pillOn]} onPress={() => setPeriod(p)} activeOpacity={0.7}>
                <Text style={[s.pillText, period === p && s.pillTextOn]}>
                  {p === 'daily' ? 'Today' : p === 'weekly' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount + pace */}
          <Text style={s.amount}>{summary ? formatCurrency(spent, cur) : loading ? '...' : formatCurrency(0, cur)}</Text>
          {budget && budget > 0 && period !== 'daily' && (
            <View style={s.paceRow}>
              <View style={s.paceBg}><View style={[s.paceFill, { width: `${pct}%`, backgroundColor: paceColor }]} /></View>
              <Text style={[s.paceLabel, { color: paceColor }]}>
                {formatCurrency(budget, cur)} budget · {Math.round(pct)}%
              </Text>
            </View>
          )}
          {summary && period !== 'daily' && summary.average > 0 && (
            <Text style={s.avg}>avg {formatCurrency(summary.average, cur)}/day · {summary.count} expense{summary.count !== 1 ? 's' : ''}</Text>
          )}
          {settings.income && period === 'monthly' && spent > 0 && (
            <Text style={s.avg}>{Math.round((spent / settings.income) * 100)}% of income</Text>
          )}

          {/* Category bars */}
          {summary && Object.keys(summary.byCategory).length > 0 && (
            <View style={s.catSection}>
              {Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
                <View key={cat} style={s.catRow}>
                  <Text style={s.catName}>{cat}</Text>
                  <View style={s.barBg}><View style={[s.barFill, { width: `${(amt / maxCat) * 100}%`, backgroundColor: CAT_COLORS[cat as DailyExpenseCategory] ?? colors.accent }]} /></View>
                  <Text style={s.catAmt}>{formatCurrency(amt, cur)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Expense history */}
          {byDate.length > 0 && (
            <View style={s.histSection}>
              {byDate.map(([date, { items, total }]) => (
                <View key={date}>
                  <TouchableOpacity style={s.dayRow} onPress={() => setExpandedDay(expandedDay === date ? null : date)} activeOpacity={0.7}>
                    <Text style={s.dayText}>{dayLabel(date)}</Text>
                    <Text style={s.dayAmt}>{formatCurrency(total, cur)}</Text>
                  </TouchableOpacity>
                  {expandedDay === date && items.map(e => (
                    <View key={e.id} style={s.expRow}>
                      <View style={[s.expDot, { backgroundColor: CAT_COLORS[e.dailyCategory] ?? colors.text3 }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.expDesc} numberOfLines={1}>{e.description}</Text>
                        <Text style={s.expCat}>{e.dailyCategory}</Text>
                      </View>
                      <Text style={s.expAmt}>{formatCurrency(e.amount, e.currency)}</Text>
                      <TouchableOpacity onPress={() => handleDelete(e.id, e.description)} hitSlop={10} style={{ padding: 4 }}>
                        <Trash2 size={13} color={colors.text3} strokeWidth={1.5} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.addBtn} onPress={onAddExpense} activeOpacity={0.7}>
              <Plus size={15} color="#fff" strokeWidth={2.5} />
              <Text style={s.addText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.scanBtn} onPress={onScanReceipt} activeOpacity={0.7}>
              <Text style={s.scanText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginHorizontal: 16, marginBottom: 14 },
  cardOn: { borderColor: c.accentBorder },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 11, fontWeight: '700', color: c.text3, letterSpacing: 1.2 },
  offText: { fontSize: 13, color: c.text3, marginTop: 6 },
  gearBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.bg2, alignItems: 'center', justifyContent: 'center' },

  // Nudge
  nudge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: c.accentBg, borderRadius: 10, borderWidth: 1, borderColor: c.accentBorder },
  nudgeText: { fontSize: 13, fontWeight: '600', color: c.accent },

  // Pills
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: c.bg2 },
  pillOn: { backgroundColor: c.text },
  pillText: { fontSize: 11, fontWeight: '600', color: c.text3 },
  pillTextOn: { color: c.bg },

  // Amount
  amount: { fontSize: 28, fontWeight: '700', color: c.text, letterSpacing: -1, marginTop: 8 },
  avg: { fontSize: 11, color: c.text3, marginTop: 2 },

  // Pace
  paceRow: { marginTop: 6, gap: 4 },
  paceBg: { height: 4, borderRadius: 2, backgroundColor: c.bg2, overflow: 'hidden' },
  paceFill: { height: 4, borderRadius: 2 },
  paceLabel: { fontSize: 11, fontWeight: '600' },

  // Categories
  catSection: { marginTop: 12, gap: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { width: 80, fontSize: 11, fontWeight: '500', color: c.text2 },
  barBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.bg2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  catAmt: { width: 60, fontSize: 11, fontWeight: '600', color: c.text, textAlign: 'right' },

  // History
  histSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  dayText: { fontSize: 12, fontWeight: '700', color: c.text },
  dayAmt: { fontSize: 12, fontWeight: '600', color: c.text2 },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 4 },
  expDot: { width: 6, height: 6, borderRadius: 3 },
  expDesc: { fontSize: 13, color: c.text },
  expCat: { fontSize: 10, color: c.text3, marginTop: 1 },
  expAmt: { fontSize: 13, fontWeight: '600', color: c.text },

  // Settings
  settingsPanel: { marginTop: 10, padding: 14, backgroundColor: c.bg2, borderRadius: 12, gap: 8 },
  settingsHead: { fontSize: 13, fontWeight: '700', color: c.text },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: c.text3, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numInput: { width: 90, fontSize: 14, fontWeight: '600', textAlign: 'right', color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { fontSize: 11, fontWeight: '600', color: c.text3 },
  chipTextOn: { color: '#fff' },
  saveBtn: { backgroundColor: c.accent, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Actions
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text, paddingVertical: 10, borderRadius: 10 },
  addText: { fontSize: 13, fontWeight: '700', color: c.bg },
  scanBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg2 },
  scanText: { fontSize: 13, fontWeight: '700', color: c.text2 },
});
