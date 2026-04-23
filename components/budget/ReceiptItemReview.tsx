import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';
import type { GroupMember } from '@/lib/types';
import type { ReceiptLineItem } from '@/lib/anthropic';

type Assignment = 'shared' | string; // 'shared' or member name

interface Props {
  items: ReceiptLineItem[];
  members: GroupMember[];
  placeName: string;
  category: string;
  currency?: string;
  onConfirm: (result: {
    items: (ReceiptLineItem & { assignedTo: Assignment })[];
    sharedCount: number;
  }) => void;
  onCancel: () => void;
}

export function ReceiptItemReview({
  items,
  members,
  placeName,
  category,
  currency = 'PHP',
  onConfirm,
  onCancel,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Each item assigned to 'shared' by default
  const [assignments, setAssignments] = useState<Record<number, Assignment>>(
    () => Object.fromEntries(items.map((_, i) => [i, 'shared'])),
  );

  const assign = useCallback((index: number, to: Assignment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAssignments(prev => ({ ...prev, [index]: to }));
  }, []);

  const showAssignPicker = useCallback((index: number) => {
    const options = [
      { label: 'Shared (split equally)', value: 'shared' },
      ...members.map(m => ({ label: m.name, value: m.name })),
    ];
    Alert.alert(
      `Assign "${items[index].name}"`,
      'Who is this item for?',
      [
        ...options.map(o => ({
          text: o.label,
          onPress: () => assign(index, o.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [items, members, assign]);

  // Calculate per-person totals
  const summary = useMemo(() => {
    const sharedTotal = items.reduce(
      (sum, item, i) => assignments[i] === 'shared' ? sum + item.amount * item.qty : sum,
      0,
    );
    const sharedCount = members.length || 1;
    const perPersonShared = sharedTotal / sharedCount;

    const personal: Record<string, number> = {};
    for (const m of members) personal[m.name] = perPersonShared;

    items.forEach((item, i) => {
      if (assignments[i] !== 'shared') {
        const name = assignments[i];
        personal[name] = (personal[name] ?? 0) + item.amount * item.qty;
      }
    });

    return { sharedTotal, sharedCount, perPersonShared, personal };
  }, [items, assignments, members]);

  const total = items.reduce((s, item) => s + item.amount * item.qty, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Review Receipt</Text>
          <Text style={styles.subtitle}>{placeName} · {category}</Text>
        </View>
        <Text style={styles.total}>{formatCurrency(total, currency)}</Text>
      </View>

      {/* Items */}
      <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.sm }}>
        {items.map((item, i) => {
          const assigned = assignments[i];
          const isShared = assigned === 'shared';
          return (
            <TouchableOpacity
              key={i}
              style={styles.itemRow}
              onPress={() => showAssignPicker(i)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.qty > 1 ? `${item.qty}× ` : ''}{item.name}
                </Text>
                <Text style={styles.itemAssign}>
                  {isShared ? `🤝 Shared (÷${summary.sharedCount})` : `👤 ${assigned}`}
                </Text>
              </View>
              <Text style={styles.itemAmount}>
                {formatCurrency(item.amount * item.qty, currency)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Per-person breakdown */}
      {members.length >= 2 && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Each person pays</Text>
          {members.map(m => (
            <View key={m.id} style={styles.breakdownRow}>
              <Text style={styles.breakdownName}>{m.name}</Text>
              <Text style={styles.breakdownAmount}>
                {formatCurrency(summary.personal[m.name] ?? 0, currency)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onConfirm({
              items: items.map((item, i) => ({ ...item, assignedTo: assignments[i] })),
              sharedCount: summary.sharedCount,
            });
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>Add to expenses</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 2,
    },
    total: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.4,
    },
    list: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    itemAssign: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    itemAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    breakdown: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: radius.md,
      gap: spacing.xs,
    },
    breakdownTitle: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.accent,
      marginBottom: spacing.xs,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    breakdownName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    breakdownAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text2,
    },
    confirmBtn: {
      flex: 2,
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.black,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onBlack,
    },
  });
