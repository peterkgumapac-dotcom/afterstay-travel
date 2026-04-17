import { useCallback, useState } from 'react';
import { Image, LayoutAnimation, Modal, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Expense } from '@/lib/types';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import Pill from './Pill';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  expense: Expense;
}

const TONE: Record<string, 'amber' | 'blue' | 'green' | 'purple' | 'default'> = {
  Food: 'amber',
  Transport: 'blue',
  Activity: 'green',
  Accommodation: 'purple',
  Shopping: 'default',
  Other: 'default',
};

const SPLIT_TONE: Record<string, 'blue' | 'purple' | 'green'> = {
  Equal: 'blue',
  Custom: 'purple',
  Individual: 'green',
};

export default function ExpenseRow({ expense }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  return (
    <Pressable onPress={toggle} style={styles.row}>
      {/* Collapsed: always visible */}
      <View style={styles.topRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.desc} numberOfLines={expanded ? undefined : 1}>
            {expense.description}
          </Text>
          {expense.placeName ? (
            <Text style={styles.placeName} numberOfLines={1}>
              {expense.placeName}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Pill label={expense.category} tone={TONE[expense.category] ?? 'default'} />
            {expense.splitType ? (
              <Pill label={expense.splitType} tone={SPLIT_TONE[expense.splitType] ?? 'default'} />
            ) : null}
            <Text style={styles.meta}>
              {expense.date ? formatDatePHT(expense.date) : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.amount}>{formatCurrency(expense.amount, expense.currency)}</Text>
        {expense.photo ? (
          <Pressable onPress={() => setPhotoModalVisible(true)}>
            <Image source={{ uri: expense.photo }} style={styles.thumbnail} />
          </Pressable>
        ) : null}
      </View>

      {/* Expanded: extra details */}
      {expanded ? (
        <View style={styles.details}>
          {expense.paidBy ? (
            <DetailLine label="Paid by" value={expense.paidBy} />
          ) : null}
          {expense.splitType ? (
            <DetailLine label="Split" value={expense.splitType} />
          ) : null}
          {expense.currency ? (
            <DetailLine label="Currency" value={expense.currency} />
          ) : null}
          {expense.notes ? (
            <View style={styles.notesBlock}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {expense.photo ? (
        <Modal visible={photoModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setPhotoModalVisible(false)}>
            <Image source={{ uri: expense.photo }} style={styles.fullImage} resizeMode="contain" />
            <Text style={styles.modalClose}>Tap anywhere to close</Text>
          </Pressable>
        </Modal>
      ) : null}
    </Pressable>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  desc: { color: colors.text, fontSize: 14, fontWeight: '600' },
  placeName: { color: colors.text3, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  meta: { color: colors.text3, fontSize: 11 },
  amount: { color: colors.text, fontSize: 15, fontWeight: '700' },
  details: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { color: colors.text3, fontSize: 12, fontWeight: '600' },
  detailValue: { color: colors.text2, fontSize: 12 },
  notesBlock: { gap: 2, marginTop: spacing.xs },
  notesText: { color: colors.text2, fontSize: 12, lineHeight: 18 },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fullImage: {
    width: '100%',
    height: '70%',
  },
  modalClose: {
    color: colors.white,
    fontSize: 13,
    marginTop: spacing.lg,
    opacity: 0.7,
  },
});
