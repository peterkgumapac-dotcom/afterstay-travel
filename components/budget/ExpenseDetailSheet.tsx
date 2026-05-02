import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Pencil, Trash2, X } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import { getExpenseSplits, settleExpenseSplit } from '@/lib/supabase';
import type { ExpenseSplit } from '@/lib/supabase';
import type { Expense } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface Props {
  visible: boolean;
  expense: Expense | null;
  currency?: string;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseDetailSheet({ visible, expense, currency = 'PHP', onClose, onEdit, onDelete }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);

  useEffect(() => {
    if (visible && expense?.id) {
      getExpenseSplits(expense.id).then(setSplits).catch(() => setSplits([]));
    } else {
      setSplits([]);
    }
  }, [visible, expense?.id]);

  const handleSettle = async (split: ExpenseSplit) => {
    Alert.alert(
      'Settle',
      `Mark ${formatCurrency(split.amount, currency)} for ${split.memberName} as settled?`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Settled',
          onPress: async () => {
            await settleExpenseSplit(split.id).catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSplits(prev => prev.map(s => s.id === split.id ? { ...s, settled: true, settledAt: new Date().toISOString() } : s));
          },
        },
      ],
    );
  };

  if (!expense) return null;

  const settledCount = splits.filter(s => s.settled).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle}><View style={s.handleBar} /></View>

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={2}>{expense.description}</Text>
              <Text style={s.date}>{formatDatePHT(expense.date)} · {expense.category}</Text>
            </View>
            <Text style={s.amount}>{formatCurrency(expense.amount, expense.currency ?? currency)}</Text>
          </View>

          {/* Details */}
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {expense.paidBy && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Paid by</Text>
                <Text style={s.detailValue}>{expense.paidBy}</Text>
              </View>
            )}
            {expense.placeName && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Place</Text>
                <Text style={s.detailValue}>{expense.placeName}</Text>
              </View>
            )}
            {expense.splitType && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Split type</Text>
                <Text style={s.detailValue}>{expense.splitType}</Text>
              </View>
            )}
            {expense.notes && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Notes</Text>
                <Text style={[s.detailValue, { flex: 1 }]}>{expense.notes}</Text>
              </View>
            )}

            {/* Split breakdown */}
            {splits.length > 0 && (
              <View style={s.splitSection}>
                <Text style={s.splitTitle}>
                  Split breakdown {settledCount > 0 && `· ${settledCount}/${splits.length} settled`}
                </Text>
                {splits.map(split => (
                  <View key={split.id} style={s.splitRow}>
                    <View style={[s.splitAvatar, { backgroundColor: split.settled ? colors.success : colors.chart2 }]}>
                      <Text style={s.splitAvatarText}>{split.memberName.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.splitName}>{split.memberName}</Text>
                      <Text style={s.splitAmount}>{formatCurrency(split.amount, currency)}</Text>
                    </View>
                    {split.settled ? (
                      <View style={s.settledBadge}>
                        <Check size={10} color={colors.success} strokeWidth={3} />
                        <Text style={[s.settledText, { color: colors.success }]}>Settled</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={s.settleBtn}
                        onPress={() => handleSettle(split)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.settleBtnText}>Settle</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => { onClose(); onEdit(expense); }}
              activeOpacity={0.7}
            >
              <Pencil size={16} color={colors.accent} strokeWidth={2} />
              <Text style={[s.actionText, { color: colors.accent }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => {
                onClose();
                Alert.alert('Delete expense?', expense.description, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(expense.id) },
                ]);
              }}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={colors.danger} strokeWidth={2} />
              <Text style={[s.actionText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg, paddingBottom: 40, maxHeight: '80%',
    },
    handle: { alignItems: 'center', paddingVertical: 12 },
    handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border2 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: spacing.lg, gap: 12,
    },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    date: { fontSize: 12, color: c.text3, marginTop: 4 },
    amount: { fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.5 },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    detailLabel: { fontSize: 13, color: c.text3 },
    detailValue: { fontSize: 13, fontWeight: '600', color: c.text },
    splitSection: { marginTop: spacing.lg, gap: 8 },
    splitTitle: { fontSize: 11, fontWeight: '700', color: c.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
    splitRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    splitAvatar: {
      width: 32, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
    },
    splitAvatarText: { fontSize: 13, fontWeight: '700', color: c.bg },
    splitName: { fontSize: 13, fontWeight: '600', color: c.text },
    splitAmount: { fontSize: 12, color: c.text2, marginTop: 1 },
    settledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    settledText: { fontSize: 11, fontWeight: '600' },
    settleBtn: {
      paddingHorizontal: 14, paddingVertical: 6,
      backgroundColor: c.accentBg, borderRadius: 10, borderWidth: 1, borderColor: c.accentBorder,
    },
    settleBtnText: { fontSize: 12, fontWeight: '700', color: c.accent },
    actions: {
      flexDirection: 'row', gap: 12, marginTop: spacing.lg,
    },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    },
    actionText: { fontSize: 14, fontWeight: '600' },
  });
