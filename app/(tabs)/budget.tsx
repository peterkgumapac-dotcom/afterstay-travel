import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetAlertCard } from '@/components/budget/BudgetAlertCard';
import BudgetSummary from '@/components/BudgetSummary';
import ExpenseRow from '@/components/ExpenseRow';
import { getBudgetStatus } from '@/lib/budgetAlerts';
import { colors, radius, spacing } from '@/constants/theme';
import {
  deleteExpense,
  getActiveTrip,
  getExpenses,
  getGroupMembers,
  updateTripBudgetLimit,
  updateTripBudgetMode,
} from '@/lib/notion';
import type { Expense, Trip } from '@/lib/types';
import { formatCurrency, formatDatePHT, safeParse } from '@/lib/utils';

type BudgetMode = 'Limited' | 'Unlimited';

const CATEGORY_EMOJI: Record<string, string> = {
  Food: '\u{1F37D}',
  Transport: '\u{1F6FA}',
  Activity: '\u{1F3AF}',
  Accommodation: '\u{1F3E8}',
  Shopping: '\u{1F6CD}',
  Other: '\u{1F4E6}',
};

/** Parse date string with PHT timezone suffix to avoid Android UTC-shift. */
function parseDatePht(dateStr: string): Date {
  return safeParse(dateStr);
}

function computeDaysElapsed(startDate: string): number {
  const start = parseDatePht(startDate);
  const now = Date.now();
  const ms = now - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function computeDaysLeft(endDate: string): number {
  const end = parseDatePht(endDate);
  const now = Date.now();
  const ms = end.getTime() - now;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function computeTotalDays(startDate: string, endDate: string): number {
  const start = parseDatePht(startDate);
  const end = parseDatePht(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
}

function getExpenseDay(expenseDate: string, tripStartDate: string): number {
  const exp = parseDatePht(expenseDate);
  const start = parseDatePht(tripStartDate);
  return Math.floor((exp.getTime() - start.getTime()) / 86400000) + 1;
}

interface DayGroup {
  day: number;
  date: string;
  expenses: Expense[];
  total: number;
}

function buildDayGroups(expenses: ReadonlyArray<Expense>, tripStartDate: string): readonly DayGroup[] {
  const groups = new Map<number, { expenses: Expense[]; total: number; date: string }>();

  for (const expense of expenses) {
    const day = getExpenseDay(expense.date, tripStartDate);
    const existing = groups.get(day);
    if (existing) {
      groups.set(day, {
        ...existing,
        expenses: [...existing.expenses, expense],
        total: existing.total + expense.amount,
      });
    } else {
      groups.set(day, {
        expenses: [expense],
        total: expense.amount,
        date: formatDatePHT(expense.date),
      });
    }
  }

  return Array.from(groups.entries())
    .map(([day, data]) => ({ day, ...data }))
    .sort((a, b) => b.day - a.day);
}

function getDayLabel(day: number, currentDay: number, dateStr: string): string {
  if (day <= 0) return `Pre-trip \u2014 ${dateStr}`;
  if (day === currentDay) return `Today (Day ${day} \u2014 ${dateStr})`;
  if (day === currentDay - 1) return `Yesterday (Day ${day} \u2014 ${dateStr})`;
  return `Day ${day} \u2014 ${dateStr}`;
}

function getDailyProgressColor(pct: number): string {
  if (pct >= 1) return colors.red;
  if (pct >= 0.75) return colors.amber;
  return colors.green2;
}

export default function BudgetScreen() {
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [travelers, setTravelers] = useState(3);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const budgetMode: BudgetMode = trip?.budgetMode ?? 'Unlimited';

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const t = await getActiveTrip();
      setTrip(t);
      if (!t) return;
      const [exp, mem] = await Promise.all([
        getExpenses(t.id),
        getGroupMembers(t.id).catch(() => []),
      ]);
      setExpenses(exp);
      if (mem.length > 0) setTravelers(mem.length);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleModeToggle = async (mode: BudgetMode) => {
    if (!trip || mode === budgetMode) return;
    const updated: Trip = { ...trip, budgetMode: mode };
    setTrip(updated);
    try {
      await updateTripBudgetMode(trip.id, mode);
    } catch {
      // revert on failure
      setTrip(trip);
    }
  };

  const handleBudgetSave = async () => {
    if (!trip) return;
    const parsed = parseFloat(budgetInput);
    if (isNaN(parsed) || parsed <= 0) {
      setEditingBudget(false);
      return;
    }
    const updated: Trip = { ...trip, budgetLimit: parsed };
    setTrip(updated);
    setEditingBudget(false);
    try {
      await updateTripBudgetLimit(trip.id, parsed);
    } catch {
      setTrip(trip);
    }
  };

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setExpenses(prev => prev.filter(e => e.id !== expenseId));
          try {
            await deleteExpense(expenseId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            // Reload on failure to restore state
            load();
          }
        },
      },
    ]);
  };

  const handleEditExpense = (expense: Expense) => {
    router.push({
      pathname: '/add-expense',
      params: {
        editId: expense.id,
        description: expense.description,
        amount: String(expense.amount),
        currency: expense.currency,
        category: expense.category,
        placeName: expense.placeName ?? '',
        notes: expense.notes ?? '',
        photoUri: expense.photo ?? '',
        date: expense.date,
        paidBy: expense.paidBy ?? '',
        splitType: expense.splitType ?? 'Equal',
      },
    });
  };

  const handleFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Manual Entry', 'Scan Receipt'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) router.push('/add-expense');
          if (index === 2) router.push('/scan-receipt');
        },
      );
    } else {
      Alert.alert('Add Expense', 'Choose an option', [
        { text: 'Manual Entry', onPress: () => router.push('/add-expense') },
        { text: 'Scan Receipt', onPress: () => router.push('/scan-receipt') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Separate accommodation expenses from daily spending
  const isAccommodation = (e: Expense) => {
    const desc = (e.description ?? '').toLowerCase();
    return e.category === 'Accommodation' || desc.includes('hotel') || desc.includes('canyon');
  };
  const dailyExpenses = expenses.filter(e => !isAccommodation(e));
  const accommodationExpenses = expenses.filter(isAccommodation);
  const accommodationTotal = accommodationExpenses.reduce((sum, e) => sum + e.amount, 0);
  const accommodationCost = accommodationTotal || (trip?.cost ?? 0);

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of dailyExpenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    total += e.amount;
  }

  const daysElapsed = trip ? computeDaysElapsed(trip.startDate) : 1;
  const daysLeft = trip ? computeDaysLeft(trip.endDate) : 0;
  const totalDays = trip ? computeTotalDays(trip.startDate, trip.endDate) : 1;
  const currentDay = daysElapsed;

  // Only show expenses during the trip (filter out pre-trip payments)
  const tripDailyExpenses = useMemo(
    () => {
      if (!trip) return dailyExpenses;
      const tripStart = parseDatePht(trip.startDate).getTime();
      return dailyExpenses.filter(e => parseDatePht(e.date).getTime() >= tripStart);
    },
    [dailyExpenses, trip],
  );

  const dayGroups = useMemo(
    () => (trip ? buildDayGroups(tripDailyExpenses, trip.startDate) : []),
    [tripDailyExpenses, trip],
  );

  const isLimited = budgetMode === 'Limited' && trip?.budgetLimit != null && trip.budgetLimit > 0;
  const dailyAllowance = isLimited ? (trip?.budgetLimit ?? 0) / totalDays : 0;
  const currency = trip?.costCurrency ?? 'PHP';

  const sections = useMemo(
    () =>
      dayGroups.map((group) => ({
        day: group.day,
        date: group.date,
        total: group.total,
        data: group.expenses,
      })),
    [dayGroups],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.green2} />
      </SafeAreaView>
    );
  }
  if (error || !trip) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'No trip found.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.safe}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.sub}>
            {isLimited
              ? `${formatCurrency(trip.budgetLimit ?? 0, currency)} for ${totalDays} days · ${formatCurrency(dailyAllowance, currency)}/day`
              : `${dailyExpenses.length} ${dailyExpenses.length === 1 ? 'expense' : 'expenses'} logged`}
          </Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.toggleRow}>
          {(['Limited', 'Unlimited'] as const).map((mode) => {
            const active = budgetMode === mode;
            return (
              <Pressable
                key={mode}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                onPress={() => handleModeToggle(mode)}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {mode}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => (
              <Pressable
                onPress={() => handleDeleteExpense(item.id)}
                style={styles.deleteAction}
              >
                <Text style={styles.deleteActionText}>Delete</Text>
              </Pressable>
            )}
          >
            <Pressable
              style={styles.expenseItem}
              onPress={() => handleEditExpense(item)}
            >
              <View style={styles.expenseItemHeader}>
                <Text style={styles.expenseEmoji}>
                  {CATEGORY_EMOJI[item.category] ?? CATEGORY_EMOJI.Other}
                </Text>
                <View style={styles.expenseItemInfo}>
                  <Text style={styles.expenseDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                  {item.paidBy ? (
                    <Text style={styles.expensePaidBy}>Paid by {item.paidBy}</Text>
                  ) : null}
                </View>
                <Text style={styles.expenseAmount}>
                  {formatCurrency(item.amount, item.currency)}
                </Text>
              </View>
            </Pressable>
          </Swipeable>
        )}
        renderSectionHeader={({ section }) => {
          const label = getDayLabel(section.day, currentDay, section.date);
          const dailyPct = dailyAllowance > 0 ? Math.min(1, section.total / dailyAllowance) : 0;
          return (
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{label}</Text>
              {isLimited && (
                <>
                  <View style={styles.dailyProgressTrack}>
                    <View
                      style={[
                        styles.dailyProgressFill,
                        {
                          width: `${dailyPct * 100}%`,
                          backgroundColor: getDailyProgressColor(dailyPct),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.dailyProgressText}>
                    {formatCurrency(section.total, currency)} of{' '}
                    {formatCurrency(dailyAllowance, currency)}
                  </Text>
                </>
              )}
              {!isLimited && (
                <Text style={styles.dailyProgressText}>
                  {formatCurrency(section.total, currency)}
                </Text>
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            {/* Budget alert card */}
            {isLimited && (
              <BudgetAlertCard
                status={getBudgetStatus(total, trip.budgetLimit ?? 0, daysLeft)}
              />
            )}

            {/* Editable budget limit for Limited mode */}
            {budgetMode === 'Limited' && (
              <Pressable
                style={styles.editBudgetRow}
                onPress={() => {
                  setBudgetInput(String(trip.budgetLimit ?? ''));
                  setEditingBudget(true);
                }}
              >
                {editingBudget ? (
                  <View style={styles.editInputRow}>
                    <Text style={styles.editLabel}>Budget: {currency}</Text>
                    <TextInput
                      style={styles.editInput}
                      value={budgetInput}
                      onChangeText={setBudgetInput}
                      keyboardType="numeric"
                      autoFocus
                      onSubmitEditing={handleBudgetSave}
                      onBlur={handleBudgetSave}
                      placeholder="Enter amount"
                      placeholderTextColor={colors.text3}
                    />
                  </View>
                ) : (
                  <Text style={styles.editHint}>
                    {trip.budgetLimit
                      ? 'Tap to edit budget limit'
                      : 'Tap to set a budget limit'}
                  </Text>
                )}
              </Pressable>
            )}

            {accommodationCost > 0 && (
              <View style={styles.accommodationCard}>
                <Text style={styles.accommodationHeader}>🏨 ACCOMMODATION (Paid)</Text>
                <Text style={styles.accommodationAmount}>
                  {formatCurrency(accommodationCost, currency)}
                </Text>
                {accommodationExpenses.length > 0 && (
                  <View style={{ gap: 2, marginTop: spacing.sm }}>
                    {accommodationExpenses.map(e => (
                      <Text key={e.id} style={styles.accommodationDetail}>
                        {e.description} · Paid {formatDatePHT(e.date)}
                      </Text>
                    ))}
                  </View>
                )}
                {travelers > 1 && (
                  <Text style={styles.accommodationPerPerson}>
                    Per person: {formatCurrency(accommodationCost / travelers, currency)} each
                  </Text>
                )}
              </View>
            )}

            <BudgetSummary
              total={total}
              currency={currency}
              byCategory={byCategory}
              travelers={travelers}
              budgetMode={budgetMode}
              budgetLimit={trip.budgetLimit}
              daysLeft={daysLeft}
              daysElapsed={daysElapsed}
              totalDays={totalDays}
              currentDay={currentDay}
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet. Tap + to add one.</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.green2}
          />
        }
        stickySectionHeadersEnabled={false}
      />

      <Pressable style={styles.fab} onPress={handleFabPress}>
        <Plus size={24} color={colors.white} />
      </Pressable>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontSize: 13 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.text2, fontSize: 13, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.green,
  },
  toggleText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: colors.white,
  },
  editBudgetRow: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
  },
  editHint: {
    color: colors.green2,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  editInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editLabel: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
  },
  editInput: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.green2,
  },
  accommodationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  accommodationHeader: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  accommodationAmount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  accommodationDetail: {
    color: colors.text2,
    fontSize: 12,
  },
  accommodationPerPerson: {
    color: colors.text3,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  list: { padding: spacing.lg, paddingBottom: 120 },
  empty: { color: colors.text2, fontSize: 13, textAlign: 'center', paddingVertical: spacing.xl },
  // Day header styles
  dayHeader: {
    paddingVertical: spacing.sm,
    gap: 6,
  },
  dayLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dailyProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg3,
    overflow: 'hidden',
  },
  dailyProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  dailyProgressText: {
    color: colors.text3,
    fontSize: 12,
    fontWeight: '600',
  },
  // Expense item styles (inline within section)
  expenseItem: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  expenseItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expenseEmoji: {
    fontSize: 20,
  },
  expenseItemInfo: {
    flex: 1,
    gap: 2,
  },
  expenseDesc: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  expensePaidBy: {
    color: colors.text3,
    fontSize: 11,
  },
  expenseAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteAction: {
    backgroundColor: colors.red,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  deleteActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
