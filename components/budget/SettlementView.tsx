import React, { useMemo } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';
import type { Expense, GroupMember } from '@/lib/types';

interface Props {
  expenses: Expense[];
  members: GroupMember[];
  currency?: string;
}

interface Debt {
  from: string;
  to: string;
  amount: number;
}

function calculateSettlement(expenses: Expense[], members: GroupMember[]): Debt[] {
  if (members.length < 2) return [];

  const names = members.map(m => m.name);
  const paid: Record<string, number> = {};
  const share: Record<string, number> = {};

  for (const n of names) {
    paid[n] = 0;
    share[n] = 0;
  }

  for (const e of expenses) {
    const payer = e.paidBy || names[0];
    if (paid[payer] !== undefined) paid[payer] += e.amount;

    // Equal split by default
    const splitCount = names.length;
    const perPerson = e.amount / splitCount;
    for (const n of names) {
      share[n] += perPerson;
    }
  }

  // Calculate net: positive = owed money, negative = owes money
  const net: Record<string, number> = {};
  for (const n of names) {
    net[n] = paid[n] - share[n];
  }

  // Simplify debts
  const debts: Debt[] = [];
  const debtors = names.filter(n => net[n] < -0.5).map(n => ({ name: n, amount: -net[n] }));
  const creditors = names.filter(n => net[n] > 0.5).map(n => ({ name: n, amount: net[n] }));

  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amt = Math.min(debtors[di].amount, creditors[ci].amount);
    if (amt > 0.5) {
      debts.push({ from: debtors[di].name, to: creditors[ci].name, amount: Math.round(amt) });
    }
    debtors[di].amount -= amt;
    creditors[ci].amount -= amt;
    if (debtors[di].amount < 0.5) di++;
    if (creditors[ci].amount < 0.5) ci++;
  }

  return debts;
}

export function SettlementView({ expenses, members, currency = 'PHP' }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const debts = useMemo(() => calculateSettlement(expenses, members), [expenses, members]);

  if (members.length < 2) return null;

  // Per-person totals
  const paidBy: Record<string, number> = {};
  for (const e of expenses) {
    const payer = e.paidBy || members[0]?.name || 'Unknown';
    paidBy[payer] = (paidBy[payer] ?? 0) + e.amount;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who Owes What</Text>

      {/* Per-person paid */}
      <View style={styles.paidSection}>
        {members.map(m => (
          <View key={m.id} style={styles.paidRow}>
            <Text style={styles.paidName}>{m.name}</Text>
            <Text style={styles.paidAmount}>paid {formatCurrency(paidBy[m.name] ?? 0, currency)}</Text>
          </View>
        ))}
      </View>

      {/* Shared expenses breakdown */}
      <View style={styles.sharedSection}>
        <Text style={styles.sharedTitle}>Shared expenses</Text>
        {expenses.filter(e => !e.splitType || e.splitType === 'Equal').map((e) => {
          const payer = e.paidBy || members[0]?.name || 'Unknown';
          const perPerson = Math.round(e.amount / members.length);
          const othersOwe = members.filter(m => m.name !== payer);
          return (
            <View key={e.id} style={styles.sharedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sharedDesc} numberOfLines={1}>{e.description}</Text>
                <Text style={styles.sharedMeta}>
                  {payer} paid {formatCurrency(e.amount, currency)} · {formatCurrency(perPerson, currency)} each
                </Text>
              </View>
              {othersOwe.length > 0 && (
                <View style={styles.oweBadge}>
                  <Text style={styles.oweText}>
                    {othersOwe.map(m => m.name.split(' ')[0]).join(', ')} owe {formatCurrency(perPerson, currency)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Net debts */}
      {debts.length === 0 ? (
        <View style={styles.settledCard}>
          <Text style={styles.settledText}>{'✓'} All settled up!</Text>
        </View>
      ) : (
        <View style={styles.debtList}>
          {debts.map((d, i) => (
            <View key={i} style={styles.debtRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.debtText}>
                  <Text style={{ fontWeight: '600' }}>{d.from}</Text>
                  {' owes '}
                  <Text style={{ fontWeight: '600' }}>{d.to}</Text>
                </Text>
                <Text style={styles.debtAmount}>{formatCurrency(d.amount, currency)}</Text>
              </View>
              <TouchableOpacity
                style={styles.settleBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Settle Up', `Mark ${formatCurrency(d.amount, currency)} from ${d.from} to ${d.to} as settled?`, [
                    { text: 'Not yet', style: 'cancel' },
                    { text: 'Settled', onPress: () => Alert.alert('Done', 'Marked as settled') },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.settleBtnText}>Settle</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Payment options */}
      <View style={styles.payOptions}>
        <Text style={styles.payLabel}>Settle with</Text>
        <View style={styles.payRow}>
          {['GCash', 'Maya', 'Bank transfer'].map(method => (
            <TouchableOpacity
              key={method}
              style={styles.payChip}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (method === 'GCash') Linking.openURL('https://gcash.com').catch(() => {});
                else if (method === 'Maya') Linking.openURL('https://maya.ph').catch(() => {});
                else Alert.alert(method, 'Share your bank details with your group');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.payChipText}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    paidSection: {
      gap: spacing.xs,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    paidRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    paidName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    paidAmount: {
      fontSize: 13,
      color: colors.text2,
    },
    settledCard: {
      padding: spacing.lg,
      alignItems: 'center',
      backgroundColor: colors.accentBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    settledText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    debtList: {
      gap: spacing.sm,
    },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    debtText: {
      fontSize: 13,
      color: colors.text,
    },
    debtAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.warn,
      marginTop: 2,
    },
    settleBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.black,
    },
    settleBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    payOptions: {
      gap: spacing.sm,
    },
    payLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text3,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    payRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    payChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    payChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    sharedSection: {
      gap: spacing.sm,
    },
    sharedTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text2,
    },
    sharedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sharedDesc: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    sharedMeta: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    oweBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentBg,
    },
    oweText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.accent,
    },
  });
