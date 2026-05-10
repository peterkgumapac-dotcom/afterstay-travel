// Budget 2.0 — ported from prototype budget.jsx
// Structure: Track/Budget/Group pill → Overview/Fate tabs → status + budget card + categories + expenses + settle

import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Car, ChevronDown, ChevronUp, Compass, Package, QrCode, ShoppingBag, Users, UtensilsCrossed, Wallet, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
import SwipeableExpenseRow from '@/components/budget/SwipeableExpenseRow';
import {
  addPaymentQr,
  addUserPaymentQr,
  deleteExpense,
  getActiveTrip,
  getExpenses,
  getGroupMembers,
  getPaymentQrs,
  getUserPaymentQrs,
  removePaymentQr as removePaymentQrSupabase,
  removeUserPaymentQr,
  updateTripBudgetLimit,
} from '@/lib/supabase';
import type { PaymentQr, UserPaymentQr } from '@/lib/supabase';
import { getUnifiedExpenseHistory } from '@/lib/expenseHistory';
import { deleteQuickTripExpense, getQuickTrips } from '@/lib/quickTrips';
import type { QuickTrip } from '@/lib/quickTripTypes';
import ExpenseTargetSheet from '@/components/budget/ExpenseTargetSheet';
import { ExpenseDetailSheet } from '@/components/budget/ExpenseDetailSheet';
import { GroupBalanceCard } from '@/components/budget/GroupBalanceCard';
import { DailyTrackerCard } from '@/components/budget/DailyTrackerCard';
import { DailyTrackerSheet } from '@/components/budget/DailyTrackerSheet';
import { SavingsGoalCard } from '@/components/budget/SavingsGoalCard';
import { SavingsGoalSetup } from '@/components/budget/SavingsGoalSetup';
import { SavingsEntrySheet } from '@/components/budget/SavingsEntrySheet';
import { SavingsMilestoneModal } from '@/components/budget/SavingsMilestoneModal';
import { useAuth } from '@/lib/auth';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import {
  getActiveSavingsGoal,
  createSavingsGoal,
  updateSavingsGoal,
  addSavingsEntry,
  addDailyExpense,
} from '@/lib/supabase';
import { formatCurrency, formatDatePHT, safeParse, MS_PER_DAY } from '@/lib/utils';
import type { DailyExpense, DailyExpenseCategory, Expense, ExpenseTarget, GroupMember, SavingsGoal, SavingsMilestone, Trip, UnifiedExpenseHistoryItem } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type DetailExpense = Expense & { source?: UnifiedExpenseHistoryItem['source']; sourceId?: string };
type BudgetMode = 'budget' | 'group';
type TabId = 'expenses' | 'savings' | 'settle' | 'fate';
type MoneySummary = { today: number; week: number; month: number; currency: string };
type ExpenseHistoryFilter = 'travel' | 'trip' | 'quick-trip' | 'normal';
type ExpenseTargetAction = 'add' | 'scan';

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
    .replace(/ in \w[\w\s]*$/i, '');
  if (e.placeName && e.placeName.length > 2) {
    const catMap: Record<string, string> = { Food: 'Food', Transport: 'Ride', Activity: 'Activity', Shopping: 'Shopping', Accommodation: 'Stay', Other: '' };
    const prefix = catMap[e.category] ?? '';
    desc = prefix ? `${prefix} at ${e.placeName}` : e.placeName;
  }
  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  if (desc.length > 45) desc = desc.slice(0, 42) + '\u2026';
  return desc || e.description.slice(0, 35);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function summarizeMoneyByPeriod(items: { amount: number; currency?: string; date: string }[]): MoneySummary {
  const now = new Date();
  const today = dateKey(now);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const summary: MoneySummary = { today: 0, week: 0, month: 0, currency: items[0]?.currency ?? 'PHP' };

  for (const item of items) {
    const itemDate = safeParse(item.date);
    if (dateKey(itemDate) === today) summary.today += item.amount;
    if (itemDate >= weekStart) summary.week += item.amount;
    if (itemDate >= monthStart) summary.month += item.amount;
  }

  return summary;
}

function SummaryStrip({ summary, styles }: { summary: MoneySummary; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.summaryStrip}>
      {[
        ['Today', summary.today],
        ['This Week', summary.week],
        ['This Month', summary.month],
      ].map(([label, amount]) => (
        <View key={label as string} style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>{label as string}</Text>
          <Text style={styles.summaryAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(amount as number, summary.currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BudgetHero({
  eyebrow,
  amount,
  currency,
  subtitle,
  context,
  note,
  progressPct,
  progressLeftLabel,
  progressRightLabel,
  onAdd,
  onScan,
  onSetLimit,
  styles,
}: {
  eyebrow: string;
  amount: number;
  currency: string;
  subtitle: string;
  context: string;
  note?: string;
  progressPct?: number;
  progressLeftLabel?: string;
  progressRightLabel?: string;
  onAdd: () => void;
  onScan: () => void;
  onSetLimit?: () => void;
  styles: ReturnType<typeof getStyles>;
}) {
  const clampedProgress = progressPct == null ? null : Math.max(0, Math.min(100, progressPct));

  return (
    <View style={styles.travelHero}>
      <View style={styles.travelHeroTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.travelHeroAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(amount, currency)}
          </Text>
          <Text style={styles.travelHeroSub}>{subtitle}</Text>
        </View>
        <View style={styles.travelHeroPill}>
          <Text style={styles.travelHeroPillText} numberOfLines={1}>{context}</Text>
        </View>
      </View>

      {clampedProgress !== null && (
        <View style={styles.travelHeroProgressBlock}>
          <View style={styles.travelHeroProgressTrack}>
            <View style={[styles.travelHeroProgressFill, { width: `${clampedProgress}%` }]} />
          </View>
          {(progressLeftLabel || progressRightLabel) && (
            <View style={styles.travelHeroProgressLabels}>
              <Text style={styles.travelHeroProgressText}>{progressLeftLabel}</Text>
              <Text style={styles.travelHeroProgressText}>{progressRightLabel}</Text>
            </View>
          )}
        </View>
      )}

      {note ? <Text style={styles.travelHeroNote}>{note}</Text> : null}

      <View style={styles.travelHeroActions}>
        <TouchableOpacity style={styles.travelHeroPrimaryAction} onPress={onAdd} activeOpacity={0.75}>
          <Text style={styles.travelHeroPrimaryText}>Add expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.travelHeroSecondaryAction} onPress={onScan} activeOpacity={0.75}>
          <Text style={styles.travelHeroSecondaryText}>Scan receipt</Text>
        </TouchableOpacity>
        {onSetLimit && (
          <TouchableOpacity style={styles.travelHeroLimitAction} onPress={onSetLimit} activeOpacity={0.75}>
            <Text style={styles.travelHeroLimitText}>Set limit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CollapsibleBudgetSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  styles,
  colors,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.compactSectionHeader} onPress={() => setOpen(prev => !prev)} activeOpacity={0.75}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.compactSectionSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {open ? <ChevronUp size={18} color={colors.text3} /> : <ChevronDown size={18} color={colors.text3} />}
      </TouchableOpacity>
      {open ? <View style={styles.compactSectionBody}>{children}</View> : null}
    </View>
  );
}

function summarizeExpenses(expenses: Expense[]): { total: number; byCategory: Record<string, number>; count: number } {
  const byCategory: Record<string, number> = {};
  const total = expenses.reduce((sum, expense) => {
    const category = expense.category || 'Other';
    byCategory[category] = (byCategory[category] ?? 0) + expense.amount;
    return sum + expense.amount;
  }, 0);
  return { total, byCategory, count: expenses.length };
}

export default function BudgetScreenWithBoundary() {
  return (
    <TabErrorBoundary name="Budget">
      <BudgetScreenMemo />
    </TabErrorBoundary>
  );
}

const BudgetScreenMemo = React.memo(BudgetScreen);

function BudgetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isTestMode, mockData } = useUserSegment();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [mode, setMode] = useState<BudgetMode>('budget');
  const modeInit = useRef(false);
  const didInitialBudgetLoad = useRef(false);
  const lastBudgetFocusRefreshAt = useRef(0);
  const historyLoadingRef = useRef(false);
  const [tab, setTab] = useState<TabId>('expenses');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<{ total: number; byCategory: Record<string, number>; count: number }>({ total: 0, byCategory: {}, count: 0 });
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [paymentQrs, setPaymentQrs] = useState<PaymentQr[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [viewingQr, setViewingQr] = useState<PaymentQr | null>(null);
  const [showQrNameModal, setShowQrNameModal] = useState(false);
  const [pendingQrUri, setPendingQrUri] = useState<string | null>(null);
  const [qrNameInput, setQrNameInput] = useState('');

  // Expense detail sheet
  const [detailExpense, setDetailExpense] = useState<DetailExpense | null>(null);

  // User-scoped QR codes (visible in all states)
  const [userQrs, setUserQrs] = useState<UserPaymentQr[]>([]);
  const [viewingUserQr, setViewingUserQr] = useState<UserPaymentQr | null>(null);
  const [showUserQrNameModal, setShowUserQrNameModal] = useState(false);
  const [pendingUserQrUri, setPendingUserQrUri] = useState<string | null>(null);
  const [userQrNameInput, setUserQrNameInput] = useState('');

  // Savings + Daily Tracker state
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal | null>(null);
  const [showSavingsSetup, setShowSavingsSetup] = useState(false);
  const [showSavingsEntry, setShowSavingsEntry] = useState(false);
  const [milestoneToShow, setMilestoneToShow] = useState<SavingsMilestone | null>(null);
  const [showDailySheet, setShowDailySheet] = useState(false);

  // React "reset state on prop change" — clear synchronously on auth change
  // so the previous account's expenses, members, QR codes, savings goal,
  // budget input never flash for a frame after switching accounts.
  const [accountBoundUserId, setAccountBoundUserId] = useState<string | undefined>(user?.id);
  if (accountBoundUserId !== user?.id) {
    setAccountBoundUserId(user?.id);
    setTrip(null);
    setExpenses([]);
    setExpenseSummary({ total: 0, byCategory: {}, count: 0 });
    setMembers([]);
    setPersonFilter(null);
    setExpandedExpense(null);
    setShowAllExpenses(false);
    setBudgetInput('');
    setPaymentQrs([]);
    setUserQrs([]);
    setSavingsGoal(null);
    setDetailExpense(null);
  }

  // Load savings goal on mount
  useEffect(() => {
    getActiveSavingsGoal().then(setSavingsGoal).catch(() => {});
  }, [user?.id]);

  // Load user-scoped QR codes (always, regardless of trip)
  useEffect(() => {
    if (user?.id) {
      getUserPaymentQrs(user.id).then(setUserQrs).catch(() => {});
    }
  }, [user?.id]);

  const handleCreateGoal = async (input: { title: string; targetAmount: number; targetCurrency: string; targetDate?: string; destination?: string }) => {
    try {
      const goal = await createSavingsGoal(input);
      setSavingsGoal(goal);
    } catch (e) { if (__DEV__) console.warn('[Budget] create goal failed:', e); }
  };

  const handleUpdateGoal = async (input: { title: string; targetAmount: number; targetCurrency: string; targetDate?: string; destination?: string }) => {
    if (!savingsGoal) return;
    try {
      await updateSavingsGoal(savingsGoal.id, input);
      setSavingsGoal({ ...savingsGoal, ...input });
    } catch (e) { if (__DEV__) console.warn('[Budget] update goal failed:', e); }
  };

  const handleLogSavings = async (amount: number, note?: string) => {
    if (!savingsGoal) return;
    try {
      const { newMilestones } = await addSavingsEntry(savingsGoal.id, amount, note);
      setSavingsGoal((prev) => prev ? { ...prev, currentAmount: prev.currentAmount + amount, celebratedMilestones: [...prev.celebratedMilestones, ...newMilestones] } : prev);
      if (newMilestones.length > 0) {
        setMilestoneToShow(newMilestones[newMilestones.length - 1]);
      }
    } catch (e) { if (__DEV__) console.warn('[Budget] log savings failed:', e); }
  };

  const handleAddDailyExpense = async (input: { description: string; amount: number; dailyCategory: DailyExpenseCategory; notes?: string }) => {
    try {
      await addDailyExpense(input);
    } catch (e) { if (__DEV__) console.warn('[Budget] add daily expense failed:', e); }
  };

  // Dev test mode: apply mock data
  useEffect(() => {
    if (!isTestMode || !mockData) return;
    setTrip(mockData.trip);
    setExpenses(mockData.expenses as Expense[]);
    const total = mockData.expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory: Record<string, number> = {};
    for (const e of mockData.expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }
    setExpenseSummary({ total, byCategory, count: mockData.expenses.length });
    setMembers(mockData.members as GroupMember[]);
    setRefreshing(false);
  }, [isTestMode, mockData]);

  // ── Data loading ──
  const load = useCallback(async (force = false) => {
    if (testModeRef.current) { setRefreshing(false); return; }
    try {
      const t = await getActiveTrip(force);
      setTrip(t);
      if (t) {
        const [exps, mems] = await Promise.all([
          getExpenses(t.id).catch(() => [] as Expense[]),
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
        ]);
        setExpenses(exps);
        setExpenseSummary(summarizeExpenses(exps));
        setMembers(mems);
        // Auto-detect mode only on first load
        if (!modeInit.current) {
          modeInit.current = true;
          if (mems.length >= 2) setMode('group');
          else setMode('budget');
        }
      } else {
        setExpenses([]);
        setExpenseSummary({ total: 0, byCategory: {}, count: 0 });
        setMembers([]);
        setMode('budget');
      }
    } catch (e) { if (__DEV__) console.warn('[BudgetScreen] load budget data failed:', e); } finally {
      setRefreshing(false);
      setBudgetLoading(false);
    }
  }, []);

  const prevTestModeBudget = useRef(isTestMode);
  useEffect(() => {
    if (prevTestModeBudget.current && !isTestMode) {
      load(true);
    }
    prevTestModeBudget.current = isTestMode;
  }, [isTestMode, load]);

  useEffect(() => {
    didInitialBudgetLoad.current = true;
    lastBudgetFocusRefreshAt.current = Date.now();
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialBudgetLoad.current) return;
      const now = Date.now();
      if (now - lastBudgetFocusRefreshAt.current < 60_000) return;
      lastBudgetFocusRefreshAt.current = now;
      load(false);
    }, [load]),
  );

  useEffect(() => {
    if (members.length < 2 && mode === 'group') setMode('budget');
    if (members.length < 2 && tab === 'fate') setTab('expenses');
  }, [members.length, mode, tab]);

  // ── Payment QRs (Supabase-synced) ──
  useEffect(() => {
    if (!trip?.id) return;
    getPaymentQrs(trip.id).then(setPaymentQrs).catch(() => {});
  }, [trip?.id]);

  const pickPaymentQr = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPendingQrUri(result.assets[0].uri);
    setQrNameInput('');
    setShowQrNameModal(true);
  }, []);

  const confirmAddQr = useCallback(async () => {
    if (!pendingQrUri || !trip?.id) return;
    const label = qrNameInput.trim() || 'Payment QR';
    try {
      const next = await addPaymentQr(trip.id, label, pendingQrUri);
      setPaymentQrs(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to upload QR code');
    }
    setPendingQrUri(null);
    setShowQrNameModal(false);
  }, [pendingQrUri, qrNameInput, trip?.id]);

  const handleRemoveQr = useCallback((idx: number) => {
    const name = paymentQrs[idx]?.label ?? 'this QR';
    Alert.alert('Remove QR', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (!trip?.id) return;
        try {
          const next = await removePaymentQrSupabase(trip.id, idx);
          setPaymentQrs(next);
        } catch {
          Alert.alert('Error', 'Something went wrong. Please try again.');
        }
      }},
    ]);
  }, [paymentQrs, trip?.id]);

  // ── Derived values ──
  const total = trip?.budgetLimit ?? 0;
  const spent = expenseSummary.total;
  const remaining = total - spent;
  const days = trip ? Math.max(1, Math.ceil(
    (safeParse(trip.endDate).getTime() - safeParse(trip.startDate).getTime()) / MS_PER_DAY
  ) + 1) : 1;
  const perDay = total > 0 ? Math.round(total / days) : 0;
  const tripStart = trip ? safeParse(trip.startDate) : new Date();
  const tripEnd = trip ? safeParse(trip.endDate) : new Date();
  const todayDate = new Date();
  const elapsedDays = trip ? Math.min(days, Math.max(1, Math.floor((todayDate.getTime() - tripStart.getTime()) / MS_PER_DAY) + 1)) : 1;
  const remainingTripDays = trip ? Math.max(1, Math.ceil((tripEnd.getTime() - todayDate.getTime()) / MS_PER_DAY) + 1) : 1;
  const actualPerDay = spent > 0 ? Math.round(spent / elapsedDays) : 0;
  const dailyAllowance = total > 0 ? Math.max(0, Math.round(remaining / remainingTripDays)) : 0;
  const projectedSpend = trip && actualPerDay > 0 ? actualPerDay * days : spent;
  const topCategory = useMemo(() => {
    const entries = Object.entries(expenseSummary.byCategory).filter(([, amount]) => amount > 0);
    if (entries.length === 0 || spent <= 0) return null;
    const [name, amount] = entries.sort(([, a], [, b]) => b - a)[0];
    return { name, amount, pct: Math.round((amount / spent) * 100) };
  }, [expenseSummary.byCategory, spent]);
  const budgetInsights = useMemo(() => {
    if (!trip) return [] as string[];
    const insights: string[] = [];
    if (total > 0) {
      insights.push(`You can spend ${formatCurrency(dailyAllowance, trip.costCurrency ?? 'PHP')}/day for the rest of this trip.`);
      const delta = Math.round(projectedSpend - total);
      if (spent > 0) {
        insights.push(delta > 0
          ? `At this pace, you'll finish ${formatCurrency(delta, trip.costCurrency ?? 'PHP')} over budget.`
          : `At this pace, you'll finish ${formatCurrency(Math.abs(delta), trip.costCurrency ?? 'PHP')} under budget.`);
      }
    } else if (spent > 0) {
      insights.push(`You're averaging ${formatCurrency(actualPerDay, trip.costCurrency ?? 'PHP')}/day so far.`);
    }
    if (topCategory) {
      insights.push(`${topCategory.name} is your biggest category at ${topCategory.pct}% of spending.`);
    }
    return insights.slice(0, 3);
  }, [actualPerDay, dailyAllowance, projectedSpend, spent, topCategory, total, trip]);

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

  const handleDeleteHistoryExpense = useCallback((item: UnifiedExpenseHistoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Expense', `Delete "${item.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (item.source === 'quick-trip' && item.sourceId) {
            await deleteQuickTripExpense(item.id, item.sourceId).catch(() => {});
          } else {
            await deleteExpense(item.id).catch(() => {});
          }
          load(true);
        },
      },
    ]);
  }, [load]);

  const handleEditExpense = useCallback((e: Expense) => {
    router.push({
      pathname: '/add-expense',
      params: {
        editId: e.id,
        description: e.description,
        amount: String(e.amount),
        currency: e.currency,
        category: e.category,
        date: e.date,
        paidBy: e.paidBy ?? '',
        placeName: e.placeName ?? '',
        notes: e.notes ?? '',
      },
    });
  }, [router]);

  const handleEditDailyExpense = useCallback((e: DailyExpense) => {
    router.push({
      pathname: '/add-expense',
      params: {
        editId: e.id,
        target: 'daily-tracker',
        description: e.description,
        amount: String(e.amount),
        currency: e.currency,
        category: e.category,
        date: e.date,
        placeName: e.placeName ?? '',
        notes: e.notes ?? '',
        photoUri: e.photo ?? '',
      },
    });
  }, [router]);

  const handleEditHistoryExpense = useCallback((e: UnifiedExpenseHistoryItem) => {
    router.push({
      pathname: '/add-expense',
      params: {
        editId: e.id,
        target: e.source === 'quick-trip' ? 'quick-trip' : e.source === 'trip' ? 'trip' : 'standalone',
        ...(e.source === 'quick-trip' && e.sourceId ? { quickTripId: e.sourceId } : {}),
        ...(e.source === 'trip' && e.sourceId ? { tripId: e.sourceId } : {}),
        description: e.description,
        amount: String(e.amount),
        currency: e.currency,
        category: e.category,
        date: e.date,
        paidBy: e.paidBy ?? '',
        placeName: e.placeName ?? '',
        notes: e.notes ?? '',
      },
    });
  }, [router]);

  const handleModeChange = useCallback((m: BudgetMode) => {
    setMode(m);
  }, []);

  const handleSaveBudget = useCallback(() => {
    const num = parseFloat(budgetInput.replace(/[^0-9.]/g, ''));
    if (!num || !trip) return;
    updateTripBudgetLimit(trip.id, num).catch(() => {});
    setTrip(prev => prev ? { ...prev, budgetLimit: num } : prev);
    setShowBudgetModal(false);
  }, [budgetInput, trip]);

  const displayExpenses = showAllExpenses ? filteredExpenses : filteredExpenses.slice(0, 5);
  const maxDaySpend = Math.max(...spendingByDay.map(d => d[1]), 1);

  // Past trip budget summary modal
  const [pastBudgetGroup, setPastBudgetGroup] = useState<{ label: string; items: UnifiedExpenseHistoryItem[] } | null>(null);

  // History expenses for users without active trip (unified: trip + standalone + quick-trip)
  const [historyExpenses, setHistoryExpenses] = useState<UnifiedExpenseHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [quickTrips, setQuickTrips] = useState<QuickTrip[]>([]);
  const [targetSheetVisible, setTargetSheetVisible] = useState(false);
  const [targetAction, setTargetAction] = useState<ExpenseTargetAction>('add');
  const [historyFilter, setHistoryFilter] = useState<ExpenseHistoryFilter>('travel');

  const loadHistory = useCallback(async () => {
    if (historyLoadingRef.current) return;
    historyLoadingRef.current = true;
    if (testModeRef.current) {
      setHistoryExpenses([]);
      setQuickTrips([]);
      setHistoryLoaded(true);
      historyLoadingRef.current = false;
      return;
    }
    try {
      const [exps, qts] = await Promise.all([
        getUnifiedExpenseHistory(30).catch(() => [] as UnifiedExpenseHistoryItem[]),
        getQuickTrips().catch(() => [] as QuickTrip[]),
      ]);
      setHistoryExpenses(exps);
      setQuickTrips(qts);
      setHistoryLoaded(true);
    } finally {
      historyLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!budgetLoading && !trip && !historyLoaded) {
      loadHistory();
    }
  }, [budgetLoading, historyLoaded, loadHistory, trip]);

  useFocusEffect(
    useCallback(() => {
      if (!budgetLoading && !trip) loadHistory();
    }, [budgetLoading, loadHistory, trip]),
  );

  useEffect(() => {
    if (!targetSheetVisible || quickTrips.length > 0 || testModeRef.current) return;
    getQuickTrips().then(setQuickTrips).catch(() => {});
  }, [quickTrips.length, targetSheetVisible]);

  const openTargetSheet = useCallback((action: ExpenseTargetAction = 'add') => {
    setTargetAction(action);
    setTargetSheetVisible(true);
  }, []);

  const activeTripSummary = useMemo(
    () => summarizeMoneyByPeriod(expenses.map(e => ({ amount: e.amount, currency: e.currency, date: e.date }))),
    [expenses],
  );

  const handleSelectTarget = (target: ExpenseTarget) => {
    setTargetSheetVisible(false);
    const action = targetAction;
    switch (target.type) {
      case 'trip':
        if (action === 'scan') {
          router.push({ pathname: '/scan-receipt', params: { expenseType: 'trip', ...(trip?.id ? { tripId: trip.id } : {}) } } as never);
        } else {
          router.push(trip?.id ? `/add-expense?tripId=${trip.id}` as never : '/add-expense' as never);
        }
        break;
      case 'quick-trip':
        if (target.quickTripId === '__new__') {
          router.push(`/quick-trip-create?returnTo=${action === 'scan' ? 'scan-receipt' : 'add-expense'}` as never);
        } else if (action === 'scan') {
          router.push({ pathname: '/scan-receipt', params: { expenseType: 'quick-trip', quickTripId: target.quickTripId } } as never);
        } else {
          router.push(`/add-expense?target=quick-trip&quickTripId=${target.quickTripId}` as never);
        }
        break;
      case 'standalone':
        if (action === 'scan') {
          router.push({ pathname: '/scan-receipt', params: { expenseType: 'standalone' } } as never);
        } else {
          router.push('/add-expense?target=standalone' as never);
        }
        break;
      case 'daily-tracker':
        if (action === 'scan') {
          router.push({ pathname: '/scan-receipt', params: { expenseType: 'daily-tracker' } } as never);
        } else {
          setShowDailySheet(true);
        }
        break;
    }
  };

  // Group history expenses by source for summary cards
  const tripExpenses = useMemo(
    () => historyExpenses.filter(e => e.source === 'trip'),
    [historyExpenses],
  );
  const quickTripExpenses = useMemo(
    () => historyExpenses.filter(e => e.source === 'quick-trip'),
    [historyExpenses],
  );
  const standaloneExpenses = useMemo(
    () => historyExpenses.filter(e => e.source === 'standalone'),
    [historyExpenses],
  );
  const travelExpenses = useMemo(
    () => historyExpenses.filter(e => e.source === 'trip' || e.source === 'quick-trip'),
    [historyExpenses],
  );
  const noTripSettleExpenses = useMemo(
    () => historyExpenses.filter(e => (e.source === 'trip' || e.source === 'quick-trip' || e.source === 'standalone') && (e.paidBy || e.splitType)),
    [historyExpenses],
  );
  const filteredHistoryExpenses = useMemo(() => {
    switch (historyFilter) {
      case 'trip':
        return tripExpenses;
      case 'quick-trip':
        return quickTripExpenses;
      case 'normal':
        return standaloneExpenses;
      case 'travel':
      default:
        return travelExpenses;
    }
  }, [historyFilter, quickTripExpenses, standaloneExpenses, travelExpenses, tripExpenses]);
  const historySummary = useMemo(() => summarizeMoneyByPeriod(filteredHistoryExpenses), [filteredHistoryExpenses]);
  const historyTotal = useMemo(
    () => filteredHistoryExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredHistoryExpenses],
  );
  const standaloneTotal = useMemo(
    () => standaloneExpenses.reduce((sum, e) => sum + e.amount, 0),
    [standaloneExpenses],
  );

  if (!trip && !budgetLoading) {
    const tripTotal = tripExpenses.reduce((s, e) => s + e.amount, 0);
    const quickTotal = quickTripExpenses.reduce((s, e) => s + e.amount, 0);
    const hasTravelExpenses = travelExpenses.length > 0;
    const hasNormalExpenses = standaloneExpenses.length > 0;
    const hasFilteredExpenses = filteredHistoryExpenses.length > 0;
    const isTrueEmptyBudget = historyLoaded && historyExpenses.length === 0 && quickTrips.length === 0;
    const filterTitle = historyFilter === 'normal'
      ? 'Normal Expenses'
      : historyFilter === 'trip'
        ? 'Trips'
        : historyFilter === 'quick-trip'
          ? 'Quick Trips'
          : 'Trips & Quick Trips';
    const filterSubtitle = historyFilter === 'normal'
      ? 'Personal logs, separate from travel'
      : historyFilter === 'trip'
        ? 'Planned trip spending only'
        : historyFilter === 'quick-trip'
          ? 'Quick-trip spending only'
          : 'Travel spending across trips and quick trips';
    const filterChips: { id: ExpenseHistoryFilter; label: string; amount: number; count: number }[] = [
      { id: 'travel', label: 'All Travel', amount: tripTotal + quickTotal, count: travelExpenses.length },
      { id: 'trip', label: 'Trips', amount: tripTotal, count: tripExpenses.length },
      { id: 'quick-trip', label: 'Quick Trips', amount: quickTotal, count: quickTripExpenses.length },
      { id: 'normal', label: 'Normal', amount: standaloneTotal, count: standaloneExpenses.length },
    ];

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Budget</Text>
            <Text style={styles.subtitle}>{hasTravelExpenses ? 'Trips and quick trips' : 'Travel spending'}</Text>
          </View>
        </View>

        {/* Tab row — same tabs for all states */}
        {!isTrueEmptyBudget && (
          <View style={styles.tabRow}>
            {([
              { id: 'expenses' as const, label: 'Expenses' },
              { id: 'savings' as const, label: 'Savings' },
              { id: 'settle' as const, label: 'Settle Up' },
            ]).map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isTrueEmptyBudget ? (
            <View style={styles.trueEmptyWrap}>
              <View style={styles.trueEmptyCard}>
                <View style={styles.trueEmptyIcon}>
                  <Wallet size={26} color={colors.accent} strokeWidth={1.8} />
                </View>
                <Text style={styles.trueEmptyTitle}>No travel spending yet</Text>
                <Text style={styles.trueEmptySub}>
                  Track expenses for trips, quick trips, or everyday travel.
                </Text>
                <View style={styles.trueEmptyActions}>
                  <TouchableOpacity
                    style={styles.trueEmptyPrimary}
                    onPress={() => openTargetSheet('add')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.trueEmptyPrimaryText}>Add Expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.trueEmptySecondary}
                    onPress={() => openTargetSheet('scan')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.trueEmptySecondaryText}>Scan Receipt</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <>
              {tab === 'expenses' && (
                <View style={styles.section}>
                  <BudgetHero
                    eyebrow="Travel Budget"
                    amount={historyTotal}
                    currency={historySummary.currency}
                    subtitle={hasFilteredExpenses
                      ? `${filteredHistoryExpenses.length} expense${filteredHistoryExpenses.length !== 1 ? 's' : ''} · ${filterSubtitle}`
                      : historyFilter === 'normal'
                        ? 'Normal expenses stay here when you just need to log something.'
                        : 'Plan a trip or create a quick trip to see travel spending here.'}
                    context={filterTitle}
                    onAdd={() => openTargetSheet('add')}
                    onScan={() => openTargetSheet('scan')}
                    styles={styles}
                  />
                  <SummaryStrip summary={historySummary} styles={styles} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expenseFilterRow}>
                    {filterChips.map((chip) => {
                      const active = historyFilter === chip.id;
                      return (
                        <TouchableOpacity
                          key={chip.id}
                          style={[styles.expenseFilterChip, active && styles.expenseFilterChipActive]}
                          onPress={() => setHistoryFilter(chip.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.expenseFilterLabel, active && styles.expenseFilterLabelActive]}>{chip.label}</Text>
                          <Text style={[styles.expenseFilterMeta, active && styles.expenseFilterMetaActive]}>
                            {chip.count} · {formatCurrency(chip.amount, historySummary.currency)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ── SAVINGS TAB (no-trip) ── */}
              {tab === 'savings' && (
                <View style={{ gap: 16 }}>
                  <SavingsGoalCard
                    goal={savingsGoal}
                    onSetup={() => setShowSavingsSetup(true)}
                    onLogSavings={() => setShowSavingsEntry(true)}
                    onEdit={() => setShowSavingsSetup(true)}
                    onPlanTrip={() => router.push('/onboarding' as never)}
                  />
                  <DailyTrackerCard
                    onAddExpense={() => setShowDailySheet(true)}
                    onScanReceipt={() => openTargetSheet('scan')}
                    onEditExpense={handleEditDailyExpense}
                  />
                </View>
              )}

          {/* ── SETTLE UP TAB (no-trip) ── */}
          {tab === 'settle' && (
            <View style={{ gap: 16 }}>
              {noTripSettleExpenses.length > 0 ? (
                <>
                  <Text style={styles.historyLabel}>WHO OWES WHO</Text>
                  {noTripSettleExpenses
                    .slice(0, 20)
                    .map((e) => {
                      const badge = e.sourceLabel ?? (e.source === 'quick-trip' ? 'Quick Trip' : e.source === 'standalone' ? 'Just Log It' : 'Trip');
                      return (
                        <TouchableOpacity
                          key={e.id}
                          style={styles.settleRow}
                          onPress={() => setDetailExpense({
                            id: e.id,
                            description: e.description,
                            amount: e.amount,
                            currency: e.currency,
                            category: e.category as Expense['category'],
                            date: e.date,
                            paidBy: e.paidBy,
                            splitType: e.splitType as Expense['splitType'],
                            notes: e.notes,
                            source: e.source,
                            sourceId: e.sourceId,
                          })}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.avatar, { backgroundColor: colors.chart2, width: 36, height: 36 }]}>
                            <Text style={[styles.avatarText, { fontSize: 14 }]}>
                              {(e.paidBy ?? '?').charAt(0)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.settleText}>
                              <Text style={{ fontWeight: '600' }}>{e.description}</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.text3, marginTop: 2 }}>
                              {e.paidBy ? `Paid by ${e.paidBy}` : ''} · {badge} · {formatDatePHT(e.date)}
                            </Text>
                          </View>
                          <Text style={styles.settleAmount}>{formatCurrency(e.amount, e.currency)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                </>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
                  <Users size={28} color={colors.text3} strokeWidth={1.5} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>No shared expenses</Text>
                  <Text style={{ fontSize: 13, color: colors.text3, textAlign: 'center' }}>
                    Add split trip, quick-trip, or Just Log It expenses to see who owes whom.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── EXPENSES TAB (no-trip) ── */}
          {tab === 'expenses' && (
            <CollapsibleBudgetSection
              title="Everyday spending"
              subtitle="For non-trip purchases"
              styles={styles}
              colors={colors}
            >
              <DailyTrackerCard
                onAddExpense={() => setShowDailySheet(true)}
                onScanReceipt={() => openTargetSheet('scan')}
                onEditExpense={handleEditDailyExpense}
                embedded
              />
            </CollapsibleBudgetSection>
          )}
          {tab === 'expenses' && hasFilteredExpenses && historyFilter !== 'normal' ? (
            <>

              {/* Category breakdown */}
              {(() => {
                const byCat: Record<string, number> = {};
                for (const e of filteredHistoryExpenses) {
                  byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
                }
                const sorted = Object.entries(byCat).sort(([, a], [, b]) => b - a);
                const maxVal = Math.max(1, ...sorted.map(([, v]) => v));
                const catColors: Record<string, string> = {
                  Food: '#d8ab7a', Transport: '#c49460', Activity: '#e38868',
                  Shopping: '#d9a441', Accommodation: '#8a5a2b', Other: '#857d70',
                };
                if (sorted.length > 0) return (
                  <CollapsibleBudgetSection
                    title="Where it went"
                    subtitle={`${sorted[0][0]} leads · ${formatCurrency(sorted[0][1], historySummary.currency)}`}
                    styles={styles}
                    colors={colors}
                  >
                    <View style={{ gap: 10 }}>
                      {sorted.map(([cat, amt]) => (
                        <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ width: 90, fontSize: 12, fontWeight: '600', color: colors.text2 }}>{cat}</Text>
                          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bg2, overflow: 'hidden' }}>
                            <View style={{ height: 8, borderRadius: 4, width: `${(amt / maxVal) * 100}%`, backgroundColor: catColors[cat] ?? colors.accent }} />
                          </View>
                          <Text style={{ width: 80, fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'right' }}>{formatCurrency(amt, historySummary.currency)}</Text>
                        </View>
                      ))}
                    </View>
                  </CollapsibleBudgetSection>
                );
                return null;
              })()}

              {/* Grouped purchases — per source with sub-groups by name/date */}
              <View style={styles.historyList}>
                {(() => {
                  // Group trip expenses by sourceLabel (trip name)
                  const tripGroups = new Map<string, typeof tripExpenses>();
                  for (const e of historyFilter === 'quick-trip' ? [] : tripExpenses) {
                    const key = e.sourceLabel ?? 'Trip';
                    const arr = tripGroups.get(key) ?? [];
                    arr.push(e);
                    tripGroups.set(key, arr);
                  }

                  // Group quick trip expenses by sourceLabel
                  const qtGroups = new Map<string, typeof quickTripExpenses>();
                  for (const e of historyFilter === 'trip' ? [] : quickTripExpenses) {
                    const key = e.sourceLabel ?? 'Quick Trip';
                    const arr = qtGroups.get(key) ?? [];
                    arr.push(e);
                    qtGroups.set(key, arr);
                  }

                  // Build all groups
                  const allGroups: { key: string; label: string; items: typeof historyExpenses; total: number }[] = [];
                  for (const [name, items] of tripGroups) {
                    allGroups.push({ key: `trip-${name}`, label: name, items, total: items.reduce((s, e) => s + e.amount, 0) });
                  }
                  for (const [name, items] of qtGroups) {
                    allGroups.push({ key: `qt-${name}`, label: name, items, total: items.reduce((s, e) => s + e.amount, 0) });
                  }

                  return allGroups.map((group) => {
                    const isOpen = expandedExpense === group.key;
                    // Sub-group by date when expanded
                    const byDate = new Map<string, typeof group.items>();
                    for (const e of group.items) {
                      const day = e.date;
                      const arr = byDate.get(day) ?? [];
                      arr.push(e);
                      byDate.set(day, arr);
                    }

                    return (
                      <View key={group.key} style={{ marginBottom: 12 }}>
                        <TouchableOpacity
                          style={styles.groupHeader}
                          activeOpacity={0.7}
                          onPress={() => setExpandedExpense(isOpen ? null : group.key)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.historyDesc, { fontSize: 14 }]}>{group.label}</Text>
                            {isOpen && group.items.length >= 2 && (
                              <TouchableOpacity
                                onPress={() => setPastBudgetGroup({ label: group.label, items: group.items })}
                                hitSlop={8}
                                style={{ marginTop: 4 }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent }}>View Budget Summary</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={[styles.historyAmount, { fontSize: 14 }]}>
                            {formatCurrency(group.total, group.items[0]?.currency ?? 'PHP')}
                          </Text>
                        </TouchableOpacity>
                        {isOpen && [...byDate.entries()].map(([date, items]) => (
                          <View key={date}>
                            <Text style={[styles.historyMeta, { paddingHorizontal: 4, paddingVertical: 6 }]}>
                              {formatDatePHT(date)}
                            </Text>
                            {items.map((e) => (
                              <SwipeableExpenseRow
                                key={e.id}
                                colors={colors}
                                onEdit={() => handleEditHistoryExpense(e)}
                                onDelete={() => handleDeleteHistoryExpense(e)}
                              >
                                <TouchableOpacity
                                  style={styles.historyRow}
                                  onPress={() => setDetailExpense({
                                    id: e.id,
                                    description: e.description,
                                    amount: e.amount,
                                    currency: e.currency,
                                    category: e.category as Expense['category'],
                                    date: e.date,
                                    paidBy: e.paidBy,
                                    placeName: e.placeName,
                                    splitType: e.splitType as Expense['splitType'],
                                    notes: e.notes,
                                    source: e.source,
                                    sourceId: e.sourceId,
                                  })}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.historyInfo}>
                                    <Text style={styles.historyDesc} numberOfLines={1}>{e.description || 'Expense'}</Text>
                                    <Text style={styles.historyMeta}>
                                      {e.paidBy ? `by ${e.paidBy}` : e.category}
                                    </Text>
                                  </View>
                                  <Text style={styles.historyAmount}>{formatCurrency(e.amount, e.currency)}</Text>
                                </TouchableOpacity>
                              </SwipeableExpenseRow>
                            ))}
                          </View>
                        ))}
                      </View>
                    );
                  });
                })()}
              </View>
            </>
          ) : tab === 'expenses' ? (
            <View style={styles.historyEmpty}>
              <Wallet size={32} color={colors.text3} strokeWidth={1.5} />
              <Text style={styles.historyEmptyTitle}>
                {historyFilter === 'normal' ? 'No normal expenses yet' : 'No travel expenses yet'}
              </Text>
              <Text style={styles.historyEmptySub}>
                {historyFilter === 'normal'
                  ? 'Use Just Log It when an expense is not part of a trip.'
                  : 'Your Trips and Quick Trips will appear here.\nNormal expenses stay in their own filter.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.historyCtaBtn}
                  onPress={() => {
                    if (historyFilter === 'normal') {
                      router.push('/add-expense?target=standalone' as never);
                    } else {
                      openTargetSheet('add');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.historyCtaText}>
                    {historyFilter === 'normal' ? 'Just Log It' : 'Add Travel Expense'}
                  </Text>
                </TouchableOpacity>
                {historyFilter !== 'normal' && (
                  <TouchableOpacity
                    style={[styles.historyCtaBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => router.push('/onboarding' as never)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.historyCtaText, { color: colors.text }]}>Plan a Trip</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}

          {tab === 'expenses' && historyFilter === 'normal' && hasNormalExpenses && (
            <View style={styles.section}>
              <View style={styles.normalExpenseHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Normal Expenses</Text>
                  <Text style={styles.historyMeta}>Separate from trips and quick trips</Text>
                </View>
                <Text style={styles.historyAmount}>{formatCurrency(standaloneTotal, standaloneExpenses[0]?.currency ?? 'PHP')}</Text>
              </View>
              <View style={{ gap: 6 }}>
                {standaloneExpenses.slice(0, 8).map((e) => (
                  <SwipeableExpenseRow
                    key={e.id}
                    colors={colors}
                    onEdit={() => handleEditHistoryExpense(e)}
                    onDelete={() => handleDeleteHistoryExpense(e)}
                  >
                    <TouchableOpacity
                      style={styles.historyRow}
                      onPress={() => setDetailExpense({
                        id: e.id,
                        description: e.description,
                        amount: e.amount,
                        currency: e.currency,
                        category: e.category as Expense['category'],
                        date: e.date,
                        paidBy: e.paidBy,
                        placeName: e.placeName,
                        splitType: e.splitType as Expense['splitType'],
                        notes: e.notes,
                        source: e.source,
                        sourceId: e.sourceId,
                      })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyDesc} numberOfLines={1}>{e.description || 'Expense'}</Text>
                        <Text style={styles.historyMeta}>{e.category} · {formatDatePHT(e.date)}</Text>
                      </View>
                      <Text style={styles.historyAmount}>{formatCurrency(e.amount, e.currency)}</Text>
                    </TouchableOpacity>
                  </SwipeableExpenseRow>
                ))}
              </View>
            </View>
          )}

          {/* User-scoped Payment QR codes (visible in all states) */}
          <CollapsibleBudgetSection
            title="Payment QR"
            subtitle={userQrs.length > 0 ? `${userQrs.length} saved code${userQrs.length !== 1 ? 's' : ''}` : 'Add GCash, Maya, bank QR'}
            styles={styles}
            colors={colors}
          >
            {userQrs.map((qr) => (
              <TouchableOpacity
                key={qr.id}
                style={styles.qrRow}
                onPress={() => setViewingUserQr(qr)}
                onLongPress={() => {
                  Alert.alert('Remove QR?', `Remove "${qr.label}"?`, [
                    { text: 'Keep', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        await removeUserPaymentQr(qr.id).catch(() => {});
                        setUserQrs((prev) => prev.filter((q) => q.id !== qr.id));
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      },
                    },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Image source={{ uri: qr.uri }} style={styles.qrThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrLabel}>{qr.label}</Text>
                  <Text style={styles.qrHint}>Tap to show · long press to remove</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.qrUploadBtn}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
                if (!result.canceled && result.assets[0]) {
                  setPendingUserQrUri(result.assets[0].uri);
                  setUserQrNameInput('');
                  setShowUserQrNameModal(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.qrUploadText}>
                {userQrs.length > 0 ? '+ Add another QR' : '+ Add payment QR'}
              </Text>
            </TouchableOpacity>
          </CollapsibleBudgetSection>

            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* User QR name modal */}
        <Modal visible={showUserQrNameModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowUserQrNameModal(false)}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Name this QR</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg3, borderColor: colors.border, color: colors.text }]}
                value={userQrNameInput}
                onChangeText={setUserQrNameInput}
                placeholder="e.g. GCash, Maya, BPI"
                placeholderTextColor={colors.text3}
                autoFocus
              />
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
                onPress={async () => {
                  if (!pendingUserQrUri || !user?.id || !userQrNameInput.trim()) return;
                  try {
                    const qr = await addUserPaymentQr(user.id, userQrNameInput.trim(), pendingUserQrUri);
                    setUserQrs((prev) => [...prev, qr]);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setShowUserQrNameModal(false);
                    setPendingUserQrUri(null);
                  } catch (err: any) {
                    Alert.alert('Upload failed', err?.message ?? 'Could not save QR code. Check your connection and try again.');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* User QR viewer modal */}
        <Modal visible={!!viewingUserQr} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setViewingUserQr(null)}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, alignItems: 'center', padding: 24 }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{viewingUserQr?.label}</Text>
              {viewingUserQr?.uri && (
                <Image source={{ uri: viewingUserQr.uri }} style={{ width: 240, height: 240, borderRadius: 12, marginTop: 12 }} />
              )}
              <Text style={{ color: colors.text3, fontSize: 12, marginTop: 12 }}>Scan to pay</Text>
            </View>
          </Pressable>
        </Modal>

        <ExpenseTargetSheet
          visible={targetSheetVisible}
          onClose={() => setTargetSheetVisible(false)}
          hasActiveTrip={false}
          quickTrips={quickTrips}
          onSelectTarget={handleSelectTarget}
        />
        <DailyTrackerSheet
          visible={showDailySheet}
          onClose={() => setShowDailySheet(false)}
          onSave={handleAddDailyExpense}
        />
        <SavingsGoalSetup
          visible={showSavingsSetup}
          onClose={() => setShowSavingsSetup(false)}
          onSave={savingsGoal ? handleUpdateGoal : handleCreateGoal}
          existing={savingsGoal}
        />
        <SavingsEntrySheet
          visible={showSavingsEntry}
          onClose={() => setShowSavingsEntry(false)}
          onSave={handleLogSavings}
          currency={savingsGoal?.targetCurrency ?? 'PHP'}
        />
        <SavingsMilestoneModal
          visible={milestoneToShow !== null}
          milestone={milestoneToShow}
          currentAmount={savingsGoal?.currentAmount ?? 0}
          currency={savingsGoal?.targetCurrency ?? 'PHP'}
          onClose={() => setMilestoneToShow(null)}
        />

        {/* Past trip budget summary modal */}
        <Modal visible={!!pastBudgetGroup} transparent animationType="fade" onRequestClose={() => setPastBudgetGroup(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setPastBudgetGroup(null)}>
            <View style={[styles.modalCard, { maxHeight: '75%' }]} onStartShouldSetResponder={() => true}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.modalTitle}>{pastBudgetGroup?.label ?? 'Budget'}</Text>
                <TouchableOpacity onPress={() => setPastBudgetGroup(null)} hitSlop={12}>
                  <X size={20} color={colors.text3} />
                </TouchableOpacity>
              </View>

              {pastBudgetGroup && (() => {
                const items = pastBudgetGroup.items;
                const total = items.reduce((s, e) => s + e.amount, 0);
                const byCat: Record<string, number> = {};
                for (const e of items) {
                  byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
                }
                const sorted = Object.entries(byCat).sort(([, a], [, b]) => b - a);
                const maxVal = sorted[0]?.[1] ?? 1;
                const topExpense = [...items].sort((a, b) => b.amount - a.amount)[0];
                const catColors: Record<string, string> = { Food: colors.chart1, Transport: colors.chart2, Activity: colors.chart3, Shopping: colors.chart4, Accommodation: colors.accent, Other: colors.text3 };
                const groupCurrency = items[0]?.currency ?? 'PHP';

                return (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Total */}
                    <View style={{ alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3 }}>TOTAL SPENT</Text>
                      <Text style={{ fontSize: 28, fontWeight: '500', letterSpacing: -0.5, color: colors.text, marginTop: 4 }}>{formatCurrency(total, groupCurrency)}</Text>
                      <Text style={{ fontSize: 12, color: colors.text3, marginTop: 2 }}>{items.length} expenses</Text>
                    </View>

                    {/* Category breakdown */}
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3, marginBottom: 10 }}>BY CATEGORY</Text>
                    <View style={{ gap: 10, marginBottom: 20 }}>
                      {sorted.map(([cat, amt]) => (
                        <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ width: 90, fontSize: 12, fontWeight: '600', color: colors.text2 }}>{cat}</Text>
                          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bg2, overflow: 'hidden' }}>
                            <View style={{ height: 8, borderRadius: 4, width: `${(amt / maxVal) * 100}%`, backgroundColor: catColors[cat] ?? colors.accent }} />
                          </View>
                          <Text style={{ width: 80, fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'right' }}>{formatCurrency(amt, groupCurrency)}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Top expense */}
                    {topExpense && (
                      <>
                        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3, marginBottom: 8 }}>BIGGEST EXPENSE</Text>
                        <View style={{ padding: 14, backgroundColor: colors.card2, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 }}>{topExpense.description}</Text>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatCurrency(topExpense.amount, topExpense.currency)}</Text>
                          </View>
                          <Text style={{ fontSize: 11, color: colors.text3, marginTop: 4 }}>{topExpense.category} · {formatDatePHT(topExpense.date)}{topExpense.paidBy ? ` · Paid by ${topExpense.paidBy}` : ''}</Text>
                        </View>
                      </>
                    )}

                    {/* Per-payer breakdown */}
                    {(() => {
                      const byPayer: Record<string, number> = {};
                      for (const e of items) {
                        const p = e.paidBy ?? 'Unknown';
                        byPayer[p] = (byPayer[p] ?? 0) + e.amount;
                      }
                      const payers = Object.entries(byPayer).sort(([, a], [, b]) => b - a);
                      if (payers.length < 2) return null;
                      return (
                        <>
                          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3, marginBottom: 8 }}>BY MEMBER</Text>
                          <View style={{ gap: 8, marginBottom: 16 }}>
                            {payers.map(([name, amt]) => (
                              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: colors.card2, borderRadius: 12 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fffaf0' }}>{name.charAt(0)}</Text>
                                </View>
                                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>{name.split(' ')[0]}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{formatCurrency(amt, groupCurrency)}</Text>
                              </View>
                            ))}
                          </View>
                        </>
                      );
                    })()}
                  </ScrollView>
                );
              })()}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.subtitle}>{trip?.destination ?? 'Trip'} · {formatDatePHT(trip?.startDate ?? '')} - {formatDatePHT(trip?.endDate ?? '')}</Text>
        </View>
      </View>

      {/* Mode pill — Budget / Group */}
      {members.length >= 2 && (
        <View style={styles.modePadding}>
          <View style={styles.segControl}>
            {(['budget', 'group'] as const).map(m => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.segBtn, active && styles.segBtnActive]}
                  onPress={() => handleModeChange(m)}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>
                    {m === 'budget' ? 'Budget' : 'Group'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Tab row */}
      <View style={styles.tabRow}>
        {([
          { id: 'expenses' as const, label: 'Expenses' },
          { id: 'savings' as const, label: 'Savings' },
          { id: 'settle' as const, label: 'Settle Up' },
          ...(members.length >= 2 ? [{ id: 'fate' as const, label: 'Who Pays?' }] : []),
        ]).map(t => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
              {t.label}
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
        {tab === 'expenses' && (
          <>
            <View style={styles.section}>
              <BudgetHero
                eyebrow="Travel Budget"
                amount={spent}
                currency={trip?.costCurrency ?? 'PHP'}
                subtitle={total > 0
                  ? `${remaining < 0 ? 'Over by' : 'Left'} ${formatCurrency(Math.abs(remaining), trip?.costCurrency ?? 'PHP')} · ${formatCurrency(dailyAllowance, trip?.costCurrency ?? 'PHP')}/day left`
                  : `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} · ${formatCurrency(actualPerDay, trip?.costCurrency ?? 'PHP')}/day average`}
                context={trip?.destination ?? trip?.name ?? 'Current trip'}
                note={budgetInsights[0] ?? (total > 0 ? `${days} days · ${formatCurrency(perDay, trip?.costCurrency ?? 'PHP')}/day target` : undefined)}
                progressPct={total > 0 ? (spent / total) * 100 : undefined}
                progressLeftLabel={total > 0 ? `Spent ${formatCurrency(spent, trip?.costCurrency ?? 'PHP')}` : undefined}
                progressRightLabel={total > 0 ? `${remaining < 0 ? 'Over' : 'Left'} ${formatCurrency(Math.abs(remaining), trip?.costCurrency ?? 'PHP')}` : undefined}
                onAdd={() => openTargetSheet('add')}
                onScan={() => openTargetSheet('scan')}
                onSetLimit={total > 0 ? undefined : () => { setBudgetInput(''); setShowBudgetModal(true); }}
                styles={styles}
              />
              <SummaryStrip summary={{ ...activeTripSummary, currency: trip?.costCurrency ?? activeTripSummary.currency }} styles={styles} />
            </View>

            {/* Payment QR shortcuts */}
            <CollapsibleBudgetSection
              title="Payment QR"
              subtitle={[paymentQrs.length, userQrs.length].reduce((sum, n) => sum + n, 0) > 0
                ? `${paymentQrs.length + userQrs.length} saved code${paymentQrs.length + userQrs.length !== 1 ? 's' : ''}`
                : 'Add GCash, Maya, bank QR'}
              styles={styles}
              colors={colors}
            >
              <View style={styles.qrHeader}>
                <Image source={require('@/assets/icon/afterstay-icon.png')} style={styles.qrBrandIcon} />
                <View>
                  <Text style={styles.sectionTitle}>AfterStay Pay</Text>
                  <Text style={styles.qrHeaderSub}>Your payment QR codes</Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {paymentQrs.map((qr, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.qrRow}
                    onPress={() => { setViewingQr(qr); setShowQrModal(true); }}
                    onLongPress={() => handleRemoveQr(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.qrThumb, { borderColor: colors.border }]}>
                      <Image source={{ uri: qr.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qrLabel}>{qr.label}</Text>
                      <Text style={styles.qrHint}>Tap to show · long press to remove</Text>
                    </View>
                    <QrCode size={20} color={colors.accent} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.qrUploadBtn} onPress={pickPaymentQr} activeOpacity={0.7}>
                  <QrCode size={18} color={colors.accent} />
                  <Text style={styles.qrUploadText}>{paymentQrs.length > 0 ? 'Add another QR' : 'Add payment QR'}</Text>
                </TouchableOpacity>
                {/* User-scoped QRs (portable across trips) */}
                {userQrs.filter(uq => !paymentQrs.some(pq => pq.uri === uq.uri)).map((qr) => (
                  <TouchableOpacity
                    key={qr.id}
                    style={styles.qrRow}
                    onPress={() => setViewingUserQr(qr)}
                    onLongPress={() => {
                      Alert.alert('Remove QR?', `Remove "${qr.label}"?`, [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: async () => {
                            await removeUserPaymentQr(qr.id).catch(() => {});
                            setUserQrs((prev) => prev.filter((q) => q.id !== qr.id));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          },
                        },
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.qrThumb, { borderColor: colors.border }]}>
                      <Image source={{ uri: qr.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qrLabel}>{qr.label}</Text>
                      <Text style={styles.qrHint}>Personal · Tap to show</Text>
                    </View>
                    <QrCode size={20} color={colors.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            </CollapsibleBudgetSection>

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
              <CollapsibleBudgetSection
                title="Where it went"
                subtitle={topCategory ? `${topCategory.name} · ${topCategory.pct}% of spend` : `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}`}
                styles={styles}
                colors={colors}
              >
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
                            <Text style={styles.catAmount}>{formatCurrency(amount, trip?.costCurrency ?? 'PHP')}</Text>
                          </View>
                          <View style={styles.catBarTrack}>
                            <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </CollapsibleBudgetSection>
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
            {expenses.length === 0 && (
              <View style={styles.section}>
                <View style={[styles.nudgeCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Wallet size={28} color={colors.text3} strokeWidth={1.5} />
                  <Text style={[styles.sectionTitle, { marginTop: 10 }]}>No expenses yet</Text>
                  <Text style={{ fontSize: 13, color: colors.text2, textAlign: 'center', marginTop: 4 }}>
                    Set a trip limit or scan your first receipt.
                  </Text>
                </View>
              </View>
            )}
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
                  const splitCount = members.length || 1;
                  const each = Math.round(e.amount / splitCount);
                  const catConfig = CATEGORIES.find(c => c.matchKey === e.category);
                  const CatIcon = catConfig?.icon ?? Package;
                  const catColor = catConfig ? colors[catConfig.colorKey] : colors.text3;

                  return (
                    <SwipeableExpenseRow
                      key={e.id}
                      colors={colors}
                      onEdit={() => handleEditExpense(e)}
                      onDelete={() => handleDeleteExpense(e.id, e.description)}
                    >
                      <TouchableOpacity
                        style={styles.expenseRow}
                        onPress={() => setDetailExpense(e)}
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
                      </TouchableOpacity>
                    </SwipeableExpenseRow>
                  );
                })}
              </View>
            )}

            <CollapsibleBudgetSection
              title="Everyday spending"
              subtitle="Separate from this trip"
              styles={styles}
              colors={colors}
            >
              <DailyTrackerCard
                onAddExpense={() => setShowDailySheet(true)}
                onScanReceipt={() => openTargetSheet('scan')}
                onEditExpense={handleEditDailyExpense}
                embedded
              />
            </CollapsibleBudgetSection>

          </>
        )}

        {/* ── SAVINGS TAB ── */}
        {tab === 'savings' && (
          <View style={{ gap: 16 }}>
            <SavingsGoalCard
              goal={savingsGoal}
              onSetup={() => setShowSavingsSetup(true)}
              onLogSavings={() => setShowSavingsEntry(true)}
              onEdit={() => setShowSavingsSetup(true)}
              onPlanTrip={() => router.push('/onboarding' as never)}
            />
            <DailyTrackerCard
              onAddExpense={() => setShowDailySheet(true)}
              onScanReceipt={() => openTargetSheet('scan')}
              onEditExpense={handleEditDailyExpense}
            />
          </View>
        )}

        {/* ── SETTLE UP TAB ── */}
        {tab === 'settle' && trip && members.length >= 2 && (
          <GroupBalanceCard
            trip={trip}
            expenses={expenses}
            members={members}
          />
        )}
        {tab === 'settle' && trip && members.length < 2 && (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
            <Users size={28} color={colors.text3} strokeWidth={1.5} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>No group yet</Text>
            <Text style={{ fontSize: 13, color: colors.text3, textAlign: 'center' }}>
              Invite trip members first. Shared expenses will appear here automatically once your group starts adding them.
            </Text>
          </View>
        )}
        {tab === 'settle' && !trip && (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
            <Users size={28} color={colors.text3} strokeWidth={1.5} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>No active trip</Text>
            <Text style={{ fontSize: 13, color: colors.text3, textAlign: 'center' }}>
              Start a trip to track group balances.
            </Text>
          </View>
        )}

        {/* ── FATE TAB ── */}
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

      {/* Daily + Savings modals */}
      <DailyTrackerSheet visible={showDailySheet} onClose={() => setShowDailySheet(false)} onSave={handleAddDailyExpense} />
      <SavingsGoalSetup visible={showSavingsSetup} onClose={() => setShowSavingsSetup(false)} onSave={savingsGoal ? handleUpdateGoal : handleCreateGoal} existing={savingsGoal} />
      <SavingsEntrySheet visible={showSavingsEntry} onClose={() => setShowSavingsEntry(false)} onSave={handleLogSavings} currency={savingsGoal?.targetCurrency ?? 'PHP'} />
      <SavingsMilestoneModal visible={milestoneToShow !== null} milestone={milestoneToShow} currentAmount={savingsGoal?.currentAmount ?? 0} currency={savingsGoal?.targetCurrency ?? 'PHP'} onClose={() => setMilestoneToShow(null)} />
      <ExpenseTargetSheet
        visible={targetSheetVisible}
        onClose={() => setTargetSheetVisible(false)}
        hasActiveTrip={!!trip}
        quickTrips={quickTrips}
        onSelectTarget={handleSelectTarget}
      />

      {/* Expense detail sheet */}
      <ExpenseDetailSheet
        visible={!!detailExpense}
        expense={detailExpense}
        currency={trip?.costCurrency ?? 'PHP'}
        onClose={() => setDetailExpense(null)}
        onEdit={(e) => {
          if (e.source) {
            handleEditHistoryExpense(e as UnifiedExpenseHistoryItem);
          } else {
            handleEditExpense(e);
          }
        }}
        onDelete={() => {
          if (!detailExpense) return;
          if (detailExpense.source) {
            handleDeleteHistoryExpense(detailExpense as UnifiedExpenseHistoryItem);
          } else {
            handleDeleteExpense(detailExpense.id, detailExpense.description);
          }
        }}
      />

      {/* QR view modal — branded card */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowQrModal(false)}>
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalBrand}>
              <Image source={require('@/assets/icon/afterstay-icon.png')} style={styles.qrModalLogo} />
              <Text style={styles.qrModalBrandName}>AfterStay</Text>
            </View>
            <Text style={styles.qrModalTitle}>{viewingQr?.label ?? 'Payment QR'}</Text>
            {viewingQr?.uri ? (
              <View style={styles.qrModalImageWrap}>
                <Image source={{ uri: viewingQr.uri }} style={styles.qrModalImage} resizeMode="contain" />
              </View>
            ) : null}
            <Text style={styles.qrModalScan}>Scan to pay</Text>
          </View>
        </Pressable>
      </Modal>


      {/* QR name input modal */}
      <Modal visible={showQrNameModal} transparent animationType="fade" onRequestClose={() => setShowQrNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name this QR</Text>
            <TextInput
              style={styles.modalInput}
              value={qrNameInput}
              onChangeText={setQrNameInput}
              placeholder="e.g. GCash, Maya, BPI"
              placeholderTextColor={colors.text3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setShowQrNameModal(false); setPendingQrUri(null); }}>
                <Text style={[styles.modalBtn, { color: colors.text3 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmAddQr}>
                <Text style={[styles.modalBtn, { color: colors.accent }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  scrollContent: { paddingBottom: 120 },
  section: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  nudgeCard: { alignItems: 'center', padding: 28, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  seeAllText: { fontSize: 12, fontWeight: '600', color: c.accent },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6, textTransform: 'uppercase', color: c.text3 },
  travelHero: { backgroundColor: c.card, borderWidth: 1, borderColor: c.accentBorder, borderRadius: 18, padding: 16, gap: 12 },
  travelHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  travelHeroAmount: { fontSize: 32, fontWeight: '700', color: c.text, letterSpacing: -0.7, marginTop: 4 },
  travelHeroSub: { fontSize: 12.5, color: c.text2, lineHeight: 18, marginTop: 3 },
  travelHeroPill: { maxWidth: 132, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder },
  travelHeroPillText: { fontSize: 10.5, fontWeight: '800', color: c.accent },
  travelHeroProgressBlock: { gap: 6 },
  travelHeroProgressTrack: { height: 6, borderRadius: 99, backgroundColor: c.card2, overflow: 'hidden' },
  travelHeroProgressFill: { height: '100%', borderRadius: 99, backgroundColor: c.accent },
  travelHeroProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  travelHeroProgressText: { fontSize: 11, color: c.text3, fontWeight: '600' },
  travelHeroNote: { fontSize: 12, color: c.text3, lineHeight: 17 },
  travelHeroActions: { flexDirection: 'row', gap: 8 },
  travelHeroPrimaryAction: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  travelHeroPrimaryText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  travelHeroSecondaryAction: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  travelHeroSecondaryText: { fontSize: 13, fontWeight: '800', color: c.text },
  travelHeroLimitAction: { minWidth: 82, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  travelHeroLimitText: { fontSize: 12, fontWeight: '800', color: c.accent },
  summaryStrip: { flexDirection: 'row', gap: 6 },
  summaryTile: { flex: 1, minHeight: 46, backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 9, justifyContent: 'center' },
  summaryLabel: { fontSize: 9.5, fontWeight: '700', color: c.text3, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryAmount: { fontSize: 12.5, fontWeight: '800', color: c.text, marginTop: 2, letterSpacing: -0.2 },
  compactSectionHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 15 },
  compactSectionSub: { fontSize: 11, color: c.text3, marginTop: 2 },
  compactSectionBody: { paddingTop: 8, gap: 8 },
  expenseFilterRow: { gap: 8, paddingRight: 16 },
  expenseFilterChip: { minWidth: 116, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  expenseFilterChipActive: { borderColor: c.accentBorder, backgroundColor: c.accentBg },
  expenseFilterLabel: { fontSize: 12, fontWeight: '700', color: c.text2 },
  expenseFilterLabelActive: { color: c.accent },
  expenseFilterMeta: { fontSize: 10, fontWeight: '600', color: c.text3, marginTop: 3 },
  expenseFilterMetaActive: { color: c.text2 },

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
  budgetStatsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  budgetStat: { flex: 1, backgroundColor: c.card2, borderRadius: 12, padding: 10 },
  budgetStatLabel: { fontSize: 9.5, fontWeight: '700', color: c.text3, textTransform: 'uppercase', letterSpacing: 0.7 },
  budgetStatValue: { fontSize: 13, fontWeight: '700', color: c.text, marginTop: 3 },
  insightCard: { backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder, borderRadius: 16, padding: 14, gap: 8 },
  insightText: { fontSize: 12.5, color: c.text2, lineHeight: 18 },
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
  categoryNudge: { fontSize: 12, color: c.text3, marginTop: -2, marginBottom: 2 },
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
  expenseRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.card },
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

  // Payment QR
  qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  qrBrandIcon: { width: 28, height: 28, borderRadius: 8 },
  qrHeaderSub: { fontSize: 10, color: c.text3, marginTop: 1 },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16 },
  qrThumb: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  qrLabel: { fontSize: 13, fontWeight: '600', color: c.text },
  qrHint: { fontSize: 10, color: c.text3, marginTop: 2 },
  qrUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.accentBorder, borderRadius: 16, borderStyle: 'dashed' as const },
  qrUploadText: { fontSize: 13, fontWeight: '600', color: c.accent },
  qrModalCard: { width: '85%', backgroundColor: c.bg2, borderRadius: radius.xl, padding: 28, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  qrModalBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  qrModalLogo: { width: 24, height: 24, borderRadius: 6 },
  qrModalBrandName: { fontSize: 13, fontWeight: '700', color: c.accent, letterSpacing: 0.5 },
  qrModalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 },
  qrModalImageWrap: { backgroundColor: '#fff', borderRadius: 16, padding: 12 },
  qrModalImage: { width: 240, height: 240, borderRadius: 8 },
  qrModalScan: { fontSize: 11, color: c.text3, marginTop: 12, letterSpacing: 1, textTransform: 'uppercase' as const, fontWeight: '600' },
  qrModalClose: { marginTop: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '85%', backgroundColor: c.bg2, borderRadius: radius.lg, padding: 24, borderWidth: 1, borderColor: c.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 },
  modalInput: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 18, letterSpacing: -0.3, paddingHorizontal: 14, paddingVertical: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 16 },
  modalBtn: { fontSize: 14, fontWeight: '600' },

  // History (no active trip)
  addExpBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.accent, borderRadius: 12 },
  addExpBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  historyTotal: { alignItems: 'center', paddingVertical: 24, marginHorizontal: 16, marginBottom: 8 },
  historyTotalAmount: { fontSize: 32, fontWeight: '700', color: c.text, letterSpacing: -0.8 },
  historyTotalLabel: { fontSize: 12, color: c.text3, marginTop: 4 },
  historyList: { paddingHorizontal: 16 },
  historyLabel: { fontSize: 10, fontWeight: '700', color: c.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 8 },
  normalExpenseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, backgroundColor: c.card2, borderWidth: 1, borderColor: c.border, borderRadius: 14 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border,
    marginBottom: 6,
  },
  historyInfo: { flex: 1, marginRight: 12 },
  historyDesc: { fontSize: 14, fontWeight: '600', color: c.text },
  historyMeta: { fontSize: 11, color: c.text3, marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: '700', color: c.text },
  historyEmpty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  historyEmptyTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  historyEmptySub: { fontSize: 13, color: c.text3, textAlign: 'center' },
  historyCtaBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: c.accent, marginTop: 12 },
  historyCtaText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  trueEmptyWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 86 },
  trueEmptyCard: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 34,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  trueEmptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  trueEmptyTitle: { fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center' },
  trueEmptySub: {
    fontSize: 13,
    color: c.text3,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },
  trueEmptyActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  trueEmptyPrimary: {
    minWidth: 132,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  trueEmptyPrimaryText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  trueEmptySecondary: {
    minWidth: 118,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  trueEmptySecondaryText: { fontSize: 13, fontWeight: '800', color: c.text },
});
