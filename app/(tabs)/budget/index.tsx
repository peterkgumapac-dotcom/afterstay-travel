// Budget 2.0 — ported from prototype budget.jsx
// Structure: Track/Budget/Group pill → Overview/Fate tabs → status + budget card + categories + expenses + settle

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Car, Compass, Hotel, Package, Pencil, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import BudgetStatusBanner from '@/components/budget/BudgetStatusBanner';
import {
  deleteExpense,
  getActiveTrip,
  getExpenses,
  getExpenseSummary,
  getGroupMembers,
  updateTripBudgetLimit,
  updateTripBudgetMode,
} from '@/lib/supabase';
import { formatCurrency, formatDatePHT, safeParse, MS_PER_DAY } from '@/lib/utils';
import type { Expense, GroupMember, Trip } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type BudgetState = 'cruising' | 'low' | 'over';
type BudgetMode = 'track' | 'budget' | 'group';
type TabId = 'overview' | 'fate';

// ── Category config ──────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Food & Drink', matchKey: 'Food', icon: UtensilsCrossed, colorKey: 'chart1' as const },
  { name: 'Transport', matchKey: 'Transport', icon: Car, colorKey: 'chart2' as const },
  { name: 'Activities', matchKey: 'Activity', icon: Compass, colorKey: 'chart3' as const },
  { name: 'Shopping', matchKey: 'Shopping', icon: ShoppingBag, colorKey: 'chart4' as const },
];

function smartTitle(e: Expense): string {
  let desc = e.description.trim()
    .replace(/^payment transaction at /i, '')
    .replace(/^ride booking service with /i, '')
    .replace(/^dinner for multiple people with /i, '')
    .replace(/^purchase at /i, '')
    .replace(/^online payment to /i, '')
    .replace(/ in boracay$/i, '')
    .replace(/ in .*philippines$/i, '');
  if (e.placeName && e.placeName.length > 2) {
    const catMap: Record<string, string> = { Food: 'Food', Transport: 'Ride', Activity: 'Activity', Shopping: 'Shopping', Accommodation: 'Stay', Other: '' };
    const prefix = catMap[e.category] ?? '';
    desc = prefix ? `${prefix} at ${e.placeName}` : e.placeName;
  }
  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  if (desc.length > 35) desc = desc.slice(0, 32) + '\u2026';
  return desc || e.description.slice(0, 35);
}

// ── Main screen ──────────────────────────────────────────────────────

export default function BudgetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [mode, setMode] = useState<BudgetMode>('track');
  const [tab, setTab] = useState<TabId>('overview');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<{ total: number; byCategory: Record<string, number>; count: number }>({ total: 0, byCategory: {}, count: 0 });
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // ── Data loading ──
  const load = useCallback(async (force = false) => {
    try {
      const t = await getActiveTrip(force);
      setTrip(t);
      if (t) {
        const [exps, summary, mems] = await Promise.all([
          getExpenses(t.id).catch(() => [] as Expense[]),
          getExpenseSummary(t.id).catch(() => ({ total: 0, byCategory: {}, count: 0 })),
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
        ]);
        setExpenses(exps);
        setExpenseSummary(summary);
        setMembers(mems);
        // Auto-detect mode
        if (mems.length >= 2) setMode('group');
        else if (t.budgetLimit && t.budgetLimit > 0) setMode('budget');
        else setMode('track');
      }
    } catch (e) { if (__DEV__) console.warn('[BudgetScreen] load budget data failed:', e); } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived values ──
  const total = trip?.budgetLimit ?? 0;
  const spent = expenseSummary.total;
  const remaining = total - spent;
  const days = useMemo(() => trip ? Math.max(1, Math.ceil(
    (safeParse(trip.endDate).getTime() - safeParse(trip.startDate).getTime()) / MS_PER_DAY
  ) + 1) : 1, [trip?.startDate, trip?.endDate]);
  const perDay = total > 0 ? Math.round(total / days) : 0;
  const bState: BudgetState = total <= 0 ? 'cruising' : remaining / total > 0.5 ? 'cruising' : remaining / total > 0.2 ? 'low' : 'over';

  const spendingByPerson = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) { map[e.paidBy || 'Unknown'] = (map[e.paidBy || 'Unknown'] ?? 0) + e.amount; }
    return map;
  }, [expenses]);

  const filteredExpenses = useMemo(() =>
    personFilter ? expenses.filter(e => e.paidBy === personFilter || e.splitType === 'Equal') : expenses,
    [expenses, personFilter],
  );

  const spendingByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) { map[e.date] = (map[e.date] ?? 0) + e.amount; }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [expenses]);

  // ── Actions ──
  const handleDeleteExpense = useCallback((id: string, desc: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Expense', `Delete "${desc}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteExpense(id).catch(() => {});
        load(true);
      }},
    ]);
  }, [load]);

  const handleModeChange = useCallback((m: BudgetMode) => {
    setMode(m);
    if (trip) {
      const supabaseMode = m === 'budget' || m === 'group' ? 'Limited' : 'Unlimited';
      updateTripBudgetMode(trip.id, supabaseMode).catch(() => {});
    }
  }, [trip]);

  const handleSaveBudget = useCallback(() => {
    const num = parseFloat(budgetInput.replace(/[^0-9.]/g, ''));
    if (!num || !trip) return;
    updateTripBudgetLimit(trip.id, num).catch(() => {});
    setTrip(prev => prev ? { ...prev, budgetLimit: num } : prev);
    setShowBudgetModal(false);
  }, [budgetInput, trip]);

  const displayExpenses = showAllExpenses ? filteredExpenses : filteredExpenses.slice(0, 5);
  const maxDaySpend = Math.max(...spendingByDay.map(d => d[1]), 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.subtitle}>{trip?.destination ?? 'Trip'} · {days} days</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/add-expense' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Mode pill — Track / Budget / Group */}
      <View style={styles.modePadding}>
        <View style={styles.segControl}>
          {(['track', 'budget', 'group'] as const).map(m => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                style={[styles.segBtn, active && styles.segBtnActive]}
                onPress={() => handleModeChange(m)}
              >
                <Text style={[styles.segText, active && styles.segTextActive]}>
                  {m === 'track' ? 'Track' : m === 'budget' ? 'Budget' : 'Group'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Tab row — Overview / Fate */}
      <View style={styles.tabRow}>
        {(['overview', 'fate'] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'overview' ? 'Overview' : 'Who Pays?'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'overview' && (
          <>
            {/* Status banner */}
            {(mode === 'budget' || mode === 'group') && total > 0 && (
              <View style={styles.section}>
                <BudgetStatusBanner state={bState} spent={spent} total={total} />
              </View>
            )}

            {/* Budget card */}
            {(mode === 'budget' || mode === 'group') && (
              <View style={styles.section}>
                <View style={styles.budgetCard}>
                  <View style={styles.budgetHeader}>
                    <View>
                      <Text style={styles.eyebrow}>Trip budget · {days} days</Text>
                      <View style={styles.budgetAmountRow}>
                        <Text style={styles.budgetCurrency}>{'\u20B1'}</Text>
                        <Text style={styles.budgetAmount}>{total.toLocaleString()}</Text>
                        <TouchableOpacity onPress={() => { setBudgetInput(String(total)); setShowBudgetModal(true); }} hitSlop={8}>
                          <Pencil size={13} color={colors.text3} strokeWidth={1.8} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.budgetPerDay}>{formatCurrency(perDay, 'PHP')}/day target</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, total > 0 ? (spent / total) * 100 : 0)}%` }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressText}>Spent <Text style={styles.progressBold}>{formatCurrency(spent, 'PHP')}</Text></Text>
                    <Text style={styles.progressText}>Left <Text style={[styles.progressBold, { color: colors.accent }]}>{formatCurrency(remaining, 'PHP')}</Text></Text>
                  </View>

                  {/* Lodging one-liner */}
                  {trip?.accommodation && (
                    <View style={styles.lodgingRow}>
                      <View style={styles.lodgingCheck}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"><Polyline points="20 6 9 17 4 12" stroke={colors.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lodgingTitle} numberOfLines={1}>Lodging · {trip.accommodation}</Text>
                        <Text style={styles.lodgingSub}>Paid in full · {members.length} travelers</Text>
                      </View>
                      {trip.cost != null && <Text style={styles.lodgingAmount}>{formatCurrency(trip.cost, trip.costCurrency ?? 'PHP')}</Text>}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Track mode — simple total */}
            {mode === 'track' && (
              <View style={styles.section}>
                <View style={styles.trackCard}>
                  <Text style={styles.eyebrow}>Total spent</Text>
                  <Text style={styles.trackAmount}>{formatCurrency(spent, trip?.costCurrency ?? 'PHP')}</Text>
                  <Text style={styles.trackSub}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · {days} days</Text>
                </View>
              </View>
            )}

            {/* Person filter — Group mode */}
            {mode === 'group' && members.length >= 2 && (
              <View style={styles.section}>
                <Text style={styles.eyebrow}>Filter by person</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personRow}>
                  <TouchableOpacity
                    style={[styles.personChip, !personFilter && styles.personChipActive]}
                    onPress={() => setPersonFilter(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.personChipText, !personFilter && styles.personChipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {members.map(m => {
                    const active = personFilter === m.name;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.personChip, active && styles.personChipActive]}
                        onPress={() => setPersonFilter(active ? null : m.name)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                          <Text style={styles.avatarText}>{m.name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={[styles.personChipText, active && styles.personChipTextActive]}>{m.name.split(' ')[0]}</Text>
                          {(spendingByPerson[m.name] ?? 0) > 0 && (
                            <Text style={[styles.personChipAmount, active && { color: colors.accent }]}>{formatCurrency(spendingByPerson[m.name], 'PHP')}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Categories */}
            {spent > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Where it's going</Text>
                <View style={styles.catList}>
                  {CATEGORIES.map(cat => {
                    const amount = expenseSummary.byCategory[cat.matchKey] ?? 0;
                    const pct = spent > 0 ? Math.round((amount / spent) * 100) : 0;
                    const color = colors[cat.colorKey];
                    const Icon = cat.icon;
                    return (
                      <View key={cat.name} style={styles.catRow}>
                        <View style={[styles.catIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                          <Icon size={16} color={color} strokeWidth={1.8} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.catHeader}>
                            <Text style={styles.catName}>{cat.name}</Text>
                            <Text style={styles.catAmount}>{formatCurrency(amount, 'PHP')}</Text>
                          </View>
                          <View style={styles.catBarTrack}>
                            <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Spending by day */}
            {spendingByDay.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by day</Text>
                <View style={styles.dayCard}>
                  {spendingByDay.slice(-7).map(([date, amt]) => {
                    const pct = (amt / maxDaySpend) * 100;
                    return (
                      <View key={date} style={styles.dayRow}>
                        <Text style={styles.dayLabel}>{formatDatePHT(date)}</Text>
                        <View style={styles.dayBarTrack}>
                          <View style={[styles.dayBarFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.dayAmount}>{formatCurrency(amt, 'PHP')}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Expenses */}
            {expenses.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{mode === 'group' ? 'Shared expenses' : 'Expenses'}</Text>
                  {filteredExpenses.length > 5 && (
                    <TouchableOpacity onPress={() => setShowAllExpenses(!showAllExpenses)}>
                      <Text style={styles.seeAllText}>
                        {showAllExpenses ? 'Show less' : `All ${filteredExpenses.length} \u2192`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {displayExpenses.map((e) => {
                  const payer = members.find(m => m.name === e.paidBy) || members[0];
                  const isOpen = expandedExpense === e.id;
                  const splitCount = members.length || 1;
                  const each = Math.round(e.amount / splitCount);
                  const catConfig = CATEGORIES.find(c => c.matchKey === e.category);
                  const CatIcon = catConfig?.icon ?? Package;
                  const catColor = catConfig ? colors[catConfig.colorKey] : colors.text3;

                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={styles.expenseRow}
                      onPress={() => setExpandedExpense(isOpen ? null : e.id)}
                      onLongPress={() => handleDeleteExpense(e.id, e.description)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.expenseMain}>
                        <View style={[styles.expenseIcon, { backgroundColor: catColor + '18' }]}>
                          <CatIcon size={16} color={catColor} strokeWidth={1.8} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.expenseTopRow}>
                            <Text style={styles.expenseTitle} numberOfLines={1}>{smartTitle(e)}</Text>
                            <Text style={styles.expenseAmount}>{formatCurrency(e.amount, e.currency)}</Text>
                          </View>
                          {mode === 'group' && payer ? (
                            <Text style={styles.expenseMeta}>
                              {payer.name.split(' ')[0]} paid · others owe <Text style={{ color: colors.accent, fontWeight: '600' }}>{formatCurrency(each, 'PHP')}</Text> each
                            </Text>
                          ) : (
                            <Text style={styles.expenseMeta}>{e.category} · {e.paidBy ? `by ${e.paidBy.split(' ')[0]}` : formatDatePHT(e.date)}</Text>
                          )}
                        </View>
                      </View>

                      {/* Expanded breakdown */}
                      {isOpen && mode === 'group' && (
                        <View style={styles.expenseBreakdown}>
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>{payer?.name.split(' ')[0] ?? 'Payer'} paid</Text>
                            <Text style={styles.breakdownValue}>{formatCurrency(e.amount, 'PHP')}</Text>
                          </View>
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Split across {splitCount} · each</Text>
                            <Text style={styles.breakdownValue}>{formatCurrency(each, 'PHP')}</Text>
                          </View>
                          <Text style={[styles.breakdownLabel, { marginTop: 4 }]}>{e.category}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Settle cards — Group mode only */}
            {mode === 'group' && members.length >= 2 && (() => {
              const primaryPayer = members.reduce((top, m) =>
                (spendingByPerson[m.name] ?? 0) > (spendingByPerson[top.name] ?? 0) ? m : top,
                members[0],
              );
              const others = members.filter(m => m.name !== primaryPayer.name);
              const perPerson = spent > 0 ? Math.round(spent / members.length) : 0;

              return others.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Settle up</Text>
                  {others.map(m => {
                    const theirPaid = spendingByPerson[m.name] ?? 0;
                    const owes = Math.max(0, perPerson - theirPaid);
                    if (owes < 1) return null;
                    return (
                      <View key={m.id} style={styles.settleRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.chart2, width: 36, height: 36 }]}>
                          <Text style={[styles.avatarText, { fontSize: 14 }]}>{m.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settleText}>
                            <Text style={{ fontWeight: '600' }}>{m.name.split(' ')[0]}</Text>
                            <Text style={{ color: colors.text3 }}> owes </Text>
                            <Text style={{ fontWeight: '600' }}>{primaryPayer.name.split(' ')[0]}</Text>
                          </Text>
                          <Text style={styles.settleAmount}>{formatCurrency(owes, 'PHP')}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.settleBtn}
                          onPress={() => Alert.alert('Settle', `Mark ${formatCurrency(owes, 'PHP')} as settled?`, [
                            { text: 'Not yet', style: 'cancel' },
                            { text: 'Settled', onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
                          ])}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.settleBtnText}>Settle</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : null;
            })()}
          </>
        )}

        {/* Fate tab */}
        {tab === 'fate' && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>Who pays?</Text>
            <Text style={[styles.sectionTitle, { fontSize: 22 }]}>Let fate decide</Text>
            <Text style={styles.fateSub}>Spin the wheel or let Touch of Fate pick who pays next.</Text>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/budget/fate-decides'); }}
              style={styles.fateButton}
              accessibilityRole="button"
              accessibilityLabel="Open Fate Decides"
            >
              <Text style={styles.fateButtonText}>Open Fate Decides</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit budget modal */}
      <Modal visible={showBudgetModal} transparent animationType="fade" onRequestClose={() => setShowBudgetModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Budget</Text>
            <TextInput
              style={styles.modalInput}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder="50000"
              placeholderTextColor={colors.text3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowBudgetModal(false)}><Text style={[styles.modalBtn, { color: colors.text3 }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveBudget}><Text style={[styles.modalBtn, { color: colors.accent }]}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '500', letterSpacing: -0.8, color: c.text },
  subtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 1.6, textTransform: 'uppercase', color: c.text3, marginTop: 2 },
  addBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.black, borderRadius: radius.sm },
  addBtnText: { fontSize: 12, fontWeight: '600', color: c.onBlack },

  // Mode pill
  modePadding: { paddingHorizontal: 16, paddingBottom: 10 },
  segControl: { flexDirection: 'row', backgroundColor: c.card2, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.pill },
  segBtnActive: { backgroundColor: c.card },
  segText: { fontSize: 13, fontWeight: '600', color: c.text3 },
  segTextActive: { color: c.text },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.border, gap: 18 },
  tabBtn: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabBtnActive: { borderBottomColor: c.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: c.text3 },
  tabTextActive: { color: c.text },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  seeAllText: { fontSize: 12, fontWeight: '600', color: c.accent },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6, textTransform: 'uppercase', color: c.text3 },

  // Budget card
  budgetCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 22, padding: 18 },
  budgetHeader: { marginBottom: 14 },
  budgetAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  budgetCurrency: { fontSize: 18, color: c.text3, fontWeight: '600' },
  budgetAmount: { fontSize: 34, fontWeight: '500', letterSpacing: -0.3, color: c.text },
  budgetPerDay: { fontSize: 11, color: c.text3, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: c.card2, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: c.accent },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12, color: c.text3 },
  progressBold: { fontWeight: '600', color: c.text, letterSpacing: -0.3 },
  lodgingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  lodgingCheck: { width: 24, height: 24, borderRadius: 6, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder, alignItems: 'center', justifyContent: 'center' },
  lodgingTitle: { fontSize: 12, fontWeight: '600', color: c.text },
  lodgingSub: { fontSize: 10.5, color: c.text3, marginTop: 1 },
  lodgingAmount: { fontSize: 13, fontWeight: '600', color: c.text2, letterSpacing: -0.3 },

  // Track mode
  trackCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 22, padding: 18, alignItems: 'center' },
  trackAmount: { fontSize: 34, fontWeight: '500', letterSpacing: -0.3, color: c.text, marginTop: 4 },
  trackSub: { fontSize: 12, color: c.text3, marginTop: 4 },

  // Person filter
  personRow: { gap: 6, paddingTop: 6 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  personChipActive: { borderColor: c.accentBorder, backgroundColor: c.accentBg },
  personChipText: { fontSize: 12, fontWeight: '600', color: c.text },
  personChipTextActive: { color: c.accent },
  personChipAmount: { fontSize: 9.5, color: c.text3, marginTop: 1 },
  avatar: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#fffaf0' },

  // Categories
  catList: { gap: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14 },
  catIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  catName: { fontSize: 13, fontWeight: '600', color: c.text },
  catAmount: { fontSize: 13, fontWeight: '600', color: c.text, letterSpacing: -0.3 },
  catBarTrack: { height: 4, borderRadius: 99, backgroundColor: c.card2, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 99 },

  // Spending by day
  dayCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14, gap: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayLabel: { width: 46, fontSize: 11, fontWeight: '600', color: c.text3 },
  dayBarTrack: { flex: 1, height: 8, backgroundColor: c.card2, borderRadius: 99, overflow: 'hidden' },
  dayBarFill: { height: '100%', borderRadius: 99, backgroundColor: c.accent },
  dayAmount: { width: 72, textAlign: 'right', fontSize: 11, fontWeight: '600', color: c.text, letterSpacing: -0.3 },

  // Expenses
  expenseRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border },
  expenseMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expenseIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expenseTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  expenseTitle: { fontSize: 13, fontWeight: '600', color: c.text, flex: 1 },
  expenseAmount: { fontSize: 13, fontWeight: '600', color: c.text, letterSpacing: -0.3 },
  expenseMeta: { fontSize: 11, color: c.text3, marginTop: 2 },
  expenseBreakdown: { marginTop: 10, marginLeft: 44, padding: 10, backgroundColor: c.card2, borderWidth: 1, borderColor: c.border, borderRadius: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  breakdownLabel: { fontSize: 11, color: c.text2 },
  breakdownValue: { fontSize: 11, fontWeight: '600', color: c.text, letterSpacing: -0.3 },

  // Settle
  settleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14 },
  settleText: { fontSize: 12.5, color: c.text },
  settleAmount: { fontSize: 18, fontWeight: '600', color: c.accent, letterSpacing: -0.3, marginTop: 2 },
  settleBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.black, borderRadius: radius.sm },
  settleBtnText: { fontSize: 12, fontWeight: '600', color: c.onBlack },

  // Fate
  fateSub: { fontSize: 12, color: c.text3, marginTop: 4 },
  fateButton: { marginTop: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.accentBorder, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  fateButtonText: { fontSize: 15, fontWeight: '600', color: c.accent, letterSpacing: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '85%', backgroundColor: c.bg2, borderRadius: radius.lg, padding: 24, borderWidth: 1, borderColor: c.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 },
  modalInput: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 18, letterSpacing: -0.3, paddingHorizontal: 14, paddingVertical: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 16 },
  modalBtn: { fontSize: 14, fontWeight: '600' },
});
