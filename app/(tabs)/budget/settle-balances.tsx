import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, HelpCircle, QrCode, ShieldCheck, Users, X } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  getActiveTrip,
  getExpenses,
  getGroupMembers,
  getPaymentQrs,
  getTripSplits,
  notifySettlementReminder,
  settleExpenseSplit,
} from '@/lib/supabase';
import type { ExpenseSplit, PaymentQr } from '@/lib/supabase';
import { getUnifiedExpenseHistory } from '@/lib/expenseHistory';
import {
  budgetMemberInitial,
  computeUnsettledDebtEdges,
  displayBudgetMemberName,
  summarizeDebtEdges,
  type BudgetDebtEdge,
} from '@/lib/budgetBalances';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import type { Expense, GroupMember, Trip, UnifiedExpenseHistoryItem } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type SettleScope = 'trip' | 'personal';

interface PersonalSplitRow {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  status: 'review' | 'settled';
}

function shortTripName(trip: Trip | null): string {
  const label = trip?.destination || trip?.name || 'Trip';
  return label.length > 18 ? `${label.slice(0, 17)}...` : label;
}

function parsePersonalSplitRows(items: UnifiedExpenseHistoryItem[]): PersonalSplitRow[] {
  const rows: PersonalSplitRow[] = [];

  for (const item of items) {
    if (item.source === 'trip') continue;
    if (!item.splitType && !item.notes?.toLowerCase().includes('split:')) continue;

    const splitLines = item.notes?.split('\n').filter((line) => /:\s*[A-Z]{3}\s+[\d,.]+/i.test(line)) ?? [];
    if (splitLines.length === 0) {
      rows.push({
        id: item.id,
        title: item.description || 'Split expense',
        subtitle: `${item.sourceLabel ?? item.category} · ${formatDatePHT(item.date)}`,
        amount: item.amount,
        currency: item.currency,
        status: 'review',
      });
      continue;
    }

    for (const line of splitLines) {
      const match = line.match(/^([^:]+):\s*([A-Z]{3})\s+([\d,.]+)/i);
      if (!match) continue;
      const settled = /settled/i.test(line);
      rows.push({
        id: `${item.id}-${rows.length}`,
        title: displayBudgetMemberName(match[1]),
        subtitle: `${item.description || 'Split expense'} · ${formatDatePHT(item.date)}`,
        amount: Number(match[3].replace(/,/g, '')) || 0,
        currency: match[2].toUpperCase(),
        status: settled ? 'settled' : 'review',
      });
    }
  }

  return rows;
}

export default function SettleBalancesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string }>();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [scope, setScope] = useState<SettleScope>(params.scope === 'personal' ? 'personal' : 'trip');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [personalHistory, setPersonalHistory] = useState<UnifiedExpenseHistoryItem[]>([]);
  const [paymentQrs, setPaymentQrs] = useState<PaymentQr[]>([]);
  const [viewingQr, setViewingQr] = useState<PaymentQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      const activeTrip = await getActiveTrip(force).catch(() => null);
      setTrip(activeTrip);
      if (!activeTrip && scope === 'trip') setScope('personal');

      const [history, tripExpenses, tripMembers, tripSplits, qrs] = await Promise.all([
        getUnifiedExpenseHistory(50).catch(() => [] as UnifiedExpenseHistoryItem[]),
        activeTrip ? getExpenses(activeTrip.id).catch(() => [] as Expense[]) : Promise.resolve([] as Expense[]),
        activeTrip ? getGroupMembers(activeTrip.id).catch(() => [] as GroupMember[]) : Promise.resolve([] as GroupMember[]),
        activeTrip ? getTripSplits(activeTrip.id).catch(() => [] as ExpenseSplit[]) : Promise.resolve([] as ExpenseSplit[]),
        activeTrip ? getPaymentQrs(activeTrip.id).catch(() => [] as PaymentQr[]) : Promise.resolve([] as PaymentQr[]),
      ]);

      setPersonalHistory(history);
      setExpenses(tripExpenses);
      setMembers(tripMembers);
      setSplits(tripSplits);
      setPaymentQrs(qrs);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const currentMember = useMemo(
    () => members.find((member) => member.userId && member.userId === user?.id),
    [members, user?.id],
  );
  const currency = trip?.costCurrency ?? expenses[0]?.currency ?? 'PHP';
  const debtEdges = useMemo(() => computeUnsettledDebtEdges(expenses, members, splits), [expenses, members, splits]);
  const summary = useMemo(() => summarizeDebtEdges(debtEdges, currentMember?.id), [currentMember?.id, debtEdges]);
  const personalRows = useMemo(() => parsePersonalSplitRows(personalHistory), [personalHistory]);
  const personalOpenRows = personalRows.filter((row) => row.status !== 'settled');
  const personalSettledRows = personalRows.filter((row) => row.status === 'settled');

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleSettleEdge = useCallback((edge: BudgetDebtEdge) => {
    Alert.alert('Mark as settled?', `${edge.fromName} paid ${edge.toName} ${formatCurrency(edge.amount, currency)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settled',
        onPress: async () => {
          try {
            for (const splitId of edge.splitIds) {
              await settleExpenseSplit(splitId);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await load(true);
          } catch {
            Alert.alert('Could not settle', 'Please try again.');
          }
        },
      },
    ]);
  }, [currency, load]);

  const handleRequest = useCallback(async (edge: BudgetDebtEdge) => {
    if (!trip || !user?.id || !currentMember) return;
    if (!edge.fromUserId) {
      Alert.alert('Share manually', `${edge.fromName} has not joined AfterStay for this trip yet.`);
      return;
    }
    try {
      await notifySettlementReminder({
        tripId: trip.id,
        debtorUserId: edge.fromUserId,
        debtorMemberId: edge.fromMemberId,
        creditorName: displayBudgetMemberName(currentMember.name),
        amount: edge.amount,
        currency,
        requestedByUserId: user.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Reminder sent', `${edge.fromName} will see this in AfterStay.`);
    } catch {
      Alert.alert('Reminder not sent', 'Please try again later.');
    }
  }, [currentMember, currency, trip, user?.id]);

  const openPaymentQr = useCallback(() => {
    if (paymentQrs.length === 0) {
      Alert.alert('No payment QR yet', 'Add a payment QR from Budget so people can pay faster.');
      return;
    }
    setViewingQr(paymentQrs[0]);
  }, [paymentQrs]);

  const renderEdgeRow = (edge: BudgetDebtEdge, direction: 'owed' | 'owe') => {
    const name = direction === 'owed' ? edge.fromName : edge.toName;
    const subtitle = direction === 'owed' ? 'Owes you' : 'You owe';
    const hasAppAccount = direction === 'owed' ? !!edge.fromUserId : !!edge.toUserId;

    return (
      <View key={`${edge.fromMemberId}-${edge.toMemberId}`} style={styles.personRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{budgetMemberInitial(name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.personName} numberOfLines={1}>{name}</Text>
          <Text style={styles.personMeta}>{subtitle}{hasAppAccount ? '' : ' · note-only'}</Text>
        </View>
        <Text style={[styles.personAmount, direction === 'owed' ? styles.positive : styles.negative]}>
          {formatCurrency(edge.amount, currency)}
        </Text>
        {direction === 'owed' ? (
          <TouchableOpacity style={styles.outlineAction} onPress={() => handleRequest(edge)} activeOpacity={0.75}>
            <Text style={styles.outlineActionText}>{hasAppAccount ? 'Request' : 'Share'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.outlineAction} onPress={openPaymentQr} onLongPress={() => handleSettleEdge(edge)} activeOpacity={0.75}>
            <Text style={styles.outlineActionText}>Pay</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.75}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settle balances</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => Alert.alert('How settling works', 'Trip balances use shared expense splits. Personal balances are note-only unless the person has joined the trip or quick trip in AfterStay.')}
          activeOpacity={0.75}
        >
          <HelpCircle size={19} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentWrap}>
        {(['trip', 'personal'] as const).map((nextScope) => {
          const active = scope === nextScope;
          const disabled = nextScope === 'trip' && !trip;
          return (
            <TouchableOpacity
              key={nextScope}
              style={[styles.segmentButton, active && styles.segmentButtonActive, disabled && { opacity: 0.45 }]}
              onPress={() => !disabled && setScope(nextScope)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {nextScope === 'trip' ? `On Trip (${shortTripName(trip)})` : 'Personal'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading balances...</Text>
          </View>
        ) : scope === 'trip' ? (
          <>
            <View style={styles.totalCard}>
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>You are owed</Text>
                <Text style={[styles.totalAmount, styles.positive]}>{formatCurrency(summary.owedToUserTotal, currency)}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>You owe</Text>
                <Text style={[styles.totalAmount, styles.negative]}>{formatCurrency(summary.userOwesTotal, currency)}</Text>
              </View>
              <Text style={styles.totalFootnote}>All amounts are in {currency}</Text>
            </View>

            {!currentMember && members.length > 0 ? (
              <View style={styles.emptyCard}>
                <Users size={24} color={colors.text3} />
                <Text style={styles.emptyTitle}>We could not match your trip member</Text>
                <Text style={styles.emptyText}>Reopen the trip or rejoin with your account before settling balances.</Text>
              </View>
            ) : (
              <>
                <SectionTitle title="People who owe you" />
                {summary.owedToUser.length > 0 ? (
                  <View style={styles.cardList}>{summary.owedToUser.map((edge) => renderEdgeRow(edge, 'owed'))}</View>
                ) : (
                  <EmptyLine text="No one owes you right now." />
                )}

                <SectionTitle title="You owe" />
                {summary.userOwes.length > 0 ? (
                  <View style={styles.cardList}>{summary.userOwes.map((edge) => renderEdgeRow(edge, 'owe'))}</View>
                ) : (
                  <EmptyLine text="You are settled up." />
                )}

                {summary.betweenOthers.length > 0 && (
                  <>
                    <SectionTitle title="Between others" />
                    <View style={styles.cardList}>
                      {summary.betweenOthers.map((edge) => (
                        <View key={`${edge.fromMemberId}-${edge.toMemberId}`} style={styles.personRow}>
                          <View style={styles.avatarMuted}><Text style={styles.avatarMutedText}>{budgetMemberInitial(edge.fromName)}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.personName}>{edge.fromName} owes {edge.toName}</Text>
                            <Text style={styles.personMeta}>Visible to this trip group</Text>
                          </View>
                          <Text style={styles.personAmount}>{formatCurrency(edge.amount, currency)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.totalCard}>
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>Open personal splits</Text>
                <Text style={styles.totalAmount}>{personalOpenRows.length}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>Settled notes</Text>
                <Text style={styles.totalAmount}>{personalSettledRows.length}</Text>
              </View>
              <Text style={styles.totalFootnote}>Personal reminders are manual unless the person is an AfterStay user in a shared trip.</Text>
            </View>

            <SectionTitle title="Personal split notes" />
            {personalRows.length > 0 ? (
              <View style={styles.cardList}>
                {personalRows.map((row) => (
                  <View key={row.id} style={styles.personRow}>
                    <View style={row.status === 'settled' ? styles.avatarSettled : styles.avatar}>
                      {row.status === 'settled' ? <CheckCircle size={16} color={colors.success} /> : <Text style={styles.avatarText}>?</Text>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.personName} numberOfLines={1}>{row.title}</Text>
                      <Text style={styles.personMeta} numberOfLines={1}>{row.subtitle}</Text>
                    </View>
                    <Text style={styles.personAmount}>{formatCurrency(row.amount, row.currency)}</Text>
                    <View style={styles.disabledAction}>
                      <Text style={styles.disabledActionText}>{row.status === 'settled' ? 'Settled' : 'Share'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Users size={24} color={colors.text3} />
                <Text style={styles.emptyTitle}>No personal balances yet</Text>
                <Text style={styles.emptyText}>Add split Just Log It or quick-trip expenses, then they will appear here for manual review.</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.securityNote}>
          <ShieldCheck size={18} color={colors.success} />
          <Text style={styles.securityText}>Payments are private and secure. Trip balances stay visible only to people in that trip.</Text>
        </View>
      </ScrollView>

      <Modal visible={!!viewingQr} transparent animationType="fade" onRequestClose={() => setViewingQr(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setViewingQr(null)}>
          <View style={styles.qrCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{viewingQr?.label ?? 'Payment QR'}</Text>
              <TouchableOpacity onPress={() => setViewingQr(null)} hitSlop={10}>
                <X size={18} color={colors.text2} />
              </TouchableOpacity>
            </View>
            {viewingQr?.uri ? (
              <Image source={{ uri: viewingQr.uri }} style={styles.qrImage} resizeMode="contain" />
            ) : (
              <View style={styles.qrFallback}><QrCode size={52} color={colors.text3} /></View>
            )}
            <Text style={styles.qrHint}>Scan to pay, then long-press the row to mark settled.</Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );

  function SectionTitle({ title }: { title: string }) {
    return <Text style={styles.sectionTitle}>{title}</Text>;
  }

  function EmptyLine({ text }: { text: string }) {
    return (
      <View style={styles.emptyLine}>
        <Text style={styles.emptyLineText}>{text}</Text>
      </View>
    );
  }
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: c.text },
  segmentWrap: { flexDirection: 'row', marginHorizontal: 22, padding: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  segmentButton: { flex: 1, minHeight: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  segmentButtonActive: { backgroundColor: c.accent },
  segmentText: { fontSize: 13, fontWeight: '800', color: c.text2 },
  segmentTextActive: { color: '#fffaf0' },
  scroll: { flex: 1 },
  content: { padding: 22, gap: 18, paddingBottom: 120 },
  totalCard: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  totalCol: { flex: 1, minWidth: 120, alignItems: 'center' },
  totalDivider: { width: 1, height: 62, backgroundColor: c.border, marginHorizontal: 14 },
  totalLabel: { fontSize: 12, fontWeight: '800', color: c.text2 },
  totalAmount: { fontSize: 29, fontWeight: '900', color: c.text, marginTop: 7 },
  totalFootnote: { width: '100%', textAlign: 'center', fontSize: 11, color: c.text3, marginTop: 14 },
  positive: { color: c.success },
  negative: { color: c.danger },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: c.text, marginTop: 4, marginBottom: -8 },
  cardList: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, overflow: 'hidden' },
  personRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarMuted: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  avatarSettled: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.success + '18', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: '#fffaf0' },
  avatarMutedText: { fontSize: 16, fontWeight: '900', color: c.text2 },
  personName: { fontSize: 14, fontWeight: '800', color: c.text },
  personMeta: { fontSize: 12, fontWeight: '600', color: c.text3, marginTop: 2 },
  personAmount: { fontSize: 16, fontWeight: '900', color: c.text },
  outlineAction: { borderRadius: 14, borderWidth: 1, borderColor: c.accent, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.bg2 },
  outlineActionText: { fontSize: 12, fontWeight: '900', color: c.accent },
  disabledAction: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.card2 },
  disabledActionText: { fontSize: 12, fontWeight: '800', color: c.text3 },
  emptyLine: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16 },
  emptyLineText: { fontSize: 13, fontWeight: '700', color: c.text3 },
  emptyCard: { alignItems: 'center', gap: 8, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: c.text, textAlign: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600', color: c.text3, textAlign: 'center', lineHeight: 19 },
  securityNote: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: c.card2, padding: 16 },
  securityText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text2, lineHeight: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrCard: { width: '100%', borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg2, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: c.text },
  qrImage: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#fff' },
  qrFallback: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  qrHint: { fontSize: 12, fontWeight: '600', color: c.text3, textAlign: 'center', marginTop: 12 },
});
