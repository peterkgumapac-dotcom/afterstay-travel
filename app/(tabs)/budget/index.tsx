import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  InteractionManager,
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
import {
  Briefcase,
  Camera,
  Car,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Coffee,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  Settings,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react-native';

import { DailyTrackerSheet } from '@/components/budget/DailyTrackerSheet';
import { ExpenseDetailSheet } from '@/components/budget/ExpenseDetailSheet';
import ExpenseTargetSheet from '@/components/budget/ExpenseTargetSheet';
import { SavingsEntrySheet } from '@/components/budget/SavingsEntrySheet';
import { SavingsGoalCard } from '@/components/budget/SavingsGoalCard';
import { SavingsGoalSetup } from '@/components/budget/SavingsGoalSetup';
import { SavingsMilestoneModal } from '@/components/budget/SavingsMilestoneModal';
import SwipeableExpenseRow from '@/components/budget/SwipeableExpenseRow';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
import { useTheme, type ThemeColors } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useAuth } from '@/lib/auth';
import {
  computeUnsettledDebtEdges,
  summarizeDebtEdges,
} from '@/lib/budgetBalances';
import { getUnifiedExpenseHistory } from '@/lib/expenseHistory';
import { deleteQuickTripExpense, getQuickTrips } from '@/lib/quickTrips';
import type { QuickTrip } from '@/lib/quickTripTypes';
import {
  addDailyExpense,
  addPaymentQr,
  addSavingsEntry,
  addUserPaymentQr,
  createSavingsGoal,
  deleteExpense,
  getActiveSavingsGoal,
  getActiveTrip,
  getExpenses,
  getGroupMembers,
  getPaymentQrs,
  getTripSplits,
  getUserPaymentQrs,
  removePaymentQr as removePaymentQrSupabase,
  removeUserPaymentQr,
  updateSavingsGoal,
  updateTripBudgetLimit,
} from '@/lib/supabase';
import type { ExpenseSplit, PaymentQr, UserPaymentQr } from '@/lib/supabase';
import type {
  DailyExpense,
  DailyExpenseCategory,
  Expense,
  ExpenseTarget,
  GroupMember,
  SavingsGoal,
  SavingsMilestone,
  Trip,
  UnifiedExpenseHistoryItem,
} from '@/lib/types';
import { formatCurrency, formatDatePHT, safeParse } from '@/lib/utils';

type BudgetMode = 'trips' | 'personal';
type ExpenseTargetAction = 'add' | 'scan';
type DetailExpense = Expense & { source?: UnifiedExpenseHistoryItem['source']; sourceId?: string };
type MoneySummary = { today: number; week: number; month: number; currency: string; count: number };
type TravelSummary = { total: number; tripTotal: number; quickTripTotal: number; count: number; tripCount: number; quickTripCount: number; currency: string };

const CATEGORY_CONFIG = [
  { key: 'Food', label: 'Food', icon: UtensilsCrossed, color: '#d65a1f' },
  { key: 'Transport', label: 'Transport', icon: Car, color: '#c7aa8c' },
  { key: 'Activity', label: 'Activity', icon: Camera, color: '#3b8b50' },
  { key: 'Shopping', label: 'Shopping', icon: ShoppingBag, color: '#2678a8' },
  { key: 'Accommodation', label: 'Stay', icon: Briefcase, color: '#9b6a3d' },
  { key: 'Other', label: 'Other', icon: Wallet, color: '#8d806d' },
] as const;

function normalizeTitle(text?: string): string {
  const title = (text ?? 'Expense')
    .trim()
    .replace(/^payment transaction at /i, '')
    .replace(/^purchase at /i, '')
    .replace(/^dinner for multiple people with /i, '')
    .replace(/^ride booking service with /i, '');
  if (!title) return 'Expense';
  return title.length > 42 ? `${title.slice(0, 39)}...` : title;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function summarizeMoney(items: { amount: number; currency?: string; date: string }[]): MoneySummary {
  const now = new Date();
  const today = dateKey(now);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const summary: MoneySummary = {
    today: 0,
    week: 0,
    month: 0,
    currency: items[0]?.currency ?? 'PHP',
    count: items.length,
  };

  for (const item of items) {
    const parsed = safeParse(item.date);
    if (Number.isNaN(parsed.getTime())) continue;
    if (dateKey(parsed) === today) summary.today += item.amount;
    if (parsed >= weekStart) summary.week += item.amount;
    if (parsed >= monthStart) summary.month += item.amount;
  }

  return summary;
}

function summarizeExpenses(items: Pick<Expense, 'amount' | 'category'>[]) {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const item of items) {
    total += item.amount;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + item.amount;
  }
  return { total, byCategory, count: items.length };
}

function topCategoryLabel(byCategory: Record<string, number>, total: number, currency = 'PHP') {
  const top = Object.entries(byCategory).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])[0];
  if (!top || total <= 0) return 'No categories yet';
  return `${top[0]} leads · ${formatCurrency(top[1], currency)}`;
}

function tripDates(trip: Trip | null) {
  if (!trip) return '';
  return `${formatDatePHT(trip.startDate)} - ${formatDatePHT(trip.endDate)}`;
}

function historyToExpense(item: UnifiedExpenseHistoryItem): DetailExpense {
  return {
    id: item.id,
    description: item.description,
    amount: item.amount,
    currency: item.currency,
    category: (CATEGORY_CONFIG.find((cat) => cat.key === item.category)?.key ?? 'Other') as Expense['category'],
    date: item.date,
    paidBy: item.paidBy,
    placeName: item.placeName,
    splitType: item.splitType as Expense['splitType'],
    notes: item.notes,
    source: item.source,
    sourceId: item.sourceId,
  };
}

function compactTripName(trip: Trip | null) {
  const label = trip?.destination || trip?.name || 'Active trip';
  return label.length > 24 ? `${label.slice(0, 23)}...` : label;
}

function BudgetTab() {
  return (
    <TabErrorBoundary name="Budget">
      <BudgetScreen />
    </TabErrorBoundary>
  );
}

export default BudgetTab;

function BudgetScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { isTestMode, mockData } = useUserSegment();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;
  const modeInitialized = useRef(false);
  const didInitialLoad = useRef(false);
  const lastFocusLoadAt = useRef(0);

  const [mode, setMode] = useState<BudgetMode>('personal');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tripSplits, setTripSplits] = useState<ExpenseSplit[]>([]);
  const [historyExpenses, setHistoryExpenses] = useState<UnifiedExpenseHistoryItem[]>([]);
  const [quickTrips, setQuickTrips] = useState<QuickTrip[]>([]);
  const [paymentQrs, setPaymentQrs] = useState<PaymentQr[]>([]);
  const [userQrs, setUserQrs] = useState<UserPaymentQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailExpense, setDetailExpense] = useState<DetailExpense | null>(null);
  const [targetSheetVisible, setTargetSheetVisible] = useState(false);
  const [targetAction, setTargetAction] = useState<ExpenseTargetAction>('add');
  const [showAllTripExpenses, setShowAllTripExpenses] = useState(false);
  const [showAllPersonalExpenses, setShowAllPersonalExpenses] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [showDailySheet, setShowDailySheet] = useState(false);
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal | null>(null);
  const [showSavingsSetup, setShowSavingsSetup] = useState(false);
  const [showSavingsEntry, setShowSavingsEntry] = useState(false);
  const [milestoneToShow, setMilestoneToShow] = useState<SavingsMilestone | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [viewingQr, setViewingQr] = useState<PaymentQr | null>(null);
  const [showQrNameModal, setShowQrNameModal] = useState(false);
  const [pendingQrUri, setPendingQrUri] = useState<string | null>(null);
  const [qrNameInput, setQrNameInput] = useState('');
  const [viewingUserQr, setViewingUserQr] = useState<UserPaymentQr | null>(null);
  const [showUserQrNameModal, setShowUserQrNameModal] = useState(false);
  const [pendingUserQrUri, setPendingUserQrUri] = useState<string | null>(null);
  const [userQrNameInput, setUserQrNameInput] = useState('');

  const [boundUserId, setBoundUserId] = useState(user?.id);
  useEffect(() => {
    if (boundUserId === user?.id) return;
    setBoundUserId(user?.id);
    modeInitialized.current = false;
    setMode('personal');
    setTrip(null);
    setExpenses([]);
    setMembers([]);
    setTripSplits([]);
    setHistoryExpenses([]);
    setQuickTrips([]);
    setPaymentQrs([]);
    setUserQrs([]);
    setSavingsGoal(null);
    setDetailExpense(null);
  }, [boundUserId, user?.id]);

  const applyMockData = useCallback(() => {
    if (!mockData) return;
    setTrip(mockData.trip);
    setExpenses(mockData.expenses as Expense[]);
    setMembers(mockData.members as GroupMember[]);
    setTripSplits([]);
    setHistoryExpenses([]);
    setQuickTrips([]);
    setPaymentQrs([]);
    setLoading(false);
    setRefreshing(false);
    if (!modeInitialized.current) {
      modeInitialized.current = true;
      setMode(mockData.trip ? 'trips' : 'personal');
    }
  }, [mockData]);

  const load = useCallback(async (force = false) => {
    if (testModeRef.current) {
      applyMockData();
      return;
    }
    try {
      const activeTrip = await getActiveTrip(force).catch(() => null);
      const [history, qts, tripExpenses, tripMembers, splits, qrs] = await Promise.all([
        getUnifiedExpenseHistory(60).catch(() => [] as UnifiedExpenseHistoryItem[]),
        getQuickTrips().catch(() => [] as QuickTrip[]),
        activeTrip ? getExpenses(activeTrip.id).catch(() => [] as Expense[]) : Promise.resolve([] as Expense[]),
        activeTrip ? getGroupMembers(activeTrip.id).catch(() => [] as GroupMember[]) : Promise.resolve([] as GroupMember[]),
        activeTrip ? getTripSplits(activeTrip.id).catch(() => [] as ExpenseSplit[]) : Promise.resolve([] as ExpenseSplit[]),
        activeTrip ? getPaymentQrs(activeTrip.id).catch(() => [] as PaymentQr[]) : Promise.resolve([] as PaymentQr[]),
      ]);

      setTrip(activeTrip);
      setHistoryExpenses(history);
      setQuickTrips(qts);
      setExpenses(tripExpenses);
      setMembers(tripMembers);
      setTripSplits(splits);
      setPaymentQrs(qrs);

      if (!modeInitialized.current) {
        modeInitialized.current = true;
        setMode(activeTrip ? 'trips' : 'personal');
      }
    } catch (error) {
      if (__DEV__) console.warn('[Budget] load failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyMockData]);

  useEffect(() => {
    didInitialLoad.current = true;
    lastFocusLoadAt.current = Date.now();
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoad.current) return undefined;
      const now = Date.now();
      if (now - lastFocusLoadAt.current < 45_000) return undefined;
      lastFocusLoadAt.current = now;
      const task = InteractionManager.runAfterInteractions(() => load(false));
      return () => task.cancel();
    }, [load]),
  );

  useEffect(() => {
    if (!user?.id) return;
    const task = InteractionManager.runAfterInteractions(() => {
      getUserPaymentQrs(user.id).then(setUserQrs).catch(() => {});
      getActiveSavingsGoal().then(setSavingsGoal).catch(() => {});
    });
    return () => task.cancel();
  }, [user?.id]);

  const tripSummary = useMemo(() => summarizeExpenses(expenses), [expenses]);
  const tripPulse = useMemo(() => summarizeMoney(expenses), [expenses]);
  const personalHistory = useMemo(
    () => historyExpenses.filter((item) => item.source === 'standalone' || item.source === 'quick-trip' || item.source === 'daily'),
    [historyExpenses],
  );
  const travelHistorySummary = useMemo<TravelSummary>(() => {
    const travelItems = historyExpenses.filter((item) => item.source === 'trip' || item.source === 'quick-trip');
    return travelItems.reduce<TravelSummary>((summary, item) => {
      const isQuickTrip = item.source === 'quick-trip';
      summary.total += item.amount;
      summary.count += 1;
      summary.currency = item.currency || summary.currency;
      if (isQuickTrip) {
        summary.quickTripTotal += item.amount;
        summary.quickTripCount += 1;
      } else {
        summary.tripTotal += item.amount;
        summary.tripCount += 1;
      }
      return summary;
    }, { total: 0, tripTotal: 0, quickTripTotal: 0, count: 0, tripCount: 0, quickTripCount: 0, currency: 'PHP' });
  }, [historyExpenses]);
  const personalSummary = useMemo(() => {
    const amountItems = personalHistory.map((item) => ({
      amount: item.amount,
      currency: item.currency,
      date: item.date,
    }));
    const pulse = summarizeMoney(amountItems);
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const item of personalHistory) {
      total += item.amount;
      byCategory[item.category] = (byCategory[item.category] ?? 0) + item.amount;
    }
    return { ...pulse, total, byCategory };
  }, [personalHistory]);

  const currency = trip?.costCurrency ?? expenses[0]?.currency ?? personalSummary.currency ?? 'PHP';
  const budgetLimit = trip?.budgetLimit ?? 0;
  const budgetPct = budgetLimit > 0 ? Math.min(100, Math.round((tripSummary.total / budgetLimit) * 100)) : 0;
  const remaining = budgetLimit > 0 ? Math.max(0, budgetLimit - tripSummary.total) : 0;
  const tripExpenseRows = showAllTripExpenses ? expenses : expenses.slice(0, 4);
  const personalRows = showAllPersonalExpenses ? personalHistory : personalHistory.slice(0, 5);
  const currentMember = useMemo(
    () => members.find((member) => member.userId && member.userId === user?.id),
    [members, user?.id],
  );
  const debtEdges = useMemo(
    () => computeUnsettledDebtEdges(expenses, members, tripSplits),
    [expenses, members, tripSplits],
  );
  const debtSummary = useMemo(() => summarizeDebtEdges(debtEdges, currentMember?.id), [currentMember?.id, debtEdges]);
  const pendingPersonalSplits = useMemo(
    () => personalHistory.filter((item) => item.splitType || item.notes?.toLowerCase().includes('split:')),
    [personalHistory],
  );
  const tripTopCategory = useMemo(
    () => topCategoryLabel(tripSummary.byCategory, tripSummary.total, currency),
    [currency, tripSummary.byCategory, tripSummary.total],
  );
  const personalTopCategory = useMemo(
    () => topCategoryLabel(personalSummary.byCategory, personalSummary.total, personalSummary.currency),
    [personalSummary.byCategory, personalSummary.currency, personalSummary.total],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const openTargetSheet = useCallback((action: ExpenseTargetAction) => {
    setTargetAction(action);
    setTargetSheetVisible(true);
  }, []);

  const handleSelectTarget = useCallback((target: ExpenseTarget) => {
    setTargetSheetVisible(false);
    const action = targetAction;
    switch (target.type) {
      case 'trip':
        if (action === 'scan') {
          router.push({ pathname: '/scan-receipt', params: { expenseType: 'trip', ...(trip?.id ? { tripId: trip.id } : {}) } } as never);
        } else {
          router.push(trip?.id ? (`/add-expense?tripId=${trip.id}` as never) : ('/add-expense' as never));
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
  }, [router, targetAction, trip?.id]);

  const handleEditExpense = useCallback((expense: DetailExpense) => {
    if (expense.source === 'daily') return;
    const target = expense.source === 'quick-trip'
      ? 'quick-trip'
      : expense.source === 'standalone'
        ? 'standalone'
        : 'trip';
    const editTripId = expense.source === 'trip' ? expense.sourceId : expense.source ? undefined : trip?.id;
    router.push({
      pathname: '/add-expense',
      params: {
        editId: expense.id,
        target,
        ...(expense.source === 'quick-trip' && expense.sourceId ? { quickTripId: expense.sourceId } : {}),
        ...(editTripId ? { tripId: editTripId } : {}),
        description: expense.description,
        amount: String(expense.amount),
        currency: expense.currency,
        category: expense.category,
        date: expense.date,
        paidBy: expense.paidBy ?? '',
        placeName: expense.placeName ?? '',
        notes: expense.notes ?? '',
      },
    } as never);
  }, [router, trip?.id]);

  const handleEditDailyExpense = useCallback((expense: DailyExpense) => {
    router.push({
      pathname: '/add-expense',
      params: {
        editId: expense.id,
        target: 'daily-tracker',
        description: expense.description,
        amount: String(expense.amount),
        currency: expense.currency,
        category: expense.category,
        date: expense.date,
        placeName: expense.placeName ?? '',
        notes: expense.notes ?? '',
        photoUri: expense.photo ?? '',
      },
    } as never);
  }, [router]);

  const handleDeleteTripExpense = useCallback((expense: Expense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete expense?', expense.description, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(expense.id).catch(() => {});
          load(true);
        },
      },
    ]);
  }, [load]);

  const handleDeleteHistoryExpense = useCallback((item: UnifiedExpenseHistoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete expense?', item.description, [
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

  const handleCreateGoal = useCallback(async (input: { title: string; targetAmount: number; targetCurrency: string; targetDate?: string; destination?: string }) => {
    const goal = await createSavingsGoal(input).catch((error) => {
      if (__DEV__) console.warn('[Budget] create savings failed:', error);
      return null;
    });
    if (goal) setSavingsGoal(goal);
  }, []);

  const handleUpdateGoal = useCallback(async (input: { title: string; targetAmount: number; targetCurrency: string; targetDate?: string; destination?: string }) => {
    if (!savingsGoal) return;
    await updateSavingsGoal(savingsGoal.id, input).catch((error) => {
      if (__DEV__) console.warn('[Budget] update savings failed:', error);
    });
    setSavingsGoal((prev) => prev ? { ...prev, ...input, updatedAt: new Date().toISOString() } : prev);
  }, [savingsGoal]);

  const handleLogSavings = useCallback(async (amount: number, note?: string) => {
    if (!savingsGoal) return;
    const result = await addSavingsEntry(savingsGoal.id, amount, note).catch((error) => {
      if (__DEV__) console.warn('[Budget] log savings failed:', error);
      return null;
    });
    if (!result) return;
    setSavingsGoal((prev) => prev ? {
      ...prev,
      currentAmount: prev.currentAmount + amount,
      celebratedMilestones: [...prev.celebratedMilestones, ...result.newMilestones],
    } : prev);
    if (result.newMilestones.length > 0) {
      setMilestoneToShow(result.newMilestones[result.newMilestones.length - 1]);
    }
  }, [savingsGoal]);

  const handleAddDailyExpense = useCallback(async (input: { description: string; amount: number; dailyCategory: DailyExpenseCategory; notes?: string }) => {
    await addDailyExpense(input).catch((error) => {
      if (__DEV__) console.warn('[Budget] add daily expense failed:', error);
    });
  }, []);

  const handleSaveBudget = useCallback(async () => {
    const nextBudget = Number(budgetInput.replace(/[^0-9.]/g, ''));
    if (!trip || !nextBudget || nextBudget <= 0) return;
    await updateTripBudgetLimit(trip.id, nextBudget).catch(() => {});
    setTrip((prev) => prev ? { ...prev, budgetLimit: nextBudget } : prev);
    setShowBudgetModal(false);
    setBudgetInput('');
  }, [budgetInput, trip]);

  const pickPaymentQr = useCallback(async (scope: 'trip' | 'user') => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    if (scope === 'trip') {
      setPendingQrUri(result.assets[0].uri);
      setQrNameInput('');
      setShowQrNameModal(true);
    } else {
      setPendingUserQrUri(result.assets[0].uri);
      setUserQrNameInput('');
      setShowUserQrNameModal(true);
    }
  }, []);

  const confirmAddTripQr = useCallback(async () => {
    if (!pendingQrUri || !trip?.id) return;
    const label = qrNameInput.trim() || 'Payment QR';
    try {
      const next = await addPaymentQr(trip.id, label, pendingQrUri);
      setPaymentQrs(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not add QR', 'Please try again.');
    } finally {
      setPendingQrUri(null);
      setShowQrNameModal(false);
    }
  }, [pendingQrUri, qrNameInput, trip?.id]);

  const confirmAddUserQr = useCallback(async () => {
    if (!pendingUserQrUri || !user?.id) return;
    const label = userQrNameInput.trim() || 'Payment QR';
    try {
      const next = await addUserPaymentQr(user.id, label, pendingUserQrUri);
      setUserQrs((prev) => [...prev, next]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not add QR', 'Please try again.');
    } finally {
      setPendingUserQrUri(null);
      setShowUserQrNameModal(false);
    }
  }, [pendingUserQrUri, user?.id, userQrNameInput]);

  const removeTripQr = useCallback((index: number) => {
    Alert.alert('Remove QR?', paymentQrs[index]?.label ?? 'Payment QR', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!trip?.id) return;
          const next = await removePaymentQrSupabase(trip.id, index).catch(() => null);
          if (next) setPaymentQrs(next);
        },
      },
    ]);
  }, [paymentQrs, trip?.id]);

  const removeUserQr = useCallback((qr: UserPaymentQr) => {
    Alert.alert('Remove QR?', qr.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeUserPaymentQr(qr.id).catch(() => {});
          setUserQrs((prev) => prev.filter((item) => item.id !== qr.id));
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.subtitle}>{mode === 'trips' ? 'On trip spending' : 'Personal spending'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/add-member' as never)} activeOpacity={0.75}>
            <Users size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/settings' as never)}
            activeOpacity={0.75}
          >
            <Settings size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modeWrap}>
        <ModeButton
          colors={colors}
          active={mode === 'trips'}
          label="Trips"
          icon={<Briefcase size={16} color={mode === 'trips' ? '#fffaf0' : colors.text2} />}
          onPress={() => setMode('trips')}
        />
        <ModeButton
          colors={colors}
          active={mode === 'personal'}
          label="Personal"
          icon={<Users size={16} color={mode === 'personal' ? '#fffaf0' : colors.text2} />}
          onPress={() => setMode('personal')}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <BudgetLoading styles={styles} />
        ) : mode === 'trips' ? (
          <TripsMode
            colors={colors}
            styles={styles}
            trip={trip}
            expenses={tripExpenseRows}
            allExpenseCount={expenses.length}
            showAll={showAllTripExpenses}
            setShowAll={setShowAllTripExpenses}
            members={members}
            tripSummary={tripSummary}
            tripPulse={tripPulse}
            travelHistorySummary={travelHistorySummary}
            budgetPct={budgetPct}
            budgetLimit={budgetLimit}
            remaining={remaining}
            topCategory={tripTopCategory}
            debtSummary={debtSummary}
            currentMemberName={currentMember?.name}
            expandedInsight={expandedInsight}
            onToggleInsight={() => setExpandedInsight((prev) => !prev)}
            onAdd={() => openTargetSheet('add')}
            onScan={() => openTargetSheet('scan')}
            onPlanTrip={() => router.push('/create-trip' as never)}
            onSetBudget={() => {
              setBudgetInput(trip?.budgetLimit ? String(trip.budgetLimit) : '');
              setShowBudgetModal(true);
            }}
            onOpenSettle={() => router.push({ pathname: '/budget/settle-balances', params: { scope: 'trip' } } as never)}
            onExpensePress={(expense) => setDetailExpense(expense)}
            onEditExpense={(expense) => handleEditExpense(expense)}
            onDeleteExpense={handleDeleteTripExpense}
            onAddQr={() => pickPaymentQr('trip')}
            onOpenQr={(qr) => { setViewingQr(qr); setShowQrModal(true); }}
            onRemoveQr={removeTripQr}
            paymentQrs={paymentQrs}
          />
        ) : (
          <PersonalMode
            colors={colors}
            styles={styles}
            personalSummary={personalSummary}
            expenses={personalRows}
            allExpenseCount={personalHistory.length}
            showAll={showAllPersonalExpenses}
            setShowAll={setShowAllPersonalExpenses}
            pendingPersonalSplits={pendingPersonalSplits.length}
            topCategory={personalTopCategory}
            savingsGoal={savingsGoal}
            expandedInsight={expandedInsight}
            onToggleInsight={() => setExpandedInsight((prev) => !prev)}
            onAdd={() => openTargetSheet('add')}
            onScan={() => openTargetSheet('scan')}
            onOpenSettle={() => router.push({ pathname: '/budget/settle-balances', params: { scope: 'personal' } } as never)}
            onExpensePress={(item) => setDetailExpense(historyToExpense(item))}
            onEditExpense={(item) => handleEditExpense(historyToExpense(item))}
            onDeleteExpense={handleDeleteHistoryExpense}
            onSetupSavings={() => setShowSavingsSetup(true)}
            onLogSavings={() => setShowSavingsEntry(true)}
            onEditSavings={() => setShowSavingsSetup(true)}
            onPlanTrip={() => router.push('/create-trip' as never)}
            onAddQr={() => pickPaymentQr('user')}
            onOpenQr={(qr) => setViewingUserQr(qr)}
            onRemoveQr={removeUserQr}
            userQrs={userQrs}
            onAddDaily={() => setShowDailySheet(true)}
            onScanDaily={() => openTargetSheet('scan')}
            onEditDaily={handleEditDailyExpense}
          />
        )}
      </ScrollView>

      <ExpenseTargetSheet
        visible={targetSheetVisible}
        onClose={() => setTargetSheetVisible(false)}
        hasActiveTrip={!!trip}
        quickTrips={quickTrips}
        onSelectTarget={handleSelectTarget}
      />

      <ExpenseDetailSheet
        visible={!!detailExpense}
        expense={detailExpense}
        currency={detailExpense?.currency ?? currency}
        onClose={() => setDetailExpense(null)}
        onEdit={handleEditExpense}
        onDelete={() => {
          if (!detailExpense) return;
          if (detailExpense.source) {
            const sourceItem = historyExpenses.find((item) => item.id === detailExpense.id);
            if (sourceItem) handleDeleteHistoryExpense(sourceItem);
          } else {
            handleDeleteTripExpense(detailExpense);
          }
        }}
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

      <QrViewModal
        colors={colors}
        styles={styles}
        visible={showQrModal}
        qr={viewingQr}
        onClose={() => setShowQrModal(false)}
      />
      <QrViewModal
        colors={colors}
        styles={styles}
        visible={!!viewingUserQr}
        qr={viewingUserQr}
        onClose={() => setViewingUserQr(null)}
      />
      <QrNameModal
        colors={colors}
        styles={styles}
        visible={showQrNameModal}
        title="Name this trip QR"
        value={qrNameInput}
        onChange={setQrNameInput}
        onClose={() => { setPendingQrUri(null); setShowQrNameModal(false); }}
        onSave={confirmAddTripQr}
      />
      <QrNameModal
        colors={colors}
        styles={styles}
        visible={showUserQrNameModal}
        title="Name this payment QR"
        value={userQrNameInput}
        onChange={setUserQrNameInput}
        onClose={() => { setPendingUserQrUri(null); setShowUserQrNameModal(false); }}
        onSave={confirmAddUserQr}
      />

      <Modal visible={showBudgetModal} transparent animationType="fade" onRequestClose={() => setShowBudgetModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set trip budget</Text>
            <TextInput
              style={styles.modalInput}
              value={budgetInput}
              onChangeText={setBudgetInput}
              placeholder="60000"
              placeholderTextColor={colors.text3}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowBudgetModal(false)}>
                <Text style={[styles.modalBtn, { color: colors.text3 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveBudget}>
                <Text style={[styles.modalBtn, { color: colors.accent }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ModeButton({
  active,
  colors,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  colors: ThemeColors;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[modeStyles.button, { borderColor: colors.border }, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon}
      <Text style={[modeStyles.text, { color: colors.text }, active && { color: '#fffaf0' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BudgetLoading({ styles }: { styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Loading your budget...</Text>
      <Text style={styles.emptyText}>Pulling your trip and personal spending.</Text>
    </View>
  );
}

function TripsMode(props: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  trip: Trip | null;
  expenses: Expense[];
  allExpenseCount: number;
  showAll: boolean;
  setShowAll: (value: boolean) => void;
  members: GroupMember[];
  tripSummary: { total: number; byCategory: Record<string, number>; count: number };
  tripPulse: MoneySummary;
  travelHistorySummary: TravelSummary;
  budgetPct: number;
  budgetLimit: number;
  remaining: number;
  topCategory: string;
  debtSummary: ReturnType<typeof summarizeDebtEdges>;
  currentMemberName?: string;
  expandedInsight: boolean;
  onToggleInsight: () => void;
  onAdd: () => void;
  onScan: () => void;
  onPlanTrip: () => void;
  onSetBudget: () => void;
  onOpenSettle: () => void;
  onExpensePress: (expense: Expense) => void;
  onEditExpense: (expense: DetailExpense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onAddQr: () => void;
  onOpenQr: (qr: PaymentQr) => void;
  onRemoveQr: (index: number) => void;
  paymentQrs: PaymentQr[];
}) {
  const {
    colors,
    styles,
    trip,
    expenses,
    allExpenseCount,
    showAll,
    setShowAll,
    members,
    tripSummary,
    tripPulse,
    travelHistorySummary,
    budgetPct,
    budgetLimit,
    remaining,
    topCategory,
    debtSummary,
    expandedInsight,
    onToggleInsight,
    onAdd,
    onScan,
    onPlanTrip,
    onSetBudget,
    onOpenSettle,
    onExpensePress,
    onEditExpense,
    onDeleteExpense,
  } = props;

  if (!trip) {
    return (
      <>
        <View style={styles.travelBudgetCard}>
          <View style={styles.travelCardHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardEyebrow}>Travel budget</Text>
              <View style={styles.amountRow}>
                <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {formatCurrency(travelHistorySummary.total, travelHistorySummary.currency)}
                </Text>
                <Text style={styles.amountSuffix}>tracked</Text>
              </View>
            </View>
            <View style={styles.quickTripPill}>
              <Text style={styles.quickTripPillText}>Quick Trips</Text>
            </View>
          </View>
          <Text style={styles.cardCopy}>
            Plan a trip or create a quick trip to keep travel spending separate from everyday purchases.
          </Text>
          <ActionButtons styles={styles} colors={colors} onAdd={onAdd} onScan={onScan} />
        </View>

        <View style={styles.quietLine}>
          <ReceiptText size={17} color={colors.text3} />
          <View style={{ flex: 1 }}>
            <Text style={styles.quietLineTitle}>No spending logged today</Text>
            <Text style={styles.quietLineText}>Today, week, and month are clear.</Text>
          </View>
        </View>

        <View style={styles.travelFilterRow}>
          <TravelFilterCard styles={styles} label="All" count={travelHistorySummary.count} amount={travelHistorySummary.total} currency={travelHistorySummary.currency} active={false} />
          <TravelFilterCard styles={styles} label="Trips" count={travelHistorySummary.tripCount} amount={travelHistorySummary.tripTotal} currency={travelHistorySummary.currency} active={false} />
          <TravelFilterCard styles={styles} label="Quick Trips" count={travelHistorySummary.quickTripCount} amount={travelHistorySummary.quickTripTotal} currency={travelHistorySummary.currency} active />
        </View>

        <View style={styles.collapsibleCard}>
          <View style={styles.collapsibleHead}>
            <View>
              <Text style={styles.collapsibleTitle}>Everyday spending</Text>
              <Text style={styles.collapsibleSub}>For non-trip purchases</Text>
            </View>
            <ChevronDown size={18} color={colors.text3} />
          </View>
        </View>

        <View style={styles.travelEmptyState}>
          <Wallet size={34} color={colors.text3} />
          <Text style={styles.emptyTitle}>No travel expenses yet</Text>
          <Text style={styles.emptyText}>Trips and Quick Trips will appear here. Normal expenses stay in their own filter.</Text>
          <View style={styles.bottomCtaRow}>
            <TouchableOpacity style={styles.primaryAction} onPress={onAdd} activeOpacity={0.78}>
              <Text style={styles.primaryActionText}>Add Travel Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={onPlanTrip} activeOpacity={0.78}>
              <Text style={styles.secondaryActionText}>Plan a Trip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  const settleCopy = debtSummary.owedToUserTotal > 0
    ? `You are owed ${formatCurrency(debtSummary.owedToUserTotal, trip.costCurrency ?? 'PHP')}`
    : debtSummary.userOwesTotal > 0
      ? `You owe ${formatCurrency(debtSummary.userOwesTotal, trip.costCurrency ?? 'PHP')}`
      : members.length > 1
        ? 'Everyone looks settled'
        : 'Invite people to split this trip';

  return (
    <>
      <View style={styles.tripCard}>
        <View style={styles.tripCardTop}>
          {trip.heroImageUrl ? (
            <Image source={{ uri: trip.heroImageUrl }} style={styles.tripThumb} />
          ) : (
            <View style={styles.tripThumbFallback}><Briefcase size={22} color={colors.accent} /></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.tripTitleRow}>
              <Text style={styles.tripTitle} numberOfLines={1}>{compactTripName(trip)}</Text>
              <ChevronDown size={16} color={colors.text3} />
            </View>
            <Text style={styles.tripMeta} numberOfLines={1}>
              {tripDates(trip)} · {members.length || 1} people
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.compactAmount}>{formatCurrency(tripSummary.total, trip.costCurrency ?? 'PHP')}</Text>
              <Text style={styles.amountSuffix}>spent</Text>
            </View>
            <Text style={styles.miniMeta}>{tripSummary.count} expense{tripSummary.count === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressPct}>{budgetLimit > 0 ? `${budgetPct}%` : '--'}</Text>
            <Text style={styles.progressLabel}>budget</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${budgetLimit > 0 ? budgetPct : 0}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.smallMuted}>{formatCurrency(tripSummary.total, trip.costCurrency ?? 'PHP')} spent</Text>
          <TouchableOpacity onPress={onSetBudget} activeOpacity={0.75}>
            <Text style={styles.linkText}>
              {budgetLimit > 0
                ? `${formatCurrency(remaining, trip.costCurrency ?? 'PHP')} left`
                : 'Set budget'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ActionButtons styles={styles} colors={colors} onAdd={onAdd} onScan={onScan} />

      {members.length > 1 && (
        <SettlementNudge
          colors={colors}
          styles={styles}
          title={settleCopy}
          subtitle={currentSettlementSubtitle(debtSummary)}
          rightLabel={debtSummary.owedToUserTotal > 0 ? 'View all' : 'Review'}
          onPress={onOpenSettle}
        />
      )}

      <RecentExpenses
        colors={colors}
        styles={styles}
        title="Recent expenses"
        expenses={expenses}
        allCount={allExpenseCount}
        showAll={showAll}
        setShowAll={setShowAll}
        members={members}
        onPress={(expense) => onExpensePress(expense)}
        onEdit={(expense) => onEditExpense(expense)}
        onDelete={onDeleteExpense}
      />

      <InsightSection
        styles={styles}
        colors={colors}
        label="Where it went"
        value={topCategory}
        byCategory={tripSummary.byCategory}
        total={tripSummary.total}
        currency={trip.costCurrency ?? 'PHP'}
        expanded={expandedInsight}
        onToggle={onToggleInsight}
      />

      <View style={styles.monthSummaryRow}>
        <View style={styles.monthSummaryIcon}><ReceiptText size={17} color={colors.text2} /></View>
        <Text style={styles.monthSummaryTitle}>Trip pulse</Text>
        <Text style={styles.monthSummaryMeta}>{formatCurrency(tripPulse.week, trip.costCurrency ?? 'PHP')} this week</Text>
        <ChevronRight size={15} color={colors.text3} />
      </View>
    </>
  );
}

function TravelFilterCard({
  active,
  amount,
  count,
  currency,
  label,
  styles,
}: {
  active: boolean;
  amount: number;
  count: number;
  currency: string;
  label: string;
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={[styles.travelFilterCard, active && styles.travelFilterCardActive]}>
      <Text style={[styles.travelFilterLabel, active && styles.travelFilterLabelActive]}>{label}</Text>
      <Text style={styles.travelFilterValue}>{count} · {formatCurrency(amount, currency)}</Text>
    </View>
  );
}

function PersonalMode(props: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  personalSummary: MoneySummary & { total: number; byCategory: Record<string, number> };
  expenses: UnifiedExpenseHistoryItem[];
  allExpenseCount: number;
  showAll: boolean;
  setShowAll: (value: boolean) => void;
  pendingPersonalSplits: number;
  topCategory: string;
  savingsGoal: SavingsGoal | null;
  expandedInsight: boolean;
  onToggleInsight: () => void;
  onAdd: () => void;
  onScan: () => void;
  onOpenSettle: () => void;
  onExpensePress: (item: UnifiedExpenseHistoryItem) => void;
  onEditExpense: (item: UnifiedExpenseHistoryItem) => void;
  onDeleteExpense: (item: UnifiedExpenseHistoryItem) => void;
  onSetupSavings: () => void;
  onLogSavings: () => void;
  onEditSavings: () => void;
  onPlanTrip: () => void;
  onAddQr: () => void;
  onOpenQr: (qr: UserPaymentQr) => void;
  onRemoveQr: (qr: UserPaymentQr) => void;
  userQrs: UserPaymentQr[];
  onAddDaily: () => void;
  onScanDaily: () => void;
  onEditDaily: (expense: DailyExpense) => void;
}) {
  const {
    colors,
    styles,
    personalSummary,
    expenses,
    allExpenseCount,
    showAll,
    setShowAll,
    pendingPersonalSplits,
    topCategory,
    savingsGoal,
    expandedInsight,
    onToggleInsight,
    onAdd,
    onScan,
    onOpenSettle,
    onExpensePress,
    onEditExpense,
    onDeleteExpense,
    onSetupSavings,
    onLogSavings,
    onEditSavings,
    onPlanTrip,
  } = props;

  return (
    <>
      <View style={styles.personalCard}>
        <View style={styles.personalTop}>
          <View>
            <View style={styles.periodRow}>
              <Text style={styles.personalPeriod}>This week</Text>
              <ChevronDown size={15} color={colors.text3} />
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.compactAmount}>{formatCurrency(personalSummary.week, personalSummary.currency)}</Text>
              <Text style={styles.amountSuffix}>spent</Text>
            </View>
            <Text style={styles.miniMeta}>{personalSummary.count} recent expense{personalSummary.count === 1 ? '' : 's'}</Text>
          </View>
          <MiniBars colors={colors} />
        </View>
        <TouchableOpacity style={styles.insightBanner} onPress={onToggleInsight} activeOpacity={0.75}>
          <View style={styles.insightIcon}><Coffee size={17} color={colors.accent} /></View>
          <Text style={styles.insightText}>{personalSummary.week > 0 ? `Nice! ${topCategory}` : 'No spending logged today'}</Text>
          <ChevronRight size={16} color={colors.text3} />
        </TouchableOpacity>
      </View>

      <ActionButtons styles={styles} colors={colors} onAdd={onAdd} onScan={onScan} />

      {pendingPersonalSplits > 0 && (
        <SettlementNudge
          colors={colors}
          styles={styles}
          title={`You have ${pendingPersonalSplits} split note${pendingPersonalSplits === 1 ? '' : 's'}`}
          subtitle="Review quick-trip and personal balances"
          rightLabel="View all"
          onPress={onOpenSettle}
        />
      )}

      <RecentHistoryExpenses
        colors={colors}
        styles={styles}
        expenses={expenses}
        allCount={allExpenseCount}
        showAll={showAll}
        setShowAll={setShowAll}
        onPress={onExpensePress}
        onEdit={onEditExpense}
        onDelete={onDeleteExpense}
      />

      <InsightSection
        styles={styles}
        colors={colors}
        label="Where it went"
        value={topCategory}
        byCategory={personalSummary.byCategory}
        total={personalSummary.total}
        currency={personalSummary.currency}
        expanded={expandedInsight}
        onToggle={onToggleInsight}
      />

      <SavingsGoalCard
        goal={savingsGoal}
        onSetup={onSetupSavings}
        onLogSavings={onLogSavings}
        onEdit={onEditSavings}
        onPlanTrip={onPlanTrip}
      />

      <View style={styles.monthSummaryRow}>
        <View style={styles.monthSummaryIcon}><CircleDollarSign size={17} color={colors.text2} /></View>
        <Text style={styles.monthSummaryTitle}>Monthly summary</Text>
        <Text style={styles.monthSummaryMeta}>{formatCurrency(personalSummary.month, personalSummary.currency)}</Text>
        <ChevronRight size={15} color={colors.text3} />
      </View>
    </>
  );
}

function currentSettlementSubtitle(summary: ReturnType<typeof summarizeDebtEdges>) {
  if (summary.owedToUserTotal > 0 && summary.userOwesTotal > 0) return 'You have money moving both ways';
  if (summary.owedToUserTotal > 0) return `${summary.owedToUser.length} person${summary.owedToUser.length === 1 ? '' : 's'} to request`;
  if (summary.userOwesTotal > 0) return `${summary.userOwes.length} payment${summary.userOwes.length === 1 ? '' : 's'} to settle`;
  return 'Tap to review trip balances';
}

function ActionButtons({
  colors,
  onAdd,
  onScan,
  styles,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  onAdd: () => void;
  onScan: () => void;
}) {
  return (
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.primaryAction} onPress={onAdd} activeOpacity={0.78}>
        <CircleDollarSign size={18} color="#fffaf0" />
        <Text style={styles.primaryActionText}>Add expense</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryAction} onPress={onScan} activeOpacity={0.78}>
        <ScanLine size={18} color={colors.text} />
        <Text style={styles.secondaryActionText}>Scan receipt</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettlementNudge({
  colors,
  onPress,
  rightLabel,
  styles,
  subtitle,
  title,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  title: string;
  subtitle: string;
  rightLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.nudge} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.nudgeIcon}><Users size={18} color={colors.text2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nudgeTitle}>{title}</Text>
        <Text style={styles.nudgeSub}>{subtitle}</Text>
      </View>
      <Text style={styles.nudgeLink}>{rightLabel}</Text>
      <ChevronRight size={16} color={colors.text3} />
    </TouchableOpacity>
  );
}

function RecentExpenses({
  allCount,
  colors,
  expenses,
  members,
  onDelete,
  onEdit,
  onPress,
  setShowAll,
  showAll,
  styles,
  title,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  title: string;
  expenses: Expense[];
  allCount: number;
  showAll: boolean;
  setShowAll: (value: boolean) => void;
  members: GroupMember[];
  onPress: (expense: Expense) => void;
  onEdit: (expense: DetailExpense) => void;
  onDelete: (expense: Expense) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        styles={styles}
        title={title}
        action={allCount > expenses.length ? 'See all' : showAll ? 'Show less' : undefined}
        onPress={allCount > expenses.length ? () => setShowAll(true) : showAll ? () => setShowAll(false) : undefined}
      />
      {expenses.length === 0 ? (
        <View style={styles.emptyInline}>
          <Text style={styles.emptyInlineTitle}>No expenses yet</Text>
          <Text style={styles.emptyInlineText}>Add or scan the first receipt for this trip.</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {expenses.map((expense) => {
            const config = categoryConfig(expense.category);
            const Icon = config.icon;
            const splitCount = members.length > 1 ? ` · Split with ${members.length}` : '';
            return (
              <SwipeableExpenseRow
                key={expense.id}
                colors={colors}
                onEdit={() => onEdit(expense)}
                onDelete={() => onDelete(expense)}
              >
                <TouchableOpacity style={styles.expenseRow} onPress={() => onPress(expense)} activeOpacity={0.75}>
                  <View style={[styles.expenseIcon, { backgroundColor: config.color + '1a' }]}>
                    <Icon size={17} color={config.color} strokeWidth={2} />
                  </View>
                  <View style={styles.expenseMiddle}>
                    <Text style={styles.expenseTitle} numberOfLines={1}>{normalizeTitle(expense.description)}</Text>
                    <Text style={styles.expenseMeta} numberOfLines={1}>
                      {expense.paidBy ? `Paid by ${expense.paidBy}` : expense.category}{splitCount}
                    </Text>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>{formatCurrency(expense.amount, expense.currency)}</Text>
                    <Text style={styles.expenseDate}>{formatDatePHT(expense.date)}</Text>
                  </View>
                  <ChevronRight size={14} color={colors.text3} />
                </TouchableOpacity>
              </SwipeableExpenseRow>
            );
          })}
        </View>
      )}
    </View>
  );
}

function RecentHistoryExpenses({
  allCount,
  colors,
  expenses,
  onDelete,
  onEdit,
  onPress,
  setShowAll,
  showAll,
  styles,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  expenses: UnifiedExpenseHistoryItem[];
  allCount: number;
  showAll: boolean;
  setShowAll: (value: boolean) => void;
  onPress: (item: UnifiedExpenseHistoryItem) => void;
  onEdit: (item: UnifiedExpenseHistoryItem) => void;
  onDelete: (item: UnifiedExpenseHistoryItem) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        styles={styles}
        title="Recent expenses"
        action={allCount > expenses.length ? 'See all' : showAll ? 'Show less' : undefined}
        onPress={allCount > expenses.length ? () => setShowAll(true) : showAll ? () => setShowAll(false) : undefined}
      />
      {expenses.length === 0 ? (
        <View style={styles.emptyInline}>
          <Text style={styles.emptyInlineTitle}>No personal expenses yet</Text>
          <Text style={styles.emptyInlineText}>Everyday and quick-trip expenses appear here.</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {expenses.map((item) => {
            const config = categoryConfig(item.category);
            const Icon = config.icon;
            return (
              <SwipeableExpenseRow
                key={`${item.source}-${item.id}`}
                colors={colors}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              >
                <TouchableOpacity style={styles.expenseRow} onPress={() => onPress(item)} activeOpacity={0.75}>
                  <View style={[styles.expenseIcon, { backgroundColor: config.color + '1a' }]}>
                    <Icon size={17} color={config.color} strokeWidth={2} />
                  </View>
                  <View style={styles.expenseMiddle}>
                    <Text style={styles.expenseTitle} numberOfLines={1}>{normalizeTitle(item.description)}</Text>
                    <Text style={styles.expenseMeta} numberOfLines={1}>
                      {item.sourceLabel ? `${item.sourceLabel} · ` : ''}{item.category}
                    </Text>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>{formatCurrency(item.amount, item.currency)}</Text>
                    <Text style={styles.expenseDate}>{formatDatePHT(item.date)}</Text>
                  </View>
                  <ChevronRight size={14} color={colors.text3} />
                </TouchableOpacity>
              </SwipeableExpenseRow>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SectionHeader({
  action,
  onPress,
  styles,
  title,
}: {
  styles: ReturnType<typeof getStyles>;
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function InsightSection({
  byCategory,
  colors,
  currency,
  expanded,
  label,
  onToggle,
  styles,
  total,
  value,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  label: string;
  value: string;
  byCategory: Record<string, number>;
  total: number;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const entries = Object.entries(byCategory).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, entries[0]?.[1] ?? 1);
  return (
    <View style={styles.collapsibleCard}>
      <TouchableOpacity style={styles.collapsibleHead} onPress={onToggle} activeOpacity={0.75}>
        <View>
          <Text style={styles.collapsibleTitle}>{label}</Text>
          <Text style={styles.collapsibleSub}>{value}</Text>
        </View>
        <ChevronDown size={18} color={colors.text3} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.categoryBars}>
          {entries.length === 0 ? (
            <Text style={styles.emptyInlineText}>Categories will appear once spending is logged.</Text>
          ) : entries.slice(0, 5).map(([name, amount]) => {
            const config = categoryConfig(name);
            return (
              <View key={name} style={styles.categoryRow}>
                <Text style={styles.categoryName}>{name}</Text>
                <View style={styles.categoryTrack}>
                  <View style={[styles.categoryFill, { width: `${(amount / max) * 100}%`, backgroundColor: config.color }]} />
                </View>
                <Text style={styles.categoryAmount}>{formatCurrency(amount, currency)}</Text>
              </View>
            );
          })}
          {total > 0 && <Text style={styles.categoryFoot}>Total tracked: {formatCurrency(total, currency)}</Text>}
        </View>
      )}
    </View>
  );
}

function MiniBars({ colors }: { colors: ThemeColors }) {
  const heights = [18, 26, 38, 22, 30, 34, 24];
  return (
    <View style={miniStyles.wrap}>
      {heights.map((height, index) => (
        <View key={index} style={miniStyles.barCol}>
          <View style={[miniStyles.bar, { height, backgroundColor: index === 2 ? colors.accent : colors.border2 }]} />
          <Text style={[miniStyles.day, { color: index === 2 ? colors.accent : colors.text3 }]}>
            {'MTWTFSS'[index]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function QrViewModal({
  onClose,
  qr,
  styles,
  visible,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  visible: boolean;
  qr: PaymentQr | UserPaymentQr | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.qrModalCard}>
          <View style={styles.qrModalBrand}>
            <Image source={require('@/assets/icon/afterstay-icon.png')} style={styles.qrModalLogo} />
            <Text style={styles.qrModalBrandName}>AfterStay</Text>
          </View>
          <Text style={styles.qrModalTitle}>{qr?.label ?? 'Payment QR'}</Text>
          {qr?.uri ? (
            <View style={styles.qrModalImageWrap}>
              <Image source={{ uri: qr.uri }} style={styles.qrModalImage} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.qrModalScan}>Scan to pay</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

function QrNameModal({
  colors,
  onChange,
  onClose,
  onSave,
  styles,
  title,
  value,
  visible,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  visible: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChange}
            placeholder="GCash, Maya, BPI"
            placeholderTextColor={colors.text3}
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalBtn, { color: colors.text3 }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave}>
              <Text style={[styles.modalBtn, { color: colors.accent }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function categoryConfig(category: string) {
  return CATEGORY_CONFIG.find((item) => item.key === category) ?? CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];
}

const modeStyles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  text: { fontSize: 14, fontWeight: '900' },
});

const miniStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  barCol: { alignItems: 'center', gap: 4 },
  bar: { width: 6, borderRadius: 4 },
  day: { fontSize: 10, fontWeight: '800' },
});

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '900', color: c.text, letterSpacing: 0 },
  subtitle: { marginTop: 4, fontSize: 12, fontWeight: '900', color: c.text3, letterSpacing: 3, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modeWrap: { marginHorizontal: 24, padding: 4, borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.card, flexDirection: 'row', gap: 4 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 130, gap: 14 },

  travelBudgetCard: { borderRadius: 22, borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.card, padding: 18, gap: 16 },
  travelCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardEyebrow: { fontSize: 12, fontWeight: '900', color: c.text3, letterSpacing: 4, textTransform: 'uppercase' },
  heroAmount: { flexShrink: 1, fontSize: 38, fontWeight: '900', color: c.text, letterSpacing: 0 },
  quickTripPill: { borderRadius: 17, borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentDim, paddingHorizontal: 16, paddingVertical: 9 },
  quickTripPillText: { fontSize: 13, fontWeight: '900', color: c.accent },
  cardCopy: { fontSize: 15, fontWeight: '600', lineHeight: 22, color: c.text2, maxWidth: 290 },
  travelFilterRow: { flexDirection: 'row', gap: 10 },
  travelFilterCard: { flex: 1, minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, justifyContent: 'center' },
  travelFilterCardActive: { backgroundColor: c.accentDim, borderColor: c.accentBorder },
  travelFilterLabel: { fontSize: 13, fontWeight: '900', color: c.text2 },
  travelFilterLabelActive: { color: c.accent },
  travelFilterValue: { marginTop: 5, fontSize: 11, fontWeight: '800', color: c.text3 },
  travelEmptyState: { alignItems: 'center', gap: 10, paddingTop: 42, paddingHorizontal: 10 },
  bottomCtaRow: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 22 },

  tripCard: { borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  tripCardTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  tripThumb: { width: 82, height: 82, borderRadius: 16, backgroundColor: c.card2 },
  tripThumbFallback: { width: 82, height: 82, borderRadius: 16, backgroundColor: c.accentDim, alignItems: 'center', justifyContent: 'center' },
  tripTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tripTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: c.text },
  tripMeta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: c.text2 },
  amountRow: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  compactAmount: { fontSize: 29, fontWeight: '900', color: c.text, letterSpacing: 0 },
  amountSuffix: { fontSize: 13, fontWeight: '700', color: c.text2 },
  miniMeta: { marginTop: 3, fontSize: 12, fontWeight: '800', color: c.text2 },
  progressCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg2, borderWidth: 5, borderColor: c.accent },
  progressPct: { fontSize: 15, fontWeight: '900', color: c.text },
  progressLabel: { fontSize: 9, fontWeight: '800', color: c.text3 },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: c.bg2, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: 8, borderRadius: 8, backgroundColor: c.accent },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  smallMuted: { fontSize: 11, fontWeight: '700', color: c.text3 },
  linkText: { fontSize: 11, fontWeight: '900', color: c.accent },

  personalCard: { borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, overflow: 'hidden' },
  personalTop: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  personalPeriod: { fontSize: 13, fontWeight: '900', color: c.text, marginBottom: 2 },
  insightBanner: { borderTopWidth: 1, borderTopColor: c.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accentDim, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, fontSize: 13, fontWeight: '800', color: c.text2 },

  actionRow: { flexDirection: 'row', gap: 12 },
  primaryAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { fontSize: 14, fontWeight: '900', color: '#fffaf0' },
  secondaryAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { fontSize: 14, fontWeight: '900', color: c.text },

  nudge: { minHeight: 68, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nudgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentDim, alignItems: 'center', justifyContent: 'center' },
  nudgeTitle: { fontSize: 14, fontWeight: '900', color: c.text },
  nudgeSub: { marginTop: 2, fontSize: 12, fontWeight: '600', color: c.text2 },
  nudgeLink: { fontSize: 12, fontWeight: '900', color: c.success },

  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: c.text },
  sectionAction: { fontSize: 13, fontWeight: '900', color: c.accent },
  listCard: { borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  expenseRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  expenseIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  expenseMiddle: { flex: 1, minWidth: 0 },
  expenseTitle: { fontSize: 14, fontWeight: '900', color: c.text },
  expenseMeta: { marginTop: 3, fontSize: 11, fontWeight: '600', color: c.text2 },
  expenseRight: { alignItems: 'flex-end', maxWidth: 104 },
  expenseAmount: { fontSize: 14, fontWeight: '900', color: c.text },
  expenseDate: { marginTop: 3, fontSize: 10, fontWeight: '700', color: c.text3 },
  emptyInline: { borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 18 },
  emptyInlineTitle: { fontSize: 15, fontWeight: '900', color: c.text },
  emptyInlineText: { marginTop: 4, fontSize: 12, fontWeight: '600', color: c.text3, lineHeight: 18 },

  collapsibleCard: { borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  collapsibleHead: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collapsibleTitle: { fontSize: 15, fontWeight: '900', color: c.text },
  collapsibleSub: { marginTop: 3, fontSize: 12, fontWeight: '700', color: c.text2 },
  categoryBars: { borderTopWidth: 1, borderTopColor: c.border, padding: 16, gap: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryName: { width: 82, fontSize: 12, fontWeight: '800', color: c.text2 },
  categoryTrack: { flex: 1, height: 8, borderRadius: 8, backgroundColor: c.bg2, overflow: 'hidden' },
  categoryFill: { height: 8, borderRadius: 8 },
  categoryAmount: { width: 92, textAlign: 'right', fontSize: 12, fontWeight: '900', color: c.text },
  categoryFoot: { fontSize: 11, fontWeight: '700', color: c.text3 },

  quietLine: { minHeight: 62, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  quietLineTitle: { fontSize: 15, fontWeight: '900', color: c.text },
  quietLineText: { marginTop: 2, fontSize: 12, fontWeight: '800', color: c.text2 },
  pulseGrid: { flexDirection: 'row', gap: 10 },
  smallMetric: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  smallMetricLabel: { fontSize: 10, fontWeight: '900', color: c.text3, textTransform: 'uppercase', letterSpacing: 1.2 },
  smallMetricValue: { marginTop: 6, fontSize: 15, fontWeight: '900', color: c.text },

  qrHeader: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  qrAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: c.accentDim },
  qrAddText: { fontSize: 12, fontWeight: '900', color: c.accent },
  qrList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: c.border },
  qrChip: { maxWidth: '48%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: c.bg2 },
  qrChipText: { flex: 1, fontSize: 12, fontWeight: '800', color: c.text2 },

  monthSummaryRow: { minHeight: 54, borderRadius: 15, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  monthSummaryIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.bg2, alignItems: 'center', justifyContent: 'center' },
  monthSummaryTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: c.text },
  monthSummaryMeta: { fontSize: 12, fontWeight: '700', color: c.text2 },

  emptyCard: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: c.text, textAlign: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600', color: c.text3, lineHeight: 19, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg2, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: c.text, marginBottom: 14 },
  modalInput: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 18 },
  modalBtn: { fontSize: 14, fontWeight: '900' },
  qrModalCard: { width: '100%', borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg2, padding: 20, alignItems: 'center' },
  qrModalBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  qrModalLogo: { width: 24, height: 24, borderRadius: 6 },
  qrModalBrandName: { fontSize: 13, fontWeight: '900', color: c.text },
  qrModalTitle: { fontSize: 18, fontWeight: '900', color: c.text, marginBottom: 14 },
  qrModalImageWrap: { width: 240, height: 240, borderRadius: 16, backgroundColor: '#fff', padding: 12 },
  qrModalImage: { width: '100%', height: '100%' },
  qrModalScan: { marginTop: 12, fontSize: 12, fontWeight: '700', color: c.text3 },
});
