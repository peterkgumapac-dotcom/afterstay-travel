import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Car, Compass, Hotel, Package, Pencil, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import type { Expense } from '@/lib/types';

interface Props {
  expense: Expense;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof UtensilsCrossed; color: string; label: string }> = {
  Food: { icon: UtensilsCrossed, color: '#e8a860', label: 'Food' },
  Transport: { icon: Car, color: '#5a8fb5', label: 'Transport' },
  Activity: { icon: Compass, color: '#7ac4d6', label: 'Activity' },
  Accommodation: { icon: Hotel, color: '#8b6f5a', label: 'Stay' },
  Shopping: { icon: ShoppingBag, color: '#b66a8a', label: 'Shopping' },
  Other: { icon: Package, color: '#857d70', label: 'Other' },
};

function smartTitle(expense: Expense): string {
  const raw = expense.description.trim();
  let desc = raw
    .replace(/^payment transaction at /i, '')
    .replace(/^ride booking service with /i, '')
    .replace(/^dinner for multiple people with /i, '')
    .replace(/^purchase at /i, '')
    .replace(/^online payment to /i, '')
    .replace(/ in boracay$/i, '')
    .replace(/ in .*philippines$/i, '');

  if (expense.placeName && expense.placeName.length > 2) {
    const catLabel = CATEGORY_CONFIG[expense.category]?.label ?? expense.category;
    desc = `${catLabel} at ${expense.placeName}`;
  }

  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  if (desc.length > 35) desc = desc.slice(0, 32) + '\u2026';
  return desc || raw.slice(0, 35);
}

export function ExpenseCard({ expense, onPress, onEdit, onDelete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cat = CATEGORY_CONFIG[expense.category] ?? CATEGORY_CONFIG.Other;
  const title = smartTitle(expense);
  const swipeRef = useRef<Swipeable>(null);

  const handleEdit = useCallback(() => {
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit?.();
  }, [onEdit]);

  const handleDelete = useCallback(() => {
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.();
  }, [onDelete]);

  const renderRightActions = useCallback(() => (
    <View style={styles.actions}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={handleEdit} activeOpacity={0.7}>
        <Pencil size={16} color="#fff" strokeWidth={2} />
        <Text style={styles.actionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#c4554a' }]} onPress={handleDelete} activeOpacity={0.7}>
        <Trash2 size={16} color="#fff" strokeWidth={2} />
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  ), [colors.accent, handleEdit, handleDelete, styles]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatCurrency(expense.amount, expense.currency)}`}
      >
        {/* Category icon */}
        <View style={[styles.iconWrap, { backgroundColor: cat.color + '18' }]}>
          <cat.icon size={18} color={cat.color} strokeWidth={1.8} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.metaRow}>
            {expense.paidBy ? <Text style={styles.meta}>{expense.paidBy}</Text> : null}
            <Text style={[styles.catBadge, { color: cat.color }]}>{cat.label}</Text>
            <Text style={styles.meta}>{formatDatePHT(expense.date)}</Text>
          </View>
        </View>

        {/* Amount */}
        <Text style={styles.amount}>
          {formatCurrency(expense.amount, expense.currency)}
        </Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    actions: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    actionBtn: {
      width: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    actionText: {
      fontSize: 9,
      fontWeight: '600',
      color: '#fff',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md + 2,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
      flexWrap: 'wrap',
    },
    meta: {
      fontSize: 11,
      color: colors.text3,
    },
    catBadge: {
      fontSize: 10,
      fontWeight: '600',
    },
    amount: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.3,
    },
  });
