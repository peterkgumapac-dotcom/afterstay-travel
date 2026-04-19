import { useCallback, useState } from 'react';
import { Image, LayoutAnimation, Modal, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
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
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  return (
    <Pressable onPress={toggle} style={styles.row}>
      {/* Collapsed: always visible */}
      <View style={staticStyles.topRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.desc} numberOfLines={expanded ? undefined : 1}>
            {expense.description}
          </Text>
          {expense.placeName ? (
            <Text style={styles.placeName} numberOfLines={1}>
              {expense.placeName}
            </Text>
          ) : null}
          <View style={staticStyles.metaRow}>
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
            <Image source={{ uri: expense.photo }} style={staticStyles.thumbnail} />
          </Pressable>
        ) : null}
      </View>

      {/* Expanded: extra details */}
      {expanded ? (
        <View style={styles.details}>
          {expense.paidBy ? (
            <DetailLine label="Paid by" value={expense.paidBy} colors={colors} />
          ) : null}
          {expense.splitType ? (
            <DetailLine label="Split" value={expense.splitType} colors={colors} />
          ) : null}
          {expense.currency ? (
            <DetailLine label="Currency" value={expense.currency} colors={colors} />
          ) : null}
          {expense.notes ? (
            <View style={staticStyles.notesBlock}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {expense.photo ? (
        <Modal visible={photoModalVisible} transparent animationType="fade">
          <Pressable style={staticStyles.modalOverlay} onPress={() => setPhotoModalVisible(false)}>
            <Image source={{ uri: expense.photo }} style={staticStyles.fullImage} resizeMode="contain" />
            <Text style={styles.modalClose}>Tap anywhere to close</Text>
          </Pressable>
        </Modal>
      ) : null}
    </Pressable>
  );
}

function DetailLine({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={staticStyles.detailRow}>
      <Text style={{ color: colors.text3, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.text2, fontSize: 12 }}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  desc: { color: colors.text, fontSize: 14, fontWeight: '600' },
  placeName: { color: colors.text3, fontSize: 12 },
  meta: { color: colors.text3, fontSize: 11 },
  amount: { color: colors.text, fontSize: 15, fontWeight: '700' },
  details: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  detailLabel: { color: colors.text3, fontSize: 12, fontWeight: '600' },
  notesText: { color: colors.text2, fontSize: 12, lineHeight: 18 },
  modalClose: {
    color: colors.white,
    fontSize: 13,
    marginTop: spacing.lg,
    opacity: 0.7,
  },
});

const staticStyles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesBlock: { gap: 2, marginTop: spacing.xs },
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
});
