import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PiggyBank, Plus, Pencil, Plane } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';
import { ProgressRing } from './ProgressRing';
import type { SavingsGoal, SavingsMilestone } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface SavingsGoalCardProps {
  goal: SavingsGoal | null;
  onSetup: () => void;
  onLogSavings: () => void;
  onEdit: () => void;
  onPlanTrip: () => void;
}

const MILESTONES: SavingsMilestone[] = [25, 50, 75, 100];

export function SavingsGoalCard({ goal, onSetup, onLogSavings, onEdit, onPlanTrip }: SavingsGoalCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  if (!goal) {
    return (
      <View style={s.card}>
        <View style={s.emptyIcon}>
          <PiggyBank size={24} color={colors.accent} strokeWidth={1.5} />
        </View>
        <Text style={s.emptyTitle}>Save for your next trip</Text>
        <Text style={s.emptySub}>
          Set a savings goal and track your progress toward your dream destination.
        </Text>
        <TouchableOpacity style={s.setupBtn} onPress={onSetup} activeOpacity={0.7}>
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text style={s.setupBtnText}>Set Savings Goal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const pct = Math.round(progress * 100);
  const isComplete = pct >= 100;
  const daysLeft = goal.targetDate
    ? Math.max(0, Math.ceil((new Date(goal.targetDate + 'T00:00:00+08:00').getTime() - Date.now()) / 86400000))
    : null;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.goalTitle}>{goal.title}</Text>
          {goal.destination && <Text style={s.goalDest}>{goal.destination}</Text>}
        </View>
        <TouchableOpacity onPress={onEdit} hitSlop={8}>
          <Pencil size={16} color={colors.text3} />
        </TouchableOpacity>
      </View>

      <View style={s.progressRow}>
        <ProgressRing progress={progress} size={72} strokeWidth={5}>
          <Text style={s.pctText}>{pct}%</Text>
        </ProgressRing>
        <View style={s.amountCol}>
          <Text style={s.currentAmount}>
            {formatCurrency(goal.currentAmount, goal.targetCurrency)}
          </Text>
          <Text style={s.targetLabel}>
            of {formatCurrency(goal.targetAmount, goal.targetCurrency)}
          </Text>
          {daysLeft !== null && (
            <Text style={s.daysLeft}>
              {daysLeft > 0 ? `${daysLeft} days left` : 'Target date reached'}
            </Text>
          )}
        </View>
      </View>

      {/* Milestone indicators */}
      <View style={s.milestoneRow}>
        {MILESTONES.map((m) => {
          const reached = goal.celebratedMilestones.includes(m) || pct >= m;
          return (
            <View key={m} style={s.milestoneItem}>
              <Text style={[s.milestoneStar, reached && s.milestoneReached]}>
                {reached ? '\u2605' : '\u2606'}
              </Text>
              <Text style={[s.milestoneLabel, reached && { color: colors.accent }]}>
                {m}%
              </Text>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {isComplete ? (
          <TouchableOpacity style={s.planBtn} onPress={onPlanTrip} activeOpacity={0.7}>
            <Plane size={16} color="#fff" strokeWidth={2} />
            <Text style={s.planBtnText}>Plan it with me</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.saveBtn} onPress={onLogSavings} activeOpacity={0.7}>
            <Plus size={16} color="#fff" strokeWidth={2.5} />
            <Text style={s.saveBtnText}>I Saved Today</Text>
          </TouchableOpacity>
        )}
      </View>
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
      padding: 18,
      marginHorizontal: 16,
      marginBottom: 14,
    },
    // Empty state
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 6 },
    emptySub: { fontSize: 12, color: c.text3, lineHeight: 18, marginBottom: 16 },
    setupBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: c.accent,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: radius.sm,
    },
    setupBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    // Active goal
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
    goalTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    goalDest: { fontSize: 12, color: c.accent, marginTop: 2 },

    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 14 },
    pctText: { fontSize: 16, fontWeight: '700', color: c.accent },
    amountCol: { flex: 1 },
    currentAmount: { fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.5 },
    targetLabel: { fontSize: 12, color: c.text3, marginTop: 2 },
    daysLeft: { fontSize: 11, color: c.text2, marginTop: 4 },

    milestoneRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, paddingHorizontal: 8 },
    milestoneItem: { alignItems: 'center', gap: 2 },
    milestoneStar: { fontSize: 18, color: c.border2 },
    milestoneReached: { color: c.gold },
    milestoneLabel: { fontSize: 10, fontWeight: '600', color: c.text3 },

    actions: { flexDirection: 'row', gap: 10 },
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      paddingVertical: 12,
      borderRadius: radius.sm,
    },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    planBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      paddingVertical: 12,
      borderRadius: radius.sm,
    },
    planBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });
