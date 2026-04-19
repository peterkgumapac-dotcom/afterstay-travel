import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Path,
  Polyline,
  Rect,
} from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import BudgetStatusBanner from '@/components/budget/BudgetStatusBanner';
import GroupHeader from '@/components/budget/GroupHeader';
import WhoPaysPicker from '@/components/budget/WhoPaysPicker';
import {
  deleteExpense,
  getActiveTrip,
  getExpenses,
  getExpenseSummary,
  getGroupMembers,
  updateTripBudgetLimit,
  updateTripBudgetMode,
} from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { Expense, GroupMember, Trip } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type BudgetState = 'cruising' | 'low' | 'over';
type BudgetMode = 'limited' | 'unlimited';

/* ---------- Category icon components (verbatim SVG paths from prototype) ---------- */

function FoodIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2v9a4 4 0 008 0V2M10 2v4M18 5v16M14 5c0-1 1-3 4-3v8a2 2 0 01-2 2h-2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TransportIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4} y={4} width={16} height={16} rx={2}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 14h16M8 20v-2M16 20v-2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={8} cy={17} r={1} fill={color} />
      <Circle cx={16} cy={17} r={1} fill={color} />
    </Svg>
  );
}

function ActivitiesIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={12} cy={12} r={3}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShoppingIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 6h18M16 10a4 4 0 01-8 0"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ---------- Category config ---------- */

interface CategoryConfig {
  name: string;
  matchKey: string;
  colorKey: 'chart1' | 'chart2' | 'chart3' | 'chart4';
  icon: (color: string) => React.ReactNode;
}

const CATEGORY_CONFIG: ReadonlyArray<CategoryConfig> = [
  { name: 'Food & Drink', matchKey: 'Food', colorKey: 'chart1', icon: (c) => <FoodIcon color={c} /> },
  { name: 'Transport', matchKey: 'Transport', colorKey: 'chart2', icon: (c) => <TransportIcon color={c} /> },
  { name: 'Activities', matchKey: 'Activity', colorKey: 'chart3', icon: (c) => <ActivitiesIcon color={c} /> },
  { name: 'Shopping', matchKey: 'Shopping', colorKey: 'chart4', icon: (c) => <ShoppingIcon color={c} /> },
];

/* ---------- Pulsing icon wrapper for cruising state ---------- */

function PulsingIcon({ children, pulse }: { children: React.ReactNode; pulse: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [pulse, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/* ---------- Main screen ---------- */

export default function BudgetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = getStyles(colors);

  const [mode, setMode] = useState<BudgetMode>('limited');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<{
    total: number;
    byCategory: Record<string, number>;
    count: number;
  }>({ total: 0, byCategory: {}, count: 0 });
  const [members, setMembers] = useState<GroupMember[]>([]);

  const load = useCallback(async () => {
    try {
      const t = await getActiveTrip();
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
        if (t.budgetMode === 'Unlimited') setMode('unlimited');
        else setMode('limited');
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = trip?.budgetLimit ?? 0;
  const spent = expenseSummary.total;
  const remaining = total - spent;
  const days = trip ? Math.max(1, Math.ceil(
    (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000
  ) + 1) : 1;
  const perDay = total > 0 ? Math.round(total / days) : 0;
  const destLabel = trip?.destination ?? '';

  const bState: BudgetState = remaining / total > 0.5 ? 'cruising' : remaining / total > 0.2 ? 'low' : 'over';

  const status = total > 0
    ? (remaining / total > 0.5 ? 'Cruising' : remaining / total > 0.2 ? 'Watch' : 'Over')
    : 'Cruising';

  /* ---------- Delete expense ---------- */

  const handleDeleteExpense = useCallback(
    (expenseId: string, description: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Delete Expense', `Are you sure you want to delete "${description}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
            deleteExpense(expenseId)
              .then(() => load())
              .catch(() => {
                load();
              });
          },
        },
      ]);
    },
    [load],
  );

  /* ---------- FAB menu ---------- */

  const showAddMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Add Expense', 'Scan Receipt'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) router.push('/add-expense' as never);
          if (i === 2) router.push('/scan-receipt' as never);
        },
      );
    } else {
      Alert.alert('Add', '', [
        { text: 'Add Expense', onPress: () => router.push('/add-expense' as never) },
        { text: 'Scan Receipt', onPress: () => router.push('/scan-receipt' as never) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [router]);

  /* ---------- Budget limit editor ---------- */

  const promptBudgetLimit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!trip) return;

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Set Budget Limit',
        'Enter the new budget limit',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (value?: string) => {
              const parsed = Number(value);
              if (!value || isNaN(parsed) || parsed <= 0) return;
              updateTripBudgetLimit(trip.id, parsed).then(() => load()).catch(() => {});
            },
          },
        ],
        'plain-text',
        String(total || ''),
        'numeric',
      );
    } else {
      // Android fallback — use Alert with a message prompting the user
      Alert.alert(
        'Set Budget Limit',
        `Current limit: ${formatCurrency(total, 'PHP')}\n\nTo change the budget limit, use the trip settings.`,
        [{ text: 'OK' }],
      );
    }
  }, [trip, total, load]);

  /* ---------- Settings gear menu ---------- */

  const showSettingsMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const modeLabel = mode === 'limited' ? 'Switch to Unlimited' : 'Switch to Limited';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Set budget limit', modeLabel], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) promptBudgetLimit();
          if (i === 2 && trip) {
            const nextMode: BudgetMode = mode === 'limited' ? 'unlimited' : 'limited';
            setMode(nextMode);
            const supabaseMode = nextMode === 'limited' ? 'Limited' : 'Unlimited';
            updateTripBudgetMode(trip.id, supabaseMode).catch(() => {});
          }
        },
      );
    } else {
      Alert.alert('Budget Settings', '', [
        { text: 'Set budget limit', onPress: () => promptBudgetLimit() },
        {
          text: modeLabel,
          onPress: () => {
            if (!trip) return;
            const nextMode: BudgetMode = mode === 'limited' ? 'unlimited' : 'limited';
            setMode(nextMode);
            const supabaseMode = nextMode === 'limited' ? 'Limited' : 'Unlimited';
            updateTripBudgetMode(trip.id, supabaseMode).catch(() => {});
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [mode, trip, promptBudgetLimit, load]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TopBar */}
        <View style={styles.topBar}>
          <View>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>Budget</Text>
            <Text style={[styles.topBarSubtitle, { color: colors.text3 }]}>
              {destLabel || 'Trip'} {'\u00B7'} {days} days
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={showSettingsMenu}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={3} stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <Path
                d="M12 1v6m0 10v6M4.2 4.2l4.3 4.3m7 7l4.3 4.3M1 12h6m10 0h6M4.2 19.8l4.3-4.3m7-7l4.3-4.3"
                stroke={colors.text}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Mode toggle — Limited / Unlimited */}
        <View style={styles.togglePadding}>
          <View style={[styles.segControl, { backgroundColor: colors.card2, borderColor: colors.border }]}>
            {(['limited', 'unlimited'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.segBtn, active && [styles.segBtnActive, { backgroundColor: colors.card }]]}
                  onPress={() => {
                    setMode(m);
                    if (trip) {
                      const supabaseMode = m === 'limited' ? 'Limited' : 'Unlimited';
                      updateTripBudgetMode(trip.id, supabaseMode).catch(() => {});
                    }
                  }}
                >
                  <Text style={[styles.segText, { color: colors.text3 }, active && { color: colors.text }]}>
                    {m === 'limited' ? 'Limited' : 'Unlimited'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {mode === 'limited' && (
          <>
            {/* Animated status banner */}
            <View style={styles.bannerPadding}>
              <BudgetStatusBanner state={bState} spent={spent} total={total} />
            </View>

            {/* Main summary card */}
            <View style={styles.sectionPadding}>
              <View style={[styles.summaryCardOuter, { borderColor: colors.border }]}>
                <LinearGradient
                  colors={[colors.card, colors.card2]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.summaryCard}
                >
                  {/* Top row */}
                  <View style={styles.summaryTop}>
                    <View>
                      <Text style={styles.summaryEyebrow}>
                        {`Total budget \u00B7 ${days} days`}
                      </Text>
                      <TouchableOpacity
                        style={styles.summaryAmountRow}
                        onPress={promptBudgetLimit}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Edit budget limit"
                      >
                        <Text style={[styles.summaryCurrency, { color: colors.text3 }]}>{'\u20B1'}</Text>
                        <Text style={[styles.summaryAmount, { color: colors.text }]}>
                          {total.toLocaleString()}
                        </Text>
                        <View style={styles.editIcon}>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                              stroke={colors.text3}
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.summaryPerDay, { color: colors.text3 }]}>
                        {'\u20B1'}{perDay}/day target
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M5 15l7-7 7 7"
                          stroke={colors.accent}
                          strokeWidth={2.4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                      <Text style={[styles.statusPillText, { color: colors.accent }]}>{status}</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.card2 }]}>
                    <LinearGradient
                      colors={[colors.chart1, colors.chart2]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[styles.progressFill, { width: `${(spent / total) * 100}%` }]}
                    />
                  </View>

                  {/* Spent / Left */}
                  <View style={styles.spentLeftRow}>
                    <Text style={[styles.spentLeftLabel, { color: colors.text3 }]}>
                      Spent{' '}
                      <Text style={[styles.spentLeftValue, { color: colors.text }]}>
                        {'\u20B1'}{spent}
                      </Text>
                    </Text>
                    <Text style={[styles.spentLeftLabel, { color: colors.text3 }]}>
                      Left{' '}
                      <Text style={[styles.spentLeftValue, { color: colors.accent }]}>
                        {'\u20B1'}{remaining.toLocaleString()}
                      </Text>
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* Accommodation — paid separately */}
            <GroupHeader kicker="Accommodation" title={trip?.accommodation ?? 'Hotel'} />
            <View style={styles.sectionPadding}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.accomRow}>
                  <View style={[styles.accomIcon, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Polyline
                        points="20 6 9 17 4 12"
                        stroke={colors.accent}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accomTitle, { color: colors.text }]}>Paid in full</Text>
                    <Text style={[styles.accomSub, { color: colors.text3 }]}>
                      {members.length > 0 && trip?.cost != null
                        ? `${formatCurrency(trip.cost / members.length, trip.costCurrency || 'PHP')} per person \u00B7 ${members.length} travelers`
                        : ''}
                    </Text>
                  </View>
                  <Text style={[styles.accomAmount, { color: colors.text }]}>
                    {trip?.cost != null ? formatCurrency(trip.cost, trip.costCurrency || 'PHP') : '\u2014'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Categories */}
            <GroupHeader kicker="Categories" title="Where it's going" />
            <View style={styles.categoriesContainer}>
              {CATEGORY_CONFIG.map((c) => {
                const amount = expenseSummary.byCategory[c.matchKey] ?? 0;
                const pct = spent > 0 ? Math.round((amount / spent) * 100) : 0;
                const catColor = colors[c.colorKey];
                return (
                  <View
                    key={c.name}
                    style={[styles.categoryRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <PulsingIcon pulse={bState === 'cruising'}>
                      <View style={[styles.categoryIcon, { backgroundColor: catColor + '20', borderColor: catColor + '40' }]}>
                        {c.icon(catColor)}
                      </View>
                    </PulsingIcon>
                    <View style={{ flex: 1 }}>
                      <View style={styles.categoryTopRow}>
                        <Text style={[styles.categoryName, { color: colors.text }]}>{c.name}</Text>
                        <Text style={[styles.categoryAmount, { color: colors.text }]}>
                          {'\u20B1'}{amount.toLocaleString()}
                        </Text>
                      </View>
                      <View style={[styles.categoryBar, { backgroundColor: colors.card2 }]}>
                        <View
                          style={[styles.categoryBarFill, { width: `${pct}%`, backgroundColor: catColor }]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Who pays? — roulette picker */}
            <GroupHeader kicker="Who pays?" title="Let fate decide" />
            <WhoPaysPicker />

            {/* Recent expenses */}
            <GroupHeader
              kicker="Recent"
              title="Expenses"
              action={
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[styles.allAction, { color: colors.accent }]}>All {'\u2192'}</Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.expensesContainer}>
              {expenses.slice(0, 6).map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.expenseRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.description}, ${formatCurrency(e.amount, e.currency)}`}
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  onLongPress={() => handleDeleteExpense(e.id, e.description)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.expenseTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {e.description}
                    </Text>
                    <Text style={[styles.expenseCat, { color: colors.text3 }]}>
                      {e.category}{e.paidBy ? ` \u00B7 by ${e.paidBy}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.expenseAmount, { color: colors.text }]}>
                    {formatCurrency(e.amount, e.currency)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {mode === 'unlimited' && (
          <View style={styles.unlimitedPadding}>
            <View style={[styles.unlimitedCard, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
              <View style={[styles.unlimitedIcon, { backgroundColor: colors.accentBg }]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18.4 10.6a7 7 0 11-12.8 0 7 7 0 0112.8 0z"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    rotation={90}
                    origin="12, 12"
                  />
                  <Path
                    d="M8 12h8"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.unlimitedTitle, { color: colors.text }]}>No budget cap</Text>
              <Text style={[styles.unlimitedDesc, { color: colors.text3 }]}>
                Track expenses without a limit. We'll still categorize and summarize everything.
              </Text>
              <TouchableOpacity
                style={[styles.addExpenseBtn, { backgroundColor: colors.black }]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Add expense"
                onPress={() => router.push('/add-expense' as never)}
              >
                <Text style={[styles.addExpenseBtnText, { color: colors.onBlack }]}>+ Add expense</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* FAB — outside ScrollView, absolute within SafeAreaView */}
      <TouchableOpacity
        style={styles.fab}
        onPress={showAddMenu}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add expense or scan receipt"
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.bg} strokeWidth={2.4} strokeLinecap="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 120,
    },

    /* TopBar */
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    topBarTitle: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.7,
    },
    topBarSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.7,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Mode toggle */
    togglePadding: {
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    segControl: {
      flexDirection: 'row',
      padding: 3,
      borderWidth: 1,
      borderRadius: 12,
      gap: 2,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 9,
      alignItems: 'center',
    },
    segBtnActive: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 3,
      elevation: 2,
    },
    segText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: -0.12,
    },

    /* Banner */
    bannerPadding: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },

    /* Sections */
    sectionPadding: {
      paddingHorizontal: 16,
    },

    /* Summary card */
    summaryCardOuter: {
      borderRadius: 22,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: 14,
    },
    summaryCard: {
      padding: 20,
    },
    summaryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 18,
    },
    summaryEyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    summaryAmountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 4,
    },
    summaryCurrency: {
      fontSize: 18,
      fontWeight: '600',
    },
    summaryAmount: {
      fontSize: 36,
      fontWeight: '500',
      letterSpacing: -0.9,
      fontVariant: ['tabular-nums'],
    },
    summaryPerDay: {
      fontSize: 11,
      marginTop: 2,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '600',
    },

    /* Progress bar */
    progressTrack: {
      height: 8,
      borderRadius: 99,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressFill: {
      height: '100%',
      borderRadius: 99,
    },

    /* Spent / Left */
    spentLeftRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    spentLeftLabel: {
      fontSize: 12,
    },
    spentLeftValue: {
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },

    /* Card (generic) */
    card: {
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },

    /* Accommodation */
    accomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    accomIcon: {
      width: 42,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accomTitle: {
      fontSize: 13,
      fontWeight: '600',
    },
    accomSub: {
      fontSize: 11,
      marginTop: 2,
    },
    accomAmount: {
      fontSize: 18,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
    },

    /* Categories */
    categoriesContainer: {
      paddingHorizontal: 16,
      gap: 8,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
    categoryIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    categoryName: {
      fontSize: 13,
      fontWeight: '600',
    },
    categoryAmount: {
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    categoryBar: {
      height: 4,
      borderRadius: 99,
      overflow: 'hidden',
    },
    categoryBarFill: {
      height: '100%',
      borderRadius: 99,
    },

    /* Recent expenses */
    allAction: {
      fontSize: 12,
      fontWeight: '600',
    },
    expensesContainer: {
      paddingHorizontal: 16,
      gap: 6,
    },
    expenseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    expenseTitle: {
      fontSize: 12.5,
      fontWeight: '600',
    },
    expenseCat: {
      fontSize: 10,
      marginTop: 1,
    },
    expenseAmount: {
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },

    /* Unlimited mode */
    unlimitedPadding: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    unlimitedCard: {
      paddingVertical: 40,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    unlimitedIcon: {
      width: 52,
      height: 52,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    unlimitedTitle: {
      fontSize: 18,
      fontWeight: '500',
      letterSpacing: -0.54,
      marginBottom: 6,
    },
    unlimitedDesc: {
      fontSize: 12,
      textAlign: 'center',
      maxWidth: 260,
      marginBottom: 16,
      lineHeight: 17,
    },
    addExpenseBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    addExpenseBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },

    /* Edit icon next to budget amount */
    editIcon: {
      marginLeft: 6,
      opacity: 0.5,
    },

    /* FAB */
    fab: {
      position: 'absolute',
      right: 18,
      bottom: 100,
      width: 48,
      height: 48,
      borderRadius: 999,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 8,
    },
  });
